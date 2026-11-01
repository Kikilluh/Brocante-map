// DATAtourisme : plateforme nationale de données touristiques ouvertes (offices de tourisme).
// Flux à créer sur https://diffuseur.datatourisme.fr (format JSON-LD, sans compression),
// filtré sur les manifestations commerciales "Brocante / Vide-grenier". URL → secret DATATOURISME_FEED_URL.

import { fetchText } from '../lib/http.mjs';
import { isRelevant } from '../lib/normalize.mjs';

const fr = (v) => {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return fr(v[0]);
  return v.fr?.[0] ?? v['@value'] ?? Object.values(v)[0]?.[0] ?? null;
};
const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

export async function run(_source, { log }) {
  const feed = process.env.DATATOURISME_FEED_URL;
  if (!feed) {
    log('  DATATOURISME_FEED_URL absent : source ignorée');
    return [];
  }
  const data = await fetchText(feed, { json: true, checkRobots: false });
  const nodes = arr(data['@graph'] ?? data);
  const raws = [];
  for (const n of nodes) {
    const title = fr(n['rdfs:label'] ?? n.label);
    const types = arr(n['@type']).join(' ');
    const desc = fr(n['rdfs:comment'] ?? n.comment);
    if (!title || !(isRelevant(`${title} ${types} ${desc ?? ''}`) || /SaleEvent|Brocante/i.test(types))) continue;
    const loc = arr(n.isLocatedAt)[0] ?? {};
    const addr = arr(loc['schema:address'] ?? loc.address)[0] ?? {};
    const geo = arr(loc['schema:geo'] ?? loc.geo)[0] ?? {};
    const city = arr(addr.hasAddressCity)[0];
    const periods = arr(n.takesPlaceAt);
    const contact = arr(n.hasContact)[0] ?? {};
    const url = arr(contact['foaf:homepage'] ?? contact.homepage)[0] ?? null;
    for (const p of periods.length ? periods : [{}]) {
      raws.push({
        title,
        description: desc,
        start: p.startDate ?? n['schema:startDate'],
        end: p.endDate ?? n['schema:endDate'],
        hours: p.startTime ? `${p.startTime.slice(0, 5)}${p.endTime ? '–' + p.endTime.slice(0, 5) : ''}` : null,
        address: arr(addr['schema:streetAddress'] ?? addr.streetAddress).join(', ') || null,
        postcode: addr['schema:postalCode'] ?? addr.postalCode,
        city: fr(city?.['rdfs:label']) ?? addr['schema:addressLocality'],
        lat: geo['schema:latitude'] ?? geo.latitude,
        lon: geo['schema:longitude'] ?? geo.longitude,
        url,
      });
    }
  }
  return raws;
}
