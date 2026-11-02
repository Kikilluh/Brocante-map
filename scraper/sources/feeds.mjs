// Agendas des collectivités (mairies, intercommunalités, offices de tourisme publics) : flux iCal, API
// « The Events Calendar » de WordPress ou événements en données structurées (schema.org) sur leurs pages.
//
// Cadre : les informations publiées par une administration sont librement réutilisables (code des relations
// entre le public et l'administration, art. L321-1), avec mention de la source. On ne reprend que les faits
// (titre, dates, lieu, lien vers la page d'origine) et un court extrait, pas les affiches ni les photos.
// robots.txt est respecté (fetchText).
//
// config.json : { "type": "feeds", "sites": [ { "name", "url", "dept", "city"?, "feed"? } ] }
//  - url  : page d'accueil ou page agenda du site ; le flux est cherché automatiquement (résultat en cache)
//  - feed : adresse du flux si on la connaît (iCal, JSON « tribe » ou page avec données structurées)
//  - city : commune par défaut (site d'une mairie) ; sinon la commune est cherchée dans le titre / le lieu

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchText } from '../lib/http.mjs';
import { extractEvents } from '../lib/jsonld.mjs';

const CACHE = join(dirname(fileURLToPath(import.meta.url)), '..', 'cache');
const readJson = async (f, d) => { try { return JSON.parse(await readFile(f, 'utf8')); } catch { return d; } };
const WEEK = 7 * 864e5;
const norm = (s = '') => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’-]/g, ' ').replace(/\s+/g, ' ');

// ---------- iCal ----------
const ICAL_DAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const unescapeIcs = (v = '') => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
/** Date iCal → { day: 'AAAA-MM-JJ', time: 'HH:MM' | null } en heure de Paris. */
function icsDate(value, params = '') {
  const m = String(value).match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (!h || /VALUE=DATE(?!-)/.test(params)) return { day: `${y}-${mo}-${d}`, time: null };
  if (z) {
    // UTC → heure de Paris
    const dt = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(dt).map((p) => [p.type, p.value]));
    return { day: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
  }
  return { day: `${y}-${mo}-${d}`, time: `${h}:${mi}` };
}
const minusDay = (day) => new Date(Date.parse(`${day}T12:00:00Z`) - 864e5).toISOString().slice(0, 10);

/** Lit un calendrier iCal : [{ title, description, location, url, geo, categories, occurrences }]. */
export function parseIcs(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const out = [];
  let ev = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { ev = {}; continue; }
    if (line === 'END:VEVENT') { if (ev) out.push(ev); ev = null; continue; }
    if (!ev) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const [name, ...params] = line.slice(0, i).split(';');
    ev[name.toUpperCase()] = { value: line.slice(i + 1), params: params.join(';') };
  }
  return out.map((e) => {
    const s = e.DTSTART && icsDate(e.DTSTART.value, e.DTSTART.params);
    if (!s) return null;
    let en = e.DTEND && icsDate(e.DTEND.value, e.DTEND.params);
    // fin « date seule » exclusive en iCal
    if (en && !en.time && en.day > s.day) en = { ...en, day: minusDay(en.day) };
    const occ = { start: s.day, end: en?.day && en.day >= s.day ? en.day : s.day, hours: s.time ? `${s.time}${en?.time && en.time !== s.time ? `–${en.time}` : ''}` : null };
    // récurrence hebdomadaire : FREQ=WEEKLY;BYDAY=TU,SA;UNTIL=…
    const rr = e.RRULE?.value ?? '';
    if (/FREQ=WEEKLY/.test(rr)) {
      const days = (rr.match(/BYDAY=([A-Z,0-9-]+)/)?.[1] ?? '').split(',').map((d) => ICAL_DAYS[d.slice(-2)]).filter((d) => d != null);
      const until = rr.match(/UNTIL=(\d{8})/)?.[1];
      occ.end = until ? `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}` : `${+s.day.slice(0, 4) + 1}${s.day.slice(4)}`;
      occ.days = days.length ? days : [new Date(`${s.day}T12:00:00Z`).getUTCDay()];
    }
    const geo = e.GEO?.value?.split(/[;,]/).map(Number);
    return {
      title: unescapeIcs(e.SUMMARY?.value ?? '').trim(),
      description: unescapeIcs(e.DESCRIPTION?.value ?? '').replace(/\s+/g, ' ').trim() || null,
      location: unescapeIcs(e.LOCATION?.value ?? '').trim() || null,
      url: (e.URL?.value ?? '').trim() || null,
      geo: geo?.length === 2 && geo.every(Number.isFinite) ? geo : null,
      categories: unescapeIcs(e.CATEGORIES?.value ?? '') || null,
      occurrences: [occ],
    };
  }).filter((x) => x?.title);
}

