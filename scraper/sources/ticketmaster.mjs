// Ticketmaster Discovery API : grands concerts, spectacles, sport.
// Clé = « Consumer Key » du compte développeur → secret TICKETMASTER_KEY (la Consumer Secret n'est pas utilisée).
// Conditions : afficher l'événement avec un lien vers la page de billetterie Ticketmaster (champ url).
// Doc : https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/

import { fetchText } from '../lib/http.mjs';
import { deptFromPostcode } from '../lib/normalize.mjs';

const API = 'https://app.ticketmaster.com/discovery/v2/events.json';

// Centre et rayon couvrant chaque département (ajouter une entrée par département couvert)
const AREAS = { '37': { lat: 47.26, lon: 0.69, radiusKm: 75 } };

const B32 = '0123456789bcdefghjkmnpqrstuvwxyz';
/** Encode une position en geohash (paramètre geoPoint de l'API). */
export function geohash(lat, lon, precision = 6) {
  let [latMin, latMax, lonMin, lonMax] = [-90, 90, -180, 180];
  let hash = '';
  let bit = 0;
  let ch = 0;
  let even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (lonMin + lonMax) / 2;
      if (lon > mid) { ch |= 1 << (4 - bit); lonMin = mid; } else lonMax = mid;
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat > mid) { ch |= 1 << (4 - bit); latMin = mid; } else latMax = mid;
    }
    even = !even;
    if (bit < 4) bit++;
    else { hash += B32[ch]; bit = 0; ch = 0; }
  }
  return hash;
}

const SEGMENTS = { Music: 'concert', Sports: 'sport', 'Arts & Theatre': 'spectacle', Film: 'spectacle', Family: 'spectacle' };

export function mapEvent(ev) {
  const venue = ev._embedded?.venues?.[0] ?? {};
  const cls = ev.classifications?.[0] ?? {};
  const prices = (ev.priceRanges ?? []).flatMap((p) => [p.min, p.max]).filter((x) => Number.isFinite(x));
  const start = ev.dates?.start?.localDate;
  const time = ev.dates?.start?.localTime?.slice(0, 5);
  return {
    title: ev.name,
    category: SEGMENTS[cls.segment?.name] ?? null,
    types: [cls.segment?.name, cls.genre?.name, cls.subGenre?.name].filter(Boolean).join(' '),
    description: ev.info ?? ev.pleaseNote ?? null,
    occurrences: [{ start, end: ev.dates?.end?.localDate ?? start, hours: time ?? null }],
    venue: venue.name ?? null,
    address: venue.address?.line1 ?? null,
    postcode: venue.postalCode ?? null,
    city: venue.city?.name ?? null,
    lat: venue.location?.latitude,
    lon: venue.location?.longitude,
    priceMin: prices.length ? Math.min(...prices) : null,
    priceMax: prices.length ? Math.max(...prices) : null,
    ageMin: ev.ageRestrictions?.legalAgeEnforced ? 18 : null,
    url: ev.url ?? null,
    credit: 'Ticketmaster',
  };
}

export async function run(source, { departments, log }) {
  const key = process.env.TICKETMASTER_KEY;
  if (!key) {
    log('  TICKETMASTER_KEY absent : source ignorée');
    return [];
  }
  const raws = [];
  const seen = new Set();
  for (const dept of departments) {
    const area = AREAS[dept];
    if (!area) {
      log(`  pas de zone définie pour le ${dept} (voir AREAS)`);
      continue;
    }
    // L'API limite la pagination à 1000 résultats (page × size < 1000)
    for (let page = 0; page < 5; page++) {
      const url = new URL(API);
      url.searchParams.set('apikey', key);
      url.searchParams.set('countryCode', 'FR');
      url.searchParams.set('geoPoint', geohash(area.lat, area.lon));
      url.searchParams.set('radius', String(area.radiusKm));
      url.searchParams.set('unit', 'km');
      url.searchParams.set('size', '199');
      url.searchParams.set('page', String(page));
      url.searchParams.set('sort', 'date,asc');
      url.searchParams.set('locale', '*');
      const data = await fetchText(url.href, { json: true, checkRobots: false, delayMs: 300 });
      const events = data._embedded?.events ?? [];
      for (const ev of events) {
        if (seen.has(ev.id)) continue;
        seen.add(ev.id);
        const raw = mapEvent(ev);
        if (deptFromPostcode(raw.postcode) !== dept) continue;
        raws.push(raw);
      }
      const totalPages = data.page?.totalPages ?? 0;
      if (page + 1 >= totalPages) break;
    }
  }
  log(`  ${raws.length} événements Ticketmaster dans la zone`);
  return raws;
}
