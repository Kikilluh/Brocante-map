// OpenAgenda : beaucoup de mairies et offices de tourisme y publient leurs événements.
// Nécessite une clé API (secret OPENAGENDA_KEY) et la liste des agendas dans config.json.

import { fetchText } from '../lib/http.mjs';
import { isRelevant } from '../lib/normalize.mjs';

const tr = (v) => (v && typeof v === 'object' ? v.fr ?? Object.values(v)[0] : v);

export async function run(source, { log }) {
  const key = process.env.OPENAGENDA_KEY;
  if (!key || !source.agendas?.length) {
    log('  OPENAGENDA_KEY ou agendas absents : source ignorée');
    return [];
  }
  const raws = [];
  for (const uid of source.agendas) {
    let after = null;
    for (let i = 0; i < 20; i++) {
      const url = new URL(`https://api.openagenda.com/v2/agendas/${uid}/events`);
      url.searchParams.set('key', key);
      url.searchParams.set('size', '100');
      url.searchParams.set('relative[]', 'upcoming');
      url.searchParams.set('detailed', '1');
      if (source.search) url.searchParams.set('search', source.search);
      if (after) after.forEach((a) => url.searchParams.append('after[]', a));
      const data = await fetchText(url.href, { json: true, checkRobots: false });
      for (const ev of data.events ?? []) {
        const title = tr(ev.title);
        const desc = tr(ev.description) ?? '';
        if (!isRelevant(`${title} ${desc} ${(ev.keywords?.fr ?? []).join(' ')}`)) continue;
        const loc = ev.location ?? {};
        for (const t of ev.timings ?? [{ begin: ev.firstTiming?.begin, end: ev.lastTiming?.end }]) {
          raws.push({
            title,
            description: desc,
            start: t.begin,
            end: t.end,
            address: loc.address,
            postcode: loc.postalCode,
            city: loc.city,
            lat: loc.latitude,
            lon: loc.longitude,
            url: `https://openagenda.com/agendas/${uid}/events/${ev.slug ?? ev.uid}`,
          });
        }
      }
      if (!data.after || !(data.events ?? []).length) break;
      after = data.after;
    }
    log(`  agenda ${uid} → ${raws.length} événements cumulés`);
  }
  return raws;
}
