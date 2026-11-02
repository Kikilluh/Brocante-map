#!/usr/bin/env node
// Collecte des brocantes / vide-greniers depuis toutes les sources configurées
// → public/data/<département>/events.json + public/data/index.json (consommés par la carte).
//
// Usage : node scraper/index.mjs [--only=source-id] [--dept=37,41]

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { configureHttp } from './lib/http.mjs';
import { makeEvent, expandRecurring } from './lib/normalize.mjs';
import { createGeocoder } from './lib/geocode.mjs';
import { dedupe } from './lib/dedupe.mjs';
import { createVenueFinder } from './lib/venues.mjs';
import { readPrevious, writeSplit, keepMissing } from './lib/store.mjs';
import { loadConfig, deptsFromArgs } from './lib/config.mjs';
import * as structuredHtml from './sources/structured-html.mjs';
import * as datatourisme from './sources/datatourisme.mjs';
import * as openagenda from './sources/openagenda.mjs';
import * as manual from './sources/manual.mjs';
import * as ticketmaster from './sources/ticketmaster.mjs';

const ADAPTERS = { 'structured-html': structuredHtml, datatourisme, openagenda, manual, ticketmaster };
const ROOT = dirname(fileURLToPath(import.meta.url));

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const config = await loadConfig();
const departments = deptsFromArgs(config);
configureHttp({ delayMs: config.requestDelayMs, userAgent: config.userAgent });

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
const horizon = new Date(Date.now() + config.horizonDays * 864e5).toISOString().slice(0, 10);

const previous = await readPrevious('events');

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
      if (raw.periodsRaw) Object.defineProperty(ev, '_raw', { value: raw.periodsRaw, enumerable: false });
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
const dropped = { passe: 0, tropLong: 0, horsZone: 0, nonLocalise: 0 };
let expanded = 0;
for (const ev of collected) {
  // « tous les mardis de mai à octobre » → une date par mardi (au lieu d'écarter la période entière)
  if (ev.occurrences.some((o) => o.days?.length)) {
    const before = ev.occurrences.length;
    ev.occurrences = expandRecurring(ev.occurrences, { today, horizon, maxDays });
    if (ev.occurrences.length !== before) expanded++;
  }
  const upcoming = ev.occurrences.filter((o) => o.end >= today && o.start <= horizon);
  if (!upcoming.length) { dropped.passe++; continue; }
  // On ne garde que les dates à venir dans l'horizon ; les très longues périodes (marché hebdomadaire
  // décrit sur toute l'année, lieu ouvert toute la saison) sont écartées, sauf pour les expositions.
  ev.occurrences = ev.occurrences.filter(
    (o) => o.end >= today && o.start <= horizon && (LONG_OK.has(ev.category) || (Date.parse(o.end) - Date.parse(o.start)) / 864e5 <= maxDays),
  );
  if (!ev.occurrences.length) {
    // diagnostic : un exemple de période longue écartée, pour voir comment la source décrit les récurrences
    if (!dropped.tropLong && ev._raw) console.log(`  exemple de période longue écartée : ${ev.title} → ${JSON.stringify(ev._raw).slice(0, 600)}`);
    dropped.tropLong++;
    continue;
  }
  ev.start = ev.occurrences[0].start;
  ev.end = ev.occurrences.at(-1).end;
  ev.hours = ev.occurrences[0].hours;
  await geocoder.geocode(ev);
  if (ev.lat == null || ev.lon == null) { dropped.nonLocalise++; continue; }
  if (!ev.dept || !departments.includes(ev.dept)) { dropped.horsZone++; continue; }
  inScope.push(ev);
}
console.log(`Écartés : ${dropped.passe} passés ou hors horizon, ${dropped.tropLong} périodes trop longues sans jours précis, ${dropped.horsZone} hors zone, ${dropped.nonLocalise} non localisés ; ${expanded} récurrences développées en dates`);
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

// Filet de sécurité par source et par département (voir lib/store.mjs)
keepMissing(events, previous, { departments, stillValid: (e) => e.end >= today, log: console.warn });
events.sort((a, b) => a.start.localeCompare(b.start) || (a.city ?? '').localeCompare(b.city ?? ''));

await writeSplit('events', events, { departments, all: config.departments, sources: report });
const perDept = departments.map((d) => `${d}: ${events.filter((e) => e.dept === d).length}`).join(', ');
console.log(`\n${events.length} événements écrits (${perDept})`);
