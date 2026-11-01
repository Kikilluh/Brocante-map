// OpenAgenda : agendas de mairies, musées, offices de tourisme, événements nationaux (patrimoine, musées…).
// Clé API → secret OPENAGENDA_KEY. Agendas suivis : "agendas" (UID) dans config.json.
// On ne garde que les événements situés dans les départements couverts et publiés sous licence ouverte
// (chaque événement OpenAgenda porte sa licence dans rights.license).

import { fetchText } from '../lib/http.mjs';
import { deptFromPostcode } from '../lib/normalize.mjs';

const API = 'https://api.openagenda.com/v2';
const tr = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v.fr ?? Object.values(v)[0] : v);
const OPEN_LICENSE = /etalab|licence ouverte|cc-by|cc by|odbl|cc0|public domain/i;

async function discoverAgendas(key, terms, log) {
  const found = new Map();
  for (const term of terms) {
    try {
      const url = new URL(`${API}/agendas`);
      url.searchParams.set('key', key);
      url.searchParams.set('search', term);
      url.searchParams.set('size', '50');
      const data = await fetchText(url.href, { json: true, checkRobots: false, delayMs: 300 });
      for (const a of data.agendas ?? data.items ?? []) if (!found.has(a.uid)) found.set(a.uid, a);
    } catch (e) {
      log(`  découverte "${term}" → ${e.message}`);
    }
  }
  for (const a of found.values()) log(`  [agenda] ${a.uid} | ${tr(a.title)} | https://openagenda.com/${a.slug ?? ''}`);
  return [...found.keys()];
}

/** Convertit un événement OpenAgenda en événement "brut". */
export function mapEvent(ev, uid) {
  const loc = ev.location ?? {};
  const keywords = [].concat(tr(ev.keywords) ?? []).join(' ');
  const conditions = tr(ev.conditions) ?? '';
  return {
    title: tr(ev.title),
    description: tr(ev.description) ?? tr(ev.longDescription),
    conditions,
    types: keywords,
    occurrences: (ev.timings?.length ? ev.timings : [{ begin: ev.firstTiming?.begin, end: ev.lastTiming?.end }]).map((t) => ({
      start: t.begin,
      end: t.end,
      hours: t.begin && /T\d{2}:\d{2}/.test(t.begin)
        ? `${t.begin.slice(11, 16)}${t.end && /T\d{2}:\d{2}/.test(t.end) ? '–' + t.end.slice(11, 16) : ''}`.replace(':', 'h').replace(':', 'h')
        : null,
    })),
    address: loc.address,
    postcode: loc.postalCode,
    city: loc.city,
    lat: loc.latitude,
    lon: loc.longitude,
    ageMin: ev.age?.min ?? null,
    ageMax: ev.age?.max ?? null,
    url: ev.canonicalUrl ?? `https://openagenda.com/agendas/${uid}/events/${ev.slug ?? ev.uid}`,
    credit: ev.rights?.licensor?.name ?? null,
  };
}

export async function run(source, { departments, log }) {
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
  let closed = 0;
  for (const uid of agendas) {
    let n = 0;
    let after = null;
    for (let page = 0; page < (source.maxPages ?? 10); page++) {
      const url = new URL(`${API}/agendas/${uid}/events`);
      url.searchParams.set('key', key);
      url.searchParams.set('size', '100');
      url.searchParams.append('relative[]', 'current');
      url.searchParams.append('relative[]', 'upcoming');
      url.searchParams.set('detailed', '1');
      if (after) after.forEach((a) => url.searchParams.append('after[]', a));
      let data;
      try {
        data = await fetchText(url.href, { json: true, checkRobots: false, delayMs: 300 });
      } catch (e) {
        log(`  agenda ${uid} → ${e.message}`);
        break;
      }
      for (const ev of data.events ?? []) {
        if (seen.has(ev.uid)) continue;
        seen.add(ev.uid);
        const dept = deptFromPostcode(ev.location?.postalCode);
        if (dept && !departments.includes(dept)) continue;
        const license = `${ev.rights?.license?.id ?? ''} ${ev.rights?.license?.name ?? ''}`;
        if (!OPEN_LICENSE.test(license)) {
          closed++;
          continue;
        }
        raws.push(mapEvent(ev, uid));
        n++;
      }
      if (!data.after || !(data.events ?? []).length) break;
      after = data.after;
    }
    if (n) log(`  agenda ${uid} → ${n} événement(s) dans la zone`);
  }
  if (closed) log(`  ${closed} événement(s) écarté(s) : licence non ouverte`);
  return raws;
}
