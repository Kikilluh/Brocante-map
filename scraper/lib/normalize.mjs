// Normalisation des événements issus des différentes sources vers un format unique.

// Catégories d'activités. L'ordre compte : la première qui correspond l'emporte.
export const CATEGORIES = [
  ['brocante', /brocante|vide[\s-]?greniers?|vide[\s-]?maisons?|vide[\s-]?dressing|braderie|\bpuces\b|bric[\s-]?[àa][\s-]?brac|bourse aux|\btroc\b|antiquit/i],
  ['atelier', /atelier|\bstages?\b|initiation|\bcours\b|workshop|masterclass|apprendre [àa]|\banimations?\b|\bjeux\b|jeu de (soci[ée]t[ée]|plateau)|ludique|escape game/i],
  ['concert', /concert|r[ée]cital|musique|chorale|\bjazz\b|orchestre|\bdj\b|fanfare|op[ée]ra|\brock\b|chanson/i],
  ['spectacle', /spectacle|th[ée][aâ]tr|\bdanse\b|cirque|humour|one[\s-]?man|com[ée]die|\bcin[ée]|projection|marionnette|\bcont(e|es|eur|euse)\b|raconte|ballet|magie|repr[ée]sentation|impro/i],
  ['visite', /visite|patrimoine|ch[âa]teau|monument|guid[ée]e|journ[ée]es? europ[ée]ennes/i],
  ['exposition', /exposition|\bexpo\b|mus[ée]e|galerie|vernissage/i],
  ['rando', /randonn[ée]e|\brandos?\b|balade|marche nordique|sortie nature|promenade|sentier|\bnature\b|ornitho|botani|champignon|jardin|for[êe]t/i],
  ['sport', /\bsports?\b|course|\btrail\b|marathon|tournoi|\bmatch\b|v[ée]lo|cyclo|triathlon|p[ée]tanque|\bgolf\b|kayak|cano[ëe]|\byoga\b/i],
  ['fete', /f[êe]te|festival|carnaval|feu d.artifice|\bbal\b|guinguette|soir[ée]e|no[ëe]l|halloween/i],
  ['marche', /march[ée]|\bfoire\b|\bsalon\b|d[ée]gustation|gastronom|producteurs|\bvins?\b|\bloto\b|ap[ée]ro|paysan/i],
  ['conference', /conf[ée]rence|rencontre|d[ée]bat|lecture|d[ée]dicace|caf[ée][\s-]philo|table ronde|projection-d[ée]bat/i],
];

// Indices tirés des types DATAtourisme / schema.org
const TYPE_HINTS = [
  ['brocante', /GarageSale|FleaMarket|BricABrac|Brocante/i],
  ['concert', /Concert|MusicEvent/i],
  ['spectacle', /Theater|Theatre|Dance|Circus|ShowEvent|Screening|Comedy|Spectacle/i],
  ['exposition', /Exhibition|VisualArts|Museum/i],
  ['visite', /Visit|GuidedTour|Heritage/i],
  ['atelier', /Workshop|Course|Training|Education/i],
  ['rando', /Walk|Hiking|Ramble|NatureEvent/i],
  ['sport', /Sport/i],
  ['fete', /Festival|Celebration|Carnival|Party|Fete|TraditionalCelebration/i],
  ['marche', /Market|Fair|Trade|Gastronom|Tasting/i],
  ['conference', /Conference|Lecture|Talk|Reading|Seminar/i],
];

export function guessCategory({ title = '', types = '', description = '' } = {}) {
  for (const [c, re] of CATEGORIES) if (re.test(title)) return c;
  for (const [c, re] of TYPE_HINTS) if (re.test(types)) return c;
  for (const [c, re] of CATEGORIES) if (re.test(description)) return c;
  return 'autre';
}

/** Compatibilité : ancienne fonction (brocantes uniquement). */
export function guessType(text = '') {
  return guessCategory({ title: text });
}

const BROCANTE = CATEGORIES[0][1];
export function isRelevant(text = '') {
  return BROCANTE.test(text);
}

/** Prix depuis un texte libre : { free, priceMin, priceMax } (valeurs null si inconnues). */
export function parsePrice(text = '') {
  const t = String(text).toLowerCase();
  const out = { free: null, priceMin: null, priceMax: null };
  if (/gratuit|entr[ée]e libre|acc[èe]s libre|participation libre|sans frais/.test(t)) out.free = true;
  const nums = [...t.matchAll(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur\b|euros?)/g)].map((m) => parseFloat(m[1].replace(',', '.')));
  if (nums.length) {
    // « gratuit pour les enfants, 5 € adultes » : prix de 0 à 5 €, mais pas entièrement gratuit
    out.priceMin = out.free ? 0 : Math.min(...nums);
    out.priceMax = Math.max(...nums);
    out.free = out.priceMax === 0 ? true : out.free ? false : null;
  } else if (out.free) {
    out.priceMin = 0;
    out.priceMax = 0;
  }
  return out;
}

