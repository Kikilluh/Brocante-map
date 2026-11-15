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
const CAT_ICONS = {
  brocante: '🏺', concert: '🎵', spectacle: '🎭', exposition: '🖼️', visite: '🏰', atelier: '🎨',
  rando: '🥾', sport: '⚽', fete: '🎉', marche: '🧺', conference: '🎤', autre: '📍',
};
const KINDS = {
  activite: 'Activités & cours', musee: 'Musées', chateau: 'Châteaux', patrimoine: 'Patrimoine', jardin: 'Parcs & jardins',
  nature: 'Nature', rando: 'Randonnées', velo: 'Vélo', loisir: 'Loisirs', festival: 'Festivals',
  equipement: 'Jeux & sport libre', petitpatrimoine: 'Petit patrimoine',
};
const KALL = Object.keys(KINDS);
// Icône précise selon le titre ou le nom (repli : icône de la catégorie). Premier motif trouvé gagne.
const EV_ICON_RULES = {
  concert: [[/jazz|swing|blues/i, '🎷'], [/orchestre|symphon|classique|piano|r[ée]cital|quatuor|baroque|op[ée]ra|violon/i, '🎻'], [/chorale|ch[œo]eur|chant\b|gospel/i, '🎶'], [/rock|metal|punk|guitare/i, '🎸'], [/electro|\bdj\b|techno|clubbing/i, '🎧'], [/rap|hip.?hop/i, '🎤'], [/accord[ée]on|bal\b|guinguette/i, '🪗']],
  spectacle: [[/cin[ée]|film|projection|court.?m[ée]trage|documentaire/i, '🎬'], [/cirque|jongl|acrobat|clown/i, '🎪'], [/humour|humoriste|one.?(wo)?man|stand.?up|com[ée]die/i, '😂'], [/danse|ballet|flamenco|tango/i, '💃'], [/magie|magicien|illusion/i, '🪄'], [/marionnette|guignol/i, '🧸'], [/conte|lecture/i, '📖'], [/op[ée]ra|op[ée]rette/i, '🎼']],
  exposition: [[/photo/i, '📷'], [/sculpt/i, '🗿'], [/bande dessin[ée]e|\bbd\b|manga/i, '💬'], [/dinosaure|fossile|pal[ée]onto/i, '🦕'], [/science|astronom|espace/i, '🔭']],
  visite: [[/ch[âa]teau|forteresse|donjon/i, '🏰'], [/[ée]glise|cath[ée]drale|abbaye|basilique|chapelle|prieur[ée]/i, '⛪'], [/jardin|parc|arboretum|serre/i, '🌷'], [/cave|vin|vign|d[ée]gustation|chai\b/i, '🍷'], [/brasserie|bi[èe]re/i, '🍺'], [/nocturne|aux flambeaux|lanterne/i, '🔦'], [/ferme|[ée]levage|chèvre|fromag/i, '🐐'], [/usine|entreprise|industri|mine\b/i, '🏭'], [/grotte|troglo|souterrain|gouffre/i, '🕳️']],
  atelier: [[/cuisine|p[âa]tiss|culinaire|recette/i, '👩‍🍳'], [/couture|tricot|crochet|broderie|textile/i, '🧵'], [/jardin|potager|graine|plante|semis/i, '🌱'], [/num[ée]rique|informatique|code|robot|jeu vid[ée]o/i, '💻'], [/lecture|conte|livre|biblioth|m[ée]diath/i, '📚'], [/poterie|c[ée]ramique|modelage|argile/i, '🏺'], [/photo/i, '📷'], [/musique|chant|percussion/i, '🎵'], [/yoga|m[ée]ditation|relaxation|sophro/i, '🧘'], [/jeux? de soci[ée]t[ée]|ludoth/i, '🎲'], [/b[ée]b[ée]|tout.?petits|parent/i, '🧒']],
  rando: [[/v[ée]lo|vtt|cyclo/i, '🚴'], [/trail|course|running/i, '🏃'], [/marche nordique|marche|balade|promenade/i, '🚶'], [/oiseau|ornitho|lpo|faune/i, '🐦'], [/champignon|mycolo/i, '🍄'], [/cheval|[ée]questre/i, '🐴'], [/nuit|nocturne|[ée]toiles|astro/i, '🌙']],
  sport: [[/foot/i, '⚽'], [/basket/i, '🏀'], [/rugby/i, '🏉'], [/handball|\bhand\b/i, '🤾'], [/volley/i, '🏐'], [/tennis|padel/i, '🎾'], [/trail|marathon|course|semi|cross|run/i, '🏃'], [/v[ée]lo|cyclo|vtt|cyclisme/i, '🚴'], [/natation|piscine|nage/i, '🏊'], [/judo|karat[ée]|bo[xi]|arts? martia/i, '🥋'], [/hockey/i, '🏒'], [/p[ée]tanque|boules?\b/i, '🎯'], [/golf/i, '⛳'], [/[ée]quitation|cheval|hippique|courses? de chevaux/i, '🏇'], [/ski|neige|luge/i, '⛷️'], [/escalade|grimpe/i, '🧗'], [/cano[ëe]|kayak|aviron|voile|paddle/i, '🛶'], [/moto|auto|rallye|karting/i, '🏁']],
  fete: [[/no[ëe]l|saint.?nicolas|p[èe]re no[ëe]l/i, '🎄'], [/halloween|citrouille/i, '🎃'], [/carnaval|mardi gras/i, '🎭'], [/feu d.artifice|14 juillet|f[êe]te nationale/i, '🎆'], [/loto|quine|belote|tarot|concours de cartes/i, '🎲'], [/repas|banquet|moules|choucroute|paella|couscous|pot.?au.?feu|d[îi]ner|d[ée]jeuner/i, '🍽️'], [/bal\b|soir[ée]e dansante|thé dansant/i, '💃'], [/m[ée]di[ée]val|chevalier/i, '⚔️'], [/bi[èe]re|oktoberfest/i, '🍺'], [/vin|vendange|beaujolais/i, '🍷'], [/p[âa]ques|chasse aux [œo]eufs/i, '🐣'], [/musique|f[êe]te de la musique/i, '🎶']],
  marche: [[/no[ëe]l/i, '🎄'], [/livre|bouquin/i, '📚'], [/fleur|plante|jardin/i, '🌸'], [/producteur|terroir|fermier|gourmand|gastronom/i, '🧺'], [/artisan|cr[ée]ateur|art\b/i, '🎨'], [/salon|foire|expo.?vente/i, '🏬'], [/truffe|champignon/i, '🍄']],
  brocante: [[/jouet|pu[ée]riculture|enfant/i, '🧸'], [/v[êe]tement|fripe|textile/i, '👗'], [/livre|bouquin/i, '📚'], [/disque|vinyle/i, '💿'], [/collection|multicollection|cartes postales/i, '🔎'], [/v[ée]lo/i, '🚲']],
  conference: [[/caf[ée].?(philo|d[ée]bat)|d[ée]bat|table ronde/i, '💬'], [/auteur|d[ée]dicace|litt[ée]ra|lecture/i, '📚'], [/science|astronom/i, '🔬'], [/histoire|patrimoine/i, '📜']],
};
const PL_ICON_RULES = {
  patrimoine: [[/croix|calvaire/i, '✝️'], [/lavoir/i, '🫧'], [/[ée]glise|basilique|cath[ée]drale|chapelle|abbaye|prieur[ée]|collégiale|monast[èe]re|couvent/i, '⛪'], [/moulin/i, '🌾'], [/grotte|troglo|gouffre|souterrain|cave\b/i, '🕳️'], [/pont|viaduc|aqueduc/i, '🌉'], [/phare/i, '🗼'], [/tour\b|donjon|rempart|porte\b|beffroi/i, '🏯'], [/dolmen|menhir|m[ée]galith/i, '🪨'], [/monument aux morts|m[ée]morial|cimeti[èe]re/i, '🎖️'], [/village|cit[ée]|bourg|quartier|vieille ville/i, '🏘️'], [/gallo.?romain|antique|vestige|th[ée][âa]tre romain|arch[ée]olog/i, '🏛️'], [/maison|h[ôo]tel particulier|manoir|logis/i, '🏠'], [/fontaine/i, '⛲']],
  musee: [[/beaux.?arts|peinture|art moderne|art contemporain|galerie/i, '🖼️'], [/histoire naturelle|dinosaure|fossile|pal[ée]onto|min[ée]ral/i, '🦕'], [/auto|voiture|moto/i, '🚗'], [/train|ferroviaire|chemin de fer|tramway/i, '🚂'], [/aviation|avion|a[ée]ronaut/i, '🛩️'], [/mine\b|minier|charbon/i, '⛏️'], [/vin|vigne|viticul/i, '🍷'], [/[ée]comus[ée]e|ferme|rural|paysan|m[ée]tiers/i, '🧑‍🌾'], [/jouet|poup[ée]e|automate/i, '🧸'], [/science|espace|astronom|plan[ée]tarium/i, '🔭'], [/guerre|r[ée]sistance|militaire|m[ée]morial/i, '🎖️']],
  jardin: [[/arboretum|for[êe]t/i, '🌲'], [/roseraie|rose/i, '🌹'], [/labyrinthe/i, '🌀'], [/potager/i, '🥕'], [/jardin/i, '🌷']],
  nature: [[/point de vue|belv[ée]d[èe]re|panorama|table d.orientation/i, '🔭'], [/cascade|chute/i, '💦'], [/lac|[ée]tang|plan d.eau|barrage/i, '🏞️'], [/plage|baignade/i, '🏖️'], [/for[êe]t|bois\b/i, '🌲'], [/r[ée]serve|marais|tourbi[èe]re|zone humide|oiseau|ornitho/i, '🐦'], [/volcan|puy\b|mont\b|sommet|pic\b|col\b|gorges?|rocher/i, '⛰️'], [/rivi[èe]re|fleuve|source/i, '🌊']],
  loisir: [[/zoo|animalier|safari|faune|parc aux (oiseaux|animaux)|ferme p[ée]dagogique/i, '🦁'], [/aquarium/i, '🐠'], [/parc d.attraction|parc de loisirs|f[êe]te foraine/i, '🎢'], [/piscine|aquatique|baignade|centre nautique/i, '🏊'], [/escape|[ée]nigme/i, '🔐'], [/bowling/i, '🎳'], [/karting|circuit/i, '🏎️'], [/accrobranche|parcours aventure|tyrolienne|escalade|grimpe/i, '🧗'], [/mini.?golf|golf/i, '⛳'], [/[ée]quitation|[ée]questre|poney|haras|cheval/i, '🐴'], [/cano[ëe]|kayak|paddle|rafting|nautique|base de loisirs/i, '🛶'], [/cave|vin\b|vins|domaine|vignoble|viticole|ch[âa]teau .*(vin|cru)/i, '🍷'], [/brasserie|bi[èe]re|distillerie/i, '🍺'], [/patinoire/i, '⛸️'], [/cin[ée]ma/i, '🎬'], [/laser.?game|paintball/i, '🎯'], [/trampoline|jump|structure gonflable|plaine de jeux|parc (de jeux )?indoor/i, '🤸'], [/ski|station/i, '⛷️'], [/fromag|chocolat|confiserie|biscuit|miel/i, '🍯']],
  activite: [[/yoga|m[ée]ditation|pilates/i, '🧘'], [/danse/i, '💃'], [/cuisine|p[âa]tiss/i, '👩‍🍳'], [/poterie|c[ée]ramique/i, '🏺'], [/peinture|dessin|aquarelle/i, '🎨'], [/musique|chant|piano|guitare/i, '🎵'], [/[ée]quitation|poney|cheval/i, '🐴'], [/escalade|grimpe/i, '🧗'], [/natation|aquagym|piscine/i, '🏊'], [/cano[ëe]|kayak|paddle|voile|aviron/i, '🛶'], [/v[ée]lo|vtt/i, '🚴'], [/tir [àa] l.arc/i, '🏹'], [/golf/i, '⛳'], [/p[êe]che/i, '🎣'], [/parapente|ulm|montgolfi[èe]re|vol\b/i, '🪂'], [/plong[ée]e/i, '🤿']],
  velo: [[/vtt/i, '🚵']],
  petitpatrimoine: [[/croix|calvaire/i, '✝️'], [/oratoire|niche/i, '🛐'], [/lavoir/i, '🫧'], [/fontaine/i, '⛲'], [/monument aux morts/i, '🎖️']],
  equipement: [[/boulodrome|p[ée]tanque|boules/i, '🎯'], [/multisport|city.?stade/i, '⚽'], [/skate/i, '🛹'], [/pique.?nique/i, '🧺'], [/parcours sportif|fitness|agr[èe]s/i, '🏋️'], [/aire de jeux|jeux/i, '🛝']],
};
const SUB_ICONS = { croix: '✝️', oratoire: '🛐', lavoir: '🫧', jeux: '🛝', boulodrome: '🎯', multisport: '⚽', skatepark: '🛹', piquenique: '🧺', fitness: '🏋️', vue: '🔭' };
function iconOf(x, isEv) {
  if (x._ico) return x._ico;
  const text = isEv ? x.title ?? '' : x.name ?? '';
  const rules = (isEv ? EV_ICON_RULES[x.category] : PL_ICON_RULES[x.kind]) ?? [];
  const hit = (!isEv && SUB_ICONS[x.sub]) || rules.find(([re]) => re.test(text))?.[1];
  x._ico = hit ?? (isEv ? CAT_ICONS[x.category] : KIND_ICONS[x.kind]) ?? '📍';
  return x._ico;
}
const KIND_ICONS = {
  activite: '🤸', musee: '🏛️', chateau: '🏰', patrimoine: '⛪', jardin: '🌳', nature: '🌿',
  rando: '🥾', velo: '🚲', loisir: '🎡', festival: '🎪', equipement: '🛝', petitpatrimoine: '✝️',
};
// Envies du groupe → catégories de sorties et types de lieux
const ENVIES = {
  culture: { label: 'Culture', cats: ['exposition', 'visite', 'spectacle', 'conference'], kinds: ['musee', 'chateau', 'patrimoine', 'petitpatrimoine'] },
  nature: { label: 'Nature & balades', cats: ['rando'], kinds: ['jardin', 'nature', 'rando', 'velo', 'petitpatrimoine'] },
  sport: { label: 'Sport & activités', cats: ['sport', 'atelier'], kinds: ['activite', 'loisir', 'equipement'] },
  fete: { label: 'Fêtes & musique', cats: ['fete', 'concert'], kinds: ['festival'] },
  chine: { label: 'Brocantes & marchés', cats: ['brocante', 'marche'], kinds: [] },
};
const EALL = Object.keys(ENVIES);
const DEPT_NAMES = { '18': 'Cher', '28': 'Eure-et-Loir', '36': 'Indre', '37': 'Indre-et-Loire', '41': 'Loir-et-Cher', '38': 'Isère', '45': 'Loiret', '58': 'Nièvre' };
const SOURCE_NAMES = {
  datatourisme: 'DATAtourisme', openagenda: 'OpenAgenda', manual: 'ajout manuel', ticketmaster: 'Ticketmaster',
  museofile: 'Musées de France', festivals: 'Liste des festivals', 'agendas-locaux': 'Agenda de la collectivité', 'datatourisme-lieux': 'DATAtourisme',
  'datatourisme-itineraires': 'DATAtourisme', 'osm-itineraires': 'OpenStreetMap', 'osm-petits-lieux': 'OpenStreetMap',
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
  unknown: true, vague: true, sort: 'date', me: null, rando: { len: '', dur: '', dplus: '', shape: '' }, group: { ...NEW_GROUP(), ...(store.get('groupe') ?? {}) }, selected: null,
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
  if (h.get('jv') === '0') state.vague = false;
  if (h.get('r')) { const [len = '', dur = '', dplus = '', shape = ''] = h.get('r').split('_'); state.rando = { len, dur, dplus, shape }; }
  if (h.get('m') === 'lieux') state.mode = 'places';
  const g = h.get('g') && decodeGroup(h.get('g'));
  if (g) state.group = { ...NEW_GROUP(), ...g, set: true };
  state.selected = h.get('e') ? { type: 'events', id: h.get('e') } : h.get('l') ? { type: 'places', id: h.get('l') } : null;
  if (state.selected && h.get('d')) state.selected.dept = h.get('d');
  if (state.preset) [state.from, state.to] = presetRange(state.preset);
}
function writeHash() {
  const h = new URLSearchParams();
  if (state.preset) h.set('p', state.preset); else { if (state.from) h.set('du', state.from); if (state.to) h.set('au', state.to); }
  if (state.cats.size !== ALL.length) h.set('cat', [...state.cats].join(','));
  if (state.kinds.size !== KALL.length) h.set('k', [...state.kinds].join(','));
  if (state.q) h.set('q', state.q);
  if (!state.unknown) h.set('inc', '0');
  if (!state.vague) h.set('jv', '0');
  if (randoActive()) h.set('r', [state.rando.len, state.rando.dur, state.rando.dplus, state.rando.shape].join('_'));
  if (state.mode === 'places') h.set('m', 'lieux');
  if (state.group.set) h.set('g', encodeGroup(state.group));
  if (state.selected) h.set(state.selected.type === 'events' ? 'e' : 'l', state.selected.id);
  if (state.selected?.dept) h.set('d', state.selected.dept);
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
  { maxZoom: 19, keepBuffer: 4, attribution: '© <a href="https://www.ign.fr/">IGN</a>' },
);
const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, keepBuffer: 4, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' });
// Tuile qui ne se charge pas (serveur lent, limite de requêtes) : nouvel essai, puis la même tuile OpenStreetMap
planIGN.on('tileerror', ({ tile, coords }) => {
  const tries = Number(tile.dataset.tries ?? 0);
  tile.dataset.tries = String(tries + 1);
  if (tries === 0) setTimeout(() => { tile.src = `${planIGN.getTileUrl(coords)}&essai=2`; }, 700);
  else if (tries === 1) tile.src = osm.getTileUrl(coords);
});
osm.on('tileerror', ({ tile, coords }) => {
  if (tile.dataset.tries) return;
  tile.dataset.tries = '1';
  setTimeout(() => { tile.src = `${osm.getTileUrl(coords)}?essai=2`; }, 700);
});
// Échelle en kilomètres (en bas à gauche, sous le choix du fond de carte)
L.control.scale({ metric: true, imperial: false, maxWidth: 130, position: 'bottomleft' }).addTo(map);
// Fond détaillé d'OpenStreetMap France : aires de jeux, croix, chemins, commerces visibles en zoomant
const osmfr = L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', { subdomains: 'abc', maxZoom: 20, keepBuffer: 4, attribution: '© <a href="https://www.openstreetmap.fr/">OpenStreetMap France</a> · © <a href="https://www.openstreetmap.org/copyright">contributeurs OpenStreetMap</a>' });
const BASES = { OpenStreetMap: osm, 'OpenStreetMap détaillé': osmfr, 'Plan IGN': planIGN };
L.control.layers(BASES, null, { position: 'bottomleft' }).addTo(map);
// Le fond choisi est mémorisé sur l'appareil
// Fond par défaut : OpenStreetMap classique (sauf choix mémorisé)
(BASES[store.get('fond')] ?? osm).addTo(map);
map.on('baselayerchange', (e) => store.set('fond', e.name));
// Le zoom au clic sur un groupe est géré plus bas (zoom progressif)
// Groupes : au loin, une pastille avec le nombre ; de près (zoom 13 et plus) et s'ils sont peu nombreux,
// les icônes des éléments serrées ensemble, qui se séparent à leur place exacte en zoomant.
const BUNDLE_ZOOM = 13;
const BUNDLE_MAX = 8;
// Positions en nid d'abeille autour du centre (bulles qui se touchent, sans cadre)
const BUBBLE = 28;
function hexSpots(n, d = BUBBLE - 3) {
  const spots = [[0, 0]];
  for (let ring = 1; spots.length < n; ring++) {
    for (let i = 0; i < 6 * ring && spots.length < n; i++) {
      const a = (Math.PI / 3) * Math.floor(i / ring) + Math.PI / 6;
      const b = a + (2 * Math.PI) / 3;
      const k = i % ring;
      spots.push([d * (ring * Math.cos(a) + k * Math.cos(b)), d * (ring * Math.sin(a) + k * Math.sin(b))]);
    }
  }
  // recentrage (2 ou 3 bulles : côte à côte / en triangle plutôt qu'autour d'une bulle centrale)
  const cx = spots.reduce((t, p) => t + p[0], 0) / n;
  const cy = spots.reduce((t, p) => t + p[1], 0) / n;
  return spots.map(([x, y]) => [x - cx, y - cy]);
}
function clusterIcon(c) {
  const kids = c.getAllChildMarkers();
  const z = c._zoom ?? map.getZoom();
  if (z < BUNDLE_ZOOM || kids.length > BUNDLE_MAX) return L.MarkerClusterGroup.prototype._defaultIconCreateFunction(c);
  const spots = hexSpots(kids.length);
  const half = Math.max(...spots.flat().map(Math.abs)) + BUBBLE / 2 + 2;
  const size = Math.ceil(half * 2);
  const html = `<div class="mk-bundle" style="width:${size}px;height:${size}px">${kids.map((m, i) => {
    const [x, y] = spots[i];
    return `<span style="background:${m.col ?? 'var(--accent)'};left:${(half + x - BUBBLE / 2).toFixed(1)}px;top:${(half + y - BUBBLE / 2).toFixed(1)}px">${m.ico ?? '📍'}</span>`;
  }).join('')}</div>`;
  return L.divIcon({ className: '', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}
// Rayon de regroupement plus petit de près : les éléments voisins se séparent plus vite
const clusterRadius = (z) => (z >= 16 ? 22 : z >= 14 ? 32 : 45);
const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: clusterRadius, zoomToBoundsOnClick: false, iconCreateFunction: clusterIcon });
const placeCluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: clusterRadius, zoomToBoundsOnClick: false, iconCreateFunction: clusterIcon });
// Souris (PC) : bulle immédiate avec le nom au survol des marqueurs et des groupes
const canHover = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
for (const group of [cluster, placeCluster]) {
  // Clic sur un groupe : zoom animé (rapide mais progressif) ; groupe indivisible → éventail
  group.on('clusterclick', (e) => {
    const c = e.layer;
    c.closeTooltip?.();
    const bounds = c.getBounds();
    const target = Math.min(map.getBoundsZoom(bounds.pad(0.15)), map.getMaxZoom());
    if (target <= map.getZoom() || map.getZoom() >= map.getMaxZoom() || bounds.getNorthEast().equals(bounds.getSouthWest())) c.spiderfy();
    // zoom modéré : au plus 3 niveaux d'un coup (2 quand on est déjà proche), centré sur le groupe
    else map.flyTo(bounds.getCenter(), Math.min(target, map.getZoom() + (map.getZoom() >= 12 ? 2 : 3)), { duration: 0.65, easeLinearity: 0.4 });
  });
  group.on('clustermouseover', (e) => {
    if (!canHover()) return;
    const kids = e.layer.getAllChildMarkers();
    const names = kids.slice(0, 10).map((m) => `<li>${esc(m.options.name ?? '')}</li>`).join('');
    const more = kids.length > 10 ? `<p class="tip-more">et ${kids.length - 10} autre${kids.length - 10 > 1 ? 's' : ''}…</p>` : '';
    e.layer.unbindTooltip().bindTooltip(`<ul class="tip-list">${names}</ul>${more}`, { direction: 'top', offset: [0, -16], className: 'tip', opacity: 1 }).openTooltip();
  });
  group.on('clustermouseout', (e) => e.layer.closeTooltip());
}
map.addLayer(cluster);
let centerLayer = null;
let meMarker = null;
map.on('click', () => { if (isMobile() && !state.selected) setSheet('peek'); });

