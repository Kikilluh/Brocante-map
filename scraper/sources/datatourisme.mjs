// DATAtourisme : plateforme nationale de données touristiques ouvertes (Licence Ouverte).
//
// Deux modes :
//  1. API (recommandé, seul mode possible pour les nouveaux comptes depuis octobre 2026)
//     clé gratuite → secret DATATOURISME_API_KEY ; endpoint https://api.datatourisme.fr/v1/catalog
//  2. Ancien flux "Diffuseur" (fermeture en octobre 2027) → secret DATATOURISME_FEED_URL
//
// Le format exact des réponses de l'API n'a pas pu être vérifié lors de l'écriture :
// le code accepte plusieurs formes (avec/sans préfixes "schema:", listes paginées diverses)
// et journalise la structure reçue au premier appel pour faciliter l'ajustement.

import { fetchText } from '../lib/http.mjs';
import { isRelevant, deptFromPostcode } from '../lib/normalize.mjs';

const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

/** Texte en français depuis une valeur multilingue (string, {fr:[..]}, {fr:".."}, {"@value"}, [...]). */
export function fr(v) {
  if (v == null) return null;
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return fr(v.find((x) => x?.['@language'] === 'fr') ?? v[0]);
  if (v['@value'] != null) return String(v['@value']);
  for (const k of ['fr', '@fr', 'fr-FR', 'value']) if (v[k] != null) return fr(v[k]);
  const first = Object.values(v)[0];
  return first != null && typeof first !== 'object' ? String(first) : fr(first);
}

/** Lit une propriété avec ou sans préfixe (schema:, rdfs:, :). */
function get(o, ...names) {
  if (!o || typeof o !== 'object') return undefined;
  for (const n of names) {
    for (const k of [n, `schema:${n}`, `rdfs:${n}`, `:${n}`, `dt:${n}`]) if (o[k] != null) return o[k];
  }
  return undefined;
}

/** Convertit un objet DATAtourisme en événements "bruts" (un par période). */
export function mapNode(n) {
  const title = fr(get(n, 'label', 'name', 'title'));
  const types = arr(get(n, '@type', 'type', 'types')).map((t) => (typeof t === 'object' ? fr(t['@id'] ?? t.label ?? t) : t)).join(' ');
  const desc = fr(get(n, 'comment', 'description', 'shortDescription')) ?? fr(get(arr(get(n, 'hasDescription'))[0], 'shortDescription', 'description'));
  if (!title) return [];
  if (!(isRelevant(`${title} ${types} ${desc ?? ''}`) || /SaleEvent|Brocante|VideGrenier|FleaMarket/i.test(types))) return [];

  const loc = arr(get(n, 'isLocatedAt', 'location', 'place'))[0] ?? {};
  const addr = arr(get(loc, 'address') ?? get(n, 'address'))[0] ?? {};
  const geo = arr(get(loc, 'geo') ?? get(n, 'geo'))[0] ?? {};
  const cityNode = arr(get(addr, 'hasAddressCity', 'city'))[0];
  const city = typeof cityNode === 'object' ? fr(get(cityNode, 'label', 'name')) : fr(cityNode);
  const postcode = fr(get(addr, 'postalCode', 'postcode', 'zipCode'));
  const contact = arr(get(n, 'hasContact', 'contact'))[0] ?? {};
  const url = fr(get(contact, 'homepage', 'foaf:homepage', 'url', 'website'));

  const base = {
    title,
    description: desc,
    address: arr(get(addr, 'streetAddress', 'street')).map(fr).filter(Boolean).join(', ') || null,
    postcode,
    city: city ?? fr(get(addr, 'addressLocality', 'locality')),
    dept: postcode ? deptFromPostcode(postcode) : null,
    lat: fr(get(geo, 'latitude', 'lat')),
    lon: fr(get(geo, 'longitude', 'lon', 'lng')),
    url,
  };
  const periods = arr(get(n, 'takesPlaceAt', 'periods', 'dates'));
  if (!periods.length) return [{ ...base, start: fr(get(n, 'startDate')), end: fr(get(n, 'endDate')) }];
  return periods.map((p) => {
    const st = fr(get(p, 'startTime'));
    const et = fr(get(p, 'endTime'));
    return {
      ...base,
      start: fr(get(p, 'startDate', 'start')),
      end: fr(get(p, 'endDate', 'end')),
      hours: st ? `${st.slice(0, 5)}${et ? '–' + et.slice(0, 5) : ''}` : null,
    };
  });
}