// ---------- WordPress « The Events Calendar » (API REST) ----------
function parseTribe(json) {
  return (json?.events ?? []).map((e) => {
    const [sd, st] = String(e.start_date ?? '').split(' ');
    const [ed, et] = String(e.end_date ?? '').split(' ');
    const v = e.venue && !Array.isArray(e.venue) ? e.venue : {};
    return {
      title: String(e.title ?? '').replace(/<[^>]+>/g, '').trim(),
      description: String(e.excerpt || e.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null,
      location: [v.venue, v.address, v.zip, v.city].filter(Boolean).join(', ') || null,
      venue: v.venue ?? null,
      city: v.city ?? null,
      postcode: v.zip ?? null,
      url: e.url ?? null,
      geo: v.geo_lat && v.geo_lng ? [+v.geo_lat, +v.geo_lng] : null,
      categories: (e.categories ?? []).map((c) => c.name).join(' ') || null,
      occurrences: [{ start: sd, end: ed || sd, hours: e.all_day ? null : `${(st ?? '').slice(0, 5)}${et && et !== st ? `–${et.slice(0, 5)}` : ''}` }],
    };
  }).filter((x) => x.title && x.occurrences[0].start);
}

// ---------- Communes (pour rattacher un événement d'intercommunalité à sa commune) ----------
async function communesOf(dept) {
  const file = join(CACHE, `communes-${dept}.json`);
  const cached = await readJson(file, null);
  if (cached?.length) return cached;
  const data = await fetchText(`https://geo.api.gouv.fr/departements/${dept}/communes?fields=nom,codesPostaux`, { json: true, checkRobots: false });
  const list = data.map((c) => ({ name: c.nom, key: norm(c.nom), postcode: c.codesPostaux?.[0] ?? null })).sort((a, b) => b.key.length - a.key.length);
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, JSON.stringify(list));
  return list;
}
/** Commune citée dans un texte (le nom le plus long l'emporte : « Saint-Martin-le-Beau » avant « Beau »). */
export function findCommune(text, communes) {
  const t = ` ${norm(text)} `;
  return communes.find((c) => c.key.length > 2 && t.includes(` ${c.key} `)) ?? null;
}

/** Nom du lieu : début du champ « lieu », sauf s'il ne s'agit que du nom de la commune. */
function venueOf(location, commune) {
  const v = location?.split(',')[0].trim();
  if (!v || (commune && norm(v) === commune.key) || /^\d/.test(v)) return null;
  return v;
}

// ---------- Détection du flux d'un site ----------
const CANDIDATES = [
  (b) => ({ type: 'ical', url: `${b}events.ics?scope=future` }), // Events Manager (WordPress)
  (b) => ({ type: 'ical', url: `${b}?ical=1&scope=future` }),
  (b) => ({ type: 'tribe', url: `${b}wp-json/tribe/events/v1/events?per_page=50&start_date=now` }), // The Events Calendar
  (b) => ({ type: 'ical', url: `${b}?post_type=tribe_events&ical=1&eventDisplay=list` }),
  (b) => ({ type: 'html', url: `${b}agenda/` }),
  (b) => ({ type: 'html', url: `${b}evenements/` }),
  (b) => ({ type: 'html', url: `${b}events/` }),
];

