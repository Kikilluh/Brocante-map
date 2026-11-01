#!/usr/bin/env node
// Couche « À visiter » : lieux sans date (musées, châteaux, jardins, sites naturels), itinéraires de
// randonnée / vélo, et festivals récurrents. → public/data/places.json
//
// Sources (toutes en données ouvertes) :
//  - DATAtourisme /placeOfInterest et /tour (Licence Ouverte) — secret DATATOURISME_API_KEY
//  - data.gouv.fr « Musées de France – Muséofile » et « Liste des festivals en France » (ministère de la Culture) :
//    la licence est vérifiée à chaque collecte via l'API data.gouv.fr ; jeu ignoré si elle n'est pas ouverte.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { configureHttp, fetchText } from './lib/http.mjs';
import { createGeocoder } from './lib/geocode.mjs';
import { cleanText, deptFromPostcode, slug } from './lib/normalize.mjs';
import { splitVenue } from './lib/venues.mjs';
import { fr, get, listOf, readImage } from './sources/datatourisme.mjs';
import { loadRoutes } from './lib/routes.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, '..', 'public', 'data', 'places.json');
const config = JSON.parse(await readFile(join(ROOT, 'config.json'), 'utf8'));
const departments = config.departments;
configureHttp({ delayMs: config.requestDelayMs, userAgent: config.userAgent });
const log = console.log;
const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

// ---------- Types de lieux ----------
export const KINDS = [
  ['activite', /IntroductionCourse|AccompaniedPractice|Practice|Course|Lesson|Workshop|Training|Activity|Initiation/i],
  ['musee', /Museum|InterpretationCentre|ArtGallery|Ecomuseum|mus[ée]e|galerie/i],
  ['chateau', /Castle|Chateau|Château|Manor|Fortress|Palace|ch[âa]teau|forteresse|manoir|logis royal/i],
  ['patrimoine', /ReligiousSite|Church|Abbey|Chapel|Cathedral|Monument|RemarkableBuilding|HistoricSite|ArcheologicalSite|Cave|Troglodyte|CulturalSite|Mill|[ée]glise|abbaye|chapelle|moulin|troglo/i],
  ['jardin', /Garden|Park|Arboretum|jardin|parc|arboretum/i],
  ['nature', /NaturalHeritage|Lake|River|Forest|Viewpoint|NaturalSite|Pond|Wetland|for[êe]t|[ée]tang|r[ée]serve naturelle/i],
  ['loisir', /Zoo|ThemePark|AmusementPark|Aquarium|LeisurePlace|SportsAndLeisurePlace|Wine|Cellar|Vineyard|zoo|cave|domaine viticole/i],
];
const EXCLUDE = /FoodEstablishment|Restaurant|Accommodation|Hotel|Hosting|Camping|Store|Shop|Rental|Service|TouristInformationCenter|Bar\b|BedAndBreakfast|Guesthouse|SelfCatering|Parking|Transport/i;

function kindOf(types, label) {
  if (EXCLUDE.test(types)) return null;
  for (const [k, re] of KINDS) if (re.test(types)) return k;
  for (const [k, re] of KINDS) if (re.test(label)) return k;
  return null;
}

// ---------- DATAtourisme ----------
async function dtFetchAll(endpoint, fields) {
  const key = process.env.DATATOURISME_API_KEY;
  if (!key) {
    log('  DATATOURISME_API_KEY absent');
    return [];
  }
  const depts = departments.join(',');
  let url = new URL(`https://api.datatourisme.fr/v1/${endpoint}`);
  url.searchParams.set('filters', `isLocatedAt.address.hasAddressCity.isPartOfDepartment.insee[in]=${depts}`);
  url.searchParams.set('fields', fields);
  url.searchParams.set('lang', 'fr');
  url.searchParams.set('page_size', '100');
  const out = [];
  let pages = 0;
  let total = null;
  while (url && pages < 200) {
    const data = await fetchText(url.href, { json: true, checkRobots: false, headers: { 'X-API-Key': key }, delayMs: 400 });
    total ??= data?.meta?.total;
    const items = listOf(data);
    out.push(...items);
    pages++;
    url = data?.meta?.next && items.length ? new URL(data.meta.next) : null;
  }
  log(`  /${endpoint} : ${out.length} objets lus sur ${total ?? '?'} (${pages} pages)`);
  return out;
}