const icons = {};
const pinIcon = (cat, ico = CAT_ICONS[cat] ?? '📍') => (icons[`${cat}|${ico}`] ??= L.divIcon({ className: '', html: `<div class="mk" style="--c:${color(cat)}"><span>${ico}</span></div>`, iconSize: [34, 41], iconAnchor: [17, 41], popupAnchor: [0, -38] }));
const picons = {};
const placeIcon = (k, ico = KIND_ICONS[k] ?? '📍') => (picons[`${k}|${ico}`] ??= L.divIcon({ className: '', html: `<div class="mk sq" style="--c:${kcolor(k)}"><span>${ico}</span></div>`, iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16] }));

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
// ---------- Filtres propres aux randonnées et au vélo ----------
const NO_RANDO = { len: '', dur: '', dplus: '', shape: '' };
const RANDO_FILTERS = {
  len: { label: 'Longueur', opts: [['', 'Toutes'], ['0-5', '< 5 km'], ['5-10', '5 à 10 km'], ['10-20', '10 à 20 km'], ['20-', '> 20 km']] },
  dur: { label: 'Durée estimée', opts: [['', 'Toutes'], ['0-60', '< 1 h'], ['60-120', '1 à 2 h'], ['120-240', '2 à 4 h'], ['240-', '> 4 h']] },
  dplus: { label: 'Dénivelé positif', opts: [['', 'Tous'], ['0-100', 'Plat (< 100 m)'], ['100-300', 'Modéré (100 à 300 m)'], ['300-', 'Sportif (> 300 m)']] },
  shape: { label: 'Parcours', opts: [['', 'Tous'], ['boucle', 'Boucle'], ['lineaire', 'Aller simple']] },
};
const isRouteKind = (p) => p.kind === 'rando' || p.kind === 'velo';
/** Durée : celle de l'office de tourisme, sinon estimée (marche : 4 km/h et 300 m de montée par heure ; vélo : 15 km/h). */
function routeMinutes(p) {
  if (p.minutes) return p.minutes;
  if (!p.distanceKm || p.partial) return null;
  if (p.kind === 'velo') return Math.round((p.distanceKm / 15 + (p.dplus ?? 0) / 600) * 60);
  const h = p.distanceKm / 4;
  const v = (p.dplus ?? 0) / 300;
  return Math.round((Math.max(h, v) + Math.min(h, v) / 2) * 60);
}
const fmtMinutes = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}`);
const inRange = (v, r) => { const [a, b] = r.split('-'); return v >= +a && (b === '' || v < +b); };
/** Les filtres rando ne s'affichent (et ne s'appliquent) que si l'on a choisi randonnée ou vélo dans les types. */
const randoVisible = () => state.kinds.size < KALL.length && (state.kinds.has('rando') || state.kinds.has('velo'));
const randoActive = () => randoVisible() && Object.values(state.rando).some(Boolean);
/** Un lieu passe-t-il les filtres rando ? (les lieux qui ne sont pas des itinéraires ne sont pas concernés) */
function randoOk(p) {
  if (!isRouteKind(p) || !randoActive()) return true;
  const r = state.rando;
  const checks = [
    [r.len, p.partial ? null : p.distanceKm, (v) => inRange(v, r.len)],
    [r.dur, routeMinutes(p), (v) => inRange(v, r.dur)],
    [r.dplus, p.dplus, (v) => inRange(v, r.dplus)],
    [r.shape, p.shape, (v) => v === r.shape],
  ];
  for (const [want, value, ok] of checks) {
    if (!want) continue;
    if (value == null) { if (!state.unknown) return false; continue; }
    if (!ok(value)) return false;
  }
  return true;
}
function renderRandoFilters() {
  $('randoFilters').innerHTML = Object.entries(RANDO_FILTERS).map(([k, f]) => `<div class="rando-row"><span class="rando-label">${f.label}</span><div class="chips-wrap">${
    f.opts.map(([v, l]) => `<button type="button" class="chip" data-rando="${k}" data-v="${v}" aria-pressed="${state.rando[k] === v}">${l}</button>`).join('')}</div></div>`).join('');
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-rando]');
  if (!b) return;
  state.rando = { ...state.rando, [b.dataset.rando]: b.dataset.v };
  renderRandoFilters();
  render();
});

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
/** Zone de recherche du groupe (carré autour du centre), ou null si aucune limite de distance. */
function groupZone() {
  const g = state.group;
  return g.set && g.center && g.radius ? L.latLng(g.center.lat, g.center.lon).toBounds(g.radius * 2000) : null;
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
    if (ev.daysUnknown && !state.vague) continue;
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
// Budget pour les lieux : un lieu sans tarif connu n'est PAS gratuit (escape game, salle de spectacle…).
// Gratuits par nature : itinéraires de randonnée et de vélo, sites naturels.
const FREE_KINDS = new Set(['rando', 'velo', 'nature']);
const placeIsFree = (p) => p.free === true || p.priceMin === 0 || FREE_KINDS.has(p.kind);
function placeBudgetOk(p) {
  const g = state.group;
  if (!g.set || g.budget == null) return true;
  if (placeIsFree(p)) return true;
  if (g.budget === 0) return false;
  if (p.priceMin == null) return state.unknown;
  const pp = g.budgetMode === 'total' ? g.budget / groupSize() : g.budget;
  return p.priceMin <= pp;
}
function placePriceLabel(p) {
  if (placeIsFree(p)) return p.free === true || p.priceMin === 0 ? 'Gratuit' : 'Accès libre';
  if (p.priceMin == null) return '';
  return p.priceMax && p.priceMax !== p.priceMin ? `${euro(p.priceMin)} à ${euro(p.priceMax)}` : `dès ${euro(p.priceMin)}`;
}
function filteredPlaces() {
  const kinds = effectiveKinds();
  const q = norm(state.q.trim());
  const out = places.filter((p) => kinds.has(p.kind) && (!q || p._search.includes(q)) && inRadius(p) && randoOk(p) && placeBudgetOk(p));
  for (const p of out) p._dist = distFrom(refPoint(), p);
  if (refPoint()) out.sort((a, b) => a._dist - b._dist);
  else out.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return out;
}

// ---------- Rendu de la liste ----------
const badge = (label, col, ico = '') => `<span class="badge" style="background:${col}">${ico ? `${ico} ` : ''}${esc(label)}</span>`;
const evBadge = (ev) => badge(CATS[ev.category], color(ev.category), CAT_ICONS[ev.category]);
const plBadge = (p) => badge(KINDS[p.kind] ?? p.kind, kcolor(p.kind), KIND_ICONS[p.kind]);

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
    const name = x.title ?? x.name;
    const m = L.marker([x.lat, x.lon], { icon: isEv ? pinIcon(x.category, iconOf(x, true)) : placeIcon(x.kind, iconOf(x, false)), name, alt: name, keyboard: true });
    if (canHover()) m.bindTooltip(esc(name), { direction: 'top', offset: [0, isEv ? -38 : -16], className: 'tip', opacity: 1 });
    m.item = x;
    m.isEv = isEv;
    m.ico = iconOf(x, isEv);
    m.col = isEv ? color(x.category) : kcolor(x.kind);
    m.on('click', () => { m.closeTooltip(); openCallout(m); });
    markers.set(x.id, m);
    return m;
  }));

  closeCallout();
  current = list;
  renderOverview();
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
    // Toute la zone de la carte compte, même la partie recouverte par le panneau du bas
    return b;
  } catch { return null; }
}
// Bandeau sur la carte quand la partie visible est vide : dit pourquoi (zone du groupe, filtres) et propose d'élargir.
function widenSearch() {
  state.preset = 'all'; [state.from, state.to] = presetRange('all'); state.unknown = true; state.q = ''; $('q').value = '';
  if (state.group.radius) state.group.radius = 0;
  saveGroup(); render();
}
function updateMapHint(n) {
  const el = $('mapHint');
  if (!el) return;
  const zone = groupZone();
  const view = map.getBounds();
  if (isOverview() || n > 0 || loadingCount > 0 || wantedDepts().some((d) => !loaded[state.mode].has(d))) { el.hidden = true; return; }
  const g = state.group;
  if (zone && !zone.intersects(view)) {
    el.innerHTML = `<span>Rien ici : votre groupe cherche à ${g.radius} km autour de ${esc(g.center.label ?? 'son point de départ')}.</span>`
      + '<span class="hint-actions"><button class="btn small" data-hint="all">Chercher partout</button><button class="btn small ghost" data-hint="zone">Revenir à la zone</button></span>';
  } else {
    el.innerHTML = '<span>Rien ici avec les filtres choisis (dates, types, groupe).</span><span class="hint-actions"><button class="btn small" data-hint="widen">Élargir la recherche</button></span>';
  }
  el.hidden = false;
}
$('mapHint')?.addEventListener('click', (e) => {
  const a = e.target.closest('[data-hint]')?.dataset.hint;
  if (a === 'all') { state.group.radius = 0; saveGroup(); render(); }
  else if (a === 'zone') map.flyToBounds(groupZone(), { duration: 0.7 });
  else if (a === 'widen') widenSearch();
});
function renderList() {
  const isEv = state.mode === 'events';
  if (isOverview()) { updateMapHint(1); return renderOverviewList(); }
  const b = visibleBounds();
  const inView = b?.contains ? current.filter((x) => b.contains([x.lat, x.lon])) : current;
  const n = inView.length;
  const total = current.length;
  const noun = isEv ? `événement${n > 1 ? 's' : ''}` : `lieu${n > 1 ? 'x' : ''} et activité${n > 1 ? 's' : ''}`;
  $('count').textContent = n === total ? `${n} ${noun}` : `${n} ${noun} ici · ${total} au total`;
  $('listCount').textContent = n;
  updateMapHint(n);
  const ol = $('list');
  if (!total) {
    ol.innerHTML = `<li class="empty">Rien ne correspond à ces critères.<br><button class="btn small" id="widen">Élargir la recherche</button></li>`;
    $('widen').onclick = widenSearch;
  } else if (!n) {
    ol.innerHTML = `<li class="empty">Rien dans cette partie de la carte.<br><button class="btn small" id="zoomOut">Voir tout</button></li>`;
    $('zoomOut').onclick = () => map.fitBounds(L.latLngBounds(current.map((x) => [x.lat, x.lon])).pad(0.05), { maxZoom: 12 });
  } else {
    ol.innerHTML = inView.slice(0, 300).map((x) => (isEv ? eventItem(x) : placeItem(x))).join('');
  }
}
let moveTimer;
map.on('moveend', () => { clearTimeout(moveTimer); moveTimer = setTimeout(() => { renderList(); ensureData(); }, 120); });

function eventItem(ev) {
  const facts = [priceLabel(ev), ageLabel(ev), ev._dist != null ? km(ev._dist) : ''].filter(Boolean).join(' · ');
  return `<li><button class="item" data-id="${esc(ev.id)}">
    <span class="ico" style="background:${color(ev.category)}" aria-hidden="true">${iconOf(ev, true)}</span>
    <span class="body">
      <span class="when">${esc(occLabel(ev._next))}${ev._next.hours ? ` · ${esc(ev._next.hours)}` : ''}</span>
      ${ev.daysUnknown ? '<span class="vague">⚠️ Jours à vérifier</span>' : ''}
      <span class="title" style="display:block">${esc(ev.title)}</span>
      ${ev.venue ? `<span class="venue" style="display:block">${esc(ev.venue)}</span>` : ''}
      <span class="where" style="display:block">${esc(ev.city ?? '')}${facts ? ` · ${esc(facts)}` : ''}</span>
      ${ev._notes?.length ? `<span class="fit">${esc(ev._notes[0])}</span>` : ''}
    </span>${thumb(ev)}</button></li>`;
}
function placeItem(p) {
  const facts = [placePriceLabel(p), p.distanceKm ? km(p.distanceKm) : '', p.dplus != null ? `D+ ${p.dplus} m` : '', p.network ?? '', p.period ?? '', p._dist != null ? `à ${km(p._dist)}` : ''].filter(Boolean).join(' · ');
  return `<li><button class="item" data-id="${esc(p.id)}">
    <span class="ico sq" style="background:${kcolor(p.kind)}" aria-hidden="true">${iconOf(p, false)}</span>
    <span class="body">
      <span class="title" style="display:block">${esc(p.name)}</span>
      <span class="where" style="display:block">${esc(p.city ?? '')}${facts ? ` · ${esc(facts)}` : ''}</span>
    </span>${thumb(p)}</button></li>`;
}

const thumb = (x) => (x.image ? `<img class="thumb" src="${esc(x.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : '');
const hero = (x) => (x.image ? `<figure class="hero"><img src="${esc(x.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('figure').remove()">${x.imageCredit ? `<figcaption>${x.imageLink ? `<a href="${esc(x.imageLink)}" target="_blank" rel="noopener">${esc(x.imageCredit)}</a>` : esc(x.imageCredit)}</figcaption>` : ''}</figure>` : '');

