// Normalisation des événements issus des différentes sources vers un format unique.

const TYPES = [
  ['vide-grenier', /vide[\s-]?greniers?|vide[\s-]?maisons?|vide[\s-]?dressing/i],
  ['braderie', /braderie/i],
  ['puces', /puces|chine/i],
  ['bourse', /bourse|troc/i],
  ['brocante', /brocante|antiquit/i],
];

const RELEVANT = /brocante|vide[\s-]?grenier|vide[\s-]?maison|braderie|puces|bric[\s-]?[àa][\s-]?brac|antiquit|bourse aux|troc|vide[\s-]?dressing|chine/i;

export function guessType(text = '') {
  for (const [type, re] of TYPES) if (re.test(text)) return type;
  return 'brocante';
}

export function isRelevant(text = '') {
  return RELEVANT.test(text);
}

export function stripAccents(s = '') {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function slug(s = '') {
  return stripAccents(String(s)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const NAMED = {};
for (const [name, ch] of Object.entries({
  agrave: 'à', acirc: 'â', auml: 'ä', eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', icirc: 'î', iuml: 'ï',
  ocirc: 'ô', ouml: 'ö', ugrave: 'ù', ucirc: 'û', uuml: 'ü', ccedil: 'ç', yuml: 'ÿ',
})) {
  NAMED[name] = ch;
  NAMED[name[0].toUpperCase() + name.slice(1)] = ch.toUpperCase();
}
Object.assign(NAMED, { oelig: 'œ', OElig: 'Œ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', euro: '€', hellip: '…', ndash: '–', mdash: '—', deg: '°' });

export function decodeEntities(s = '') {
  return String(s)
    .replace(/&([a-zA-Z]+);/g, (m, n) => NAMED[n] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function cleanText(s = '') {
  return decodeEntities(String(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Renvoie une date ISO "YYYY-MM-DD" (heure locale française) ou null. */
export function toDay(value) {
  if (!value) return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m && !/T\d{2}:\d{2}.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  if (isNaN(d)) return null;
  // Conversion en date du calendrier Europe/Paris
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);
}

export function deptFromPostcode(pc) {
  if (!pc) return null;
  const s = String(pc).padStart(5, '0');
  if (s.startsWith('97')) return s.slice(0, 3);
  if (s.startsWith('20')) return +s < 20200 ? '2A' : '2B';
  return s.slice(0, 2);
}

/**
 * Construit un événement normalisé.
 * @returns {object|null}
 */
export function makeEvent(raw, source) {
  const title = cleanText(raw.title);
  const start = toDay(raw.start);
  if (!title || !start) return null;
  let end = toDay(raw.end) || start;
  if (end < start) end = start;
  const postcode = raw.postcode ? String(raw.postcode).trim() : null;
  const lat = raw.lat != null ? Number(raw.lat) : null;
  const lon = raw.lon != null ? Number(raw.lon) : null;
  return {
    title,
    type: raw.type || guessType(`${title} ${raw.description || ''}`),
    start,
    end,
    city: raw.city ? cleanText(raw.city) : null,
    postcode,
    dept: raw.dept || deptFromPostcode(postcode),
    address: raw.address ? cleanText(raw.address) : null,
    lat: Number.isFinite(lat) ? lat : null,
    lon: Number.isFinite(lon) ? lon : null,
    hours: raw.hours ? cleanText(raw.hours) : null,
    exhibitors: raw.exhibitors ?? null,
    description: raw.description ? cleanText(raw.description).slice(0, 500) : null,
    url: raw.url || null,
    sources: [{ id: source, url: raw.url || null }],
  };
}
