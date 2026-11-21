// Petits lieux de proximité d'OpenStreetMap (licence ODbL, « © contributeurs OpenStreetMap ») :
// croix et calvaires, lavoirs, aires de jeux, boulodromes, terrains multisports, skateparks,
// aires de pique-nique, parcours sportifs, points de vue.
// UNE requête Overpass par département (limites administratives : pas d'erreur de rattachement),
// gardée 7 jours dans scraper/cache/poi-<dept>.json.

import { overpass, deptArea } from './overpass.mjs';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const MAX_AGE_MS = 7 * 864e5;

function query(dept) {
  return `[out:json][timeout:180];
${deptArea(dept)}
(
  nwr(area.d)["historic"="wayside_cross"];
  nwr(area.d)["amenity"="lavoir"];
  nwr(area.d)["leisure"="playground"];
  nwr(area.d)["leisure"="pitch"]["sport"~"boules|petanque|multi|skateboard"];
  nwr(area.d)["leisure"="fitness_station"]["name"];
  nwr(area.d)["tourism"~"^(viewpoint|picnic_site)$"];
);
out center tags;`;
}

/** Type d'un élément OSM → { kind, sub, label } (label = nom par défaut s'il n'en a pas). */
export function classify(t = {}) {
  if (t.historic === 'wayside_cross') return { kind: 'petitpatrimoine', sub: 'croix', label: 'Croix' };
  if (t.amenity === 'lavoir') return { kind: 'petitpatrimoine', sub: 'lavoir', label: 'Lavoir' };
  if (t.leisure === 'playground') return { kind: 'equipement', sub: 'jeux', label: 'Aire de jeux' };
  if (t.leisure === 'pitch' && /boules|petanque/.test(t.sport ?? '')) return { kind: 'equipement', sub: 'boulodrome', label: 'Boulodrome' };
  if (t.leisure === 'pitch' && /skateboard/.test(t.sport ?? '')) return { kind: 'equipement', sub: 'skatepark', label: 'Skatepark' };
  if (t.leisure === 'pitch' && /multi/.test(t.sport ?? '')) return { kind: 'equipement', sub: 'multisport', label: 'Terrain multisport' };
  if (t.leisure === 'fitness_station') return { kind: 'equipement', sub: 'fitness', label: 'Parcours sportif' };
  if (t.tourism === 'picnic_site') return { kind: 'equipement', sub: 'piquenique', label: 'Aire de pique-nique' };
  if (t.tourism === 'viewpoint') return { kind: 'nature', sub: 'vue', label: 'Point de vue' };
  return null;
}

/** Petits lieux d'un département, prêts à fusionner avec les autres lieux. */
export async function loadPois(dept, cacheDir, log = () => {}) {
  const file = join(cacheDir, `poi-${dept}.json`);
  try {
    if (Date.now() - (await stat(file)).mtimeMs < MAX_AGE_MS) {
      const cached = JSON.parse(await readFile(file, 'utf8'));
      if (cached.length) return cached; // une réponse vide est redemandée (zone mal reconnue, panne)
    }
  } catch { /* pas de cache */ }
  try {
    const data = await overpass(query(dept), 240000);
    const out = [];
    for (const e of data.elements ?? []) {
      const c = classify(e.tags);
      const lat = e.lat ?? e.center?.lat;
      const lon = e.lon ?? e.center?.lon;
      if (!c || lat == null) continue;
      // terrains et aires privés (école, camping, résidence) écartés
      if (/^(private|no|customers)$/.test(e.tags.access ?? '')) continue;
      out.push({
        name: e.tags.name ?? c.label,
        kind: c.kind,
        sub: c.sub,
        lat: Math.round(lat * 1e5) / 1e5,
        lon: Math.round(lon * 1e5) / 1e5,
        dept,
        description: e.tags.description ?? e.tags.inscription ?? null,
        osmType: e.type,
        osmRef: e.id,
      });
    }
    await mkdir(cacheDir, { recursive: true });
    await writeFile(file, JSON.stringify(out));
    log(`  OpenStreetMap : ${out.length} petits lieux dans le ${dept}`);
    return out;
  } catch (e) {
    log(`  OpenStreetMap petits lieux (${dept}) indisponible : ${e.message}`);
    try { return JSON.parse(await readFile(file, 'utf8')); } catch { return []; }
  }
}
