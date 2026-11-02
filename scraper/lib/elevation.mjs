// Dénivelé des itinéraires : altitudes du service public de l'IGN (Géoplateforme, gratuit, sans clé,
// Licence Ouverte), le long du tracé simplifié. Résultat mis en cache (le tracé change rarement).
// Doc : https://geoservices.ign.fr/documentation/services/services-geoplateforme/altimetrie

import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const API = 'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevationLine.json';

function distM(a, b) {
  const r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** Dénivelés cumulés d'une suite d'altitudes, lissée, avec un seuil pour ignorer le bruit (± 3 m). */
export function climb(zs, threshold = 3) {
  const s = zs.map((_, i) => {
    const w = zs.slice(Math.max(0, i - 1), i + 2);
    return w.reduce((a, b) => a + b, 0) / w.length;
  });
  let up = 0;
  let down = 0;
  let ref = s[0];
  for (const z of s.slice(1)) {
    const d = z - ref;
    if (d >= threshold) { up += d; ref = z; } else if (d <= -threshold) { down -= d; ref = z; }
  }
  return { up: Math.round(up), down: Math.round(down) };
}

/** Réduit une liste à n éléments régulièrement espacés (extrémités gardées). */
export function pick(list, n) {
  if (list.length <= n) return list;
  return Array.from({ length: n }, (_, i) => list[Math.round((i * (list.length - 1)) / (n - 1))]);
}

export async function createElevation(cacheFile, log = () => {}) {
  let cache = {};
  try { cache = JSON.parse(await readFile(cacheFile, 'utf8')); } catch { /* pas de cache */ }
  let calls = 0;
  let failures = 0;
  return {
    /**
     * lines = [[ [lat, lon], … ], …] → { up, down, min, max, profile: [z…], km } ou null.
     * maxCalls limite le nombre de nouveaux calculs par collecte (le reste se fait les jours suivants).
     */
    async profile(key, lines, { maxCalls = 400 } = {}) {
      const pts = lines.flat();
      if (pts.length < 2) return null;
      const hash = createHash('sha1').update(JSON.stringify(lines)).digest('hex').slice(0, 12);
      const k = `${key}:${hash}`;
      if (cache[k] !== undefined) return cache[k];
      if (calls >= maxCalls || failures >= 5) return null;
      calls++;
      let len = 0;
      for (let i = 1; i < pts.length; i++) len += distM(pts[i - 1], pts[i]);
      const input = pick(pts, 80);
      const sampling = Math.max(20, Math.min(200, Math.round(len / 60)));
      const url = new URL(API);
      url.searchParams.set('lon', input.map((p) => p[1]).join('|'));
      url.searchParams.set('lat', input.map((p) => p[0]).join('|'));
      for (const [a, b] of Object.entries({ resource: 'ign_rge_alti_wld', delimiter: '|', indent: 'false', measures: 'false', zonly: 'true', profile_mode: 'simple', sampling: String(sampling) })) url.searchParams.set(a, b);
      try {
        await new Promise((r) => setTimeout(r, 150));
        const res = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'BrocanteMapBot/1.0 (+https://github.com/kikilluh/brocante-map)' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const zs = (data.elevations ?? []).map((e) => (typeof e === 'number' ? e : e?.z)).filter((z) => Number.isFinite(z) && z > -100);
        if (zs.length < 2) { cache[k] = null; return null; }
        const { up, down } = climb(zs);
        const out = { up, down, min: Math.round(Math.min(...zs)), max: Math.round(Math.max(...zs)), km: Math.round(len / 100) / 10, profile: pick(zs, 60).map((z) => Math.round(z)) };
        cache[k] = out;
        return out;
      } catch (e) {
        failures++;
        if (failures === 1) log(`  altitudes IGN indisponibles (${e.message})`);
        return null;
      }
    },
    async save() {
      await writeFile(cacheFile, JSON.stringify(cache));
      log(`  altitudes : ${calls} itinéraire(s) calculé(s) aujourd'hui, ${Object.keys(cache).length} en cache`);
    },
  };
}
