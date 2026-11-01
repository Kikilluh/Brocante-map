#!/usr/bin/env node
// Collecte des brocantes / vide-greniers depuis toutes les sources configurées
// → public/data/brocantes.json (consommé par la carte).
//
// Usage : node scraper/index.mjs [--only=source-id] [--dept=37,41]

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { configureHttp } from './lib/http.mjs';
import { makeEvent } from './lib/normalize.mjs';
import { createGeocoder } from './lib/geocode.mjs';
import { dedupe } from './lib/dedupe.mjs';
import * as structuredHtml from './sources/structured-html.mjs';
import * as datatourisme from './sources/datatourisme.mjs';
import * as openagenda from './sources/openagenda.mjs';
import * as manual from './sources/manual.mjs';

const ADAPTERS = { 'structured-html': structuredHtml, datatourisme, openagenda, manual };
const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, '..', 'public', 'data', 'brocantes.json');

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

// Géocodage + filtrage géographique et temporel
const inScope = [];
for (const ev of collected) {
  if (ev.end < today || ev.start > horizon) continue;
  await geocoder.geocode(ev);
  if (ev.lat == null || ev.lon == null) continue;
  if (!ev.dept || !departments.includes(ev.dept)) continue;
  inScope.push(ev);
}
await geocoder.save();

const events = dedupe(inScope).sort((a, b) => a.start.localeCompare(b.start) || a.city?.localeCompare(b.city ?? ''));

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