// ---------- Photo d'un lieu sans image : Wikimedia Commons, sinon vue de rue Panoramax ----------
// Cherchée seulement à l'ouverture de l'aperçu ou de la fiche (rien au chargement de la carte).
const stripHtml = (h) => String(h ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const nameWords = (n) => norm(n ?? '').split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !/^(chapelle|eglise|chateau|musee|parc|jardin|place|croix|lavoir|aire|jeux|saint|sainte|notre|dame)$/.test(w));
async function commonsPhoto(x) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch&ggscoord=${x.lat}|${x.lon}&ggsradius=120&ggsnamespace=6&ggslimit=15&prop=imageinfo|coordinates&iiprop=url|extmetadata&iiurlwidth=640`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const pages = Object.values((await r.json()).query?.pages ?? {}).filter((pg) => /\.(jpe?g|webp)$/i.test(pg.title) && pg.imageinfo?.[0]?.thumburl);
  const words = nameWords(x.name);
  const scored = pages.map((pg) => {
    const c = pg.coordinates?.[0];
    const dist = c ? map.distance([x.lat, x.lon], [c.lat, c.lon]) : 999;
    const t = norm(pg.title);
    return { pg, dist, match: words.some((w) => t.includes(w)) };
  }).filter((o) => o.match || o.dist <= 35).sort((a, b) => (b.match - a.match) || (a.dist - b.dist));
  const best = scored[0]?.pg;
  if (!best) return null;
  const info = best.imageinfo[0];
  const meta = info.extmetadata ?? {};
  const author = stripHtml(meta.Artist?.value).slice(0, 60);
  const licence = stripHtml(meta.LicenseShortName?.value);
  return { image: info.thumburl, imageCredit: ['Wikimedia Commons', author, licence].filter(Boolean).join(' · '), imageLink: info.descriptionurl };
}
async function panoramaxPhoto(x) {
  const d = 0.0005; // environ 50 m
  const url = `https://api.panoramax.xyz/api/search?bbox=${x.lon - d},${x.lat - d},${x.lon + d},${x.lat + d}&limit=10`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const feats = ((await r.json()).features ?? []).filter((f) => f.geometry?.coordinates && (f.assets?.sd?.href || f.assets?.thumb?.href));
  if (!feats.length) return null;
  const dist = (f) => map.distance([x.lat, x.lon], [f.geometry.coordinates[1], f.geometry.coordinates[0]]);
  const f = feats.sort((a, b) => dist(a) - dist(b))[0];
  const pr = f.properties ?? {};
  const author = (pr.providers ?? f.providers ?? [])[0]?.name ?? '';
  return { image: f.assets.sd?.href ?? f.assets.thumb.href, imageCredit: ['Panoramax', author, pr.license ?? ''].filter(Boolean).join(' · '), imageLink: `https://api.panoramax.xyz/#focus=pic&pic=${encodeURIComponent(f.id)}` };
}
async function enrichPhoto(x) {
  if (x.image || x._photoTried || x.lat == null) return;
  x._photoTried = true;
  let found = null;
  for (const find of [commonsPhoto, panoramaxPhoto]) {
    try { found = await find(x); } catch { found = null; }
    if (found) break;
  }
  if (!found) return;
  Object.assign(x, found);
  // aperçu ou fiche de ce lieu encore ouverts : on les redessine avec la photo
  if (calloutMarker?.item === x) openCallout(calloutMarker);
  if (state.selected?.id === x.id && !$('detail').hidden) {
    const top = $('sheetBody').scrollTop;
    $('detail').innerHTML = placeDetail(x);
    $('sheetBody').scrollTop = top;
    if (x.trace) fillElevation(x);
  }
}

