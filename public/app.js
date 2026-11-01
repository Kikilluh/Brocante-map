/* global L */
const CATS = {
  brocante: 'Brocantes & puces',
  concert: 'Concerts',
  spectacle: 'Spectacles',
  exposition: 'Expos & musées',
  visite: 'Visites & patrimoine',
  atelier: 'Ateliers & animations',
  rando: 'Randos & nature',
  sport: 'Sport',
  fete: 'Fêtes & festivals',
  marche: 'Marchés & salons',
  conference: 'Conférences',
  autre: 'Autres',
};
const ALL = Object.keys(CATS);
const DEPT_NAMES = { '37': 'Indre-et-Loire' };
const SOURCE_NAMES = {
  datatourisme: 'DATAtourisme', openagenda: 'OpenAgenda', manual: 'ajout manuel', ticketmaster: 'Ticketmaster',
  museofile: 'Musées de France', festivals: 'Liste des festivals', 'datatourisme-lieux': 'DATAtourisme (lieux)',
  'datatourisme-itineraires': 'DATAtourisme (itinéraires)', 'osm-itineraires': 'OpenStreetMap',
};
const KINDS = {
  musee: 'Musées', chateau: 'Châteaux', patrimoine: 'Patrimoine', jardin: 'Parcs & jardins', nature: 'Nature',
  rando: 'Randonnées', velo: 'Vélo', loisir: 'Loisirs', festival: 'Festivals',
};
const KALL = Object.keys(KINDS);
const kcolor = (k) => css(`--k-${k}`) || css('--accent');

const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const color = (cat) => css(`--c-${cat}`) || css('--accent');
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const norm = (s = '') => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// ---------- Dates (calendrier local, format YYYY-MM-DD) ----------
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmtDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

function weekend(offsetWeeks = 0) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const dow = t.getDay(); // 0 = dimanche
  let sat = dow === 0 ? addDays(t, -1) : addDays(t, 6 - dow);
  sat = addDays(sat, 7 * offsetWeeks);
  const from = offsetWeeks === 0 && dow === 0 ? t : sat;
  return [iso(from), iso(addDays(sat, 1))];
}

function presetRange(p) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  switch (p) {
    case 'today': return [iso(t), iso(t)];
    case 'weekend': return weekend(0);
    case 'nextweekend': return weekend(1);
    case 'all': return [iso(t), ''];
    default: return [iso(t), iso(addDays(t, Number(p) - 1))];
  }
}

function occLabel(o) {
  if (o.start === o.end) return fmtDay.format(parse(o.start));
  return `du ${fmtShort.format(parse(o.start))} au ${fmtShort.format(parse(o.end))}`;
}

// ---------- Libellés prix / âge / jauge ----------
const euro = (x) => `${Number.isInteger(x) ? x : x.toFixed(2).replace('.', ',')} €`;
function priceLabel(ev) {
  if (ev.free === true || (ev.priceMin === 0 && !ev.priceMax)) return 'Gratuit';
  if (ev.priceMin == null) return '';
  if (ev.priceMax == null || ev.priceMax === ev.priceMin) return euro(ev.priceMin);
  return `${ev.priceMin === 0 ? 'gratuit' : euro(ev.priceMin)} à ${euro(ev.priceMax)}`;
}
function groupCost(ev) {
  const n = state.people;
  if (n < 2 || ev.priceMin == null || ev.priceMin === 0) return '';
  return `≈ ${euro(ev.priceMin * n)} pour ${n} pers.`;
}
function ageLabel(ev) {
  if (ev.ageMin != null && ev.ageMax != null) return `${ev.ageMin}–${ev.ageMax} ans`;
  if (ev.ageMin != null) return ev.ageMin === 0 ? '' : `dès ${ev.ageMin} ans`;
  if (ev.ageMax != null) return `jusqu'à ${ev.ageMax} ans`;
  return '';
}

// ---------- État ----------
const DEFAULTS = { preset: '30', people: 1, ageMin: null, ageMax: null, price: 'all', unknown: true, q: '' };
const state = { from: '', to: '', cats: new Set(ALL), kinds: new Set(KALL), mode: 'events', sort: 'date', me: null, ...DEFAULTS };
let events = [];
let places = [];
const markers = new Map();

