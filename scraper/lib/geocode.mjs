// Géocodage via la Base Adresse Nationale (api-adresse.data.gouv.fr) — gratuite, sans clé.
// Les résultats sont mis en cache dans scraper/cache/geocode.json (versionné) pour limiter les appels.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fetchText } from './http.mjs';
import { deptFromPostcode } from './normalize.mjs';

const API = 'https://api-adresse.data.gouv.fr/search/';

export async function createGeocoder(cachePath) {
  let cache = {};
  try {
    cache = JSON.parse(await readFile(cachePath, 'utf8'));
  } catch {
    cache = {};
  }

  async function query(q, params = {}) {
    const key = JSON.stringify([q, params]);
    if (key in cache) return cache[key];
    const url = new URL(API);
    url.searchParams.set('q', q);
    url.searchParams.set('limit', '1');
    for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
    let result = null;
    try {
      const data = await fetchText(url.href, { json: true, checkRobots: false, delayMs: 100 });
      const f = data.features?.[0];
      if (f && f.properties.score > 0.4) {
        result = {
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0],
          city: f.properties.city,
          postcode: f.properties.postcode,
          type: f.properties.type,
        };
      }
    } catch (e) {
      console.warn(`  géocodage échoué pour "${q}": ${e.message}`);
      return null; // pas de mise en cache des erreurs réseau
    }
    cache[key] = result;
    return result;
  }

  return {
    /** Complète lat/lon/city/postcode/dept d'un événement. */
    async geocode(ev) {
      if (ev.lat != null && ev.lon != null && ev.postcode) return ev;
      let r = null;
      if (ev.address && ev.city) r = await query(`${ev.address} ${ev.city}`, { postcode: ev.postcode });
      if (!r && ev.city) {
        r = await query(ev.city, { postcode: ev.postcode, type: 'municipality' });
        if (r) ev.approx = true; // position = centre de la commune
      }
      if (r) {
        if (ev.lat == null || ev.lon == null) {
          ev.lat = r.lat;
          ev.lon = r.lon;
        }
        ev.city ||= r.city;
        ev.postcode ||= r.postcode;
        ev.dept ||= deptFromPostcode(r.postcode);
      }
      return ev;
    },
    async save() {
      await mkdir(dirname(cachePath), { recursive: true });
      await writeFile(cachePath, JSON.stringify(cache, null, 0));
    },
  };
}
