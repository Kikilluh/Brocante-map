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
  index.sources[part.replace(/^data-/, '')] = { departments: owned, ...(pidx.sources ?? {}) };
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
