// OpenAgenda : beaucoup de mairies, offices de tourisme et associations y publient leurs événements.
// Clé API → secret OPENAGENDA_KEY.
// - "agendas" (UID) dans config.json : agendas interrogés à coup sûr.
// - "discover" : mots-clés pour trouver automatiquement des agendas (ex. "Touraine") ;
//   la liste trouvée est écrite dans les logs pour pouvoir ensuite figer les bons UID.

import { fetchText } from '../lib/http.mjs';
import { isRelevant } from '../lib/normalize.mjs';

const API = 'https://api.openagenda.com/v2';
const tr = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v.fr ?? Object.values(v)[0] : v);

async function discoverAgendas(key, terms, log) {
  const found = new Map();
  for (const term of terms) {
    try {
      const url = new URL(`${API}/agendas`);
      url.searchParams.set('key', key);
      url.searchParams.set('search', term);
      url.searchParams.set('size', '50');
      const data = await fetchText(url.href, { json: true, checkRobots: false });
      for (const a of data.agendas ?? data.items ?? []) {
        if (!found.has(a.uid)) found.set(a.uid, a);
      }
    } catch (e) {
      log(`  découverte "${term}" → ${e.message}`);
    }
  }
  for (const a of found.values()) log(`  [agenda] ${a.uid} | ${tr(a.title)} | https://openagenda.com/${a.slug ?? ''}`);
  return [...found.keys()];
}

export async function run(source, { log }) {
  const key = process.env.OPENAGENDA_KEY;
  if (!key) {
    log('  OPENAGENDA_KEY absent : source ignorée');
    return [];
  }
  const agendas = new Set(source.agendas ?? []);
  if (source.discover?.length) {
    const found = await discoverAgendas(key, source.discover, log);
    found.slice(0, source.maxDiscovered ?? 40).forEach((uid) => agendas.add(uid));
  }
  log(`  ${agendas.size} agenda(s) interrogé(s)`);

  const raws = [];
  const seen = new Set();
  for (const uid of agendas) {
    let n = 0;
    for (const term of source.searchTerms ?? ['brocante', 'vide-grenier', 'braderie', 'puces', 'bourse']) {
      let after = null;
      for (let page = 0; page < 5; page++) {
        const url = new URL(`${API}/agendas/${uid}/events`);
        url.searchParams.set('key', key);
        url.searchParams.set('size', '100');
        url.searchParams.set('relative[]', 'upcoming');
        url.searchParams.set('detailed', '1');
        url.searchParams.set('search', term);
        if (after) after.forEach((a) => url.searchParams.append('after[]', a));
        let data;
        try {
          data = await fetchText(url.href, { json: true, checkRobots: false });
        } catch (e) {
          log(`  agenda ${uid} "${term}" → ${e.message}`);
          break;
        }
        for (const ev of data.events ?? []) {
          if (seen.has(`${uid}/${ev.uid}`)) continue;
          seen.add(`${uid}/${ev.uid}`);
          const title = tr(ev.title);
          const desc = tr(ev.longDescription) ?? tr(ev.description) ?? '';
          const keywords = [].concat(tr(ev.keywords) ?? []).join(' ');
          if (!isRelevant(`${title} ${desc} ${keywords}`)) continue;
          const loc = ev.location ?? {};
          for (const t of ev.timings?.length ? ev.timings : [{ begin: ev.firstTiming?.begin, end: ev.lastTiming?.end }]) {
            raws.push({
              title,
              description: tr(ev.description) ?? desc,
              start: t.begin,
              end: t.end,
              address: loc.address,
              postcode: loc.postalCode,
              city: loc.city,
              lat: loc.latitude,
              lon: loc.longitude,
              url: `https://openagenda.com/agendas/${uid}/events/${ev.slug ?? ev.uid}`,
            });
            n++;
          }
        }
        if (!data.after || !(data.events ?? []).length) break;
        after = data.after;
      }
    }
    if (n) log(`  agenda ${uid} → ${n} événement(s) pertinent(s)`);
  }
  return raws;
}
