// OpenAgenda : agendas de mairies, musées, offices de tourisme, événements nationaux (patrimoine, musées…).
// Clé API → secret OPENAGENDA_KEY. Agendas suivis : "agendas" (UID) dans config.json.
// On ne garde que les événements situés dans les départements couverts et publiés sous licence ouverte
// (chaque événement OpenAgenda porte sa licence dans rights.license).

import { fetchText } from '../lib/http.mjs';
import { deptFromPostcode } from '../lib/normalize.mjs';
import { DEPT_NAMES } from '../lib/store.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const CACHE = join(dirname(fileURLToPath(import.meta.url)), '..', 'cache');
const readJson = async (f, d) => { try { return JSON.parse(await readFile(f, 'utf8')); } catch { return d; } };
const MONTH = 30 * 864e5;

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
    venue: loc.name ?? null,
    address: loc.address,
    postcode: loc.postalCode,
    city: loc.city,
    lat: loc.latitude,
    lon: loc.longitude,
    ageMin: ev.age?.min ?? null,
    ageMax: ev.age?.max ?? null,
    url: ev.canonicalUrl ?? `https://openagenda.com/agendas/${uid}/events/${ev.slug ?? ev.uid}`,
    credit: ev.rights?.licensor?.name ?? null,
    image: ev.image?.base && ev.image?.filename ? `${ev.image.base}${ev.image.filename}` : null,
    imageCredit: tr(ev.imageCredits) ?? null,
  };
}

/** Agendas à interroger : liste simple, ou par région ({ "*": nationaux, "<groupe>": [...] }). */
async function agendasFor(source, departments) {
  const a = source.agendas ?? [];
  if (Array.isArray(a)) return a;
  const { loadConfig } = await import('../lib/config.mjs');
  const groups = Object.entries((await loadConfig()).groups ?? {}).filter(([, ds]) => ds.some((d) => departments.includes(d))).map(([g]) => g);
  return [...(a['*'] ?? []), ...groups.flatMap((g) => a[g] ?? [])];
}

export async function run(source, { departments, log }) {
  const key = process.env.OPENAGENDA_KEY;
  if (!key) {
    log('  OPENAGENDA_KEY absent : source ignorée');
    return [];
  }
  const agendas = new Set(await agendasFor(source, departments));
  if (source.discover?.length) {
    const found = await discoverAgendas(key, source.discover, log);
    found.slice(0, source.maxDiscovered ?? 40).forEach((uid) => agendas.add(uid));
  }
  // Découverte automatique par département (recherche du nom du département), refaite tous les 30 jours.
  // Un agenda découvert qui n'a donné aucun événement dans la zone est mis de côté 30 jours.
  const fixed = new Set(agendas);
  const yields = await readJson(join(CACHE, 'oa-yield.json'), {});
  if (source.discoverPerDept) {
    await mkdir(CACHE, { recursive: true });
    for (const d of departments) {
      const file = join(CACHE, `oa-discover-${d}.json`);
      let disc = await readJson(file, null);
      if (!disc || Date.now() - disc.at > MONTH) {
        const uids = (await discoverAgendas(key, [DEPT_NAMES[d] ?? d], log)).slice(0, source.maxPerDept ?? 12);
        disc = { at: Date.now(), uids };
        await writeFile(file, JSON.stringify(disc));
      }
      for (const uid of disc.uids) {
        const y = yields[uid];
        if (y && y.n === 0 && Date.now() - y.at < MONTH) continue;
        agendas.add(uid);
      }
    }
    log(`  ${agendas.size - fixed.size} agenda(s) découvert(s) automatiquement`);
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
    if (!fixed.has(uid)) yields[uid] = { at: Date.now(), n };
  }
  if (source.discoverPerDept) await writeFile(join(CACHE, 'oa-yield.json'), JSON.stringify(yields));
  if (closed) log(`  ${closed} événement(s) écarté(s) : licence non ouverte`);
  return raws;
}
