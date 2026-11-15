// Nom du lieu (salle de concert, théâtre, musée, église…) quand la source ne le donne pas.
// Données OpenStreetMap (licence ODbL, attribution « © contributeurs OpenStreetMap ») via l'API Overpass :
// UNE requête par département, mise en cache 7 jours dans scraper/cache/venues-<dept>.json.

import { overpass } from './overpass.mjs';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchText } from './http.mjs';

const MAX_AGE_MS = 7 * 864e5;

const STREET = /^(\d|bis\b|ter\b)|^(rue|r\.|avenue|av\.?|boulevard|bd|place|pl\.|route|rte|chemin|ch\.|all[ée]e|impasse|imp\.|quai|parvis|square|cours|lieu[- ]dit|rond[- ]point|faubourg|fbg|chauss[ée]e|sentier|passage|esplanade|za\b|zi\b|zac\b|zone|lotissement|hameau|bp\b|cs\b|cedex|mail\b|promenade|sente|venelle|ruelle|carrefour|parc d.activit)/i;

/** Sépare « nom du lieu » et « adresse » dans les lignes d'adresse d'une source. */
export function splitVenue(lines) {
  const clean = lines.map((l) => String(l).trim()).filter(Boolean);
  if (!clean.length) return { venue: null, address: null };
  if (!STREET.test(clean[0]) && !/\d{5}/.test(clean[0])) {
    return { venue: clean[0], address: clean.slice(1).join(', ') || null };
  }
  return { venue: null, address: clean.join(', ') };
}

function query(dept) {
  return `[out:json][timeout:90];
area["ref:INSEE"="${dept}"]["admin_level"="6"]->.d;
(
  nwr(area.d)["name"]["amenity"~"^(theatre|arts_centre|cinema|community_centre|events_venue|library|music_venue|nightclub|townhall|social_centre|conference_centre|exhibition_centre|place_of_worship|marketplace)$"];
  nwr(area.d)["name"]["tourism"~"^(museum|gallery|attraction|zoo|theme_park)$"];
  nwr(area.d)["name"]["historic"~"^(castle|manor|abbey|monastery|fort|church)$"];
  nwr(area.d)["name"]["leisure"~"^(sports_centre|stadium|sports_hall)$"];
);
out center tags;`;
}

async function loadDept(dept, cacheDir, log) {
  const file = join(cacheDir, `venues-${dept}.json`);
  try {
    if (Date.now() - (await stat(file)).mtimeMs < MAX_AGE_MS) return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    /* pas de cache */
  }
  try {
    const data = await overpass(query(dept), 120000);
    const venues = (data.elements ?? [])
      .map((e) => ({ name: e.tags?.name, lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon }))
      .filter((v) => v.name && v.lat != null);
    await mkdir(cacheDir, { recursive: true });
    await writeFile(file, JSON.stringify(venues));
    log(`  OpenStreetMap : ${venues.length} lieux nommés dans le ${dept}`);
    return venues;
  } catch (e) {
    log(`  OpenStreetMap (${dept}) indisponible : ${e.message}`);
    try {
      return JSON.parse(await readFile(file, 'utf8')); // ancien cache, même périmé
    } catch {
      return [];
    }
  }
}

function distM(a, b) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function createVenueFinder(departments, cacheDir, log = () => {}) {
  const venues = (await Promise.all(departments.map((d) => loadDept(d, cacheDir, log)))).flat();
  // index grossier par cellule de ~1 km pour aller vite
  const grid = new Map();
  const cell = (lat, lon) => `${Math.round(lat * 100)}|${Math.round(lon * 100)}`;
  for (const v of venues) {
    const k = cell(v.lat, v.lon);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(v);
  }
  return {
    size: venues.length,
    /** Lieu nommé le plus proche à moins de maxM mètres, sinon null. */
    nearest(lat, lon, maxM = 60) {
      let best = null;
      let bestD = maxM;
      const [ci, cj] = [Math.round(lat * 100), Math.round(lon * 100)];
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          for (const v of grid.get(`${ci + i}|${cj + j}`) ?? []) {
            const d = distM({ lat, lon }, v);
            if (d < bestD) {
              bestD = d;
              best = v;
            }
          }
        }
      }
      return best?.name ?? null;
    },
  };
}
