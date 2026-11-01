#!/usr/bin/env node
// Collecte des brocantes / vide-greniers depuis toutes les sources configurées
// → public/data/events.json (consommé par la carte).
//
// Usage : node scraper/index.mjs [--only=source-id] [--dept=37,41]

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { configureHttp } from './lib/http.mjs';
import { makeEvent } from './lib/normalize.mjs';
import { createGeocoder } from './lib/geocode.mjs';
import { dedupe } from './lib/dedupe.mjs';
import { createVenueFinder } from './lib/venues.mjs';
import * as structuredHtml from './sources/structured-html.mjs';
import * as datatourisme from './sources/datatourisme.mjs';
import * as openagenda from './sources/openagenda.mjs';
import * as manual from './sources/manual.mjs';

const ADAPTERS = { 'structured-html': structuredHtml, datatourisme, openagenda, manual };
const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, '..', 'public', 'data', 'events.json');

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const config = JSON.parse(await readFile(join(ROOT, 'config.json'), 'utf8'));
const departments = args.dept ? args.dept.split(',') : config.departments;
configureHttp({ delayMs: config.requestDelayMs, userAgent: config.userAgent });

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
const horizon = new Date(Date.now() + config.horizonDays * 864e5).toISOString().slice(0, 10);

let previous = { events: [] };
try {
  previous = JSON.parse(await readFile(OUT, 'utf8'));
} catch {
  /* premier lancement */
}

const geocoder = await createGeocoder(join(ROOT, 'cache', 'geocode.json'));
const collected = [];
const report = {};

for (const source of config.sources) {
  if (!source.enabled || (args.only && args.only !== source.id)) continue;
  const adapter = ADAPTERS[source.type];
  if (!adapter) {
    console.warn(`Type de source inconnu : ${source.type}`);
    continue;
  }
  console.log(`▶ ${source.id}`);
  try {
    const raws = await adapter.run(source, { departments, log: console.log });
    let kept = 0;
    for (const raw of raws) {
      const ev = makeEvent(raw, source.id);
      if (!ev) continue;
      collected.push(ev);
      kept++;
    }
    report[source.id] = { ok: true, count: kept };
    console.log(`  ✔ ${kept} événements`);
  } catch (e) {
    report[source.id] = { ok: false, error: e.message };
    console.warn(`  ✘ ${e.message}`);
  }
}

// Filtrage temporel par date (occurrence), géocodage, filtrage géographique
const LONG_OK = new Set(config.longEventCategories ?? ['exposition']);
const maxDays = config.maxDurationDays ?? 14;
const inScope = [];
for (const ev of collected) {
  // On ne garde que les dates à venir dans l'horizon ; les très longues périodes (marché hebdomadaire
  // décrit sur toute l'année, lieu ouvert toute la saison) sont écartées, sauf pour les expositions.
  ev.occurrences = ev.occurrences.filter(
    (o) => o.end >= today && o.start <= horizon && (LONG_OK.has(ev.category) || (Date.parse(o.end) - Date.parse(o.start)) / 864e5 <= maxDays),
  );
  if (!ev.occurrences.length) continue;
  ev.start = ev.occurrences[0].start;
  ev.end = ev.occurrences.at(-1).end;
  ev.hours = ev.occurrences[0].hours;
  await geocoder.geocode(ev);
  if (ev.lat == null || ev.lon == null) continue;
  if (!ev.dept || !departments.includes(ev.dept)) continue;
  inScope.push(ev);
}
await geocoder.save();

// Nom du lieu manquant : lieu nommé OpenStreetMap le plus proche (seulement si la position est précise)
const venues = await createVenueFinder(departments, join(ROOT, 'cache'), console.log);
let venueFound = 0;
for (const ev of inScope) {
  if (!ev.venue && !ev.approx) {
    ev.venue = venues.nearest(ev.lat, ev.lon);
    if (ev.venue) venueFound++;
  }
  delete ev.approx;
}
console.log(`Lieux : ${inScope.filter((e) => e.venue).length}/${inScope.length} événements avec un nom de lieu (${venueFound} via OpenStreetMap)`);

/** Allège le JSON : retire les champs vides, garde la liste des dates seulement si plusieurs. */
function compact(ev) {
  const out = {};
  for (const [k, v] of Object.entries(ev)) {
    if (v == null || v === '') continue;
    if (k === 'occurrences') {
      if (v.length > 1) out.dates = v.map((o) => [o.start, o.end, o.hours ?? undefined].filter((x) => x !== undefined));
      continue;
    }
    out[k] = v;
  }
  return out;
}

const events = dedupe(inScope)
  .sort((a, b) => a.start.localeCompare(b.start) || (a.city ?? '').localeCompare(b.city ?? ''))
  .map(compact);

// Si aucune source n'a répondu, on conserve les données précédentes encore à venir plutôt que d'afficher une carte vide.
const anyOk = Object.values(report).some((r) => r.ok && r.count > 0);
const finalEvents = anyOk ? events : (previous.events ?? []).filter((e) => e.end >= today);
if (!anyOk) console.warn('Aucune source exploitable : conservation des données précédentes.');

await mkdir(dirname(OUT), { recursive: true });
await writeFile(
  OUT,
  JSON.stringify({ generatedAt: new Date().toISOString(), departments, sources: report, events: finalEvents }, null, 1),
);
console.log(`\n${finalEvents.length} événements écrits dans ${OUT}`);