function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('du') || h.get('au')) { state.from = h.get('du') || ''; state.to = h.get('au') || ''; state.preset = null; }
  else if (h.get('p')) state.preset = h.get('p');
  const cats = h.get('types') ?? h.get('cat');
  if (cats) state.cats = new Set(cats.split(',').filter((t) => t in CATS));
  if (h.get('n')) state.people = Math.max(1, +h.get('n') || 1);
  if (h.get('amin')) state.ageMin = +h.get('amin');
  if (h.get('amax')) state.ageMax = +h.get('amax');
  if (h.get('prix')) state.price = h.get('prix');
  if (h.get('inc') === '0') state.unknown = false;
  if (h.get('q')) state.q = h.get('q');
  if (h.get('m') === 'lieux') state.mode = 'places';
  if (h.get('k')) state.kinds = new Set(h.get('k').split(',').filter((t) => t in KINDS));
  if (state.preset) [state.from, state.to] = presetRange(state.preset);
}
function writeHash() {
  const h = new URLSearchParams();
  if (state.preset) h.set('p', state.preset); else { if (state.from) h.set('du', state.from); if (state.to) h.set('au', state.to); }
  if (state.cats.size !== ALL.length) h.set('cat', [...state.cats].join(','));
  if (state.people > 1) h.set('n', state.people);
  if (state.ageMin != null) h.set('amin', state.ageMin);
  if (state.ageMax != null) h.set('amax', state.ageMax);
  if (state.price !== 'all') h.set('prix', state.price);
  if (!state.unknown) h.set('inc', '0');
  if (state.q) h.set('q', state.q);
  if (state.mode === 'places') h.set('m', 'lieux');
  if (state.kinds.size !== KALL.length) h.set('k', [...state.kinds].join(','));
  history.replaceState(null, '', `#${h}`);
}

// ---------- Carte ----------
// Si Leaflet n'a pas pu se charger, on remplace la carte par un objet neutre :
// la liste et les filtres continuent de fonctionner.
if (!(window.L && window.L.markerClusterGroup)) {
  const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop, construct: () => noop });
  window.L = noop;
  document.getElementById('mapError').hidden = false;
}
const map = L.map('map', { zoomControl: true }).setView([47.25, 0.7], 9);
const planIGN = L.tileLayer(
  'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
  { maxZoom: 19, attribution: '© <a href="https://www.ign.fr/">IGN</a> – Géoplateforme' },
);
const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
});
planIGN.addTo(map);
L.control.layers({ 'Plan IGN': planIGN, OpenStreetMap: osm }, null, { position: 'topleft' }).addTo(map);

const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45 });
map.addLayer(cluster);
const placeCluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45 });

const Locate = L.Control.extend({
  options: { position: 'topleft' },
  onAdd() {
    const b = L.DomUtil.create('button', 'leaflet-bar locate');
    b.title = 'Me localiser'; b.setAttribute('aria-label', 'Me localiser'); b.textContent = '◎';
    L.DomEvent.on(b, 'click', (e) => { L.DomEvent.stop(e); map.locate({ setView: true, maxZoom: 12 }); });
    return b;
  },
});
map.addControl(new Locate());
let meMarker = null;
map.on('locationfound', (e) => {
  state.me = e.latlng;
  meMarker?.remove();
  meMarker = L.circleMarker(e.latlng, { radius: 7, color: '#fff', weight: 2, fillColor: '#2563eb', fillOpacity: 1 }).addTo(map);
  render();
});
map.on('locationerror', () => alert('Localisation indisponible.'));

const icons = {};
function icon(cat) {
  return (icons[cat] ??= L.divIcon({
    className: '',
    html: `<div class="pin" style="background:${color(cat)}"></div>`,
    iconSize: [22, 22], iconAnchor: [11, 22], popupAnchor: [0, -22],
  }));
}

const picons = {};
function placeIcon(kind) {
  return (picons[kind] ??= L.divIcon({
    className: '',
    html: `<div class="pin place" style="background:${kcolor(kind)}"></div>`,
    iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -10],
  }));
}
const kbadge = (p) => `<span class="badge" style="background:${kcolor(p.kind)}">${esc(KINDS[p.kind] ?? p.kind)}</span>`;