// ---------- Fiche détaillée ----------
// Lien principal d'un événement : billetterie, page de l'événement, ou seulement le site de l'organisateur
function evLink(ev, short = false) {
  if (!ev.url) return '';
  if (ev.sources?.some((s) => s.id === 'ticketmaster')) return link(ev.url, 'Billets', 'primary');
  if (ev.urlKind === 'site') return link(ev.url, short ? 'Site organisateur' : "Site de l'organisateur", 'primary');
  return link(ev.url, short ? 'Site' : "Page de l'événement", 'primary');
}
const searchLink = (ev) => link(`https://www.google.com/search?q=${encodeURIComponent(`"${ev.title}" ${ev.city ?? ''}`.trim())}`, "Chercher l'événement");
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
    <div class="badge-row">${evBadge(ev)}${favBtn('events', ev)}</div>
    <h2>${esc(ev.title)}</h2>
    <p class="when">${esc(occLabel(next))}${next.hours ? ` · ${esc(next.hours)}` : ''}</p>
    ${ev.daysUnknown ? '<p class="vague-box">⚠️ <strong>Jours non précisés par l\'organisateur.</strong> L\'événement a lieu certains jours de cette période seulement : vérifiez auprès de l\'organisateur avant de vous déplacer.</p>' : ''}
    ${ev.venue ? `<p class="venue">${esc(ev.venue)}</p>` : ''}
    ${where ? `<p class="muted">${esc(where)}</p>` : ''}
    ${ev.organizer && ev.organizer !== ev.venue ? `<p class="muted">Organisé par ${esc(ev.organizer)}</p>` : ''}
    ${facts.length ? `<div class="facts">${facts.map((f) => `<span>${esc(f)}</span>`).join('')}</div>` : ''}
    ${state.group.set && notes.length ? `<p class="fitline">${notes.map(esc).join(' · ')}</p>` : ''}
    ${state.group.set && ev.priceMin == null && ev.free == null ? '<p class="fitline warn">Prix non précisé : vérifiez auprès de l\'organisateur.</p>' : ''}
    <div class="actions sticky">
      ${evLink(ev)}
      ${!ev.url || ev.urlKind === 'site' ? searchLink(ev) : ''}
      ${navBtn(ev, 'Itinéraire')}
      <button type="button" data-ics="${esc(ev.id)}">📅 Agenda</button>
      <button data-share>Partager</button>
    </div>
    ${hero(ev)}
    ${others.length ? `<details><summary>${others.length} autre${others.length > 1 ? 's' : ''} date${others.length > 1 ? 's' : ''}</summary><ul class="dates">${others.map((o) => `<li>${esc(occLabel(o))}${o.hours ? ` · ${esc(o.hours)}` : ''}</li>`).join('')}</ul></details>` : ''}
    ${ev.description ? `<p class="desc">${esc(ev.description)}</p>` : ''}
    ${sourcesLine(ev)}`;
}
function placeDetail(p) {
  const isRoute = p.kind === 'rando' || p.kind === 'velo';
  const facts = [placePriceLabel(p), p.distanceKm ? `${km(p.distanceKm)}${p.partial ? ' dans le département' : ''}` : '', p.dplus != null ? `D+ ${p.dplus} m` : '', p.duration ?? (isRouteKind(p) && routeMinutes(p) ? `≈ ${fmtMinutes(routeMinutes(p))}` : ''), p.shape === 'boucle' ? 'boucle' : p.shape === 'lineaire' ? 'aller simple' : '', p.network ?? '', p.period ?? '', p.discipline ?? '', p._dist != null ? `à ${km(p._dist)}` : ''].filter(Boolean);
  const where = [p.address, p.postcode && p.city ? `${p.postcode} ${p.city}` : p.city].filter(Boolean).join(', ');
  return `<button class="back" data-back>← Retour à la liste</button>
    <div class="badge-row">${plBadge(p)}${favBtn('places', p)}</div>
    <h2>${esc(p.name)}</h2>
    ${where ? `<p class="muted">${isRoute ? (p.partial ? 'Entrée dans le département : ' : 'Départ : ') : ''}${esc(where)}</p>` : ''}
    ${facts.length ? `<div class="facts">${facts.map((f) => `<span>${esc(f)}</span>`).join('')}</div>` : ''}
    <div class="actions sticky">
      ${p.trace ? `<button type="button" class="primary" data-trace="${esc(p.id)}">🗺️ Voir le tracé</button>` : p.routeUrl ? link(p.routeUrl, "Voir l'itinéraire", 'primary') : p.url ? link(p.url, 'Site / infos', 'primary') : ''}
      ${p.trace ? `<button type="button" data-gpxdl="${esc(p.id)}">Télécharger le GPX</button>` : p.gpx ? link(p.gpx, 'Trace GPX') : ''}
      ${p.trace && p.routeUrl ? link(p.routeUrl, 'Plus de détails') : ''}
      ${p.url && (p.routeUrl || p.trace) ? link(p.url, 'Site') : ''}
      ${navBtn(p, isRoute ? 'Aller au départ' : 'Itinéraire')}
      <button data-share>Partager</button>
    </div>
    ${state.group.set && state.group.budget != null && !placeIsFree(p) && p.priceMin == null ? '<p class="fitline warn">Tarif non précisé : vérifiez auprès du lieu.</p>' : ''}
    ${p.trace ? `<div class="elev" data-elev="${esc(p.id)}"></div>` : ''}
    ${hero(p)}
    ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ''}
    ${sourcesLine(p)}`;
}

function popupHtml(x, isEv) {
  x._dist = distFrom(refPoint(), x);
  const next = isEv ? (x._next ?? nextIn(x) ?? x.occurrences[0]) : null;
  const facts = isEv
    ? [priceLabel(x), ageLabel(x), x._dist != null ? `à ${km(x._dist)}` : ''].filter(Boolean)
    : [placePriceLabel(x), x.distanceKm ? km(x.distanceKm) : '', x.dplus != null ? `D+ ${x.dplus} m` : '', x.duration ?? (isRouteKind(x) && routeMinutes(x) ? `≈ ${fmtMinutes(routeMinutes(x))}` : ''), x.period ?? '', x._dist != null ? `à ${km(x._dist)}` : ''].filter(Boolean);
  const main = isEv
    ? evLink(x, true)
    : (x.trace ? `<button type="button" class="primary" data-trace="${esc(x.id)}">Voir le tracé</button>` : x.routeUrl ? link(x.routeUrl, 'Itinéraire balisé', 'primary') : x.url ? link(x.url, 'Site', 'primary') : '');
  const heart = favBtn(isEv ? 'events' : 'places', x, true);
  return `<div class="popcard">
    ${x.image ? heart : ''}
    ${x.image ? `<div class="popimg-wrap"><img class="popimg" src="${esc(x.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.remove()">${x.imageCredit ? `<span class="popcredit">${x.imageLink ? `<a href="${esc(x.imageLink)}" target="_blank" rel="noopener">${esc(x.imageCredit)}</a>` : esc(x.imageCredit)}</span>` : ''}</div>` : ''}
    <div class="popbody">
      ${x.image ? (isEv ? evBadge(x) : plBadge(x)) : `<span class="pop-badges">${isEv ? evBadge(x) : plBadge(x)}${heart.replace('fav-btn sm', 'fav-btn sm inline')}</span>`}
      <strong class="poptitle">${esc(x.title ?? x.name)}</strong>
      ${isEv ? `<span class="popwhen">${esc(occLabel(next))}${next.hours ? ` · ${esc(next.hours)}` : ''}</span>` : ''}
      ${isEv && x.daysUnknown ? '<span class="vague">⚠️ Jours non précisés, à vérifier</span>' : ''}
      <span class="popwhere">${esc([x.venue, x.city].filter(Boolean).join(' · '))}</span>
      ${facts.length ? `<span class="popfacts">${esc(facts.join(' · '))}</span>` : ''}
      ${isEv && x._notes?.length && state.group.set ? `<span class="fit">${esc(x._notes[0])}</span>` : ''}
    </div>
    <div class="popactions">
      ${main}
      ${navBtn(x, 'Itinéraire')}
      ${isEv ? `<button type="button" class="ics-mini" data-ics="${esc(x.id)}" aria-label="Ajouter à mon agenda" title="Ajouter à mon agenda">📅</button>` : ''}
      <button type="button" data-more="${esc(x.id)}">Plus d'infos</button>
    </div>
  </div>`;
}
// ---------- Fiche d'aperçu : fixe au centre de la carte, reliée au marqueur par un trait ----------
// La carte ne bouge pas quand on touche un marqueur ; la fiche se place au centre de la zone visible
// (ou au-dessus / au-dessous du marqueur s'il serait caché), et le trait suit le marqueur.
const calloutLayer = L.DomUtil.create('div', 'callout-layer', map.getContainer());
calloutLayer.innerHTML = '<svg class="callout-line" aria-hidden="true"><line/><circle r="4"/></svg><div class="callout" role="dialog" aria-label="Aperçu"></div>';
calloutLayer.hidden = true;
const calloutCard = calloutLayer.querySelector('.callout');
L.DomEvent.disableClickPropagation(calloutCard);
L.DomEvent.disableScrollPropagation(calloutCard);
let calloutMarker = null;
function markerPoint(m) {
  // marqueur caché dans un groupe après un zoom : on vise le groupe
  const group = m.isEv ? cluster : placeCluster;
  const shown = group.getVisibleParent?.(m) ?? m;
  const pt = map.latLngToContainerPoint(shown.getLatLng());
  return shown === m && m.isEv ? pt.subtract([0, 22]) : pt;
}
function placeCallout(firstTime = false) {
  if (!calloutMarker) return;
  const size = map.getSize();
  const top = 56;
  const bottom = size.y - (isMobile() ? 96 : 12);
  const cw = calloutCard.offsetWidth;
  const ch = calloutCard.offsetHeight;
  const pt = markerPoint(calloutMarker);
  if (firstTime) {
    let x = (size.x - cw) / 2;
    let y = top + Math.max(0, (bottom - top - ch) / 2);
    const hides = pt.x > x - 20 && pt.x < x + cw + 20 && pt.y > y - 20 && pt.y < y + ch + 20;
    if (hides) {
      const below = pt.y + 34;
      const above = pt.y - 40 - ch;
      if (pt.y < (top + bottom) / 2 && below + ch <= bottom) y = below;
      else if (above >= top) y = above;
      else x = pt.x < size.x / 2 ? Math.min(size.x - cw - 8, pt.x + 30) : Math.max(8, pt.x - 30 - cw);
    }
    calloutCard.style.left = `${Math.round(x)}px`;
    calloutCard.style.top = `${Math.round(Math.max(8, y))}px`;
  }
  // trait : du bord de la fiche le plus proche jusqu'au marqueur
  const x0 = calloutCard.offsetLeft;
  const y0 = calloutCard.offsetTop;
  const cx = Math.min(Math.max(pt.x, x0 + 14), x0 + cw - 14);
  const cy = Math.min(Math.max(pt.y, y0 + 14), y0 + ch - 14);
  const inside = pt.x >= x0 && pt.x <= x0 + cw && pt.y >= y0 && pt.y <= y0 + ch;
  const visible = pt.x >= 0 && pt.y >= 0 && pt.x <= size.x && pt.y <= size.y && !inside;
  const svg = calloutLayer.querySelector('svg');
  svg.style.display = visible ? '' : 'none';
  const line = svg.querySelector('line');
  line.setAttribute('x1', cx); line.setAttribute('y1', cy); line.setAttribute('x2', pt.x); line.setAttribute('y2', pt.y);
  const dot = svg.querySelector('circle');
  dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
}
function openCallout(m) {
  calloutMarker = m;
  calloutCard.innerHTML = `<button type="button" class="callout-close" data-calloutclose aria-label="Fermer">✕</button>${popupHtml(m.item, m.isEv)}`;
  calloutLayer.hidden = false;
  if (isMobile() && $('sheet').dataset.state !== 'peek') setSheet('peek');
  placeCallout(true);
  if (!m.isEv) enrichPhoto(m.item);
  // l'image peut arriver après : on recale
  calloutCard.querySelector('img')?.addEventListener('load', () => placeCallout(true), { once: true });
}
function closeCallout() {
  calloutMarker = null;
  calloutLayer.hidden = true;
  calloutCard.innerHTML = '';
}
map.on('move zoom zoomend resize', () => placeCallout(false));
map.on('resize', () => placeCallout(true));
map.on('click', closeCallout);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && calloutMarker) closeCallout(); });
calloutCard.addEventListener('click', (e) => {
  if (e.target.closest('[data-calloutclose]')) return closeCallout();
  const b = e.target.closest('[data-more]');
  if (!b) return;
  closeCallout();
  select(state.mode, b.dataset.more, { fromMap: true, open: true });
});
/** Montre un élément sur la carte (zoom si besoin) et ouvre sa fiche d'aperçu. */
function showOnMap(id) {
  const m = markers.get(id);
  if (!m) return;
  (state.mode === 'events' ? cluster : placeCluster).zoomToShowLayer(m, () => openCallout(m));
}

function select(type, id, { fromMap = false, open = false } = {}) {
  const item = (type === 'events' ? events : places).find((x) => x.id === id);
  if (!item) return;
  if (state.selected?.id !== id) clearTrace();
  state.selected = { type, id, dept: item.dept };
  if (state.mode !== type) { state.mode = type; render(); }
  item._dist = distFrom(refPoint(), item);
  const d = $('detail');
  d.innerHTML = type === 'events' ? eventDetail(item) : placeDetail(item);
  d.hidden = false;
  $('list').hidden = true;
  $('favView').hidden = true;
  $('sheetBody').scrollTop = 0;
  const m = markers.get(id);
  if (m && !fromMap) (type === 'events' ? cluster : placeCluster).zoomToShowLayer(m, () => map.panTo(m.getLatLng()));
  else if (m) map.panTo(m.getLatLng());
  if (isMobile()) setSheet(open ? 'full' : 'half');
  else setListOpen(true);
  if (type === 'places' && item.trace) fillElevation(item);
  if (type === 'places') enrichPhoto(item);
  writeHash();
}
function unselect() {
  clearTrace();
  state.selected = null;
  $('detail').hidden = true;
  $('favView').hidden = true;
  $('list').hidden = false;
  writeHash();
}
$('detail').addEventListener('click', async (e) => {
  if (e.target.closest('[data-back]')) return unselect();
  if (e.target.closest('[data-share]')) {
    const url = location.href;
    const title = $('detail').querySelector('h2')?.textContent ?? 'Événement';
    try {
      if (navigator.share) await navigator.share({ title, url });
      else { await navigator.clipboard.writeText(url); e.target.textContent = 'Lien copié ✓'; }
    } catch { /* partage annulé */ }
  }
});
$('list').addEventListener('click', (e) => {
  const b = e.target.closest('.item');
  if (!b) return;
  if (isMobile()) setSheet('peek');
  showOnMap(b.dataset.id);
});
// Liste repliée par défaut (PC) : bouton pour l'ouvrir
function setListOpen(open) {
  document.documentElement.classList.toggle('list-open', open);
  $('listToggle').setAttribute('aria-expanded', String(open));
  setTimeout(() => { map.invalidateSize(); renderList(); }, 260);
}
$('listToggle').addEventListener('click', () => setListOpen(!document.documentElement.classList.contains('list-open')));

// ---------- Panneau du bas (mobile) ----------
function setSheet(s) { $('sheet').dataset.state = s; }
// Glisser la carte quand le panneau est à moitié ouvert : il se replie pour libérer la carte
map.on('dragstart', () => { if (isMobile() && $('sheet').dataset.state === 'half') setSheet('peek'); });
// Bouton ⌄ pour réduire d'un cran
$('sheetDown').addEventListener('click', (e) => {
  e.stopPropagation();
  setSheet($('sheet').dataset.state === 'full' ? 'half' : 'peek');
});
// Balayer vers le bas depuis le contenu (quand il est déjà tout en haut) réduit aussi le panneau
(() => {
  const body = $('sheetBody');
  let y0 = null; let top0 = 0;
  body.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; top0 = body.scrollTop; }, { passive: true });
  body.addEventListener('touchend', (e) => {
    if (y0 == null || !isMobile()) return;
    const dy = e.changedTouches[0].clientY - y0;
    y0 = null;
    if (top0 <= 0 && dy > 60) setSheet($('sheet').dataset.state === 'full' ? 'half' : 'peek');
  }, { passive: true });
})();
(() => {
  const sheet = $('sheet');
  const handle = $('sheetHandle');
  let y0 = null; let t0 = 0; let base = 0; let moved = false;
  const order = ['peek', 'half', 'full'];
  handle.addEventListener('pointerdown', (e) => {
    if (!isMobile() || e.target.closest('select, button')) return;
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
    // Toucher : ouvre si replié, sinon réduit d'un cran ; glisser : suit le sens du geste
    if (!moved) setSheet(i === 0 ? 'half' : order[i - 1]);
    else if (dy < -25 || (fast && dy < 0)) setSheet(order[Math.min(2, i + 1)]);
    else if (dy > 25 || (fast && dy > 0)) setSheet(order[Math.max(0, i - 1)]);
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
  $('vague').checked = state.vague;
  $('randoSection').hidden = !randoVisible();
  $$('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === state.preset)));
  $$('[data-type]').forEach((b) => b.setAttribute('aria-pressed', String(state.cats.has(b.dataset.type))));
  $$('[data-kind]').forEach((b) => b.setAttribute('aria-pressed', String(state.kinds.has(b.dataset.kind))));
  const full = state.mode === 'places' ? state.kinds.size === KALL.length : state.cats.size === ALL.length;
  $('allTypes').textContent = full ? 'Tout décocher' : 'Tout cocher';
  $('filtersBadge').hidden = full && state.unknown && state.vague && (state.preset === '30' || state.mode === 'places') && !(state.mode === 'places' && randoActive());
  const gb = $('openGroup');
  gb.classList.toggle('set', state.group.set);
  $('groupBadge').hidden = !state.group.set;
  gb.title = state.group.set ? `Notre groupe : ${groupSummary()} (modifier)` : 'Qui sort ? Filtrer pour notre groupe';
  gb.setAttribute('aria-label', gb.title);
  $('periodLabel').textContent = state.mode === 'places' ? 'Filtres' : periodLabel();
  $('pillBadge').hidden = $('filtersBadge').hidden;
  $('searchBadge').hidden = !state.q;
}

function periodLabel() {
  if (state.preset) return Object.fromEntries(PRESETS)[state.preset];
  const f = (d) => fmtShort.format(parse(d));
  return state.to ? (state.from === state.to ? f(state.from) : `${f(state.from)} → ${f(state.to)}`) : `dès le ${f(state.from)}`;
}
function groupSummary() {
  if (!state.group.set) return 'Notre groupe : qui, quand, où, budget ?';
  return groupSummaryOf(state.group);
}
function groupSummaryOf(g) {
  const parts = [];
  parts.push(`${g.adults} adulte${g.adults > 1 ? 's' : ''}`);
  if (g.kids.length) parts.push(`${g.kids.length} enfant${g.kids.length > 1 ? 's' : ''} (${g.kids.join(', ')} ans)`);
  if (g.budget != null) parts.push(g.budget === 0 ? 'gratuit' : `≤ ${g.budget} € ${g.budgetMode === 'total' ? 'en tout' : '/pers.'}`);
  if (g.center) parts.push(g.radius ? `${g.radius} km autour de ${g.center.label}` : `autour de ${g.center.label}`);
  if (g.moment !== 'any') parts.push(MOMENTS[g.moment]);
  return parts.join(' · ');
}
// ---------- Groupes enregistrés (favoris de groupe) ----------
let savedGroups = store.get('groupesFavoris') ?? [];
function saveSavedGroups(changed = false) {
  store.set('groupesFavoris', savedGroups);
  if (changed) scheduleSync();
}
function savedGroupChips() {
  if (!savedGroups.length) return '';
  return `<div class="saved-groups"><span class="rando-label">Mes groupes enregistrés</span><div class="chips-wrap">${
    savedGroups.map((g) => `<button type="button" class="chip" data-loadgroup="${esc(g.id)}">⭐ ${esc(g.name)}</button>`).join('')}</div></div>`;
}
function rememberGroup(group) {
  const who = group.kids.length ? 'Famille' : group.adults === 1 ? 'Solo' : group.adults === 2 ? 'En couple' : 'Entre amis';
  const name = prompt('Nom de ce groupe (ex. « Famille », « Amis du samedi ») :', who);
  if (!name?.trim()) return false;
  const existing = savedGroups.find((g) => g.name.toLowerCase() === name.trim().toLowerCase());
  const entry = { id: existing?.id ?? `g${Date.now().toString(36)}`, name: name.trim().slice(0, 40), group: { ...group, set: true }, savedAt: Date.now() };
  savedGroups = [...savedGroups.filter((g) => g !== existing), entry];
  saveSavedGroups(true);
  return true;
}
function useSavedGroup(id) {
  const g = savedGroups.find((x) => x.id === id);
  if (!g) return;
  state.group = { ...NEW_GROUP(), ...g.group, set: true };
  saveGroup();
  drawCenter();
  if (state.group.center) map.setView([state.group.center.lat, state.group.center.lon], state.group.radius >= 40 ? 9 : state.group.radius >= 20 ? 10 : 11);
  render();
}
function removeSavedGroup(id) {
  favsRemoved.push({ key: `group:${id}`, at: Date.now() });
  savedGroups = savedGroups.filter((g) => g.id !== id);
  saveSavedGroups(true);
  saveFavs(true);
}

function saveGroup() { store.set('groupe', state.group); store.set('groupeLe', Date.now()); scheduleSync(); }

function chipsHtml(map, colorVar, attr, icons) {
  return Object.entries(map).map(([k, v]) => `<button type="button" class="chip type" data-${attr}="${k}"><span class="cico" style="background:var(--${colorVar}-${k})" aria-hidden="true">${icons[k]}</span>${v}</button>`).join('');
}
$$('[data-types-container]').forEach((el) => { el.innerHTML = chipsHtml(CATS, 'c', 'type', CAT_ICONS); });
$$('[data-kinds-container]').forEach((el) => { el.innerHTML = chipsHtml(KINDS, 'k', 'kind', KIND_ICONS); });
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
  if (t.dataset.mode) ensureData();
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
$('vague').addEventListener('change', () => { state.vague = $('vague').checked; render(); });
$('reset').addEventListener('click', () => {
  Object.assign(state, { preset: '30', cats: new Set(ALL), kinds: new Set(KALL), unknown: true, vague: true, q: '', rando: { ...NO_RANDO } });
  renderRandoFilters();
  [state.from, state.to] = presetRange('30');
  $('q').value = '';
  render();
});
$('openSearch').addEventListener('click', () => { $('top').classList.add('searching'); $('q').focus(); });
$('closeSearch').addEventListener('click', () => {
  $('top').classList.remove('searching');
  if (state.q) { state.q = ''; $('q').value = ''; render(); }
});
$('q').addEventListener('blur', () => {
  setTimeout(() => { $('qSuggest').hidden = true; }, 150);
  if (!$('q').value) $('top').classList.remove('searching');
});
let qTimer;
$('q').addEventListener('input', () => {
  clearTimeout(qTimer);
  qTimer = setTimeout(() => { state.q = $('q').value; unselect(); render(); }, 180);
  suggestCommunes($('q').value);
});

// ---------- Recherche d'une commune : la carte va dessus ----------
// Le texte tapé est aussi envoyé au service public geo.api.gouv.fr pour proposer des communes.
let communeTimer;
let communeHits = [];
let communeMarker = null;
function suggestCommunes(text) {
  clearTimeout(communeTimer);
  const q = text.trim();
  if (q.length < 2) { communeHits = []; $('qSuggest').hidden = true; return; }
  communeTimer = setTimeout(async () => {
    let list = [];
    try {
      const r = await fetch(`https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(q)}&fields=nom,centre,codeDepartement,codesPostaux&boost=population&limit=5`);
      if (r.ok) list = await r.json();
    } catch { /* service indisponible : la recherche par mot-clé continue */ }
    if ($('q').value.trim() !== q) return; // l'utilisateur a continué à taper
    communeHits = list.filter((c) => c.centre?.coordinates);
    $('qSuggest').innerHTML = communeHits.map((c, i) => {
      const covered = !dataIndex?.depts || dataIndex.depts[c.codeDepartement];
      const dept = dataIndex?.depts?.[c.codeDepartement]?.name ?? DEPT_NAMES[c.codeDepartement] ?? c.codeDepartement;
      return `<li><button type="button" data-commune="${i}">📍 ${esc(c.nom)} <span class="muted">· ${esc(dept)} (${esc(c.codeDepartement)})${covered ? '' : ' · pas encore couvert'}</span></button></li>`;
    }).join('');
    $('qSuggest').hidden = !communeHits.length;
  }, 250);
}
function goToCommune(c) {
  const [lon, lat] = c.centre.coordinates;
  clearTimeout(qTimer);
  clearTimeout(communeTimer);
  communeHits = [];
  $('qSuggest').hidden = true;
  // on cherche autour de la commune, pas le mot dans les fiches
  state.q = '';
  $('q').value = '';
  $('q').blur();
  $('top').classList.remove('searching');
  if (communeMarker) map.removeLayer(communeMarker);
  communeMarker = L.circleMarker([lat, lon], { radius: 8, color: '#fff', weight: 3, fillColor: '#c8644a', fillOpacity: 1, interactive: false })
    .bindTooltip(esc(c.nom), { permanent: true, direction: 'top', offset: [0, -8], className: 'tip' }).addTo(map);
  if (isMobile()) setSheet('peek');
  render();
  map.flyTo([lat, lon], 12, { duration: 0.8 });
}
$('qSuggest').addEventListener('pointerdown', (e) => e.preventDefault());
$('qSuggest').addEventListener('mousedown', (e) => e.preventDefault()); // garde le focus le temps du clic
$('qSuggest').addEventListener('click', (e) => {
  const b = e.target.closest('[data-commune]');
  if (!b) return;
  e.preventDefault();
  goToCommune(communeHits[+b.dataset.commune]);
});
$('q').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && communeHits.length) { e.preventDefault(); goToCommune(communeHits[0]); }
  if (e.key === 'Escape') $('qSuggest').hidden = true;
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
const LAST_STEP = 4; // Qui, Quand, Où, Budget, Envies
function openGroup() {
  draft = structuredClone({ ...state.group, set: true });
  step = 0;
  renderGroup();
  $('groupDialog').showModal();
}
function renderGroup() {
  $$('#groupDialog .step').forEach((s) => { s.hidden = +s.dataset.step !== step; });
  $$('#groupDialog .step-tab').forEach((b, i) => { b.classList.toggle('done', i < step); b.setAttribute('aria-current', i === step ? 'step' : 'false'); });
  $('groupPrev').hidden = step === 0;
  $('groupNext').textContent = step === LAST_STEP ? 'Voir nos idées' : 'Suivant';
  $('savedGroupsBox').innerHTML = savedGroupChips();
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
  $('centerLabel').textContent = draft.center ? `Autour de ${draft.center.label}` : "Toute la zone couverte";
  syncControls();
}
$('openGroup').addEventListener('click', openGroup);
$('periodPill').addEventListener('click', () => { syncControls(); $('filtersDialog').showModal(); });
$('groupForm').addEventListener('click', (e) => {
  const t = e.target;
  if (t.closest('[data-goto]')) step = +t.closest('[data-goto]').dataset.goto;
  else if (t.closest('[data-loadgroup]')) { const g = savedGroups.find((x) => x.id === t.closest('[data-loadgroup]').dataset.loadgroup); if (g) draft = structuredClone({ ...NEW_GROUP(), ...g.group, set: true }); }
  else if (t.closest('#groupSave')) { if (rememberGroup(draft)) { const b = t.closest('#groupSave'); b.textContent = '✓'; b.title = 'Groupe enregistré dans votre profil'; } return; }
  else if (t.closest('[data-adults]')) draft.adults = Math.max(0, Math.min(20, draft.adults + +t.closest('[data-adults]').dataset.adults));
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
// Balayer à gauche / à droite pour passer d'une étape à l'autre
{
  let sx = null, sy = 0;
  const body = $('groupDialog').querySelector('.modal-body');
  body.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || e.target.closest('input, select, textarea, .suggest')) { sx = null; return; }
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
  }, { passive: true });
  body.addEventListener('touchend', (e) => {
    if (sx == null) return;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    sx = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const next = Math.max(0, Math.min(LAST_STEP, step + (dx < 0 ? 1 : -1)));
    if (next === step) return;
    const dir = next > step ? 'left' : 'right';
    step = next;
    renderGroup();
    const sec = $('groupDialog').querySelector(`.step[data-step="${step}"]`);
    sec.classList.remove('from-left', 'from-right');
    void sec.offsetWidth;
    sec.classList.add(dir === 'left' ? 'from-right' : 'from-left');
  }, { passive: true });
}
$('groupPrev').addEventListener('click', () => { step = Math.max(0, step - 1); renderGroup(); });
$('groupNext').addEventListener('click', () => {
  if (step < LAST_STEP) { step++; renderGroup(); return; }
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
    const c = map.getCenter();
    const qs = `q=${encodeURIComponent(q)}&limit=5&lat=${c.lat.toFixed(2)}&lon=${c.lng.toFixed(2)}`;
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

// ---------- Tracés des itinéraires (randonnée, vélo) ----------
// Le tracé (OpenStreetMap, ODbL) est dessiné sur notre carte, centrée et zoomée dessus.
const traceCache = new Map();
let traceLayer = null;
async function getTrace(p) {
  if (!p.trace) return null;
  const url = `data/${p.dept}/traces/${p.trace}.json`;
  if (!traceCache.has(url)) traceCache.set(url, getJson(url));
  return traceCache.get(url);
}
function clearTrace() {
  if (traceLayer) { map.removeLayer(traceLayer); traceLayer = null; }
}
async function showTrace(p) {
  const t = await getTrace(p);
  if (!t?.lines?.length) { if (p.routeUrl) window.open(p.routeUrl, '_blank', 'noopener'); return; }
  clearTrace();
  const color = '#c0473f'; // rouge profond, pas trop vif
  const lines = L.polyline(t.lines, { color, weight: 5, opacity: 0.9, lineJoin: 'round' });
  const halo = L.polyline(t.lines, { color: '#fff', weight: 9, opacity: 0.8, interactive: false });
  const start = L.circleMarker([p.lat, p.lon], { radius: 8, color: '#fff', weight: 3, fillColor: '#2f8f57', fillOpacity: 1 }).bindTooltip(p.partial ? 'Entrée dans le département' : 'Départ', { direction: 'top', offset: [0, -8] });
  traceLayer = L.layerGroup([halo, lines, start]).addTo(map);
  closeCallout();
  // Mobile : on replie le panneau pour laisser la carte au tracé
  if (isMobile()) setSheet('peek');
  const pad = isMobile() ? { paddingTopLeft: [24, 120], paddingBottomRight: [24, 140] } : { padding: [50, 50] };
  map.flyToBounds(lines.getBounds(), { ...pad, duration: 0.7, maxZoom: 16 });
}
/** Profil altimétrique (calculé à la collecte avec les altitudes IGN), dessiné en SVG dans la fiche. */
async function fillElevation(p) {
  const t = await getTrace(p);
  const box = $('detail').querySelector(`[data-elev="${CSS.escape(p.id)}"]`);
  if (!box) return;
  const e = t?.ele;
  if (!e?.profile?.length) { box.remove(); return; }
  const W = 300, H = 96, B = 16, T = 8;
  const span = Math.max(e.max - e.min, 30);
  const base = e.min - (span - (e.max - e.min)) / 2;
  const y = (z) => (H - B - ((z - base) / span) * (H - B - T)).toFixed(1);
  const n = e.profile.length;
  const pts = e.profile.map((z, i) => `${((i / (n - 1)) * W).toFixed(1)},${y(z)}`).join(' ');
  box.innerHTML = `<p class="elev-facts"><strong>Dénivelé</strong> : D+ ${e.up} m · D− ${e.down} m · altitude ${e.min} à ${e.max} m</p>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Profil altimétrique, de ${e.min} à ${e.max} mètres">
      <polygon points="0,${H - B} ${pts} ${W},${H - B}" class="elev-area"/>
      <polyline points="${pts}" class="elev-line"/>
      <line x1="0" y1="${H - B}" x2="${W}" y2="${H - B}" class="elev-axis"/>
    </svg>
    <div class="elev-scale"><span>0 km</span><span>${km(e.km)}</span></div>
    <p class="src">Altitudes : IGN (Géoplateforme), valeurs indicatives.</p>`;
}
function gpxText(p, lines) {
  const x = (s) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const segs = lines.map((l) => `    <trkseg>\n${l.map(([la, lo]) => `      <trkpt lat="${la}" lon="${lo}"/>`).join('\n')}\n    </trkseg>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Brocante Map" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${x(p.name)}</name>
    <copyright author="Contributeurs OpenStreetMap"><license>https://opendatacommons.org/licenses/odbl/</license></copyright>
    <link href="https://www.openstreetmap.org/relation/${x(String(p.trace).slice(1))}"><text>OpenStreetMap</text></link>
  </metadata>
  <trk>
    <name>${x(p.name)}</name>