async function readFeed({ type, url }) {
  if (type === 'tribe') return parseTribe(await fetchText(url, { json: true }));
  const text = await fetchText(url);
  if (type === 'ical' || /BEGIN:VCALENDAR/.test(text.slice(0, 500))) return parseIcs(text);
  return extractEvents(text, url).map((r) => ({ ...r, occurrences: r.occurrences ?? [{ start: r.start, end: r.end ?? r.start, hours: r.hours ?? null }] }));
}
const upcomingCount = (items, today) => items.filter((e) => e.occurrences.some((o) => (o.end ?? o.start) >= today)).length;

async function detect(site, today, log) {
  if (site.feed) return { type: /\.ics|ical=|webcal/.test(site.feed) ? 'ical' : /wp-json/.test(site.feed) ? 'tribe' : 'html', url: site.feed.replace(/^webcal:/, 'https:') };
  const base = site.url.endsWith('/') ? site.url : `${site.url}/`;
  const tried = [];
  // liens présents sur la page (flux iCal annoncés)
  try {
    const html = await fetchText(site.url);
    const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((h) => /\.ics\b|[?&]ical=|^webcal:/i.test(h));
    for (const h of links.slice(0, 3)) tried.push({ type: 'ical', url: new URL(h.replace(/^webcal:/, 'https:'), base).href });
    if (extractEvents(html, site.url).length) tried.push({ type: 'html', url: site.url });
  } catch (e) {
    log(`  ${site.name} : page inaccessible (${e.message})`);
  }
  tried.push(...CANDIDATES.map((f) => f(base)));
  let best = null;
  for (const c of tried) {
    try {
      const n = upcomingCount(await readFeed(c), today);
      if (n && (!best || n > best.n)) best = { ...c, n };
    } catch { /* candidat absent */ }
  }
  return best;
}

export async function run(source, { departments, log }) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const detectFile = join(CACHE, 'feeds-detect.json');
  const detected = await readJson(detectFile, {});
  const raws = [];
  for (const site of source.sites ?? []) {
    if (!departments.includes(site.dept)) continue;
    let feed = detected[site.url];
    if (!feed || Date.now() - (feed.at ?? 0) > WEEK) {
      const found = await detect(site, today, log);
      feed = { ...(found ?? { none: true }), at: Date.now() };
      detected[site.url] = feed;
    }
    if (feed.none) { log(`  ${site.name} : aucun agenda exploitable trouvé`); continue; }
    let items = [];
    try {
      items = await readFeed(feed);
    } catch (e) {
      log(`  ${site.name} : ${e.message}`);
      delete detected[site.url]; // nouvelle détection la prochaine fois
      continue;
    }
    const communes = await communesOf(site.dept).catch(() => []);
    let n = 0;
    for (const it of items) {
      if (!it.occurrences.some((o) => (o.end ?? o.start) >= today)) continue;
      const c = it.city ? null : findCommune(`${it.title} ${it.location ?? ''}`, communes) ?? (site.city ? findCommune(site.city, communes) : null);
      raws.push({
        title: it.title,
        description: it.description ? it.description.slice(0, 300) : null,
        types: it.categories ?? '',
        occurrences: it.occurrences,
        venue: it.venue ?? venueOf(it.location, c),
        address: it.location ?? null,
        city: it.city ?? c?.name ?? null,
        postcode: it.postcode ?? c?.postcode ?? null,
        lat: it.geo?.[0],
        lon: it.geo?.[1],
        url: it.url ?? site.url,
        credit: site.name,
      });
      n++;
    }
    log(`  ${site.name} : ${n} événement(s) à venir (${feed.type} ${feed.url})`);
  }
  await mkdir(CACHE, { recursive: true });
  await writeFile(detectFile, JSON.stringify(detected, null, 1));
  return raws;
}