function dtCommon(n) {
  const loc = arr(get(n, 'isLocatedAt'))[0] ?? {};
  const addr = arr(get(loc, 'address'))[0] ?? {};
  const geo = arr(get(loc, 'geo'))[0] ?? {};
  const cityNode = arr(get(addr, 'hasAddressCity'))[0];
  const { venue, address } = splitVenue(arr(get(addr, 'streetAddress')).map(fr).filter(Boolean));
  const descNode = arr(get(n, 'hasDescription'))[0];
  return {
    name: fr(get(n, 'label')),
    types: arr(get(n, 'type')).join(' '),
    address: address ?? venue,
    postcode: fr(get(addr, 'postalCode')),
    city: (typeof cityNode === 'object' ? fr(get(cityNode, 'label')) : null) ?? fr(get(addr, 'addressLocality')),
    lat: Number(fr(get(geo, 'latitude'))),
    lon: Number(fr(get(geo, 'longitude'))),
    url: fr(get(arr(get(n, 'hasContact'))[0] ?? {}, 'homepage')),
    description: fr(get(descNode, 'shortDescription')) ?? fr(get(descNode, 'description')),
    credit: fr(get(arr(get(n, 'hasBeenCreatedBy'))[0] ?? {}, 'legalName')),
    ...readImage(n),
  };
}

async function datatourismePlaces() {
  const items = await dtFetchAll('placeOfInterest', 'uuid,label,type,isLocatedAt.geo,isLocatedAt.address,hasDescription,hasContact.homepage,hasBeenCreatedBy.legalName,hasMainRepresentation');
  const typeCount = new Map();
  const out = [];
  for (const n of items) {
    const c = dtCommon(n);
    const kind = kindOf(c.types, c.name ?? '');
    for (const t of arr(get(n, 'type'))) typeCount.set(t, (typeCount.get(t) ?? 0) + 1);
    if (!kind || !c.name || /projet d[ée]mo|\btest\b/i.test(c.name)) continue;
    out.push({ ...c, kind, source: 'datatourisme' });
  }
  log(`  types les plus fréquents : ${[...typeCount].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([t, n]) => `${t}=${n}`).join(', ')}`);
  return out;
}

async function datatourismeTours() {
  const items = await dtFetchAll('tour', 'uuid,label,type,isLocatedAt.geo,isLocatedAt.address,hasDescription,hasContact.homepage,hasBeenCreatedBy.legalName,tourDistance,duration,hasTheme,hasRepresentation,hasMainRepresentation');
  return items.map((n) => {
    const c = dtCommon(n);
    const dist = Number(fr(get(n, 'tourDistance')));
    const dur = fr(get(n, 'duration'));
    const velo = /Cycl|Bike|V[ée]lo|VTT/i.test(`${c.types} ${c.name}`);
    return {
      ...c,
      kind: velo ? 'velo' : 'rando',
      distanceKm: Number.isFinite(dist) && dist > 0 ? Math.round(dist / 100) / 10 : null,
      // trace GPX/KML fournie par l'office de tourisme (lien direct vers son fichier)
      gpx: JSON.stringify(get(n, 'hasRepresentation') ?? '').match(/https?:[^"\\]+\.(gpx|kml)\b[^"\\]*/i)?.[0] ?? null,
      duration: dur && /^\d+$/.test(dur) ? `${Math.floor(+dur / 60)} h ${String(+dur % 60).padStart(2, '0')}` : null,
      source: 'datatourisme',
    };
  }).filter((p) => p.name && !/projet d[ée]mo|\btest\b/i.test(p.name));
}

// ---------- data.gouv.fr (jeux du ministère de la Culture) ----------
const OPEN = /^(fr-lo|lov2|etalab|cc-by|cc-zero|odc-odbl|odc-by|odc-pddl)/i;

function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const firstLine = text.slice(0, text.indexOf('\n'));
  const sep = [';', ',', '\t'].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows = [];
  let row = [];
  let field = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

