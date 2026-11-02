#!/usr/bin/env node
// Fusionne les résultats des collectes par région (une tâche GitHub Actions par groupe) dans public/data.
// Usage : node scraper/tools/merge-parts.mjs <dossier des parties>
// Chaque partie contient owned.json (départements collectés), index.json et un dossier par département.
// Un groupe dont la collecte a échoué garde ses données en ligne (récupérées avant par fetch-live).

import { readFile, writeFile, readdir, rm, cp, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { DATA_DIR, DEPT_NAMES } from '../lib/store.mjs';
import { loadConfig } from '../lib/config.mjs';

const partsDir = process.argv[2] ?? 'parts';
const config = await loadConfig();
const readJson = async (f, d = null) => { try { return JSON.parse(await readFile(f, 'utf8')); } catch { return d; } };

const index = await readJson(join(DATA_DIR, 'index.json'), {});
const before = JSON.parse(JSON.stringify(index.depts ?? {}));
index.depts ??= {};
index.sources = {};
let parts = [];
try { parts = await readdir(partsDir); } catch { /* aucune partie */ }
for (const part of parts) {
  const dir = join(partsDir, part);
  const owned = await readJson(join(dir, 'owned.json'), []);
  const pidx = await readJson(join(dir, 'index.json'), {});
  for (const d of owned) {
    try { await stat(join(dir, d)); } catch { console.warn(`  ${part} : pas de données pour le ${d}`); continue; }
    await rm(join(DATA_DIR, d), { recursive: true, force: true });
    await cp(join(dir, d), join(DATA_DIR, d), { recursive: true });
    if (pidx.depts?.[d]) index.depts[d] = pidx.depts[d];
  }
  // seulement le rapport de cette collecte (événements / lieux), jamais l'index précédent imbriqué
  index.sources[part.replace(/^data-/, '')] = { departments: owned, events: pidx.sources?.events ?? null, places: pidx.sources?.places ?? null };
  console.log(`  ${part} : ${owned.join(', ')}`);
}
// départements retirés de la configuration
for (const d of Object.keys(index.depts)) {
  if (config.departments.includes(d)) continue;
  delete index.depts[d];
  await rm(join(DATA_DIR, d), { recursive: true, force: true });
}
for (const d of config.departments) if (index.depts[d]) index.depts[d].name ??= DEPT_NAMES[d];
index.departments = config.departments;
index.generatedAt = new Date().toISOString();
await writeFile(join(DATA_DIR, 'index.json'), JSON.stringify(index, null, 1));
console.log(`Index : ${Object.keys(index.depts).length} département(s)`);

// Rapport du jour : chiffres par département, comparés à la veille ; alerte si forte baisse ou source en panne
const fmt = (n) => (n == null ? '–' : String(n));
const delta = (a, b) => (a == null || b == null ? '' : a - b >= 0 ? ` (+${a - b})` : ` (${a - b})`);
const lines = ['## Brocante Map : collecte du jour', '', '| Département | Événements | Lieux | Alerte |', '|---|---|---|---|'];
const alerts = [];
for (const d of config.departments) {
  const n = index.depts[d] ?? {};
  const p = before[d] ?? {};
  const drop = p.events && n.events != null && n.events < p.events * 0.7;
  if (drop) alerts.push(`${d} ${n.name ?? ''} : événements en forte baisse (${p.events} → ${n.events})`);
  lines.push(`| ${d} ${n.name ?? DEPT_NAMES[d] ?? ''} | ${fmt(n.events)}${delta(n.events, p.events)} | ${fmt(n.places)}${delta(n.places, p.places)} | ${drop ? '⚠️ baisse > 30 %' : ''} |`);
}
for (const [g, info] of Object.entries(index.sources ?? {})) {
  for (const [id, r] of Object.entries(info?.events ?? {})) if (r && r.ok === false) alerts.push(`${g} : source ${id} en échec (${r.error ?? '?'})`);
}
lines.push('', alerts.length ? `**${alerts.length} alerte(s)**\n\n${alerts.map((a) => `- ${a}`).join('\n')}` : 'Aucune alerte.');
const report = lines.join('\n');
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, report + '\n', { flag: 'a' });