${segs}
  </trk>
</gpx>
`;
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-trace],[data-gpxdl]');
  if (!b) return;
  e.stopPropagation();
  const p = itemById('places', b.dataset.trace ?? b.dataset.gpxdl);
  if (!p) return;
  if (b.dataset.trace) {
    if (!state.selected || state.selected.id !== p.id) select('places', p.id, { fromMap: true });
    return showTrace(p);
  }
  const t = await getTrace(p);
  if (!t?.lines?.length) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([gpxText(p, t.lines)], { type: 'application/gpx+xml' }));
  a.download = `${slugName(p.name)}.gpx`;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}, true);

// ---------- Y aller : choix de l'application de navigation ----------
const isAndroid = () => /android/i.test(navigator.userAgent);
const NAV_APPS = {
  google: { label: 'Google Maps', url: (a, o) => `https://www.google.com/maps/dir/?api=1&destination=${a},${o}` },
  apple: { label: 'Plans (Apple)', url: (a, o, name) => `https://maps.apple.com/?daddr=${a},${o}&q=${encodeURIComponent(name)}`, only: () => isIOS() || /Macintosh/.test(navigator.userAgent) },
  waze: { label: 'Waze', url: (a, o) => `https://waze.com/ul?ll=${a},${o}&navigate=yes`, only: () => isMobile() },
  geo: { label: 'Autre application du téléphone', url: (a, o, name) => `geo:${a},${o}?q=${a},${o}(${encodeURIComponent(name)})`, only: () => isAndroid() },
  osm: { label: 'OpenStreetMap', url: (a, o) => `https://www.openstreetmap.org/directions?to=${a},${o}#map=16/${a}/${o}` },
};
const navBtn = (x, label) => `<button type="button" data-nav="${x.lat},${x.lon}" data-navname="${esc(x.title ?? x.name ?? '')}">${label}</button>`;
let navTarget = null;
// Ouvrir l'application elle-même sur téléphone (et non son site) :
// - Android : liens « intent » (l'appli si installée, sinon le site en secours)
// - iPhone : schémas d'URL des applis (comgooglemaps://, waze://), le site si rien ne s'ouvre ; Plans s'ouvre directement
const APP_LINKS = {
  google: {
    android: (a, o, web) => `intent://maps.google.com/maps?daddr=${a},${o}#Intent;scheme=https;package=com.google.android.apps.maps;S.browser_fallback_url=${encodeURIComponent(web)};end`,
    ios: (a, o) => `comgooglemaps://?daddr=${a},${o}&directionsmode=driving`,
  },
  waze: {
    android: (a, o, web) => `intent://?ll=${a},${o}&navigate=yes#Intent;scheme=waze;package=com.waze;S.browser_fallback_url=${encodeURIComponent(web)};end`,
    ios: (a, o) => `waze://?ll=${a},${o}&navigate=yes`,
  },
};
function tryAppThenWeb(appUrl, web) {
  // si l'appli s'ouvre, la page passe en arrière-plan : on annule le secours
  const fallback = setTimeout(() => { if (document.visibilityState === 'visible') location.href = web; }, 1600);
  document.addEventListener('visibilitychange', () => clearTimeout(fallback), { once: true });
  location.href = appUrl;
}
function openNav(app, t) {
  const web = NAV_APPS[app].url(t.lat, t.lon, t.name);
  const links = APP_LINKS[app];
  if (web.startsWith('geo:')) { location.href = web; return; }
  if (isAndroid() && links?.android) { location.href = links.android(t.lat, t.lon, web); return; }
  if (isIOS() && links?.ios) { tryAppThenWeb(links.ios(t.lat, t.lon), web); return; }
  if (isIOS() && app === 'apple') { location.href = web; return; } // maps.apple.com ouvre l'appli Plans
  window.open(web, '_blank', 'noopener');
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-nav]');
  if (!b) return;
  e.stopPropagation();
  const [lat, lon] = b.dataset.nav.split(',');
  navTarget = { lat, lon, name: b.dataset.navname };
  const saved = store.get('appliCarte');
  if (saved && NAV_APPS[saved] && (!NAV_APPS[saved].only || NAV_APPS[saved].only())) return openNav(saved, navTarget);
  $('navApps').innerHTML = Object.entries(NAV_APPS).filter(([, a]) => !a.only || a.only())
    .map(([k, a]) => `<button type="button" class="btn" data-navapp="${k}">${a.label}</button>`).join('');
  $('navRemember').checked = false;
  $('navDialog').showModal();
}, true);
$('navApps').addEventListener('click', (e) => {
  const b = e.target.closest('[data-navapp]');
  if (!b || !navTarget) return;
  if ($('navRemember').checked) store.set('appliCarte', b.dataset.navapp);
  $('navDialog').close();
  openNav(b.dataset.navapp, navTarget);
  if (!$('favView').hidden) renderFavs();
});

