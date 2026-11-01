/* global L */
const TYPES = {
  brocante: 'Brocante',
  'vide-grenier': 'Vide-grenier',
  braderie: 'Braderie',
  puces: 'Puces',
  bourse: 'Bourse / troc',
};
const DEPT_NAMES = { '37': 'Indre-et-Loire' };

const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

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

function whenLabel(ev) {
  if (ev.start === ev.end) return fmtDay.format(parse(ev.start));
  return `du ${fmtShort.format(parse(ev.start))} au ${fmtShort.format(parse(ev.end))}`;
}

// ---------- État ----------
const state = { from: '', to: '', types: new Set(Object.keys(TYPES)), q: '', sort: 'date', preset: '30', me: null };
let events = [];
const markers = new Map();

function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('du') || h.get('au')) { state.from = h.get('du') || ''; state.to = h.get('au') || ''; state.preset = null; }
  else if (h.get('p')) state.preset = h.get('p');
  if (h.get('types')) state.types = new Set(h.get('types').split(',').filter((t) => t in TYPES));
  if (h.get('q')) state.q = h.get('q');
  if (state.preset) [state.from, state.to] = presetRange(state.preset);
}
function writeHash() {
  const h = new URLSearchParams();
  if (state.preset) h.set('p', state.preset); else { if (state.from) h.set('du', state.from); if (state.to) h.set('au', state.to); }
  if (state.types.size !== Object.keys(TYPES).length) h.set('types', [...state.types].join(','));
  if (state.q) h.set('q', state.q);
  history.replaceState(null, '', `#${h}`);
}

// ---------- Carte ----------
const map = L.map('map', { zoomControl: true, preferCanvas: false }).setView([47.25, 0.7], 9);
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

function icon(type) {
  return L.divIcon({
    className: '',
    html: `<div class="pin" style="background:${css(`--t-${type}`) || css('--accent')}"></div>`,
    iconSize: [22, 22], iconAnchor: [11, 22], popupAnchor: [0, -22],
  });
}