function placePopup(p) {
  const isRoute = p.kind === 'rando' || p.kind === 'velo';
  const route = `https://www.openstreetmap.org/directions?to=${p.lat},${p.lon}`;
  const km = p.distanceKm ? `${String(p.distanceKm).replace('.', ',')} km${p.partial ? ' dans le département' : ''}` : '';
  const facts = [km, p.duration ?? '', p.network ?? '', p.period ?? '', p.discipline ?? ''].filter(Boolean);
  const sources = (p.sources ?? []).map((s) => (s.url
    ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(SOURCE_NAMES[s.id] ?? s.id)}</a>` : esc(SOURCE_NAMES[s.id] ?? s.id))).join(' · ');
  const place = [p.address, p.postcode && p.city ? `${p.postcode} ${p.city}` : p.city].filter(Boolean).join(', ');
  const links = [
    p.routeUrl ? `<a href="${esc(p.routeUrl)}" target="_blank" rel="noopener"><strong>Voir l'itinéraire</strong></a>` : '',
    p.gpx ? `<a href="${esc(p.gpx)}" target="_blank" rel="noopener">Trace GPX</a>` : '',
    p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">Site</a>` : '',
    `<a href="${route}" target="_blank" rel="noopener">${isRoute ? 'Aller au départ' : 'Itinéraire'}</a>`,
  ].filter(Boolean).join('');
  return `<div class="popup">
    <h3>${esc(p.name)}</h3>
    <p>${kbadge(p)}</p>
    ${place ? `<p class="muted">${isRoute ? `${p.partial ? 'Entrée dans le département' : 'Départ'} : ` : ''}${esc(place)}</p>` : ''}
    ${facts.length ? `<p class="facts">${facts.map((f) => `<span>${esc(f)}</span>`).join('')}</p>` : ''}
    ${p.description ? `<p class="muted">${esc(p.description.slice(0, 240))}${p.description.length > 240 ? '…' : ''}</p>` : ''}
    <div class="links">${links}</div>
    <p class="muted small">Source : ${sources}${p.credit ? ` · ${esc(p.credit)}` : ''}</p>
  </div>`;
}

function renderPlaces() {
  map.removeLayer(cluster);
  map.addLayer(placeCluster);
  const q = norm(state.q.trim());
  const list = places.filter((p) => state.kinds.has(p.kind) && (!q || p._search.includes(q)));
  if (state.me) list.sort((a, b) => distanceKm(a) - distanceKm(b));
  else list.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  placeCluster.clearLayers();
  markers.clear();
  placeCluster.addLayers(list.map((p) => {
    const m = L.marker([p.lat, p.lon], { icon: placeIcon(p.kind), title: p.name }).bindPopup(() => placePopup(p), { maxWidth: 300 });
    markers.set(p.id, m);
    return m;
  }));
  const n = list.length;
  const label = `${n} lieu${n > 1 ? 'x' : ''} à visiter`;
  $('count').textContent = label;
  $('countDesk').textContent = label;
  const ol = $('list');
  ol.innerHTML = n ? '' : '<li class="empty">Aucun lieu ne correspond.</li>';
  const frag = document.createDocumentFragment();
  for (const p of list.slice(0, 500)) {
    const li = document.createElement('li');
    const d = distanceKm(p);
    const facts = [p.distanceKm ? `${String(p.distanceKm).replace('.', ',')} km` : '', p.network ?? '', p.period ?? ''].filter(Boolean).join(' · ');
    li.innerHTML = `<button class="item" data-id="${esc(p.id)}">
      <div class="title">${esc(p.name)}</div>
      <div class="where">${kbadge(p)} ${esc(p.city ?? '')}${d != null ? ` · ${d.toFixed(0)} km` : ''}${facts ? ` · ${esc(facts)}` : ''}</div>
    </button>`;
    frag.append(li);
  }
  ol.append(frag);
  syncControls();
  writeHash();
}

function badge(ev) {
  return `<span class="badge" style="background:${color(ev.category)}">${esc(CATS[ev.category])}</span>`;
}