// ---------- Favoris et planning (enregistrés sur l'appareil, sans compte) ----------
// Chaque favori garde un instantané de l'élément : le planning reste lisible même si l'élément n'est plus
// chargé (autre département) ou a disparu des sources.
let favs = store.get('favoris') ?? [];
const looseKey = (x) => norm(`${x.title ?? x.name}|${x.city ?? ''}`);
const findFav = (type, x) => favs.find((f) => f.type === type && (f.id === x.id || f.loose === looseKey(x)));
const today = () => iso(new Date());
function snapshot(type, x) {
  const base = { type, id: x.id, loose: looseKey(x), dept: x.dept, city: x.city ?? null, lat: x.lat, lon: x.lon, url: x.url ?? x.routeUrl ?? null, savedAt: Date.now() };
  if (type === 'events') {
    return { ...base, title: x.title, venue: x.venue ?? null, address: x.address ?? null, postcode: x.postcode ?? null, category: x.category,
      occurrences: x.occurrences.filter((o) => o.end >= today()).slice(0, 30) };
  }
  return { ...base, name: x.name, kind: x.kind };
}
function favBtn(type, x, small = false) {
  const on = !!findFav(type, x);
  return `<button type="button" class="fav-btn${small ? ' sm' : ''}" data-fav="${type}|${esc(x.id)}" aria-pressed="${on}" aria-label="${on ? 'Retirer des favoris' : 'Ajouter aux favoris'}" title="${on ? 'Retirer des favoris' : 'Ajouter aux favoris'}">${on ? '❤️' : '🤍'}</button>`;
}
// Retraits datés : empêchent un favori retiré sur un appareil de revenir par la synchronisation
let favsRemoved = store.get('favorisRetires') ?? [];
const favKeyOf = (f) => `${f.type}:${f.id}`;
function saveFavs(changed = false) {
  store.set('favoris', favs);
  store.set('favorisRetires', favsRemoved);
  if (changed) scheduleSync();
  $('favCount').textContent = favs.length;
  $('favPill').hidden = !favs.length;
  updateAccountBtn();
}
function toggleFav(type, x) {
  const f = findFav(type, x);
  if (f) favsRemoved.push({ key: favKeyOf(f), at: Date.now() });
  favs = f ? favs.filter((y) => y !== f) : [...favs, snapshot(type, x)];
  saveFavs(true);
  return !f;
}
const itemById = (type, id) => (type === 'events' ? events : places).find((x) => x.id === id);
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-fav]');
  if (!b) return;
  e.stopPropagation();
  const [type, id] = [b.dataset.fav.slice(0, b.dataset.fav.indexOf('|')), b.dataset.fav.slice(b.dataset.fav.indexOf('|') + 1)];
  const x = itemById(type, id) ?? favs.find((f) => f.type === type && f.id === id);
  if (!x) return;
  const on = itemById(type, id) ? toggleFav(type, x) : (favsRemoved.push({ key: favKeyOf(x), at: Date.now() }), favs = favs.filter((f) => f !== x), saveFavs(true), false);
  $$(`[data-fav="${CSS.escape(b.dataset.fav)}"]`).forEach((el) => {
    el.setAttribute('aria-pressed', String(on));
    el.textContent = on ? '❤️' : '🤍';
    el.title = el.ariaLabel = on ? 'Retirer des favoris' : 'Ajouter aux favoris';
  });
  if (on) { b.classList.remove('pop-anim'); void b.offsetWidth; b.classList.add('pop-anim'); }
  if (!$('favView').hidden) renderFavs();
}, true);

