#!/usr/bin/env node
// Récupère les données actuellement en ligne (index + fichiers par département) dans public/data.
// Elles servent de « veille » : si une source tombe en panne, la collecte garde ses anciens éléments
// (voir lib/store.mjs). Les données ne sont plus stockées dans Git : le site en ligne fait foi.

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DATA_DIR } from '../lib/store.mjs';

const SITE = (process.env.SITE_URL || 'https://brocante-map.web.app').replace(/\/$/, '');
const get = async (path) => {
  const r = await fetch(`${SITE}/data/${path}`, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${path} : HTTP ${r.status}`);
  return r.text();
};

try {
  const index = await get('index.json');
  const depts = Object.keys(JSON.parse(index).depts ?? {});
  for (const d of depts) {
    await mkdir(join(DATA_DIR, d), { recursive: true });
    for (const kind of ['events', 'places']) {
      try {
        await writeFile(join(DATA_DIR, d, `${kind}.json`), await get(`${d}/${kind}.json`));
      } catch (e) {
        console.warn(`  ${e.message}`);
      }
    }
  }
  await writeFile(join(DATA_DIR, 'index.json'), index);
  console.log(`Données en ligne récupérées : ${depts.join(', ')}`);
} catch (e) {
  console.warn(`Pas de données en ligne exploitables (${e.message}) : collecte à partir de zéro.`);
}
