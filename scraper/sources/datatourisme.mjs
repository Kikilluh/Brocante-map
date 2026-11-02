// DATAtourisme : plateforme nationale des données touristiques (offices de tourisme), Licence Ouverte.
// Doc : https://api.datatourisme.fr/v1/docs — clé API → secret DATATOURISME_API_KEY.
//
// On interroge l'endpoint pré-filtré /entertainmentAndEvent (fêtes et manifestations) avec un filtre
// département + date de fin ≥ aujourd'hui, et on demande directement les champs utiles (dates, prix,
// public, jauge) : pas besoin de lire chaque fiche une par une.
// Ancien mode "flux Diffuseur" (fermeture oct. 2027) conservé : secret DATATOURISME_FEED_URL.

import { fetchText } from '../lib/http.mjs';
import { splitVenue } from '../lib/venues.mjs';
import { isEventUrl } from '../lib/normalize.mjs';

const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const DAY_NAMES = [/Sunday|dimanche/i, /Monday|lundi/i, /Tuesday|mardi/i, /Wednesday|mercredi/i, /Thursday|jeudi/i, /Friday|vendredi/i, /Saturday|samedi/i];
const FR_DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
/**
 * Jours de la semaine écrits dans un texte : « tous les mardis », « chaque samedi », « le jeudi matin »,
 * « les mercredis et samedis ». Une date précise (« le samedi 12 novembre ») ne compte pas.
 */
export function weekdaysFromText(text = '') {
  const t = String(text).toLowerCase();
  const days = new Set();
  const re = /\b(tous les|chaque|les|le)\s+((?:(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)s?(?:\s*(?:,|et|&)\s*)?)+)(?!\s*\d)/g;
  for (const m of t.matchAll(re)) {
    const list = m[2];
    // « le samedi » seul n'est retenu que s'il est suivi d'un moment de la journée (« le samedi matin »)
    if (m[1] === 'le' && !/^\s*(matin|midi|après-midi|apres-midi|soir)/.test(t.slice(m.index + m[0].length))) continue;
    FR_DAYS.forEach((d, i) => { if (new RegExp(`\\b${d}s?\\b`).test(list)) days.add(i); });
  }
  return days.size && days.size < 7 ? [...days].sort() : null;
}
/** Nom de jour seul dans un titre (« Marché de Courtenay - Samedi »), hors date précise (« samedi 12 »). */
export function weekdaysInTitle(title = '') {
  const t = String(title).toLowerCase();
  const days = FR_DAYS.map((d, i) => (new RegExp(`\\b${d}s?\\b(?!\\s*\\d)`).test(t) ? i : -1)).filter((i) => i >= 0);
  return days.length && days.length < 7 ? days : null;
}
/** Jours de la semaine (0 = dimanche … 6 = samedi) d'une période DATAtourisme, ou null si non précisés. */
export function weekdaysOf(v) {
  if (v == null) return null;
  const text = JSON.stringify(v);
  const days = DAY_NAMES.map((re, i) => (re.test(text) ? i : -1)).filter((i) => i >= 0);
  return days.length && days.length < 7 ? days : null;
}

/** Texte en français depuis une valeur multilingue (string, {"@fr":..}, {fr:[..]}, [...]). */
export function fr(v) {
  if (v == null) return null;
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return fr(v.find((x) => x?.['@language'] === 'fr') ?? v[0]);
  if (v['@value'] != null) return String(v['@value']);
  for (const k of ['@fr', 'fr', 'fr-FR', '@en', 'en', 'value']) if (v[k] != null) return fr(v[k]);
  const first = Object.values(v)[0];
  return first != null && typeof first !== 'object' ? String(first) : fr(first);
}

/** Lit une propriété avec ou sans préfixe (schema:, rdfs:, :). */
export function get(o, ...names) {
  if (!o || typeof o !== 'object') return undefined;
  for (const n of names) {
    for (const k of [n, `schema:${n}`, `rdfs:${n}`, `:${n}`, `dt:${n}`]) if (o[k] != null) return o[k];
  }
  return undefined;
}

const numOrNull = (v) => (v == null || v === '' || !Number.isFinite(Number(fr(v))) ? null : Number(fr(v)));
const minOf = (xs) => (xs.length ? Math.min(...xs) : null);
const maxOf = (xs) => (xs.length ? Math.max(...xs) : null);

