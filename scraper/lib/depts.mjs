// Emprise (sud, ouest, nord, est) de n'importe quel département, calculée une fois depuis les limites
// administratives d'OpenStreetMap (Overpass) puis gardée en cache : plus de tableau à remplir à la main
// pour ajouter un département (zones Ticketmaster, découpe des itinéraires, rattachement des lieux).

import { overpass } from './overpass.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const CACHE = join(dirname(fileURLToPath(import.meta.url)), '..', 'cache', 'dept-bbox.json');

// Valeurs connues (évitent une requête ; vérifiées sur la carte)
const KNOWN = {
  '37': [46.73, -0.06, 47.72, 1.37],
  '45': [47.47, 1.50, 48.35, 3.14],
  '58': [46.64, 2.84, 47.60, 4.24],
  '69': [45.45, 4.24, 46.31, 5.17],
  '75': [48.81, 2.22, 48.91, 2.47], // Paris (code « 75C » possible dans OpenStreetMap) // Rhône + Métropole de Lyon (deux limites distinctes dans OpenStreetMap)
};

let cache = null;
async function load() {
  if (cache) return cache;
  try { cache = JSON.parse(await readFile(CACHE, 'utf8')); } catch { cache = {}; }
  return cache;
}

/** Emprise d'un département ([s, w, n, e]) ou null si introuvable. */
export async function deptBbox(dept, log = () => {}) {
  if (KNOWN[dept]) return KNOWN[dept];
  const c = await load();
  if (c[dept]) return c[dept];
  // 1) rapide et fiable : centres des communes du département (geo.api.gouv.fr, service public), avec une marge
  try {
    const res = await fetch(`https://geo.api.gouv.fr/departements/${dept}/communes?fields=centre&format=json`, { signal: AbortSignal.timeout(30000) });
    if (res.ok) {
      const pts = (await res.json()).map((c) => c.centre?.coordinates).filter(Boolean);
      if (pts.length > 10) {
        const r2 = (x) => Math.round(x * 100) / 100;
        const m = 0.04;
        c[dept] = [r2(Math.min(...pts.map((p) => p[1])) - m), r2(Math.min(...pts.map((p) => p[0])) - m), r2(Math.max(...pts.map((p) => p[1])) + m), r2(Math.max(...pts.map((p) => p[0])) + m)];
        await mkdir(dirname(CACHE), { recursive: true });
        await writeFile(CACHE, JSON.stringify(c, null, 1));
        log(`  emprise du ${dept} (communes) : ${c[dept].join(', ')}`);
        return c[dept];
      }
    }
  } catch { /* repli sur OpenStreetMap */ }
  // 2) repli : limite administrative OpenStreetMap
  const q = `[out:json][timeout:60];relation["boundary"="administrative"]["ref:INSEE"="${dept}"]["admin_level"~"^(6|4)$"];out bb;`;
  try {
    const el = ((await overpass(q, 90000)).elements ?? []).find((e) => e.bounds);
    if (!el) throw new Error('limite introuvable');
    const b = el.bounds;
    const r2 = (x) => Math.round(x * 100) / 100;
    c[dept] = [r2(b.minlat), r2(b.minlon), r2(b.maxlat), r2(b.maxlon)];
    await mkdir(dirname(CACHE), { recursive: true });
    await writeFile(CACHE, JSON.stringify(c, null, 1));
    log(`  emprise du ${dept} : ${c[dept].join(', ')}`);
    return c[dept];
  } catch (e) {
    log(`  emprise du ${dept} indisponible : ${e.message}`);
    return null;
  }
}

/** Emprises de plusieurs départements : { '37': [s, w, n, e], … } */
export async function deptBboxes(departments, log) {
  const out = {};
  for (const d of departments) {
    const b = await deptBbox(d, log);
    if (b) out[d] = b;
  }
  return out;
}

/** Centre et rayon (km) couvrant l'emprise : pour les recherches par cercle (Ticketmaster). */
export function circleOf([s, w, n, e]) {
  const lat = (s + n) / 2;
  const lon = (w + e) / 2;
  const dy = ((n - s) / 2) * 111;
  const dx = ((e - w) / 2) * 111 * Math.cos((lat * Math.PI) / 180);
  return { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100, radiusKm: Math.min(150, Math.ceil(Math.hypot(dx, dy))) };
}