/** Âges depuis un texte libre : { ageMin, ageMax }. */
export function parseAge(text = '') {
  // Les âges cités dans un tarif (« gratuit jusqu'à 12 ans », « réduit pour les 18-25 ans ») ne sont pas des limites d'âge
  const t = String(text).toLowerCase().replace(/(gratuit|gratuité|tarifs?|r[ée]duit|offert|demi-tarif|exon[ée]r|€|euros?)[^.;\n]{0,45}/g, ' ');
  let m;
  if ((m = t.match(/(\d{1,2})\s*(?:-|à|a)\s*(\d{1,2})\s*ans/))) return { ageMin: +m[1], ageMax: +m[2] };
  if ((m = t.match(/(?:d[èe]s|[àa] partir de|plus de|\+\s?de|\+)\s*(\d{1,2})\s*ans/))) return { ageMin: +m[1], ageMax: null };
  if ((m = t.match(/(?:moins de|jusqu.[àa])\s*(\d{1,2})\s*ans/))) return { ageMin: null, ageMax: +m[1] };
  if (/r[ée]serv[ée] aux adultes|interdit aux mineurs|\+18\b/.test(t)) return { ageMin: 18, ageMax: null };
  return { ageMin: null, ageMax: null };
}

/** Jauge depuis un texte libre. */
export function parseCapacity(text = '') {
  const m = String(text).toLowerCase().match(/(?:limit[ée]e?s? [àa]|jauge (?:de |limit[ée]e [àa] )?|maximum )\s*(\d{1,4})\s*(?:personnes|participants|places|pers)|(\d{1,4})\s*places\b/);
  return m ? +(m[1] ?? m[2]) : null;
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

const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/**
 * Construit un événement normalisé.
 * raw : { title, start, end | occurrences:[{start,end,hours}], city, postcode, address, lat, lon, url,
 *         description, conditions, types, category, priceMin, priceMax, free, ageMin, ageMax, capacity, credit }
 * @returns {object|null}
 */
export function makeEvent(raw, source) {
  const title = cleanText(raw.title);
  if (!title) return null;
  const occ = (raw.occurrences?.length ? raw.occurrences : [{ start: raw.start, end: raw.end, hours: raw.hours }])
    .map((o) => {
      const start = toDay(o.start);
      if (!start) return null;
      let end = toDay(o.end) || start;
      if (end < start) end = start;
      return { start, end, hours: o.hours ? cleanText(o.hours) : null };
    })
    .filter(Boolean)
    .sort((a, b) => a.start.localeCompare(b.start));
  if (!occ.length) return null;
  const description = raw.description ? cleanText(raw.description).slice(0, 600) : null;
  const text = `${title} ${description ?? ''} ${raw.conditions ?? ''}`;
  const postcode = raw.postcode ? String(raw.postcode).trim() : null;
  const lat = num(raw.lat);
  const lon = num(raw.lon);

  const p = parsePrice(`${raw.conditions ?? ''} ${description ?? ''}`);
  let priceMin = num(raw.priceMin) ?? p.priceMin;
  let priceMax = num(raw.priceMax) ?? p.priceMax ?? priceMin;
  let free = raw.free ?? p.free;
  if (priceMin === 0 && (priceMax ?? 0) === 0) free = true;
  else if (priceMax > 0) free = false;
  if (free && priceMin == null) priceMin = priceMax = 0;
  const a = parseAge(text);

  return {
    title,
    category: raw.category || guessCategory({ title, types: raw.types ?? '', description: description ?? '' }),
    start: occ[0].start,
    end: occ[occ.length - 1].end,
    occurrences: occ,
    hours: occ[0].hours,
    city: raw.city ? cleanText(raw.city) : null,
    postcode,
    dept: raw.dept || deptFromPostcode(postcode),
    venue: raw.venue ? cleanText(raw.venue) : null,
    organizer: raw.organizer ? cleanText(raw.organizer) : null,
    address: raw.address ? cleanText(raw.address) : null,
    lat,
    lon,
    free: free ?? null,
    priceMin,
    priceMax,
    ageMin: num(raw.ageMin) ?? a.ageMin,
    ageMax: (() => { const m = num(raw.ageMax) ?? a.ageMax; return m != null && m < 18 ? m : null; })(),
    capacity: num(raw.capacity) ?? parseCapacity(text),
    description,
    url: raw.url || null,
    credit: raw.credit || null,
    audience: raw.audience || null,
    image: raw.image || null,
    imageCredit: raw.imageCredit ? cleanText(raw.imageCredit).slice(0, 120) : null,
    sources: [{ id: source, url: raw.url || null }],
  };
}
