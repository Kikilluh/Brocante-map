// Itinéraires balisés (randonnée, vélo, VTT) depuis OpenStreetMap (licence ODbL, à citer).
// Une requête Overpass par département, géométrie découpée à l'emprise du département,
// puis on ne garde que le point de départ (ou d'entrée dans le département), la longueur et les liens.
// Résultat mis en cache 7 jours dans scraper/cache/routes-<dept>.json.

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const OVERPASS = 'https://overpass-api.de/api/interpreter';
const MAX_AGE_MS = 7 * 864e5;

// Emprise (sud, ouest, nord, est) de chaque département couvert
// Emprise (sud, ouest, nord, est) de chaque département couvert
export const BBOX = {
  '37': [46.73, -0.06, 47.72, 1.37], // Indre-et-Loire
  '45': [47.47, 1.50, 48.35, 3.14], // Loiret
  '58': [46.64, 2.84, 47.60, 4.24], // Nièvre
};

const VIEWERS = {
  hiking: 'https://hiking.waymarkedtrails.org/#route?id=',
  foot: 'https://hiking.waymarkedtrails.org/#route?id=',
  bicycle: 'https://cycling.waymarkedtrails.org/#route?id=',
  mtb: 'https://mtb.waymarkedtrails.org/#route?id=',
};
const NETWORKS = { iwn: 'itinéraire international', nwn: 'itinéraire national', rwn: 'itinéraire régional', lwn: 'boucle locale', icn: 'véloroute internationale', ncn: 'véloroute nationale', rcn: 'véloroute régionale', lcn: 'boucle vélo locale' };

function distM(a, b) {
  const R = 6371000;
  const r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const same = (a, b) => a && b && Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lon - b.lon) < 1e-6;

/** Point de départ : extrémité du 1er tronçon qui ne touche pas le 2e. */
export function startPoint(ways) {
  const segs = ways.filter((w) => w.length >= 2);
  if (!segs.length) return null;
  const [a, b] = [segs[0][0], segs[0].at(-1)];
  if (segs.length === 1) return a;
  const n = segs[1];
  return same(a, n[0]) || same(a, n.at(-1)) ? b : a;
}

/** Convertit une relation Overpass (out geom) en itinéraire. */
export function mapRelation(rel) {
  const t = rel.tags ?? {};
  const ways = (rel.members ?? []).filter((m) => m.type === 'way' && m.geometry?.length).map((m) => m.geometry.filter(Boolean));
  const start = startPoint(ways);
  if (!start || !(t.name || t.ref)) return null;
  let len = 0;
  for (const w of ways) for (let i = 1; i < w.length; i++) len += distM(w[i - 1], w[i]);
  const declared = parseFloat(String(t.distance ?? '').replace(',', '.'));
  return {
    osmId: rel.id,
    name: t.name ?? t.ref,
    ref: t.ref ?? null,
    kind: /bicycle|mtb/.test(t.route) ? 'velo' : 'rando',
    route: t.route,
    network: NETWORKS[t.network] ?? null,
    lat: start.lat,
    lon: start.lon,
    // longueur déclarée si présente, sinon longueur mesurée dans le département
    distanceKm: Number.isFinite(declared) && declared > 0 ? declared : Math.round(len / 100) / 10,
    partial: !(Number.isFinite(declared) && declared > 0) && ['iwn', 'nwn', 'icn', 'ncn'].includes(t.network),
    routeUrl: `${VIEWERS[t.route] ?? VIEWERS.hiking}${rel.id}`,
    url: t.website ?? t['contact:website'] ?? null,
    description: t.description ?? null,
    operator: t.operator ?? null,
  };
}

export async function loadRoutes(dept, cacheDir, log = () => {}) {
  const file = join(cacheDir, `routes-v2-${dept}.json`);
  try {
    if (Date.now() - (await stat(file)).mtimeMs < MAX_AGE_MS) {
      const cached = JSON.parse(await readFile(file, 'utf8'));
      if (cached.length) return cached; // un cache vide est ignoré
    }
  } catch {
    /* pas de cache */
  }
  const bb = BBOX[dept];
  if (!bb) {
    log(`  pas d'emprise définie pour le ${dept} (voir BBOX dans lib/routes.mjs)`);
    return [];
  }
  const q = `[out:json][timeout:240][maxsize:536870912];
area["ref:INSEE"="${dept}"]["admin_level"="6"]->.d;
rel(area.d)["type"="route"]["route"~"^(hiking|foot|bicycle|mtb)$"];
out body geom(${bb.join(',')});`;
  try {
    const res = await fetch(OVERPASS, {
      method: 'POST',
      body: new URLSearchParams({ data: q }),
      headers: { 'User-Agent': 'BrocanteMapBot/1.0 (+https://github.com/kikilluh/brocante-map)' },
      signal: AbortSignal.timeout(300000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const routes = (data.elements ?? []).map(mapRelation).filter(Boolean);
    await mkdir(cacheDir, { recursive: true });
    await writeFile(file, JSON.stringify(routes));
    log(`  OpenStreetMap : ${routes.length} itinéraires balisés (${data.elements?.length ?? 0} relations)`);
    return routes;
  } catch (e) {
    log(`  OpenStreetMap itinéraires (${dept}) indisponible : ${e.message}`);
    try {
      return JSON.parse(await readFile(file, 'utf8'));
    } catch {
      return [];
    }
  }
}