async function dataGouv(query, titleRe, orgRe = /minist[eè]re de la culture/i) {
  const api = new URL('https://www.data.gouv.fr/api/1/datasets/');
  api.searchParams.set('q', query);
  api.searchParams.set('page_size', '20');
  const res = await fetchText(api.href, { json: true, checkRobots: false, delayMs: 300 });
  const ds = (res.data ?? []).find((d) => titleRe.test(d.title) && !d.archived && orgRe.test(d.organization?.name ?? ''));
  if (!ds) {
    log(`  data.gouv.fr : aucun jeu trouvé pour « ${query} »`);
    return null;
  }
  if (!OPEN.test(ds.license ?? '')) {
    log(`  « ${ds.title} » ignoré : licence « ${ds.license} » non ouverte`);
    return null;
  }
  // On essaie les fichiers CSV puis JSON du jeu, jusqu'à en trouver un avec des lignes
  const candidates = [
    ...(ds.resources ?? []).filter((x) => /csv/i.test(x.format ?? '')),
    ...(ds.resources ?? []).filter((x) => /json/i.test(x.format ?? '')),
  ];
  let rows = [];
  for (const r of candidates) {
    try {
      const text = await fetchText(r.url, { checkRobots: false });
      if (/^\s*</.test(text)) continue; // page HTML, pas un fichier de données
      rows = /json/i.test(r.format) ? listOf(JSON.parse(text)) : parseCsv(text);
      if (rows.length) break;
    } catch (e) {
      log(`  fichier ${r.title ?? r.url} illisible : ${e.message}`);
    }
  }
  if (!rows.length) {
    log(`  « ${ds.title} » : aucun fichier exploitable parmi ${candidates.length} (formats : ${(ds.resources ?? []).map((x) => x.format).join(', ')})`);
    return null;
  }
  log(`  « ${ds.title} » (licence ${ds.license}) : ${rows.length} lignes ; colonnes : ${Object.keys(rows[0] ?? {}).slice(0, 30).join(' | ')}`);
  return { rows, title: ds.title, page: ds.page ?? `https://www.data.gouv.fr/datasets/${ds.slug}/`, license: ds.license };
}

/** Trouve la première colonne dont le nom correspond. */
function col(row, ...res) {
  const keys = Object.keys(row);
  for (const re of res) {
    const k = keys.find((h) => re.test(h));
    if (k && row[k]) return row[k];
  }
  return null;
}

function rowCoords(row) {
  const lat = Number(String(col(row, /^lat/i) ?? '').replace(',', '.'));
  const lon = Number(String(col(row, /^lon|^lng/i) ?? '').replace(',', '.'));
  if (Number.isFinite(lat) && Number.isFinite(lon) && lat && lon) return { lat, lon };
  const xy = col(row, /g[ée]ocod|g[ée]oloc|coordonn|xy|geo_point|geopoint/i);
  const m = xy && String(xy).match(/(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)/);
  return m ? { lat: Number(m[1]), lon: Number(m[2]) } : { lat: null, lon: null };
}

const DEPT_RE = { '37': 'indre-et-loire', '45': 'loiret', '58': 'ni[eè]vre' };
function inDepts(row, postcode) {
  if (postcode && departments.includes(deptFromPostcode(postcode))) return true;
  const dep = col(row, /d[ée]partement/i);
  return !!dep && departments.some((d) => new RegExp(`(^|\\D)${d}(\\D|$)${DEPT_RE[d] ? `|${DEPT_RE[d]}` : ''}`, 'i').test(dep));
}

async function museofile() {
  const ds = await dataGouv('Muséofile musées de France', /mus[ée]ofile|mus[ée]es de france/i);
  if (!ds) return [];
  return ds.rows.map((row) => {
    const postcode = col(row, /code.?postal|^cp$/i);
    if (!inDepts(row, postcode)) return null;
    return {
      name: col(row, /nom.*(officiel|usage)|^nom/i),
      kind: 'musee',
      address: col(row, /adresse/i),
      postcode,
      city: col(row, /^ville|commune/i),
      url: col(row, /url|site|internet/i),
      ...rowCoords(row),
      source: 'museofile',
      sourceUrl: ds.page,
      credit: 'Ministère de la Culture – Muséofile',
    };
  }).filter((p) => p?.name);
}

async function festivals() {
  const ds = await dataGouv('Liste des festivals en France', /liste des festivals/i);
  if (!ds) return [];
  return ds.rows.map((row) => {
    const postcode = col(row, /code.?postal/i);
    if (!inDepts(row, postcode)) return null;
    return {
      name: col(row, /nom du festival|^nom/i),
      kind: 'festival',
      postcode,
      city: col(row, /commune principale|commune|ville/i),
      url: col(row, /site internet|site|url/i),
      period: col(row, /p[ée]riode/i),
      discipline: col(row, /discipline dominante|discipline/i),
      ...rowCoords(row),
      source: 'festivals',
      sourceUrl: ds.page,
      credit: 'Ministère de la Culture – Liste des festivals',
    };
  }).filter((p) => p?.name);
}