/** Extrait la liste d'objets d'une réponse, quelle que soit sa forme. */
export function listOf(data) {
  if (Array.isArray(data)) return data;
  for (const k of ['objects', 'data', 'results', 'items', 'hits', 'catalog', '@graph', 'hydra:member', 'member']) {
    if (Array.isArray(data?.[k])) return data[k];
  }
  return [];
}

function nextUrl(data, current) {
  const n = data?.meta?.next ?? data?.links?.next ?? data?.next ?? data?.['hydra:view']?.['hydra:next'] ?? data?.view?.next;
  if (typeof n === 'string' && n) return new URL(n, current).href;
  if (n && typeof n === 'object' && n.href) return new URL(n.href, current).href;
  return null;
}

async function runApi(source, { departments, log }) {
  const key = process.env.DATATOURISME_API_KEY;
  const base = source.apiUrl ?? 'https://api.datatourisme.fr/v1/catalog';
  const pageSize = source.pageSize ?? 100;
  const raws = [];
  const seen = new Set();
  let logged = false;
  let loggedDetail = false;

  for (const term of source.searchTerms ?? ['brocante']) {
    let url = new URL(base);
    url.searchParams.set('api_key', key);
    url.searchParams.set('search', term);
    for (const [k, v] of Object.entries(source.extraParams ?? {})) url.searchParams.set(k, v);
    url.searchParams.set(source.pageSizeParam ?? 'page_size', String(pageSize));
    let page = 1;
    let count = 0;
    while (url && page <= (source.maxPagesPerTerm ?? 30)) {
      const data = await fetchText(url.href, { json: true, checkRobots: false, headers: { 'X-API-KEY': key } });
      const items = listOf(data);
      if (!logged) {
        logged = true;
        log(`  [diagnostic] clés de la réponse : ${Object.keys(data ?? {}).join(', ') || '(tableau)'}`);
        if (items[0]) log(`  [diagnostic] clés d'un objet : ${Object.keys(items[0]).join(', ')}`);
      }
      if (!items.length) break;
      for (const n of items) {
        const id = n['@id'] ?? n.uuid ?? n.id ?? JSON.stringify(n).slice(0, 200);
        if (seen.has(id)) continue;
        seen.add(id);
        let mapped = mapNode(n);
        // filtre géographique côté client (l'API cherche dans toute la France)
        mapped = mapped.filter((r) => !r.dept || departments.includes(r.dept));
        if (!mapped.length) continue;
        // La liste ne contient pas les dates (takesPlaceAt) : on lit la fiche complète.
        if (mapped.every((r) => !r.start) && n.uuid) {
          try {
            const detailUrl = new URL(`${base.replace(/\/$/, '')}/${n.uuid}`);
            detailUrl.searchParams.set('api_key', key);
            const raw = await fetchText(detailUrl.href, { json: true, checkRobots: false, headers: { 'X-API-KEY': key } });
            const full = raw?.object ?? raw?.data ?? listOf(raw)[0] ?? raw;
            if (!loggedDetail) {
              loggedDetail = true;
              log(`  [diagnostic] clés d'une fiche : ${Object.keys(full ?? {}).join(', ')}`);
            }
            mapped = mapNode({ ...n, ...full }).filter((r) => !r.dept || departments.includes(r.dept));
          } catch (e) {
            log(`  fiche ${n.uuid} → ${e.message}`);
          }
        }
        const dated = mapped.filter((r) => r.start);
        if (mapped.length && !dated.length) log(`  sans date (ignoré) : ${mapped[0].title} – ${mapped[0].city ?? '?'}`);
        raws.push(...dated);
        count += dated.length;
      }
      const next = nextUrl(data, url.href);
      if (next) {
        url = new URL(next);
        if (!url.searchParams.has('api_key')) url.searchParams.set('api_key', key);
      } else if (items.length >= pageSize) {
        url.searchParams.set(source.pageParam ?? 'page', String(page + 1));
      } else {
        url = null;
      }
      page++;
    }
    log(`  recherche "${term}" → ${count} événements dans la zone`);
  }
  return raws;
}

async function runLegacyFeed(feed) {
  const data = await fetchText(feed, { json: true, checkRobots: false });
  return listOf(data).length ? listOf(data).flatMap(mapNode) : arr(data).flatMap(mapNode);
}

export async function run(source, ctx) {
  if (process.env.DATATOURISME_API_KEY) return runApi(source, ctx);
  if (process.env.DATATOURISME_FEED_URL) return runLegacyFeed(process.env.DATATOURISME_FEED_URL);
  ctx.log('  DATATOURISME_API_KEY absent : source ignorée');
  return [];
}