// --- Export vers l'agenda du téléphone (.ics) ---
function icsText(list) {
  const pad = (n) => String(n).padStart(2, '0');
  const d8 = (s) => s.replaceAll('-', '');
  const txt = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/[;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;
  const fold = (l) => { const out = []; while (l.length > 73) { out.push(l.slice(0, 73)); l = ` ${l.slice(73)}`; } out.push(l); return out.join('\r\n'); };
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Brocante Map//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const ev of list) {
    const o = ev.occurrences.find((x) => x.end >= today()) ?? ev.occurrences[0];
    const m = String(o.hours ?? '').match(/(\d{1,2})[:h](\d{2})?(?:\s*[–-]\s*(\d{1,2})[:h](\d{2})?)?/);
    const long = (parse(o.end) - parse(o.start)) / 864e5 > 6;
    let title = ev.title;
    lines.push('BEGIN:VEVENT', `UID:${ev.id}@brocante-map.web.app`, `DTSTAMP:${stamp}`);
    if (m && o.start === o.end) {
      const h1 = `${pad(m[1])}${m[2] ?? '00'}00`;
      const h2 = m[3] ? `${pad(m[3])}${m[4] ?? '00'}00` : `${pad(Math.min(23, +m[1] + 2))}${m[2] ?? '00'}00`;
      lines.push(`DTSTART:${d8(o.start)}T${h1}`, `DTEND:${d8(o.start)}T${h2}`);
    } else if (long) {
      // Longue période (exposition…) : un seul jour dans l'agenda, au début ou aujourd'hui si déjà commencée
      const day = o.start < today() ? today() : o.start;
      lines.push(`DTSTART;VALUE=DATE:${d8(day)}`, `DTEND;VALUE=DATE:${d8(iso(addDays(parse(day), 1)))}`);
      title += ` (jusqu'au ${fmtShortY.format(parse(o.end))})`;
    } else {
      lines.push(`DTSTART;VALUE=DATE:${d8(o.start)}`, `DTEND;VALUE=DATE:${d8(iso(addDays(parse(o.end), 1)))}`);
    }
    const where = [ev.venue, ev.address, [ev.postcode, ev.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    lines.push(fold(`SUMMARY:${txt(title)}`));
    if (where) lines.push(fold(`LOCATION:${txt(where)}`));
    if (ev.lat != null) lines.push(`GEO:${ev.lat};${ev.lon}`);
    const desc = [o.hours ? `Horaires : ${o.hours}` : '', ev.url ?? '', 'Trouvé sur Brocante Map – https://brocante-map.web.app'].filter(Boolean).join('\n');
    lines.push(fold(`DESCRIPTION:${txt(desc)}`));
    if (ev.url) lines.push(fold(`URL:${ev.url}`));
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
function downloadIcs(list, name) {
  const text = icsText(list);
  if (isIOS()) { location.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(text)}`; return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
  a.download = `${name}.ics`;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-ics]');
  if (!b) return;
  const ev = itemById('events', b.dataset.ics) ?? favs.find((f) => f.type === 'events' && f.id === b.dataset.ics);
  if (ev) downloadIcs([ev], slugName(ev.title));
}, true);
const slugName = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'evenement';

// --- Vue « Mes favoris » (dans le panneau, à la place de la liste) ---
function favEventItem(f, past = false) {
  const o = f.occurrences.find((x) => x.end >= today()) ?? f.occurrences.at(-1) ?? {};
  return `<li class="fav-row${past ? ' past' : ''}"><button class="item" data-favopen="events|${esc(f.id)}">
    <span class="ico" style="background:${color(f.category)}" aria-hidden="true">${iconOf(f, true)}</span>
    <span class="body">
      <span class="when">${o.start ? esc(occLabel(o)) : ''}${o.hours ? ` · ${esc(o.hours)}` : ''}</span>
      <span class="title" style="display:block">${esc(f.title)}</span>
      <span class="where" style="display:block">${esc([f.venue, f.city].filter(Boolean).join(' · '))}</span>
    </span></button>
    <span class="fav-tools">${past ? '' : `<button type="button" class="icon-btn flat" data-ics="${esc(f.id)}" aria-label="Ajouter à mon agenda" title="Ajouter à mon agenda">📅</button>`}${favBtn('events', f)}</span></li>`;
}
function favPlaceItem(f) {
  return `<li class="fav-row"><button class="item" data-favopen="places|${esc(f.id)}">
    <span class="ico sq" style="background:${kcolor(f.kind)}" aria-hidden="true">${iconOf(f, false)}</span>
    <span class="body"><span class="title" style="display:block">${esc(f.name)}</span><span class="where" style="display:block">${esc(f.city ?? '')}</span></span>
  </button><span class="fav-tools">${favBtn('places', f)}</span></li>`;
}
function renderFavs() {
  const t = today();
  const evs = favs.filter((f) => f.type === 'events');
  const upcoming = evs.filter((f) => f.occurrences.some((o) => o.end >= t))
    .sort((a, b) => (a.occurrences.find((o) => o.end >= t).start).localeCompare(b.occurrences.find((o) => o.end >= t).start));
  const past = evs.filter((f) => !upcoming.includes(f));
  const pls = favs.filter((f) => f.type === 'places');
  // regroupement du planning par jour
  let lastLabel = '';
  const plan = upcoming.map((f) => {
    const o = f.occurrences.find((x) => x.end >= t);
    const label = o.start <= t ? "En ce moment / aujourd'hui" : fmtDay.format(parse(o.start));
    const head = label !== lastLabel ? `<li class="fav-day">${esc(label)}</li>` : '';
    lastLabel = label;
    return head + favEventItem(f);
  }).join('');
  $('favView').innerHTML = `<button class="back" data-favclose>← Retour à la liste</button>
    <h2>👤 Mon profil</h2>
    ${accountBox()}
    <h2 class="fav-title">👥 Mes groupes</h2>
    ${savedGroups.length ? `<ul class="list fav-list">${savedGroups.map((g) => `<li class="fav-row"><div class="item"><span class="ico" style="background:var(--accent-soft)" aria-hidden="true">⭐</span><span class="body"><span class="title" style="display:block">${esc(g.name)}</span><span class="where" style="display:block">${esc(groupSummaryOf({ ...NEW_GROUP(), ...g.group }))}</span></span></div><span class="fav-tools"><button type="button" class="btn small" data-usegroup="${esc(g.id)}">Utiliser</button><button type="button" class="icon-btn flat" data-rmgroup="${esc(g.id)}" aria-label="Supprimer ce groupe" title="Supprimer">✕</button></span></li>`).join('')}</ul>` : '<p class="muted">Dans « Qui sort ? », touchez ⭐ pour enregistrer un groupe (famille, amis…) et le retrouver ici en un geste.</p>'}
    <h2 class="fav-title favs">❤️ Mes favoris</h2>
    ${!favs.length ? '<p class="muted">Touchez 🤍 sur un événement ou un lieu pour le retrouver ici.</p>' : ''}
    ${upcoming.length ? `<div class="fav-head"><h3>📅 Mon planning</h3><button type="button" class="btn small" data-icsall>Tout ajouter à mon agenda</button></div><ul class="list fav-list">${plan}</ul>` : ''}
    ${pls.length ? `<h3>📍 Lieux et activités à faire</h3><ul class="list fav-list">${pls.map(favPlaceItem).join('')}</ul>` : ''}
    ${past.length ? `<details><summary>${past.length} événement${past.length > 1 ? 's' : ''} passé${past.length > 1 ? 's' : ''}</summary><ul class="list fav-list">${past.map((f) => favEventItem(f, true)).join('')}</ul><button type="button" class="btn small" data-clearpast>Effacer les événements passés</button></details>` : ''}
    ${store.get('appliCarte') && NAV_APPS[store.get('appliCarte')] ? `<p class="src">Itinéraires ouverts avec ${esc(NAV_APPS[store.get('appliCarte')].label)} · <a href="#" data-navreset>changer</a></p>` : ''}
    <p class="src"><button type="button" class="link-btn" data-refresh>🔄 Actualiser l'application</button> · version ${esc(APP_VERSION)}</p>
    <p class="src">${account.user ? 'Vos favoris et votre groupe sont enregistrés sur cet appareil et synchronisés avec votre compte.' : 'Sans compte, vos favoris sont enregistrés uniquement sur cet appareil (rien n\'est envoyé).'}</p>`;
}
// Actualiser : sur mobile (appli installée) on ne peut pas toujours « tirer pour recharger ».
// On vide le cache de l'appli, on demande la nouvelle version au service worker, puis on recharge.
// Remplacé à chaque mise en ligne par le workflow (numéro et date de la mise en ligne)
const APP_VERSION = '__BUILD__'.startsWith('__') ? 'de développement' : '__BUILD__';
async function refreshApp(btn) {
  if (btn) btn.textContent = '⏳ Actualisation…';
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
    if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
    // contourne aussi le cache du navigateur pour les fichiers de l'application
    await Promise.all(['./', 'index.html', 'app.js', 'style.css'].map((f) => fetch(f, { cache: 'reload' }).catch(() => null)));
  } catch { /* hors ligne : on recharge quand même */ }
  location.reload();
}
function openFavs() {
  renderFavs();
  $('favView').hidden = false;
  $('list').hidden = true;
  $('detail').hidden = true;
  $('sheetBody').scrollTop = 0;
  if (isMobile()) setSheet('full'); else setListOpen(true);
}
function closeFavs() {
  $('favView').hidden = true;
  if (state.selected) $('detail').hidden = false; else $('list').hidden = false;
}
$('favPill').addEventListener('click', () => { openFavs(); $('favView').querySelector('.fav-title.favs')?.scrollIntoView({ block: 'start' }); });
$('accountBtn').addEventListener('click', openFavs);
document.addEventListener('click', (e) => { if (e.target.closest('[data-openfavs]')) { e.preventDefault(); openFavs(); } });
$('favView').addEventListener('click', async (e) => {
  if (e.target.closest('[data-favclose]')) return closeFavs();
  if (e.target.closest('[data-refresh]')) return refreshApp(e.target.closest('[data-refresh]'));
  if (e.target.closest('[data-usegroup]')) { useSavedGroup(e.target.closest('[data-usegroup]').dataset.usegroup); closeFavs(); return; }
  if (e.target.closest('[data-rmgroup]')) { removeSavedGroup(e.target.closest('[data-rmgroup]').dataset.rmgroup); return renderFavs(); }
  if (e.target.closest('[data-navreset]')) { e.preventDefault(); store.set('appliCarte', null); return renderFavs(); }
  if (e.target.closest('[data-icsall]')) {
    const t = today();
    return downloadIcs(favs.filter((f) => f.type === 'events' && f.occurrences.some((o) => o.end >= t)), 'mon-planning');
  }
  if (e.target.closest('[data-clearpast]')) {
    const t = today();
    for (const f of favs) if (f.type === 'events' && !f.occurrences.some((o) => o.end >= t)) favsRemoved.push({ key: favKeyOf(f), at: Date.now() });
    favs = favs.filter((f) => f.type !== 'events' || f.occurrences.some((o) => o.end >= t));
    saveFavs(true);
    return renderFavs();
  }
  const b = e.target.closest('[data-favopen]');
  if (!b) return;
  const i = b.dataset.favopen.indexOf('|');
  const type = b.dataset.favopen.slice(0, i);
  const id = b.dataset.favopen.slice(i + 1);
  const f = favs.find((x) => x.type === type && x.id === id);
  if (f?.dept && dataIndex?.depts?.[f.dept]) await loadDept(type, f.dept);
  const list = type === 'events' ? events : places;
  const x = list.find((y) => y.id === id) ?? list.find((y) => looseKey(y) === f?.loose);
  if (!x) { b.querySelector('.where').textContent = "N'est plus en ligne"; return; }
  $('favView').hidden = true;
  if (state.mode !== type) { state.mode = type; render(); }
  select(type, x.id, { open: true });
  map.setView([x.lat, x.lon], Math.max(map.getZoom(), 13));
});

// ---------- Compte (facultatif) : synchronise favoris et groupe entre appareils ----------
// Firebase Authentication (Google ou lien par e-mail) + un document Firestore par utilisateur, lu et écrit
// via l'API REST (pas de gros SDK). Les bibliothèques ne sont chargées que si on utilise un compte.
const FB_VERSION = '10.14.1';
const account = { user: null, mod: null, auth: null, cfg: null, status: '', syncing: null, timer: null };
async function firebase() {
  if (account.mod) return account.mod;
  const cfg = await (await fetch('/__/firebase/init.json')).json();
  const base = `https://www.gstatic.com/firebasejs/${FB_VERSION}`;
  const [app, auth] = await Promise.all([import(`${base}/firebase-app.js`), import(`${base}/firebase-auth.js`)]);
  account.cfg = cfg;
  account.auth = auth.getAuth(app.initializeApp(cfg));
  auth.useDeviceLanguage(account.auth);
  account.mod = auth;
  auth.onAuthStateChanged(account.auth, (u) => {
    account.user = u;
    store.set('compte', !!u);
    saveFavs();
    if (!$('favView').hidden) renderFavs();
    if (u) sync();
  });
  return auth;
}
const docUrl = () => `https://firestore.googleapis.com/v1/projects/${account.cfg.projectId}/databases/(default)/documents/users/${account.user.uid}`;
async function api(method, body) {
  const token = await account.user.getIdToken();
  const r = await fetch(docUrl(), { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  if (r.status === 404 && method === 'GET') return null;
  if (!r.ok) throw new Error(`Firestore ${r.status}`);
  return method === 'DELETE' ? null : r.json();
}
function mergeData(remote) {
  // retraits : on garde le plus récent par élément, 180 jours au plus
  const limit = Date.now() - 180 * 864e5;
  const tomb = new Map();
  for (const t of [...favsRemoved, ...(remote?.removed ?? [])]) if (t.at > limit && !(tomb.get(t.key) >= t.at)) tomb.set(t.key, t.at);
  const byKey = new Map();
  for (const f of [...(remote?.favs ?? []), ...favs]) {
    const k = favKeyOf(f);
    if ((tomb.get(k) ?? 0) >= (f.savedAt ?? 0)) continue;
    if (!byKey.has(k) || (byKey.get(k).savedAt ?? 0) < (f.savedAt ?? 0)) byKey.set(k, f);
  }
  favs = [...byKey.values()];
  // groupes enregistrés : même principe (le plus récent gagne, retraits datés)
  const groups = new Map();
  for (const g of [...(remote?.groups ?? []), ...savedGroups]) {
    if ((tomb.get(`group:${g.id}`) ?? 0) >= (g.savedAt ?? 0)) continue;
    if (!groups.has(g.id) || (groups.get(g.id).savedAt ?? 0) < (g.savedAt ?? 0)) groups.set(g.id, g);
  }
  savedGroups = [...groups.values()];
  saveSavedGroups();
  favsRemoved = [...tomb].map(([key, at]) => ({ key, at }));
  if (remote?.group && (remote.groupAt ?? 0) > (store.get('groupeLe') ?? 0)) {
    state.group = { ...NEW_GROUP(), ...remote.group };
    store.set('groupe', state.group);
    store.set('groupeLe', remote.groupAt);
    drawCenter();
    render();
  }
}
/** Lit le document du compte, fusionne avec l'appareil, puis réécrit le résultat. */
async function sync() {
  if (!account.user) return;
  if (account.syncing) return account.syncing;
  account.syncing = (async () => {
    try {
      const doc = await api('GET');
      const raw = doc?.fields?.data?.stringValue;
      mergeData(raw ? JSON.parse(raw) : null);
      saveFavs();
      const data = { favs, removed: favsRemoved, group: state.group, groupAt: store.get('groupeLe') ?? 0, groups: savedGroups };
      await api('PATCH', { fields: { data: { stringValue: JSON.stringify(data) }, updatedAt: { timestampValue: new Date().toISOString() } } });
      account.status = '';
    } catch (e) {
      account.status = 'Synchronisation impossible pour le moment (hors connexion ?).';
      console.warn(e);
    } finally {
      account.syncing = null;
      if (!$('favView').hidden) renderFavs();
    }
  })();
  return account.syncing;
}
function scheduleSync() {
  if (!account.user) return;
  clearTimeout(account.timer);
  account.timer = setTimeout(sync, 1000);
}
let lastFocusSync = 0;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && account.user && Date.now() - lastFocusSync > 60000) { lastFocusSync = Date.now(); sync(); }
});
/** Bouton du compte (en haut à droite) : silhouette, puis photo de profil (ou initiale) une fois connecté. */
function updateAccountBtn() {
  const u = account.user;
  const b = $('accountBtn');
  const photo = b.querySelector('.acct-photo');
  const initial = b.querySelector('.acct-initial');
  const label = u ? `Mon compte (${u.email ?? u.displayName ?? 'connecté'})` : 'Se connecter';
  b.title = label;
  b.setAttribute('aria-label', label);
  b.classList.toggle('signed', !!u);
  photo.hidden = !u?.photoURL;
  photo.onerror = () => { photo.hidden = true; initial.hidden = false; };
  if (u?.photoURL && photo.getAttribute('src') !== u.photoURL) photo.src = u.photoURL;
  initial.hidden = !u || !!u.photoURL;
  initial.textContent = (u?.displayName ?? u?.email ?? '?').trim().charAt(0).toUpperCase();
  b.querySelector('.acct-ico').style.display = u ? 'none' : '';
}
function accountBox() {
  const u = account.user;
  if (u) {
    return `<div class="acct-box on"><p>✓ Compte : <strong>${esc(u.email ?? u.displayName ?? 'connecté')}</strong><br><span class="muted">Favoris et groupe synchronisés sur vos appareils.</span></p>
      ${account.status ? `<p class="warn">${esc(account.status)}</p>` : ''}
      <div class="acct-actions"><button type="button" class="btn small" data-logout>Se déconnecter</button><button type="button" class="btn small ghost danger" data-delacct>Supprimer mon compte</button></div></div>`;
  }
  return `<div class="acct-box"><p><strong>Retrouvez vos favoris sur tous vos appareils</strong><br><span class="muted">Compte gratuit, facultatif. Seuls vos favoris et votre groupe y sont enregistrés.</span></p>
    <button type="button" class="btn google" data-login-google><span aria-hidden="true">G</span> Continuer avec Google</button>
    <form class="mail-login" data-login-mail><input type="email" name="email" required placeholder="ou votre e-mail" autocomplete="email"><button class="btn">Recevoir un lien</button></form>
    ${account.status ? `<p class="muted">${esc(account.status)}</p>` : ''}</div>`;
}
$('favView').addEventListener('click', async (e) => {
  try {
    if (e.target.closest('[data-login-google]')) {
      const a = await firebase();
      const provider = new a.GoogleAuthProvider();
      try { await a.signInWithPopup(account.auth, provider); } catch (err) {
        if (/popup-blocked|operation-not-supported/.test(err.code ?? '')) { try { sessionStorage.setItem('connexionRedirect', '1'); } catch { /* */ } await a.signInWithRedirect(account.auth, provider); }
        else if (!/popup-closed|cancelled-popup/.test(err.code ?? '')) throw err;
      }
    } else if (e.target.closest('[data-logout]')) {
      const a = await firebase();
      await a.signOut(account.auth);
    } else if (e.target.closest('[data-delacct]')) {
      if (!confirm('Supprimer votre compte et les favoris enregistrés en ligne ? Ceux de cet appareil sont conservés.')) return;
      const a = await firebase();
      await api('DELETE');
      try { await a.deleteUser(account.user); } catch (err) {
        if (/requires-recent-login/.test(err.code ?? '')) { account.status = 'Par sécurité, reconnectez-vous puis recommencez la suppression.'; await a.signOut(account.auth); }
        else throw err;
      }
    }
  } catch (err) {
    console.warn(err);
    account.status = 'Connexion impossible pour le moment.';
    renderFavs();
  }
});
$('favView').addEventListener('submit', async (e) => {
  if (!e.target.matches('[data-login-mail]')) return;
  e.preventDefault();
  const email = e.target.email.value.trim();
  try {
    const a = await firebase();
    await a.sendSignInLinkToEmail(account.auth, email, { url: `${location.origin}/`, handleCodeInApp: true });
    store.set('emailConnexion', email);
    account.status = `Lien envoyé à ${email} : ouvrez-le sur cet appareil pour vous connecter.`;
  } catch (err) {
    console.warn(err);
    account.status = "Envoi impossible pour le moment. Vérifiez l'adresse.";
  }
  renderFavs();
});
/** Au chargement : session existante, retour de connexion Google (redirection) ou lien reçu par e-mail. */
async function restoreAccount() {
  const viaMail = /[?&]oobCode=/.test(location.search) && /mode=signIn/.test(location.search);
  let redirect = false;
  try { redirect = !!sessionStorage.getItem('connexionRedirect'); sessionStorage.removeItem('connexionRedirect'); } catch { /* */ }
  if (!store.get('compte') && !viaMail && !redirect) return;
  try {
    const a = await firebase();
    if (viaMail && a.isSignInWithEmailLink(account.auth, location.href)) {
      const email = store.get('emailConnexion') || prompt('Pour terminer la connexion, confirmez votre adresse e-mail :');
      if (email) await a.signInWithEmailLink(account.auth, email, location.href);
      history.replaceState(null, '', `${location.pathname}${location.hash}`);
      openFavs();
    }
  } catch (err) {
    console.warn(err);
  }
}

// ---------- Données (un fichier par département, chargé quand il devient visible) ----------
async function getJson(url) {
  try { const r = await fetch(url, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch { return null; }
}
const OLD_TYPES = { 'vide-grenier': 'brocante', braderie: 'brocante', puces: 'brocante', bourse: 'brocante' };
function prepEvent(e) {
  let category = e.category ?? OLD_TYPES[e.type] ?? e.type ?? 'autre';
  if (!(category in CATS)) category = 'autre';
  const occurrences = e.dates?.length
    ? e.dates.map(([start, end, hours]) => ({ start, end: end ?? start, hours: hours ?? null }))
    : [{ start: e.start, end: e.end ?? e.start, hours: e.hours ?? null }];
  return { ...e, category, occurrences, sources: e.sources ?? [], _search: norm(`${e.title} ${e.venue ?? ''} ${e.organizer ?? ''} ${e.city ?? ''} ${e.postcode ?? ''} ${e.description ?? ''} ${CATS[category]}`) };
}
function prepPlace(p) {
  return { ...p, _search: norm(`${p.name} ${p.city ?? ''} ${p.postcode ?? ''} ${p.description ?? ''} ${p.discipline ?? ''} ${KINDS[p.kind]}`) };
}
function addItems(kind, list) {
  const ok = list.filter((x) => x.lat != null && x.lon != null && (kind === 'events' || x.kind in KINDS));
  if (kind === 'events') events.push(...ok.map(prepEvent)); else places.push(...ok.map(prepPlace));
}

let dataIndex = null;
const loaded = { events: new Set(), places: new Set() };
const pending = new Map();
let loadingCount = 0;
/** Charge (une seule fois) les données d'un département. Renvoie true si de nouvelles données sont arrivées. */
function loadDept(kind, d) {
  if (loaded[kind].has(d)) return Promise.resolve(false);
  const key = `${kind}/${d}`;
  if (!pending.has(key)) {
    loadingCount++;
    pending.set(key, getJson(`data/${d}/${kind}.json`).then((data) => {
      addItems(kind, data?.[kind] ?? []);
      loaded[kind].add(d);
      return true;
    }).finally(() => { loadingCount--; }));
  }
  return pending.get(key);
}
const deptBounds = (i) => L.latLngBounds([i.bbox[0], i.bbox[1]], [i.bbox[2], i.bbox[3]]);
// ---------- Vue d'ensemble (carte dézoomée sur beaucoup de départements) ----------
// Au-delà de quelques départements, une carte très dézoomée chargerait tout : on montre une pastille par
// département avec son nombre d'éléments, et le détail se charge en zoomant.
const OVERVIEW_ZOOM = 8;
const overviewLayer = L.layerGroup();
const isOverview = () => !!dataIndex && Object.keys(dataIndex.depts ?? {}).length > 4 && map.getZoom() < OVERVIEW_ZOOM;
const deptCount = (i) => (state.mode === 'events' ? i.events : i.places) ?? 0;
function renderOverview() {
  const on = isOverview();
  if (!on) { map.removeLayer(overviewLayer); return; }
  map.removeLayer(cluster);
  map.removeLayer(placeCluster);
  closeCallout?.();
  overviewLayer.clearLayers();
  const zone = groupZone();
  for (const [d, i] of Object.entries(dataIndex.depts)) {
    if (!i.bbox) continue;
    const n = deptCount(i);
    const out = zone && !deptBounds(i).intersects(zone);
    const label = n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',').replace(',0', '')} k` : String(n);
    const icon = L.divIcon({ className: '', html: `<button type="button" class="dept-bubble${out ? ' out' : ''}" aria-label="${esc(i.name)}${out ? ' (hors de la zone du groupe)' : ''}"><strong>${label}</strong><span>${d}</span></button>`, iconSize: [52, 40], iconAnchor: [26, 20] });
    const m = L.marker(deptBounds(i).getCenter(), { icon, keyboard: true });
    if (canHover()) m.bindTooltip(`${esc(i.name)} : ${n.toLocaleString('fr-FR')} ${state.mode === 'events' ? 'événements' : 'lieux et activités'}${out ? ' (hors de la zone du groupe)' : ''}`, { direction: 'top', offset: [0, -20], className: 'tip', opacity: 1 });
    m.on('click', () => map.flyToBounds(deptBounds(i), { padding: [20, 20], duration: 0.7 }));
    overviewLayer.addLayer(m);
  }
  overviewLayer.addTo(map);
}
function renderOverviewList() {
  const depts = Object.entries(dataIndex.depts).filter(([, i]) => i.bbox).sort((a, b) => a[1].name.localeCompare(b[1].name, 'fr'));
  const total = depts.reduce((n, [, i]) => n + deptCount(i), 0);
  const noun = state.mode === 'events' ? 'événements' : 'lieux et activités';
  $('count').textContent = `${total.toLocaleString('fr-FR')} ${noun} · zoomez sur un département`;
  $('listCount').textContent = total.toLocaleString('fr-FR');
  $('list').innerHTML = depts.map(([d, i]) => `<li><button class="item" data-dept="${d}"><span class="body"><span class="title" style="display:block">${esc(i.name)} (${d})</span><span class="where" style="display:block">${deptCount(i).toLocaleString('fr-FR')} ${noun} (avant filtres)</span></span></button></li>`).join('');
}
$('list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-dept]');
  if (!b) return;
  e.stopImmediatePropagation();
  if (isMobile()) setSheet('peek');
  map.flyToBounds(deptBounds(dataIndex.depts[b.dataset.dept]), { padding: [20, 20], duration: 0.7 });
}, true);
map.on('zoomend', () => {
  const was = map.hasLayer(overviewLayer);
  if (was !== isOverview()) render();
});

/** Départements qui recoupent la carte (avec une marge) ou le rayon du groupe. */
function wantedDepts() {
  if (!dataIndex || isOverview()) return [];
  const view = map.getBounds().pad(0.1);
  const g = state.group;
  const zone = groupZone();
  return Object.entries(dataIndex.depts ?? {})
    .filter(([, i]) => i.bbox && (deptBounds(i).intersects(view) || (zone && deptBounds(i).intersects(zone))))
    .map(([d]) => d);
}
async function ensureData() {
  const kind = state.mode;
  const fresh = await Promise.all(wantedDepts().map((d) => loadDept(kind, d)));
  if (fresh.some(Boolean)) render(); else renderList();
}

(async () => {
  readHash();
  renderRandoFilters();
  $('q').value = state.q;
  saveFavs();
  dataIndex = await getJson('data/index.json');
  let meta = dataIndex;
  if (!dataIndex?.depts) {
    // Ancien format (fichier unique) ou données de démonstration
    dataIndex = null;
    let data = await getJson('data/events.json');
    if (!data?.events?.length) { data = await getJson('data/demo.json'); $('demoBanner').hidden = !data; }
    data ??= { events: [], departments: [] };
    addItems('events', data.events);
    addItems('places', (await getJson('data/places.json'))?.places ?? []);
    meta = data;
  }
  const deptInfo = dataIndex?.depts ?? {};
  const totalPlaces = dataIndex ? Object.values(deptInfo).reduce((n, i) => n + (i.places ?? 0), 0) : places.length;
  if (!totalPlaces) document.querySelector('[data-mode="places"]').hidden = true;
  const codes = meta?.departments ?? [];
  $('zone').textContent = codes.length > 3 ? `${codes.length} départements` : codes.map((d) => deptInfo[d]?.name ?? DEPT_NAMES[d] ?? `Département ${d}`).join(' · ');
  $('meta').innerHTML = `${meta?.generatedAt ? `Mis à jour le ${new Date(meta.generatedAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}. ` : ''}`
    + 'Données : DATAtourisme et OpenAgenda (Licence Ouverte), Ticketmaster, ministère de la Culture, © contributeurs <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> (ODbL). '
    + '<a href="#" data-openfavs>❤️ Favoris et compte</a> · <a href="mentions-legales.html">Mentions légales et confidentialité</a> · <a href="#" data-install>📲 Installer l\'appli</a>';

  // Vue de départ : élément partagé, zone du groupe, sinon toute la zone couverte
  const sel = state.selected;
  if (sel && dataIndex) {
    if (deptInfo[sel.dept]) await loadDept(sel.type, sel.dept);
    // lien sans département (ancien format) : on cherche partout
    if (!(sel.type === 'events' ? events : places).some((x) => x.id === sel.id)) await Promise.all(Object.keys(deptInfo).map((d) => loadDept(sel.type, d)));
  }
  const all = Object.values(deptInfo).filter((i) => i.bbox);
  if (sel) state.mode = sel.type;
  else if (state.group.set && state.group.center) map.setView([state.group.center.lat, state.group.center.lon], 10);
  else if (all.length) map.fitBounds(all.map(deptBounds).reduce((a, b) => a.extend(b)), { maxZoom: 11, animate: false });
  else if (events.length) map.fitBounds(L.latLngBounds(events.map((e) => [e.lat, e.lon])).pad(0.05), { maxZoom: 11 });

  drawCenter();
  await ensureData();
  render();
  if (sel) { state.selected = null; setTimeout(() => showOnMap(sel.id), 300); }
  restoreAccount();
  // Par défaut : carte centrée sur la position de l'utilisateur, s'il l'autorise
  if (!sel && !(state.group.set && state.group.center)) {
    locateMe((me) => { map.setView([me.lat, me.lon], 11); render(); }, true);
  }
})();

// ---------- Application installable (PWA) ----------
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let installEvent = null;
function updateInstallPill() { /* pastille retirée : l'installation reste accessible par le lien en bas de liste */ }
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; updateInstallPill(); });
window.addEventListener('appinstalled', () => { installEvent = null; });
function openInstall() {
  const ios = isIOS();
  $('installIOS').hidden = !ios && isMobile();
  $('installAndroid').hidden = ios;
  $('installDesktop').hidden = isMobile();
  $('installNow').hidden = !installEvent;
  $('installDialog').showModal();
}
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

// Toucher en dehors d'une fenêtre (sur la carte assombrie) la referme
$$('dialog.modal').forEach((d) => d.addEventListener('click', (e) => {
  if (e.target !== d) return;
  const r = d.getBoundingClientRect();
  if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) d.close();
}));