// ---------- Itinéraires OpenStreetMap ----------
const reverseCache = await readFile(join(ROOT, 'cache', 'reverse.json'), 'utf8').then(JSON.parse).catch(() => ({}));
async function communeOf(lat, lon) {
  const k = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (k in reverseCache) return reverseCache[k];
  try {
    const d = await fetchText(`https://api-adresse.data.gouv.fr/reverse/?lat=${lat}&lon=${lon}&type=municipality`, { json: true, checkRobots: false, delayMs: 100 });
    const f = d.features?.[0]?.properties;
    reverseCache[k] = f ? { city: f.city, postcode: f.postcode } : null;
  } catch {
    return null;
  }
  return reverseCache[k];
}

async function osmRoutes() {
  const out = [];
  for (const dept of departments) {
    for (const r of await loadRoutes(dept, join(ROOT, 'cache'), log)) {
      const c = await communeOf(r.lat, r.lon);
      out.push({
        ...r,
        city: c?.city ?? null,
        postcode: c?.postcode ?? null,
        source: 'osm-itineraires',
        sourceUrl: `https://www.openstreetmap.org/relation/${r.osmId}`,
        credit: '© contributeurs OpenStreetMap',
      });
    }
  }
  await writeFile(join(ROOT, 'cache', 'reverse.json'), JSON.stringify(reverseCache));
  return out;
}

// ---------- Assemblage ----------
const report = {};
async function collect(id, fn) {
  log(`▶ ${id}`);
  try {
    const r = await fn();
    report[id] = { ok: true, count: r.length };
    log(`  ✔ ${r.length}`);
    return r;
  } catch (e) {
    report[id] = { ok: false, error: e.message };
    log(`  ✘ ${e.message}`);
    return [];
  }
}

const all = [
  ...(await collect('datatourisme-lieux', datatourismePlaces)),
  ...(await collect('datatourisme-itineraires', datatourismeTours)),
  ...(await collect('osm-itineraires', osmRoutes)),
  ...(await collect('museofile', museofile)),
  ...(await collect('festivals', festivals)),
];

const geocoder = await createGeocoder(join(ROOT, 'cache', 'geocode.json'));
const places = [];
for (const p of all) {
  p.name = cleanText(p.name);
  if (p.description) p.description = cleanText(p.description).slice(0, 400);
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon) || !p.lat) {
    p.lat = null;
    p.lon = null;
    await geocoder.geocode(p);
  }
  p.dept ??= deptFromPostcode(p.postcode);
  if (p.lat == null || (p.dept && !departments.includes(p.dept))) continue;
  places.push(p);
}
await geocoder.save();

// Doublons (ex. un musée présent dans DATAtourisme et Muséofile) : même nom approché à moins de 400 m
const near = (a, b) => Math.abs(a.lat - b.lat) < 0.004 && Math.abs(a.lon - b.lon) < 0.006;
const key = (n) => slug(n).replace(/-(de|du|la|le|les|des|d|l)-/g, '-');
const kept = [];
for (const p of places) {
  const isRoute = (x) => x.kind === 'rando' || x.kind === 'velo';
  const twin = kept.find((q) => (q.kind === p.kind || (isRoute(q) && isRoute(p))) && near(p, q)
    && (key(q.name).includes(key(p.name)) || key(p.name).includes(key(q.name))));
  if (twin) {
    for (const k of ['url', 'address', 'description', 'period', 'discipline', 'routeUrl', 'gpx', 'distanceKm', 'network', 'image', 'imageCredit']) twin[k] ??= p[k];
    twin.sources.push({ id: p.source, url: p.sourceUrl ?? null });
    continue;
  }
  kept.push({ ...p, sources: [{ id: p.source, url: p.sourceUrl ?? null }] });
}

const out = kept.map((p, i) => {
  const o = { id: `${p.kind}-${slug(p.name).slice(0, 50)}-${i}` };
  for (const k of ['name', 'kind', 'address', 'postcode', 'city', 'lat', 'lon', 'url', 'routeUrl', 'gpx', 'image', 'imageCredit', 'description', 'distanceKm', 'partial', 'duration', 'network', 'ref', 'period', 'discipline', 'credit', 'sources']) {
    if (p[k] != null && p[k] !== '' && p[k] !== false) o[k] = p[k];
  }
  return o;
});

const counts = Object.fromEntries([...new Set(out.map((p) => p.kind))].map((k) => [k, out.filter((p) => p.kind === k).length]));
log(`\n${out.length} lieux écrits dans ${OUT} : ${JSON.stringify(counts)}`);
if (!out.length) {
  log('Aucun lieu : fichier précédent conservé.');
} else {
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), departments, sources: report, places: out }));
}