/** Prix depuis offers[].priceSpecification[]. */
export function readPrices(n) {
  const specs = arr(get(n, 'offers')).flatMap((o) => arr(get(o, 'priceSpecification')));
  const values = [];
  let freeHint = false;
  const texts = [];
  for (const s of specs) {
    for (const k of ['minPrice', 'maxPrice', 'price']) {
      const x = numOrNull(get(s, k));
      if (x != null) values.push(x);
    }
    const label = [fr(get(s, 'name')), fr(get(get(s, 'hasPricingOffer') ?? {}, 'label')), fr(get(get(s, 'hasPricingMode') ?? {}, 'label')), fr(get(s, 'additionalInformation'))]
      .filter(Boolean)
      .join(' ');
    if (/gratuit|free/i.test(label)) freeHint = true;
    texts.push(label);
  }
  for (const o of arr(get(n, 'offers'))) texts.push(fr(get(o, 'textPriceSpecification')) ?? '');
  const out = { conditions: texts.filter(Boolean).join(' ') || null };
  if (values.length) {
    out.priceMin = freeHint ? 0 : minOf(values);
    out.priceMax = maxOf(values);
  } else if (freeHint) {
    out.priceMin = 0;
    out.priceMax = 0;
  }
  return out;
}

/** Âges et taille de groupe depuis hasClientTarget / isDedicatedTo. */
function readAudience(n) {
  const targets = [...arr(get(n, 'hasClientTarget')), ...arr(get(n, 'hasDescription')).flatMap((d) => arr(get(d, 'isDedicatedTo')))];
  const mins = [];
  const maxs = [];
  const labels = [];
  let maxPersons = null;
  for (const t of targets) {
    const mi = numOrNull(get(t, 'requiredMinAge')) ?? numOrNull(get(t, 'suggestedMinAge'));
    const ma = numOrNull(get(t, 'requiredMaxAge')) ?? numOrNull(get(t, 'suggestedMaxAge'));
    if (mi != null) mins.push(mi);
    // un âge maximum de 18 ans ou plus est un public tarifaire (« jeunes de moins de 26 ans »), pas une limite
    if (ma != null && ma < 18) maxs.push(ma);
    const mp = numOrNull(get(t, 'requiredMaxPersonCount'));
    if (mp != null) maxPersons = maxPersons == null ? mp : Math.max(maxPersons, mp);
    const l = fr(get(t, 'label'));
    if (l) labels.push(l);
  }
  return {
    // l'événement accepte des personnes dès le plus petit âge minimum cité, jusqu'au plus grand âge maximum
    ageMin: minOf(mins),
    ageMax: maxs.length === targets.length && maxs.length ? maxOf(maxs) : null,
    capacity: numOrNull(get(n, 'allowedPersons')) ?? maxPersons,
    audience: labels.join(', ') || null,
  };
}

/** Image principale (hasMainRepresentation) avec ses crédits ; ignorée si ses droits ont expiré. */
export function readImage(n) {
  const today = new Date().toISOString().slice(0, 10);
  for (const rep of arr(get(n, 'hasMainRepresentation'))) {
    const ann = arr(get(rep, 'hasAnnotation'))[0] ?? {};
    const end = fr(get(ann, 'rightsEndDate'));
    if (end && end.slice(0, 10) < today) continue;
    for (const res of arr(get(rep, 'hasRelatedResource'))) {
      const url = arr(get(res, 'locator')).map(fr).find((u) => /^https?:\/\//.test(u ?? ''));
      const mime = fr(get(arr(get(res, 'hasMimeType'))[0] ?? {}, 'label')) ?? '';
      if (url && (/image/i.test(mime) || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url))) {
        return { image: url, imageCredit: fr(get(ann, 'credits')) };
      }
    }
  }
  return {};
}