function popupHtml(ev) {
  const route = `https://www.openstreetmap.org/directions?to=${ev.lat},${ev.lon}`;
  const sources = ev.sources.map((s) => (s.url
    ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(SOURCE_NAMES[s.id] ?? s.id)}</a>`
    : esc(SOURCE_NAMES[s.id] ?? s.id))).join(' · ');
  const others = ev.occurrences.length - 1;
  const facts = [priceLabel(ev), groupCost(ev), ageLabel(ev), ev.capacity ? `${ev.capacity} places` : ''].filter(Boolean);
  return `<div class="popup">
    <h3>${esc(ev.title)}</h3>
    <p>${badge(ev)}</p>
    <p><strong>${esc(occLabel(ev._next))}</strong>${ev._next.hours ? ` · ${esc(ev._next.hours)}` : ''}${others > 0 ? ` <span class="muted">(+ ${others} autre${others > 1 ? 's' : ''} date${others > 1 ? 's' : ''})</span>` : ''}</p>
    ${ev.venue ? `<p class="venue">${esc(ev.venue)}</p>` : ''}
    <p class="${ev.venue ? 'muted' : ''}">${esc([ev.address, ev.postcode && ev.city ? `${ev.postcode} ${ev.city}` : ev.city].filter(Boolean).join(', '))}</p>
    ${ev.organizer && ev.organizer !== ev.venue ? `<p class="muted">Organisé par ${esc(ev.organizer)}</p>` : ''}
    ${facts.length ? `<p class="facts">${facts.map((f) => `<span>${esc(f)}</span>`).join('')}</p>` : ''}
    ${ev.description ? `<p class="muted">${esc(ev.description.slice(0, 240))}${ev.description.length > 240 ? '…' : ''}</p>` : ''}
    <div class="links"><a href="${route}" target="_blank" rel="noopener">Itinéraire</a>${ev.url ? `<a href="${esc(ev.url)}" target="_blank" rel="noopener">Site</a>` : ''}</div>
    <p class="muted small">Source : ${sources}${ev.credit ? ` · ${esc(ev.credit)}` : ''}</p>
  </div>`;
}

// ---------- Filtres ----------
/** Première date de l'événement qui tombe dans la période choisie (ou null). */
function nextIn(ev) {
  return ev.occurrences.find((o) => (!state.from || o.end >= state.from) && (!state.to || o.start <= state.to)) ?? null;
}

function matches(ev) {
  if (!state.cats.has(ev.category)) return false;
  const u = state.unknown;
  // Participants : jauge connue trop petite → exclu
  if (state.people > 1 && ev.capacity != null && ev.capacity < state.people) return false;
  // Âges : la tranche de l'événement doit couvrir le groupe
  if (state.ageMin != null) {
    if (ev.ageMin != null ? ev.ageMin > state.ageMin : false) return false;
  }
  if (state.ageMax != null) {
    if (ev.ageMax != null ? ev.ageMax < state.ageMax : false) return false;
  }
  if ((state.ageMin != null || state.ageMax != null) && !u && ev.ageMin == null && ev.ageMax == null) return false;
  // Prix
  if (state.price === 'free') {
    if (ev.free === true || (ev.priceMin === 0 && !ev.priceMax)) { /* ok */ } else if (!(u && ev.priceMin == null && ev.free == null)) return false;
  } else if (state.price !== 'all') {
    const max = Number(state.price);
    if (ev.priceMin == null) { if (!u) return false; } else if (ev.priceMin > max) return false;
  }
  if (state.q && !ev._search.includes(norm(state.q.trim()))) return false;
  return true;
}

function filtered() {
  const out = [];
  for (const ev of events) {
    const n = nextIn(ev);
    if (!n || !matches(ev)) continue;
    ev._next = n;
    out.push(ev);
  }
  return out.sort((a, b) => a._next.start.localeCompare(b._next.start));
}

function distanceKm(ev) {
  return state.me ? map.distance(state.me, [ev.lat, ev.lon]) / 1000 : null;
}

function render() {
  document.body.className = `mode-${state.mode}`;
  document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === state.mode)));
  if (state.mode === 'places') return renderPlaces();
  map.removeLayer(placeCluster);
  map.addLayer(cluster);
  const list = filtered();
  if (state.sort === 'distance' && state.me) list.sort((a, b) => distanceKm(a) - distanceKm(b));

  cluster.clearLayers();
  markers.clear();
  cluster.addLayers(list.map((ev) => {
    const m = L.marker([ev.lat, ev.lon], { icon: icon(ev.category), title: ev.title }).bindPopup(() => popupHtml(ev), { maxWidth: 300 });
    markers.set(ev.id, m);
    return m;
  }));

  const n = list.length;
  const label = `${n} sortie${n > 1 ? 's' : ''}`;
  $('count').textContent = label;
  $('countDesk').textContent = label;

  const ol = $('list');
  ol.innerHTML = n ? '' : '<li class="empty">Aucune sortie ne correspond. Essayez d’élargir les dates ou les filtres.</li>';
  const frag = document.createDocumentFragment();
  for (const ev of list.slice(0, 500)) {
    const li = document.createElement('li');
    const d = distanceKm(ev);
    const facts = [priceLabel(ev), ageLabel(ev)].filter(Boolean).join(' · ');
    li.innerHTML = `<button class="item" data-id="${esc(ev.id)}">
      <div class="when">${esc(occLabel(ev._next))}${ev._next.hours ? ` · ${esc(ev._next.hours)}` : ''}</div>
      <div class="title">${esc(ev.title)}</div>
      ${ev.venue ? `<div class="venue">${esc(ev.venue)}</div>` : ''}
      <div class="where">${badge(ev)} ${esc(ev.city ?? '')}${d != null ? ` · ${d.toFixed(0)} km` : ''}${facts ? ` · ${esc(facts)}` : ''}</div>
    </button>`;
    frag.append(li);
  }
  ol.append(frag);
  syncControls();
  writeHash();
}

function syncControls() {
  $('from').value = state.from;
  $('to').value = state.to;
  $('people').value = state.people;
  $('ageMin').value = state.ageMin ?? '';
  $('ageMax').value = state.ageMax ?? '';
  $('price').value = state.price;
  $('unknown').checked = state.unknown;
  document.querySelectorAll('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === state.preset)));
  document.querySelectorAll('[data-type]').forEach((b) => b.setAttribute('aria-pressed', String(state.cats.has(b.dataset.type))));
  document.querySelectorAll('[data-kind]').forEach((b) => b.setAttribute('aria-pressed', String(state.kinds.has(b.dataset.kind))));
  const full = state.mode === 'places' ? state.kinds.size === KALL.length : state.cats.size === ALL.length;
  $('allTypes').textContent = full ? 'Tout décocher' : 'Tout cocher';
}

function focusEvent(id) {
  const m = markers.get(id);
  if (!m) return;
  (state.mode === 'places' ? placeCluster : cluster).zoomToShowLayer(m, () => m.openPopup());
  document.querySelectorAll('.item.active').forEach((x) => x.classList.remove('active'));
  document.querySelector(`.item[data-id="${CSS.escape(id)}"]`)?.classList.add('active');
  if (matchMedia('(max-width: 760px)').matches) togglePanel(false);
}

function togglePanel(open) {
  $('panel').classList.toggle('open', open);
  $('panelHandle').setAttribute('aria-expanded', String(open));
}

// ---------- UI ----------
$('types').innerHTML = ALL.map((k) =>
  `<button class="chip type" data-type="${k}"><span class="dot" style="background:var(--c-${k})"></span>${CATS[k]}</button>`).join('');

$('kinds').innerHTML = KALL.map((k) =>
  `<button class="chip type" data-kind="${k}"><span class="dot" style="background:var(--k-${k})"></span>${KINDS[k]}</button>`).join('');
document.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => {
  const k = b.dataset.kind;
  if (state.kinds.size === KALL.length) state.kinds = new Set([k]);
  else if (state.kinds.has(k)) state.kinds.delete(k);
  else state.kinds.add(k);
  if (!state.kinds.size) state.kinds = new Set(KALL);
  render();
}));
document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
  state.mode = b.dataset.mode;
  render();
}));

document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
  state.preset = b.dataset.preset;
  [state.from, state.to] = presetRange(state.preset);
  render();
}));
document.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => {
  const t = b.dataset.type;
  // Premier clic quand tout est coché : on n'affiche que ce type
  if (state.cats.size === ALL.length) state.cats = new Set([t]);
  else if (state.cats.has(t)) state.cats.delete(t);
  else state.cats.add(t);
  if (!state.cats.size) state.cats = new Set(ALL);
  render();
}));
$('allTypes').addEventListener('click', () => {
  if (state.mode === 'places') {
    state.kinds = state.kinds.size === KALL.length ? new Set(['musee']) : new Set(KALL);
  } else {
    state.cats = state.cats.size === ALL.length ? new Set(['brocante']) : new Set(ALL);
  }
  render();
});
for (const id of ['from', 'to']) {
  $(id).addEventListener('change', () => {
    state[id] = $(id).value;
    if (state.from && state.to && state.to < state.from) {
      if (id === 'from') state.to = state.from; else state.from = state.to;
    }
    state.preset = null;
    render();
  });
}
const numOrNull = (v) => (v === '' || v == null || Number.isNaN(+v) ? null : +v);
$('people').addEventListener('input', () => { state.people = Math.max(1, numOrNull($('people').value) ?? 1); render(); });
$('ageMin').addEventListener('change', () => {
  state.ageMin = numOrNull($('ageMin').value);
  if (state.ageMin != null && state.ageMax != null && state.ageMax < state.ageMin) state.ageMax = state.ageMin;
  render();
});
$('ageMax').addEventListener('change', () => {
  state.ageMax = numOrNull($('ageMax').value);
  if (state.ageMin != null && state.ageMax != null && state.ageMin > state.ageMax) state.ageMin = state.ageMax;
  render();
});
$('price').addEventListener('change', () => { state.price = $('price').value; render(); });
$('unknown').addEventListener('change', () => { state.unknown = $('unknown').checked; render(); });
$('reset').addEventListener('click', () => {
  Object.assign(state, DEFAULTS, { cats: new Set(ALL), kinds: new Set(KALL) });
  [state.from, state.to] = presetRange(state.preset);
  $('q').value = '';
  render();
});
let qTimer;
$('q').addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(() => { state.q = $('q').value; render(); }, 150); });
$('sort').addEventListener('change', () => {
  state.sort = $('sort').value;
  if (state.sort === 'distance' && !state.me) map.locate({ setView: false });
  render();
});
$('list').addEventListener('click', (e) => { const b = e.target.closest('.item'); if (b) focusEvent(b.dataset.id); });
$('panelHandle').addEventListener('click', () => togglePanel(!$('panel').classList.contains('open')));
$('toggleFilters').addEventListener('click', () => {
  const open = $('filters').classList.toggle('open');
  $('toggleFilters').setAttribute('aria-expanded', String(open));
  setTimeout(() => map.invalidateSize(), 50);
});

// ---------- Données ----------
async function load(url) {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) return null;
    const d = await r.json();
    return d.events?.length ? d : null;
  } catch { return null; }
}

const OLD_TYPES = { 'vide-grenier': 'brocante', braderie: 'brocante', puces: 'brocante', bourse: 'brocante' };

(async () => {
  readHash();
  $('q').value = state.q;
  let data = (await load('data/events.json')) ?? (await load('data/brocantes.json'));
  if (!data) { data = await load('data/demo.json'); $('demoBanner').hidden = !data; }
  data ??= { events: [], departments: ['37'] };

  events = data.events.filter((e) => e.lat != null && e.lon != null).map((e) => {
    let category = e.category ?? OLD_TYPES[e.type] ?? e.type ?? 'autre';
    if (!(category in CATS)) category = 'autre';
    const occurrences = e.dates?.length
      ? e.dates.map(([start, end, hours]) => ({ start, end: end ?? start, hours: hours ?? null }))
      : [{ start: e.start, end: e.end ?? e.start, hours: e.hours ?? null }];
    return {
      ...e,
      category,
      occurrences,
      sources: e.sources ?? [],
      _search: norm(`${e.title} ${e.venue ?? ''} ${e.organizer ?? ''} ${e.city ?? ''} ${e.postcode ?? ''} ${e.description ?? ''} ${CATS[category]}`),
    };
  });

  try {
    const r = await fetch('data/places.json', { cache: 'no-cache' });
    if (r.ok) {
      places = ((await r.json()).places ?? []).filter((p) => p.lat != null && p.kind in KINDS).map((p) => ({
        ...p,
        _search: norm(`${p.name} ${p.city ?? ''} ${p.postcode ?? ''} ${p.description ?? ''} ${p.discipline ?? ''} ${KINDS[p.kind]}`),
      }));
    }
  } catch { /* pas de lieux */ }
  $('modePlacesCount') && ($('modePlacesCount').textContent = places.length);
  if (!places.length) document.querySelector('[data-mode="places"]').hidden = true;

  const depts = data.departments ?? [];
  $('zone').textContent = depts.length > 3 ? 'France' : depts.map((d) => DEPT_NAMES[d] ?? `Département ${d}`).join(', ');

  const srcs = Object.keys(data.sources ?? {}).filter((k) => data.sources[k].ok && data.sources[k].count);
  $('meta').innerHTML = (data.generatedAt
    ? `Mis à jour le ${new Date(data.generatedAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}. `
    : 'Données de démonstration. ')
    + `Données : ${srcs.length ? srcs.map((s) => esc(SOURCE_NAMES[s] ?? s)).join(', ') : '—'}`
    + ' — <a href="https://www.datatourisme.fr" target="_blank" rel="noopener">DATAtourisme</a> et OpenAgenda sous Licence Ouverte (Etalab 2.0), producteurs cités sur chaque fiche ; lieux à visiter : DATAtourisme et ministère de la Culture (Liste des festivals) ; itinéraires balisés et noms de lieux © les contributeurs <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> (ODbL).';

  render();
  if (events.length) {
    const b = L.latLngBounds(events.map((e) => [e.lat, e.lon]));
    map.fitBounds(b.pad(0.05), { maxZoom: 11 });
  }
})();