function popupHtml(ev) {
  const route = `https://www.openstreetmap.org/directions?to=${ev.lat},${ev.lon}`;
  const sources = ev.sources.filter((s) => s.url).map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.id)}</a>`).join(' · ');
  return `<div class="popup">
    <h3>${esc(ev.title)} <span class="badge" style="background:${css(`--t-${ev.type}`)}">${esc(TYPES[ev.type] ?? ev.type)}</span></h3>
    <p><strong>${esc(whenLabel(ev))}</strong>${ev.hours ? ` · ${esc(ev.hours)}` : ''}</p>
    <p>${esc([ev.address, ev.postcode && ev.city ? `${ev.postcode} ${ev.city}` : ev.city].filter(Boolean).join(', '))}</p>
    ${ev.exhibitors ? `<p class="muted">${esc(ev.exhibitors)} exposants</p>` : ''}
    ${ev.description ? `<p class="muted">${esc(ev.description.slice(0, 220))}${ev.description.length > 220 ? '…' : ''}</p>` : ''}
    <div class="links"><a href="${route}" target="_blank" rel="noopener">Itinéraire</a>${sources ? `<span class="muted">Source : ${sources}</span>` : ''}</div>
  </div>`;
}

// ---------- Filtres ----------
function filtered() {
  const q = state.q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return events.filter((ev) =>
    (!state.from || ev.end >= state.from) &&
    (!state.to || ev.start <= state.to) &&
    state.types.has(ev.type) &&
    (!q || ev._search.includes(q)));
}

function distanceKm(ev) {
  return state.me ? map.distance(state.me, [ev.lat, ev.lon]) / 1000 : null;
}

function render() {
  const list = filtered();
  if (state.sort === 'distance' && state.me) list.sort((a, b) => distanceKm(a) - distanceKm(b));

  cluster.clearLayers();
  markers.clear();
  const ms = list.map((ev) => {
    const m = L.marker([ev.lat, ev.lon], { icon: icon(ev.type), title: ev.title }).bindPopup(popupHtml(ev), { maxWidth: 300 });
    markers.set(ev.id, m);
    return m;
  });
  cluster.addLayers(ms);

  const n = list.length;
  const label = `${n} événement${n > 1 ? 's' : ''}`;
  $('count').textContent = label;
  $('countDesk').textContent = label;

  const ol = $('list');
  ol.innerHTML = n ? '' : '<li class="empty">Aucune brocante sur cette période. Essayez d’élargir les dates.</li>';
  const frag = document.createDocumentFragment();
  for (const ev of list.slice(0, 500)) {
    const li = document.createElement('li');
    const d = distanceKm(ev);
    li.innerHTML = `<button class="item" data-id="${esc(ev.id)}">
      <div class="when">${esc(whenLabel(ev))}</div>
      <div class="title">${esc(ev.title)}<span class="badge" style="background:${css(`--t-${ev.type}`)}">${esc(TYPES[ev.type] ?? ev.type)}</span></div>
      <div class="where">${esc(ev.city ?? '')}${ev.postcode ? ` (${esc(ev.postcode)})` : ''}${d != null ? ` · ${d.toFixed(0)} km` : ''}</div>
    </button>`;
    frag.append(li);
  }
  ol.append(frag);

  $('from').value = state.from;
  $('to').value = state.to;
  document.querySelectorAll('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === state.preset)));
  document.querySelectorAll('[data-type]').forEach((b) => b.setAttribute('aria-pressed', String(state.types.has(b.dataset.type))));
  writeHash();
}

function focusEvent(id) {
  const m = markers.get(id);
  if (!m) return;
  cluster.zoomToShowLayer(m, () => m.openPopup());
  document.querySelectorAll('.item.active').forEach((x) => x.classList.remove('active'));
  document.querySelector(`.item[data-id="${CSS.escape(id)}"]`)?.classList.add('active');
  if (matchMedia('(max-width: 760px)').matches) togglePanel(false);
}

function togglePanel(open) {
  $('panel').classList.toggle('open', open);
  $('panelHandle').setAttribute('aria-expanded', String(open));
}

// ---------- UI ----------
$('types').innerHTML = Object.entries(TYPES).map(([k, v]) =>
  `<button class="chip type" data-type="${k}"><span class="dot" style="background:var(--t-${k})"></span>${v}</button>`).join('');

document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
  state.preset = b.dataset.preset;
  [state.from, state.to] = presetRange(state.preset);
  render();
}));
document.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => {
  const t = b.dataset.type;
  if (state.types.has(t)) state.types.delete(t); else state.types.add(t);
  render();
}));
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

(async () => {
  readHash();
  $('q').value = state.q;
  let data = await load('data/brocantes.json');
  if (!data) { data = await load('data/demo.json'); $('demoBanner').hidden = !data; }
  data ??= { events: [], departments: ['37'] };

  events = data.events.filter((e) => e.lat != null && e.lon != null).map((e) => ({
    ...e,
    type: e.type in TYPES ? e.type : 'brocante',
    _search: `${e.title} ${e.city ?? ''} ${e.postcode ?? ''} ${e.description ?? ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
  }));

  const depts = data.departments ?? [];
  $('zone').textContent = depts.length > 3 ? 'France' : depts.map((d) => DEPT_NAMES[d] ?? `Département ${d}`).join(', ');

  const srcs = Object.keys(data.sources ?? {}).filter((k) => data.sources[k].ok && data.sources[k].count);
  $('meta').innerHTML = data.generatedAt
    ? `Mis à jour le ${new Date(data.generatedAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}${srcs.length ? ` · sources : ${srcs.map(esc).join(', ')}` : ''}`
    : 'Données de démonstration';

  render();
  if (events.length) {
    const b = L.latLngBounds(events.map((e) => [e.lat, e.lon]));
    map.fitBounds(b.pad(0.05), { maxZoom: 11 });
  }
})();