/** Convertit un objet DATAtourisme en un événement "brut" (avec toutes ses dates). */
export function mapNode(n) {
  const title = fr(get(n, 'label', 'name', 'title'));
  if (!title) return [];
  const types = arr(get(n, '@type', 'type')).map((t) => (typeof t === 'object' ? fr(t['@id'] ?? t.label ?? t) : t)).join(' ');
  const descNode = arr(get(n, 'hasDescription'))[0];
  const desc = fr(get(n, 'comment', 'description')) ?? fr(get(descNode, 'shortDescription')) ?? fr(get(descNode, 'description'));

  const loc = arr(get(n, 'isLocatedAt', 'location', 'place'))[0] ?? {};
  const addr = arr(get(loc, 'address') ?? get(n, 'address'))[0] ?? {};
  const geo = arr(get(loc, 'geo') ?? get(n, 'geo'))[0] ?? {};
  const cityNode = arr(get(addr, 'hasAddressCity', 'city'))[0];
  const city = (typeof cityNode === 'object' ? fr(get(cityNode, 'label', 'name')) : fr(cityNode)) ?? fr(get(addr, 'addressLocality', 'locality'));
  const postcode = fr(get(addr, 'postalCode', 'postcode', 'zipCode'));
  const contact = arr(get(n, 'hasContact', 'contact'))[0] ?? {};
  const url = fr(get(contact, 'homepage', 'foaf:homepage', 'url', 'website'));
  const organizer = fr(get(contact, 'legalName'));
  const { venue, address } = splitVenue(arr(get(addr, 'streetAddress', 'street')).map(fr).filter(Boolean));
  const creator = get(n, 'hasBeenCreatedBy');
  const credit = fr(get(arr(creator)[0] ?? {}, 'legalName'));

  const occurrences = arr(get(n, 'takesPlaceAt', 'periods', 'dates')).map((p) => {
    const st = fr(get(p, 'startTime'));
    const et = fr(get(p, 'endTime'));
    const hhmm = (x) => (x && /\d{2}:\d{2}/.test(x) ? x.match(/\d{2}:\d{2}/)[0] : null);
    return {
      start: fr(get(p, 'startDate', 'start')),
      end: fr(get(p, 'endDate', 'end')),
      hours: hhmm(st) ? `${hhmm(st)}${hhmm(et) ? '–' + hhmm(et) : ''}` : null,
      // jours de la semaine (« tous les mardis » sur une longue période) : appliesOnDay
      days: weekdaysOf(get(p, 'appliesOnDay')),
    };
  });
  // Jours non précisés sur une longue période : on les cherche dans le titre et la description
  const textDays = weekdaysFromText(`${title} ${desc ?? ''}`) ?? weekdaysInTitle(title);
  if (textDays) for (const o of occurrences) if (!o.days && o.start && o.end && (Date.parse(o.end) - Date.parse(o.start)) / 864e5 > 14) o.days = textDays;
  if (!occurrences.length) {
    const s = fr(get(n, 'startDate'));
    if (s) occurrences.push({ start: s, end: fr(get(n, 'endDate')) });
  }
  if (!occurrences.length) return [];

  return [
    {
      title,
      types,
      description: desc,
      occurrences,
      venue,
      address,
      organizer,
      postcode,
      city,
      lat: fr(get(geo, 'latitude', 'lat')),
      lon: fr(get(geo, 'longitude', 'lon', 'lng')),
      periodsRaw: arr(get(n, 'takesPlaceAt', 'periods', 'dates')).slice(0, 2),
      url,
      // hasContact.homepage = souvent le site général de l'organisateur, pas la page de l'événement
      urlKind: url && !isEventUrl(url, title) ? 'site' : null,
      credit,
      ...readPrices(n),
      ...readAudience(n),
      ...readImage(n),
    },
  ];
}

/** Extrait la liste d'objets d'une réponse, quelle que soit sa forme. */
export function listOf(data) {
  if (Array.isArray(data)) return data;
  for (const k of ['objects', 'data', 'results', 'items', '@graph']) if (Array.isArray(data?.[k])) return data[k];
  return [];
}

const FIELDS = [
  'uuid', 'label', 'type', 'isLocatedAt.geo', 'isLocatedAt.address', 'takesPlaceAt', 'takesPlaceAt.startDate', 'takesPlaceAt.endDate', 'takesPlaceAt.startTime', 'takesPlaceAt.endTime', 'takesPlaceAt.appliesOnDay', 'offers', 'hasDescription',
  'hasContact.homepage', 'hasContact.legalName', 'hasMainRepresentation', 'hasClientTarget', 'allowedPersons', 'hasTheme', 'hasBeenCreatedBy.legalName',
].join(',');

async function runApi(source, { departments, log }) {
  const key = process.env.DATATOURISME_API_KEY;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const base = source.apiUrl ?? 'https://api.datatourisme.fr/v1/entertainmentAndEvent';
  const headers = { 'X-API-Key': key };
  const raws = [];
  const deptList = departments.map((d) => (/^\d$/.test(d) ? `0${d}` : d)).join(',');
  let url = new URL(base);
  url.searchParams.set('filters', `isLocatedAt.address.hasAddressCity.isPartOfDepartment.insee[in]=${deptList} AND takesPlaceAt.endDate[gte]=${today}`);
  url.searchParams.set('fields', source.fields ?? FIELDS);
  url.searchParams.set('lang', 'fr');
  url.searchParams.set('page_size', String(source.pageSize ?? 100));
  let page = 0;
  let total = null;
  while (url && page < (source.maxPages ?? 100)) {
    const data = await fetchText(url.href, { json: true, checkRobots: false, headers, delayMs: 400 });
    total ??= data?.meta?.total;
    const items = listOf(data);
    for (const n of items) raws.push(...mapNode(n));
    page++;
    const next = data?.meta?.next;
    url = next && items.length ? new URL(next, base) : null;
  }
  log(`  ${raws.length} événements lus (${total ?? '?'} annoncés par l'API, ${page} page(s))`);
  return raws;
}

async function runLegacyFeed(feed) {
  const data = await fetchText(feed, { json: true, checkRobots: false });
  return (listOf(data).length ? listOf(data) : arr(data)).flatMap(mapNode);
}

export async function run(source, ctx) {
  if (process.env.DATATOURISME_API_KEY) return runApi(source, ctx);
  if (process.env.DATATOURISME_FEED_URL) return runLegacyFeed(process.env.DATATOURISME_FEED_URL);
  ctx.log('  DATATOURISME_API_KEY absent : source ignorée');
  return [];
}
