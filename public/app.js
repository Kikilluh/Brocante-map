/* global L */
// ============================================================================
// Brocante Map — carte des sorties, filtrée pour un groupe (mobile d'abord)
// ============================================================================

const CATS = {
  brocante: 'Brocantes & puces', concert: 'Concerts', spectacle: 'Spectacles', exposition: 'Expos & musées',
  visite: 'Visites & patrimoine', atelier: 'Ateliers & animations', rando: 'Randos & nature', sport: 'Sport',
  fete: 'Fêtes & festivals', marche: 'Marchés & salons', conference: 'Conférences', autre: 'Autres',
};
const ALL = Object.keys(CATS);
const KINDS = {
  activite: 'Activités & cours', musee: 'Musées', chateau: 'Châteaux', patrimoine: 'Patrimoine', jardin: 'Parcs & jardins',
  nature: 'Nature', rando: 'Randonnées', velo: 'Vélo', loisir: 'Loisirs', festival: 'Festivals',
};
const KALL = Object.keys(KINDS);
// Envies du groupe → catégories de sorties et types de lieux
const ENVIES = {
  culture: { label: 'Culture', cats: ['exposition', 'visite', 'spectacle', 'conference'], kinds: ['musee', 'chateau', 'patrimoine'] },
  nature: { label: 'Nature & balades', cats: ['rando'], kinds: ['jardin', 'nature', 'rando', 'velo'] },
  sport: { label: 'Sport & activités', cats: ['sport', 'atelier'], kinds: ['activite', 'loisir'] },
  fete: { label: 'Fêtes & musique', cats: ['fete', 'concert'], kinds: ['festival'] },
  chine: { label: 'Brocantes & marchés', cats: ['brocante', 'marche'], kinds: [] },
};
const EALL = Object.keys(ENVIES);
const DEPT_NAMES = { '37': 'Indre-et-Loire' };
const SOURCE_NAMES = {
  datatourisme: 'DATAtourisme', openagenda: 'OpenAgenda', manual: 'ajout manuel', ticketmaster: 'Ticketmaster',
  museofile: 'Musées de France', festivals: 'Liste des festivals', 'datatourisme-lieux': 'DATAtourisme',
  'datatourisme-itineraires': 'DATAtourisme', 'osm-itineraires': 'OpenStreetMap',
};
const MOMENTS = { any: 'Peu importe', matin: 'le matin', aprem: "l'après-midi", soir: 'en soirée' };

const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const color = (c) => css(`--c-${c}`) || css('--accent');
const kcolor = (k) => css(`--k-${k}`) || css('--accent');
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const norm = (s = '') => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const isMobile = () => matchMedia('(max-width: 760px)').matches;
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* navigation privée */ } },
};

// ---------- Dates ----------
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmtDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const PRESETS = [['today', "Aujourd'hui"], ['weekend', 'Ce week-end'], ['nextweekend', 'Week-end prochain'], ['7', '7 jours'], ['30', '30 jours'], ['all', 'Tout']];

function weekend(offset = 0) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const dow = t.getDay();
  let sat = dow === 0 ? addDays(t, -1) : addDays(t, 6 - dow);
  sat = addDays(sat, 7 * offset);
  return [iso(offset === 0 && dow === 0 ? t : sat), iso(addDays(sat, 1))];
}
function presetRange(p) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  if (p === 'today') return [iso(t), iso(t)];
  if (p === 'weekend') return weekend(0);
  if (p === 'nextweekend') return weekend(1);
  if (p === 'all') return [iso(t), ''];
  return [iso(t), iso(addDays(t, Number(p) - 1))];
}
const fmtShortY = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
function occLabel(o) {
  if (o.start === o.end) return fmtDay.format(parse(o.start));
  const thisYear = String(new Date().getFullYear());
  // Longue période (exposition…) sur plusieurs années : on affiche l'année
  if (o.start.slice(0, 4) !== o.end.slice(0, 4) || o.start.slice(0, 4) !== thisYear) {
    return o.start < iso(new Date()) ? `jusqu'au ${fmtShortY.format(parse(o.end))}` : `du ${fmtShortY.format(parse(o.start))} au ${fmtShortY.format(parse(o.end))}`;
  }
  return `du ${fmtShort.format(parse(o.start))} au ${fmtShort.format(parse(o.end))}`;
}
const hourOf = (h) => { const m = String(h ?? '').match(/(\d{1,2})[:h]/); return m ? +m[1] : null; };

// ---------- Libellés ----------
const euro = (x) => `${Number.isInteger(x) ? x : x.toFixed(2).replace('.', ',')} €`;
const isFree = (ev) => ev.free === true || (ev.priceMin === 0 && !ev.priceMax);
function priceLabel(ev) {
  if (isFree(ev)) return 'Gratuit';
  if (ev.priceMin == null) return '';
  if (ev.priceMax == null || ev.priceMax === ev.priceMin) return euro(ev.priceMin);
  return `${ev.priceMin === 0 ? 'gratuit' : euro(ev.priceMin)} à ${euro(ev.priceMax)}`;
}
function ageLabel(ev) {
  if (ev.ageMin != null && ev.ageMax != null) return `${ev.ageMin}–${ev.ageMax} ans`;
  if (ev.ageMin != null) return ev.ageMin === 0 ? '' : `dès ${ev.ageMin} ans`;
  if (ev.ageMax != null) return `jusqu'à ${ev.ageMax} ans`;
  return '';
}
const km = (x) => (x < 1 ? "moins d'1 km" : `${String(Math.round(x * 10) / 10).replace('.', ',')} km`);

