// Fusion des doublons : le même vide-grenier est souvent déclaré sur plusieurs sites.
// Clé = commune + date de début ; puis comparaison des titres (mots communs).

import { slug } from './normalize.mjs';

const STOP = new Set(['de', 'du', 'la', 'le', 'les', 'des', 'et', 'en', 'a', 'au', 'aux', 'l', 'd', 'sur', 'annuel', 'annuelle', 'grand', 'grande', 'un', 'une', 'pour', 'avec', 'par']);

function words(title) {
  return new Set(slug(title).split('-').filter((w) => w.length > 1 && !STOP.has(w)));
}

function similar(a, b) {
  const wa = words(a.title);
  const wb = words(b.title);
  if (!wa.size || !wb.size) return false;
  let common = 0;
  for (const w of wa) if (wb.has(w)) common++;
  const ratio = common / Math.min(wa.size, wb.size);
  // Même commune + même date : titres proches, ou deux brocantes (rarement plusieurs le même jour au même endroit)
  return ratio >= 0.5 || (a.category === 'brocante' && b.category === 'brocante' && ratio >= 0.25);
}

function merge(a, b) {
  for (const k of Object.keys(b)) {
    if (k === 'sources') continue;
    if (a[k] == null || a[k] === '') a[k] = b[k];
  }
  if (b.description && (a.description?.length ?? 0) < b.description.length) a.description = b.description;
  for (const s of b.sources) if (!a.sources.some((x) => x.id === s.id)) a.sources.push(s);
  if (b.occurrences) {
    const seen = new Set((a.occurrences ?? []).map((o) => o.start));
    a.occurrences = [...(a.occurrences ?? []), ...b.occurrences.filter((o) => !seen.has(o.start))].sort((x, y) => x.start.localeCompare(y.start));
    a.end = a.occurrences.at(-1).end > a.end ? a.occurrences.at(-1).end : a.end;
  }
  return a;
}

export function dedupe(events) {
  const groups = new Map();
  for (const ev of events) {
    const key = `${slug(ev.city || ev.postcode || '')}|${ev.start}`;
    const list = groups.get(key) || [];
    const twin = list.find((x) => similar(x, ev));
    if (twin) merge(twin, ev);
    else list.push(ev);
    groups.set(key, list);
  }
  const out = [...groups.values()].flat();
  for (const ev of out) ev.id = slug(`${ev.start}-${ev.city || ev.postcode}-${ev.title}`).slice(0, 90);
  return out;
}