// ---------- État ----------
const NEW_GROUP = () => ({ set: false, adults: 2, kids: [], moment: 'any', center: null, radius: 0, budget: null, budgetMode: 'person', envies: [...EALL] });
const state = {
  mode: 'events', preset: '30', from: '', to: '', cats: new Set(ALL), kinds: new Set(KALL), q: '',
  unknown: true, sort: 'date', me: null, group: { ...NEW_GROUP(), ...(store.get('groupe') ?? {}) }, selected: null,
};
let events = [];
let places = [];
const markers = new Map();
const groupSize = () => state.group.adults + state.group.kids.length;

function encodeGroup(g) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(g)))).replace(/=+$/, '');
}
function decodeGroup(s) {
  try { return JSON.parse(decodeURIComponent(escape(atob(s)))); } catch { return null; }
}
function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('du') || h.get('au')) { state.from = h.get('du') || ''; state.to = h.get('au') || ''; state.preset = null; }
  else if (h.get('p')) state.preset = h.get('p');
  if (h.get('cat')) state.cats = new Set(h.get('cat').split(',').filter((t) => t in CATS));
  if (h.get('k')) state.kinds = new Set(h.get('k').split(',').filter((t) => t in KINDS));
  if (h.get('q')) state.q = h.get('q');
  if (h.get('inc') === '0') state.unknown = false;
  if (h.get('m') === 'lieux') state.mode = 'places';
  const g = h.get('g') && decodeGroup(h.get('g'));
  if (g) state.group = { ...NEW_GROUP(), ...g, set: true };
  state.selected = h.get('e') ? { type: 'events', id: h.get('e') } : h.get('l') ? { type: 'places', id: h.get('l') } : null;
  if (state.preset) [state.from, state.to] = presetRange(state.preset);
}
function writeHash() {
  const h = new URLSearchParams();
  if (state.preset) h.set('p', state.preset); else { if (state.from) h.set('du', state.from); if (state.to) h.set('au', state.to); }
  if (state.cats.size !== ALL.length) h.set('cat', [...state.cats].join(','));
  if (state.kinds.size !== KALL.length) h.set('k', [...state.kinds].join(','));
  if (state.q) h.set('q', state.q);
  if (!state.unknown) h.set('inc', '0');
  if (state.mode === 'places') h.set('m', 'lieux');
  if (state.group.set) h.set('g', encodeGroup(state.group));
  if (state.selected) h.set(state.selected.type === 'events' ? 'e' : 'l', state.selected.id);
  history.replaceState(null, '', `#${h}`);
}

// ---------- Carte ----------
if (!(window.L && window.L.markerClusterGroup)) {
  const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop, construct: () => noop });
  window.L = noop;
  $('mapError').hidden = false;
}
const map = L.map('map', { zoomControl: !isMobile(), attributionControl: true }).setView([47.25, 0.7], 9);
const planIGN = L.tileLayer(
  'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
  { maxZoom: 19, attribution: '© <a href="https://www.ign.fr/">IGN</a>' },
).addTo(map);
const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' });
L.control.layers({ 'Plan IGN': planIGN, OpenStreetMap: osm }, null, { position: 'bottomleft' }).addTo(map);
const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45 });
const placeCluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45 });
map.addLayer(cluster);
let centerLayer = null;
let meMarker = null;
map.on('click', () => { if (isMobile() && !state.selected) setSheet('peek'); });

const icons = {};
const pinIcon = (cat) => (icons[cat] ??= L.divIcon({ className: '', html: `<div class="pin" style="background:${color(cat)}"></div>`, iconSize: [24, 24], iconAnchor: [12, 24] }));
const picons = {};
const placeIcon = (k) => (picons[k] ??= L.divIcon({ className: '', html: `<div class="pin place" style="background:${kcolor(k)}"></div>`, iconSize: [20, 20], iconAnchor: [10, 10] }));

function distFrom(ref, x) {
  return ref ? map.distance([ref.lat, ref.lon], [x.lat, x.lon]) / 1000 : null;
}
const refPoint = () => state.group.center ?? state.me;

function drawCenter() {
  centerLayer?.remove();
  centerLayer = null;
  const c = state.group.center;
  if (!c) return;
  centerLayer = L.layerGroup([
    L.marker([c.lat, c.lon], { icon: L.divIcon({ className: '', html: '<div class="center-mark"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false }),
    ...(state.group.radius ? [L.circle([c.lat, c.lon], { radius: state.group.radius * 1000, color: '#7d9fe0', weight: 2, fillOpacity: 0.06, interactive: false })] : []),
  ]).addTo(map);
}

// ---------- Filtres ----------
function effectiveCats() {
  const e = state.group.envies;
  if (!state.group.set || e.length === EALL.length) return state.cats;
  const allowed = new Set(e.flatMap((k) => ENVIES[k].cats));
  return new Set([...state.cats].filter((c) => allowed.has(c)));
}
function effectiveKinds() {
  const e = state.group.envies;
  if (!state.group.set || e.length === EALL.length) return state.kinds;
  const allowed = new Set(e.flatMap((k) => ENVIES[k].kinds));
  return new Set([...state.kinds].filter((c) => allowed.has(c)));
}
const nextIn = (ev) => ev.occurrences.find((o) => (!state.from || o.end >= state.from) && (!state.to || o.start <= state.to)) ?? null;

/** Le groupe peut-il aller à cette sortie ? Retourne null si non, sinon des indications. */
function groupCheck(ev) {
  const g = state.group;
  const u = state.unknown;
  const notes = [];
  if (!g.set) return notes;
  const n = groupSize();
  if (ev.capacity != null && ev.capacity < n) return null;
  // Âges : chaque enfant doit être dans la tranche ; un groupe d'adultes est exclu des activités réservées aux enfants
  if (g.kids.length) {
    if (ev.ageMin != null || ev.ageMax != null) {
      if (g.kids.some((a) => (ev.ageMin != null && a < ev.ageMin) || (ev.ageMax != null && a > ev.ageMax))) return null;
      notes.push('Adapté aux âges des enfants');
    } else if (!u) return null;
  } else if (ev.ageMax != null && ev.ageMax < 18) return null;
  // Budget
  if (g.budget != null) {
    const pp = g.budgetMode === 'total' ? g.budget / n : g.budget;
    if (ev.priceMin == null && ev.free == null) { if (!u) return null; }
    else if (g.budget === 0 ? !isFree(ev) : ev.priceMin > pp) return null;
  }
  if (ev.priceMin > 0 && n > 1) notes.push(`≈ ${euro(ev.priceMin * n)} pour le groupe`);
  else if (isFree(ev)) notes.push('Gratuit pour tout le groupe');
  return notes;
}
function momentOk(o) {
  const m = state.group.set ? state.group.moment : 'any';
  if (m === 'any') return true;
  const h = hourOf(o.hours);
  if (h == null) return true;
  return m === 'matin' ? h < 12 : m === 'aprem' ? h >= 12 && h < 18 : h >= 18;
}
function inRadius(x) {
  const g = state.group;
  if (!g.set || !g.radius || !g.center) return true;
  return distFrom(g.center, x) <= g.radius;
}

function filteredEvents() {
  const cats = effectiveCats();
  const q = norm(state.q.trim());
  const out = [];
  for (const ev of events) {
    if (!cats.has(ev.category)) continue;
    if (q && !ev._search.includes(q)) continue;
    const occ = ev.occurrences.filter((o) => (!state.from || o.end >= state.from) && (!state.to || o.start <= state.to));
    const next = occ.find(momentOk);
    if (!next || !inRadius(ev)) continue;
    const notes = groupCheck(ev);
    if (!notes) continue;
    ev._next = next;
    ev._notes = notes;
    ev._dist = distFrom(refPoint(), ev);
    out.push(ev);
  }
  if (state.sort === 'distance' && refPoint()) out.sort((a, b) => a._dist - b._dist);
  else out.sort((a, b) => a._next.start.localeCompare(b._next.start) || (hourOf(a._next.hours) ?? 99) - (hourOf(b._next.hours) ?? 99));
  return out;
}
function filteredPlaces() {
  const kinds = effectiveKinds();
  const q = norm(state.q.trim());
  const out = places.filter((p) => kinds.has(p.kind) && (!q || p._search.includes(q)) && inRadius(p));
  for (const p of out) p._dist = distFrom(refPoint(), p);
  if (refPoint()) out.sort((a, b) => a._dist - b._dist);
  else out.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return out;
}

// ---------- Rendu de la liste ----------
const badge = (label, col) => `<span class="badge" style="background:${col}">${esc(label)}</span>`;

function render() {
  document.body.className = `mode-${state.mode}`;
  $$('[data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === state.mode)));
  const isEv = state.mode === 'events';
  map.removeLayer(isEv ? placeCluster : cluster);
  map.addLayer(isEv ? cluster : placeCluster);
  const layer = isEv ? cluster : placeCluster;
  const list = isEv ? filteredEvents() : filteredPlaces();
  layer.clearLayers();
  markers.clear();
  layer.addLayers(list.map((x) => {
    const m = L.marker([x.lat, x.lon], { icon: isEv ? pinIcon(x.category) : placeIcon(x.kind), title: x.title ?? x.name });
    m.on('click', () => select(state.mode, x.id, { fromMap: true }));
    markers.set(x.id, m);
    return m;
  }));

  current = list;
  renderList();
  syncControls();
  writeHash();
}

// La liste ne montre que ce qui est visible sur la carte ; elle se met à jour quand on la déplace.
let current = [];
function visibleBounds() {
  if (!map.getBounds || typeof map.getBounds !== 'function') return null;
  try {
    const b = map.getBounds();
    // Sur mobile, le bas de la carte est caché par le panneau : on ne compte que la partie visible
    // (en plein écran, la carte est cachée : on garde toute la zone qu'elle montrait)
    if (isMobile() && $('sheet').dataset.state === 'half') {
      const sheetTop = $('sheet').getBoundingClientRect().top - $('map').getBoundingClientRect().top;
      const p = map.containerPointToLatLng([0, Math.max(40, sheetTop)]);
      return L.latLngBounds([p.lat, b.getWest()], b.getNorthEast());
    }
    return b;
  } catch { return null; }
}
function renderList() {
  const isEv = state.mode === 'events';
  const b = visibleBounds();
  const inView = b?.contains ? current.filter((x) => b.contains([x.lat, x.lon])) : current;
  const n = inView.length;
  const total = current.length;
  const noun = isEv ? `sortie${n > 1 ? 's' : ''}` : `lieu${n > 1 ? 'x' : ''} et activité${n > 1 ? 's' : ''}`;
  $('count').textContent = n === total ? `${n} ${noun}` : `${n} ${noun} ici · ${total} au total`;
  const ol = $('list');
  if (!total) {
    ol.innerHTML = `<li class="empty">Rien ne correspond à ces critères.<br><button class="btn small" id="widen">Élargir la recherche</button></li>`;
    $('widen').onclick = () => { state.preset = 'all'; [state.from, state.to] = presetRange('all'); state.unknown = true; state.q = ''; $('q').value = ''; if (state.group.radius) state.group.radius = 0; saveGroup(); render(); };
  } else if (!n) {
    ol.innerHTML = `<li class="empty">Rien dans cette partie de la carte.<br><button class="btn small" id="zoomOut">Voir tout</button></li>`;
    $('zoomOut').onclick = () => map.fitBounds(L.latLngBounds(current.map((x) => [x.lat, x.lon])).pad(0.05), { maxZoom: 12 });
  } else {
    ol.innerHTML = inView.slice(0, 300).map((x) => (isEv ? eventItem(x) : placeItem(x))).join('');
  }
}
let moveTimer;
map.on('moveend', () => { clearTimeout(moveTimer); moveTimer = setTimeout(renderList, 120); });

function eventItem(ev) {
  const facts = [priceLabel(ev), ageLabel(ev), ev._dist != null ? km(ev._dist) : ''].filter(Boolean).join(' · ');
  return `<li><button class="item" data-id="${esc(ev.id)}">
    <span class="stripe" style="background:${color(ev.category)}"></span>
    <span class="body">
      <span class="when">${esc(occLabel(ev._next))}${ev._next.hours ? ` · ${esc(ev._next.hours)}` : ''}</span>
      <span class="title" style="display:block">${esc(ev.title)}</span>
      ${ev.venue ? `<span class="venue" style="display:block">${esc(ev.venue)}</span>` : ''}
      <span class="where" style="display:block">${esc(ev.city ?? '')}${facts ? ` · ${esc(facts)}` : ''}</span>
      ${ev._notes?.length ? `<span class="fit">${esc(ev._notes[0])}</span>` : ''}
    </span>${thumb(ev)}</button></li>`;
}
function placeItem(p) {
  const facts = [p.distanceKm ? km(p.distanceKm) : '', p.network ?? '', p.period ?? '', p._dist != null ? `à ${km(p._dist)}` : ''].filter(Boolean).join(' · ');
  return `<li><button class="item" data-id="${esc(p.id)}">
    <span class="stripe" style="background:${kcolor(p.kind)}"></span>
    <span class="body">
      <span class="title" style="display:block">${esc(p.name)}</span>
      <span class="where" style="display:block">${badge(KINDS[p.kind] ?? p.kind, kcolor(p.kind))} ${esc(p.city ?? '')}${facts ? ` · ${esc(facts)}` : ''}</span>
    </span>${thumb(p)}</button></li>`;
}

const thumb = (x) => (x.image ? `<img class="thumb" src="${esc(x.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : '');
const hero = (x) => (x.image ? `<figure class="hero"><img src="${esc(x.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('figure').remove()">${x.imageCredit ? `<figcaption>${esc(x.imageCredit)}</figcaption>` : ''}</figure>` : '');

// ---------- Fiche détaillée ----------
const link = (href, label, cls = '') => `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener">${label}</a>`;
function sourcesLine(x) {
  const s = (x.sources ?? []).map((s) => (s.url ? link(s.url, esc(SOURCE_NAMES[s.id] ?? s.id)) : esc(SOURCE_NAMES[s.id] ?? s.id))).join(' · ');
  return `<p class="src">Source : ${s || '—'}${x.credit ? ` · ${esc(x.credit)}` : ''}</p>`;
}
function eventDetail(ev) {
  const next = ev._next ?? nextIn(ev) ?? ev.occurrences[0];
  const notes = groupCheck(ev) ?? [];
  const facts = [priceLabel(ev), ageLabel(ev), ev.capacity ? `${ev.capacity} places` : '', ev._dist != null ? `à ${km(ev._dist)}` : ''].filter(Boolean);
  const others = ev.occurrences.filter((o) => o !== next && o.end >= iso(new Date())).slice(0, 8);
  const where = [ev.address, ev.postcode && ev.city ? `${ev.postcode} ${ev.city}` : ev.city].filter(Boolean).join(', ');
  return `<button class="back" data-back>← Retour à la liste</button>
    <div>${badge(CATS[ev.category], color(ev.category))}</div>
    <h2>${esc(ev.title)}</h2>
    <p class="when">${esc(occLabel(next))}${next.hours ? ` · ${esc(next.hours)}` : ''}</p>
    ${ev.venue ? `<p class="venue">${esc(ev.venue)}</p>` : ''}
    ${where ? `<p class="muted">${esc(where)}</p>` : ''}
    ${ev.organizer && ev.organizer !== ev.venue ? `<p class="muted">Organisé par ${esc(ev.organizer)}</p>` : ''}
    ${facts.length ? `<div class="facts">${facts.map((f) => `<span>${esc(f)}</span>`).join('')}</div>` : ''}
    ${state.group.set && notes.length ? `<p class="fitline">${notes.map(esc).join(' · ')}</p>` : ''}
    ${state.group.set && ev.priceMin == null && ev.free == null ? '<p class="fitline warn">Prix non précisé : vérifiez auprès de l\'organisateur.</p>' : ''}
    <div class="actions sticky">
      ${ev.url ? link(ev.url, ev.sources?.some((s) => s.id === 'ticketmaster') ? 'Billets' : 'Site / infos', 'primary') : ''}
      ${link(`https://www.openstreetmap.org/directions?to=${ev.lat},${ev.lon}`, 'Itinéraire')}
      <button data-share>Partager</button>
    </div>
    ${hero(ev)}
    ${others.length ? `<details><summary>${others.length} autre${others.length > 1 ? 's' : ''} date${others.length > 1 ? 's' : ''}</summary><ul class="dates">${others.map((o) => `<li>${esc(occLabel(o))}${o.hours ? ` · ${esc(o.hours)}` : ''}</li>`).join('')}</ul></details>` : ''}
    ${ev.description ? `<p class="desc">${esc(ev.description)}</p>` : ''}
    ${sourcesLine(ev)}`;
}
function placeDetail(p) {
  const isRoute = p.kind === 'rando' || p.kind === 'velo';
  const facts = [p.distanceKm ? `${km(p.distanceKm)}${p.partial ? ' dans le département' : ''}` : '', p.duration ?? '', p.network ?? '', p.period ?? '', p.discipline ?? '', p._dist != null ? `à ${km(p._dist)}` : ''].filter(Boolean);
  const where = [p.address, p.postcode && p.city ? `${p.postcode} ${p.city}` : p.city].filter(Boolean).join(', ');
  return `<button class="back" data-back>← Retour à la liste</button>
    <div>${badge(KINDS[p.kind] ?? p.kind, kcolor(p.kind))}</div>
    <h2>${esc(p.name)}</h2>
    ${where ? `<p class="muted">${isRoute ? (p.partial ? 'Entrée dans le département : ' : 'Départ : ') : ''}${esc(where)}</p>` : ''}
    ${facts.length ? `<div class="facts">${facts.map((f) => `<span>${esc(f)}</span>`).join('')}</div>` : ''}
    <div class="actions sticky">
      ${p.routeUrl ? link(p.routeUrl, "Voir l'itinéraire", 'primary') : p.url ? link(p.url, 'Site / infos', 'primary') : ''}
      ${p.gpx ? link(p.gpx, 'Trace GPX') : ''}
      ${p.routeUrl && p.url ? link(p.url, 'Site') : ''}
      ${link(`https://www.openstreetmap.org/directions?to=${p.lat},${p.lon}`, isRoute ? 'Aller au départ' : 'Itinéraire')}
      <button data-share>Partager</button>
    </div>
    ${hero(p)}
    ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ''}
    ${sourcesLine(p)}`;
}

function select(type, id, { fromMap = false } = {}) {
  const item = (type === 'events' ? events : places).find((x) => x.id === id);
  if (!item) return;
  state.selected = { type, id };
  if (state.mode !== type) { state.mode = type; render(); }
  item._dist = distFrom(refPoint(), item);
  const d = $('detail');
  d.innerHTML = type === 'events' ? eventDetail(item) : placeDetail(item);
  d.hidden = false;
  $('list').hidden = true;
  $('sheetBody').scrollTop = 0;
  const m = markers.get(id);
  if (m && !fromMap) (type === 'events' ? cluster : placeCluster).zoomToShowLayer(m, () => map.panTo(m.getLatLng()));
  else if (m) map.panTo(m.getLatLng());
  if (isMobile()) setSheet('half');
  writeHash();
}
function unselect() {
  state.selected = null;
  $('detail').hidden = true;
  $('list').hidden = false;
  writeHash();
}
$('detail').addEventListener('click', async (e) => {
  if (e.target.closest('[data-back]')) return unselect();
  if (e.target.closest('[data-share]')) {
    const url = location.href;
    const title = $('detail').querySelector('h2')?.textContent ?? 'Sortie';
    try {
      if (navigator.share) await navigator.share({ title, url });
      else { await navigator.clipboard.writeText(url); e.target.textContent = 'Lien copié ✓'; }
    } catch { /* partage annulé */ }
  }
});
$('list').addEventListener('click', (e) => {
  const b = e.target.closest('.item');
  if (b) select(state.mode, b.dataset.id);
});

// ---------- Panneau du bas (mobile) ----------
function setSheet(s) { $('sheet').dataset.state = s; setTimeout(renderList, 300); }
(() => {
  const sheet = $('sheet');
  const handle = $('sheetHandle');
  let y0 = null; let t0 = 0; let base = 0; let moved = false;
  const order = ['peek', 'half', 'full'];
  handle.addEventListener('pointerdown', (e) => {
    if (!isMobile() || e.target.closest('select')) return;
    y0 = e.clientY; t0 = Date.now(); moved = false;
    base = sheet.getBoundingClientRect().top - sheet.parentElement.getBoundingClientRect().top;
    sheet.classList.add('dragging');
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', (e) => {
    if (y0 == null) return;
    const dy = e.clientY - y0;
    if (Math.abs(dy) > 4) moved = true;
    sheet.style.transform = `translateY(${Math.max(0, base + dy)}px)`;
  });
  const end = (e) => {
    if (y0 == null) return;
    sheet.classList.remove('dragging');
    sheet.style.transform = '';
    const dy = e.clientY - y0;
    const fast = Math.abs(dy) / Math.max(1, Date.now() - t0) > 0.5;
    const i = order.indexOf(sheet.dataset.state);
    if (!moved) setSheet(order[(i + 1) % order.length]);
    else if (dy < -40 || (fast && dy < 0)) setSheet(order[Math.min(2, i + 1)]);
    else if (dy > 40 || (fast && dy > 0)) setSheet(order[Math.max(0, i - 1)]);
    y0 = null;
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
})();

// ---------- Contrôles ----------
function syncControls() {
  $('from').value = state.from;
  $('to').value = state.to;
  $('unknown').checked = state.unknown;
  $$('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === state.preset)));
  $$('[data-type]').forEach((b) => b.setAttribute('aria-pressed', String(state.cats.has(b.dataset.type))));
  $$('[data-kind]').forEach((b) => b.setAttribute('aria-pressed', String(state.kinds.has(b.dataset.kind))));
  const full = state.mode === 'places' ? state.kinds.size === KALL.length : state.cats.size === ALL.length;
  $('allTypes').textContent = full ? 'Tout décocher' : 'Tout cocher';
  $('filtersBadge').hidden = full && state.unknown && (state.preset === '30' || state.mode === 'places');
  $('groupSummary').textContent = groupSummary();
  $('groupCta').hidden = state.group.set;
  $('groupPill').hidden = !state.group.set;
  $('periodLabel').textContent = periodLabel();
  $('searchBadge').hidden = !state.q;
}

function periodLabel() {
  if (state.preset) return Object.fromEntries(PRESETS)[state.preset];
  const f = (d) => fmtShort.format(parse(d));
  return state.to ? (state.from === state.to ? f(state.from) : `${f(state.from)} → ${f(state.to)}`) : `dès le ${f(state.from)}`;
}
function groupSummary() {
  const g = state.group;
  if (!g.set) return 'Notre groupe : qui, quand, où, budget ?';
  const parts = [];
  parts.push(`${g.adults} adulte${g.adults > 1 ? 's' : ''}`);
  if (g.kids.length) parts.push(`${g.kids.length} enfant${g.kids.length > 1 ? 's' : ''} (${g.kids.join(', ')} ans)`);
  if (g.budget != null) parts.push(g.budget === 0 ? 'gratuit' : `≤ ${g.budget} € ${g.budgetMode === 'total' ? 'en tout' : '/pers.'}`);
  if (g.center) parts.push(g.radius ? `${g.radius} km autour de ${g.center.label}` : `autour de ${g.center.label}`);
  if (g.moment !== 'any') parts.push(MOMENTS[g.moment]);
  return parts.join(' · ');
}
function saveGroup() { store.set('groupe', state.group); }

function chipsHtml(map, colorVar, attr) {
  return Object.entries(map).map(([k, v]) => `<button type="button" class="chip type" data-${attr}="${k}"><span class="dot" style="background:var(--${colorVar}-${k})"></span>${v}</button>`).join('');
}
$$('[data-types-container]').forEach((el) => { el.innerHTML = chipsHtml(CATS, 'c', 'type'); });
$$('[data-kinds-container]').forEach((el) => { el.innerHTML = chipsHtml(KINDS, 'k', 'kind'); });
$$('[data-presets-copy]').forEach((el) => { el.innerHTML = PRESETS.map(([k, v]) => `<button type="button" class="chip" data-preset="${k}">${v}</button>`).join(''); });

function toggleIn(set, all, k) {
  if (set.size === all.length) return new Set([k]);
  const s = new Set(set);
  if (s.has(k)) s.delete(k); else s.add(k);
  return s.size ? s : new Set(all);
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-type],[data-kind],[data-preset],[data-mode]');
  if (!t) return;
  if (t.dataset.type) state.cats = toggleIn(state.cats, ALL, t.dataset.type);
  else if (t.dataset.kind) state.kinds = toggleIn(state.kinds, KALL, t.dataset.kind);
  else if (t.dataset.preset) {
    state.preset = t.dataset.preset;
    [state.from, state.to] = presetRange(state.preset);
    if (t.closest('#groupDialog')) { syncControls(); return; }
  } else if (t.dataset.mode) { state.mode = t.dataset.mode; unselect(); }
  render();
});
$('allTypes').addEventListener('click', () => {
  if (state.mode === 'places') state.kinds = state.kinds.size === KALL.length ? new Set() : new Set(KALL);
  else state.cats = state.cats.size === ALL.length ? new Set() : new Set(ALL);
  if (!state.kinds.size) state.kinds = new Set(['musee']);
  if (!state.cats.size) state.cats = new Set(['concert']);
  render();
});
for (const id of ['from', 'to']) {
  $(id).addEventListener('change', () => {
    state[id] = $(id).value;
    if (state.from && state.to && state.to < state.from) { if (id === 'from') state.to = state.from; else state.from = state.to; }
    state.preset = null;
    render();
  });
}
$('unknown').addEventListener('change', () => { state.unknown = $('unknown').checked; render(); });
$('reset').addEventListener('click', () => {
  Object.assign(state, { preset: '30', cats: new Set(ALL), kinds: new Set(KALL), unknown: true, q: '' });
  [state.from, state.to] = presetRange('30');
  $('q').value = '';
  render();
});
$('openSearch').addEventListener('click', () => { $('top').classList.add('searching'); $('q').focus(); });
$('closeSearch').addEventListener('click', () => {
  $('top').classList.remove('searching');
  if (state.q) { state.q = ''; $('q').value = ''; render(); }
});
$('q').addEventListener('blur', () => { if (!$('q').value) $('top').classList.remove('searching'); });
let qTimer;
$('q').addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(() => { state.q = $('q').value; unselect(); render(); }, 180); });
$('sort').addEventListener('change', () => {
  state.sort = $('sort').value;
  if (state.sort === 'distance' && !refPoint()) locateMe();
  render();
});
$('openFilters').addEventListener('click', () => { syncControls(); $('filtersDialog').showModal(); });
$('filtersDialog').addEventListener('close', () => { if (isMobile()) setSheet('half'); });

function locateMe(then, silent = false) {
  if (!navigator.geolocation) return silent ? null : alert('Localisation indisponible sur cet appareil.');
  navigator.geolocation.getCurrentPosition((pos) => {
    state.me = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    meMarker?.remove();
    meMarker = L.circleMarker([state.me.lat, state.me.lon], { radius: 7, color: '#fff', weight: 2, fillColor: '#5b8def', fillOpacity: 1 }).addTo(map);
    then ? then(state.me) : (map.setView([state.me.lat, state.me.lon], 12), render());
  }, () => { if (!silent) alert('Impossible de vous localiser (autorisation refusée ?).'); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
}
$('locate').addEventListener('click', () => locateMe());

// ---------- Assistant « Notre groupe » ----------
let draft = null;
let step = 0;
function openGroup() {
  draft = structuredClone({ ...state.group, set: true });
  step = 0;
  renderGroup();
  $('groupDialog').showModal();
}
function renderGroup() {
  $$('#groupDialog .step').forEach((s) => { s.hidden = +s.dataset.step !== step; });
  $$('#groupDialog .steps li').forEach((li, i) => li.classList.toggle('on', i <= step));
  $('groupPrev').hidden = step === 0;
  $('groupNext').textContent = step === 3 ? 'Voir nos sorties' : 'Suivant';
  $('adults').textContent = draft.adults;
  const who = draft.kids.length ? 'famille' : draft.adults === 1 ? 'solo' : draft.adults === 2 ? 'couple' : draft.adults >= 3 ? 'amis' : null;
  $$('[data-gpreset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.gpreset === who)));
  $('kidsList').innerHTML = draft.kids.map((a, i) => `<li><label>Enfant ${i + 1}
      <select data-kid="${i}">${Array.from({ length: 18 }, (_, k) => `<option value="${k}"${k === a ? ' selected' : ''}>${k === 0 ? 'moins d\'1 an' : `${k} an${k > 1 ? 's' : ''}`}</option>`).join('')}</select>
    </label><button type="button" class="rm" data-rmkid="${i}" aria-label="Retirer l'enfant ${i + 1}">✕</button></li>`).join('');
  $$('#moments [data-moment]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.moment === draft.moment)));
  $$('#radii [data-radius]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.radius === (draft.radius || 0))));
  $$('#budgets [data-budget]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.budget === '' ? null : +b.dataset.budget) === draft.budget)));
  $$('input[name="budgetMode"]').forEach((r) => { r.checked = r.value === draft.budgetMode; });
  $('envies').innerHTML = EALL.map((k) => `<button type="button" class="chip" data-envie="${k}" aria-pressed="${draft.envies.includes(k)}">${ENVIES[k].label}</button>`).join('');
  $('centerLabel').textContent = draft.center ? `Autour de ${draft.center.label}` : "Toute l'Indre-et-Loire";
  syncControls();
}
$('groupCta').addEventListener('click', openGroup);
$('groupPill').addEventListener('click', openGroup);
$('periodPill').addEventListener('click', () => { syncControls(); $('filtersDialog').showModal(); });
$('groupForm').addEventListener('click', (e) => {
  const t = e.target;
  if (t.closest('[data-adults]')) draft.adults = Math.max(0, Math.min(20, draft.adults + +t.closest('[data-adults]').dataset.adults));
  else if (t.closest('[data-gpreset]')) {
    const p = t.closest('[data-gpreset]').dataset.gpreset;
    Object.assign(draft, { solo: { adults: 1, kids: [] }, couple: { adults: 2, kids: [] }, famille: { adults: 2, kids: draft.kids.length ? draft.kids : [6] }, amis: { adults: 4, kids: [] } }[p]);
  } else if (t.id === 'addKid') draft.kids = [...draft.kids, 6];
  else if (t.closest('[data-rmkid]')) draft.kids = draft.kids.filter((_, i) => i !== +t.closest('[data-rmkid]').dataset.rmkid);
  else if (t.closest('[data-moment]')) draft.moment = t.closest('[data-moment]').dataset.moment;
  else if (t.closest('[data-radius]')) draft.radius = +t.closest('[data-radius]').dataset.radius;
  else if (t.closest('[data-budget]')) { const v = t.closest('[data-budget]').dataset.budget; draft.budget = v === '' ? null : +v; }
  else if (t.closest('[data-envie]')) {
    const k = t.closest('[data-envie]').dataset.envie;
    draft.envies = draft.envies.length === EALL.length ? [k] : draft.envies.includes(k) ? draft.envies.filter((x) => x !== k) : [...draft.envies, k];
    if (!draft.envies.length) draft.envies = [...EALL];
  } else if (t.closest('[data-addr]')) {
    const b = t.closest('[data-addr]');
    draft.center = { lat: +b.dataset.lat, lon: +b.dataset.lon, label: b.dataset.addr };
    if (!draft.radius) draft.radius = 20;
    $('addr').value = '';
    $('addrSuggest').hidden = true;
  } else return;
  renderGroup();
});
$('groupForm').addEventListener('change', (e) => {
  if (e.target.dataset.kid != null) draft.kids[+e.target.dataset.kid] = +e.target.value;
  if (e.target.name === 'budgetMode') draft.budgetMode = e.target.value;
});
$('groupPrev').addEventListener('click', () => { step = Math.max(0, step - 1); renderGroup(); });
$('groupNext').addEventListener('click', () => {
  if (step < 3) { step++; renderGroup(); return; }
  state.group = draft;
  saveGroup();
  drawCenter();
  if (draft.center) map.setView([draft.center.lat, draft.center.lon], draft.radius >= 40 ? 9 : draft.radius >= 20 ? 10 : 11);
  $('groupDialog').close();
  unselect();
  render();
  if (isMobile()) setSheet('half');
});
$('groupClear').addEventListener('click', () => {
  state.group = NEW_GROUP();
  saveGroup();
  drawCenter();
  $('groupDialog').close();
  render();
});
$('useMyPos').addEventListener('click', () => locateMe((p) => {
  draft.center = { ...p, label: 'ma position' };
  if (!draft.radius) draft.radius = 20;
  renderGroup();
}));
let addrTimer;
$('addr').addEventListener('input', () => {
  clearTimeout(addrTimer);
  const q = $('addr').value.trim();
  if (q.length < 3) { $('addrSuggest').hidden = true; return; }
  addrTimer = setTimeout(async () => {
    const qs = `q=${encodeURIComponent(q)}&limit=5&lat=47.3&lon=0.7`;
    let data = null;
    for (const base of ['https://api-adresse.data.gouv.fr/search/', 'https://data.geopf.fr/geocodage/search']) {
      try { const r = await fetch(`${base}?${qs}`); if (r.ok) { data = await r.json(); break; } } catch { /* service suivant */ }
    }
    const feats = data?.features ?? [];
    $('addrSuggest').innerHTML = feats.map((f) => {
      const p = f.properties;
      const label = p.type === 'municipality' ? p.city : p.label;
      return `<li><button type="button" data-addr="${esc(p.type === 'municipality' ? p.city : `${p.name}, ${p.city}`)}" data-lat="${f.geometry.coordinates[1]}" data-lon="${f.geometry.coordinates[0]}">${esc(label)}</button></li>`;
    }).join('');
    $('addrSuggest').hidden = !feats.length;
  }, 250);
});

// ---------- Données ----------
async function getJson(url) {
  try { const r = await fetch(url, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch { return null; }
}
const OLD_TYPES = { 'vide-grenier': 'brocante', braderie: 'brocante', puces: 'brocante', bourse: 'brocante' };

(async () => {
  readHash();
  $('q').value = state.q;
  let data = (await getJson('data/events.json')) ?? (await getJson('data/brocantes.json'));
  if (!data?.events?.length) { data = await getJson('data/demo.json'); $('demoBanner').hidden = !data; }
  data ??= { events: [], departments: ['37'] };
  events = data.events.filter((e) => e.lat != null && e.lon != null).map((e) => {
    let category = e.category ?? OLD_TYPES[e.type] ?? e.type ?? 'autre';
    if (!(category in CATS)) category = 'autre';
    const occurrences = e.dates?.length
      ? e.dates.map(([start, end, hours]) => ({ start, end: end ?? start, hours: hours ?? null }))
      : [{ start: e.start, end: e.end ?? e.start, hours: e.hours ?? null }];
    return { ...e, category, occurrences, sources: e.sources ?? [], _search: norm(`${e.title} ${e.venue ?? ''} ${e.organizer ?? ''} ${e.city ?? ''} ${e.postcode ?? ''} ${e.description ?? ''} ${CATS[category]}`) };
  });
  const pd = await getJson('data/places.json');
  places = (pd?.places ?? []).filter((p) => p.lat != null && p.kind in KINDS).map((p) => ({
    ...p, _search: norm(`${p.name} ${p.city ?? ''} ${p.postcode ?? ''} ${p.description ?? ''} ${p.discipline ?? ''} ${KINDS[p.kind]}`),
  }));
  if (!places.length) document.querySelector('[data-mode="places"]').hidden = true;

  const depts = data.departments ?? [];
  $('zone').textContent = depts.map((d) => DEPT_NAMES[d] ?? `Département ${d}`).join(', ');
  $('meta').innerHTML = `${data.generatedAt ? `Mis à jour le ${new Date(data.generatedAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}. ` : ''}`
    + 'Données : DATAtourisme et OpenAgenda (Licence Ouverte), Ticketmaster, ministère de la Culture, © contributeurs <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> (ODbL). '
    + '<a href="mentions-legales.html">Mentions légales et confidentialité</a> · <a href="#" data-install>📲 Installer l\'appli</a>';

  drawCenter();
  render();
  if (state.selected) select(state.selected.type, state.selected.id);
  else if (state.group.set && state.group.center) map.setView([state.group.center.lat, state.group.center.lon], 10);
  else if (events.length) map.fitBounds(L.latLngBounds(events.map((e) => [e.lat, e.lon])).pad(0.05), { maxZoom: 11 });
  // Par défaut : carte centrée sur la position de l'utilisateur, s'il l'autorise
  if (!state.selected && !(state.group.set && state.group.center)) {
    locateMe((me) => { map.setView([me.lat, me.lon], 11); render(); }, true);
  }
})();

// ---------- Application installable (PWA) ----------
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let installEvent = null;
function updateInstallPill() {
  const later = store.get('installPlusTard');
  const snoozed = later && Date.now() - later < 14 * 864e5;
  $('installPill').hidden = isStandalone() || snoozed || !(installEvent || isIOS() || isMobile());
}
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; updateInstallPill(); });
window.addEventListener('appinstalled', () => { installEvent = null; $('installPill').hidden = true; });
function openInstall() {
  const ios = isIOS();
  $('installIOS').hidden = !ios && isMobile();
  $('installAndroid').hidden = ios;
  $('installDesktop').hidden = isMobile();
  $('installNow').hidden = !installEvent;
  $('installDialog').showModal();
}
$('installPill').addEventListener('click', openInstall);
$('installNow').addEventListener('click', async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice.catch(() => null);
  installEvent = null;
  $('installDialog').close();
  updateInstallPill();
});
$('installLater').addEventListener('click', () => { store.set('installPlusTard', Date.now()); updateInstallPill(); });
document.addEventListener('click', (e) => { if (e.target.closest('[data-install]')) { e.preventDefault(); openInstall(); } });
updateInstallPill();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
