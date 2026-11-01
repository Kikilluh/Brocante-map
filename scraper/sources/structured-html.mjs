// Source générique : pages HTML d'annonces exposant leurs événements en schema.org.
// Parcourt les pages de liste d'un département, puis (optionnel) les fiches détail.

import { fetchText } from '../lib/http.mjs';
import { extractEvents, extractLinks } from '../lib/jsonld.mjs';

export async function run(source, { departments, log }) {
  const raws = [];
  let failures = 0;
  for (const dept of departments) {
    const detailLinks = new Set();
    for (const tpl of source.listUrls) {
      let lastSignature = '';
      for (let page = 1; page <= (source.maxPages ?? 1); page++) {
        const url = tpl.replaceAll('{dept}', dept).replaceAll('{page}', String(page));
        let html;
        try {
          html = await fetchText(url);
        } catch (e) {
          log(`  ${url} → ${e.message}`);
          failures++;
          break;
        }
        const found = extractEvents(html, url);
        const links = source.followLinksPattern ? extractLinks(html, url, source.followLinksPattern) : [];
        const signature = JSON.stringify([found.map((f) => f.url), links]);
        if (signature === lastSignature) break; // page identique à la précédente = fin de pagination
        lastSignature = signature;
        raws.push(...found);
        links.forEach((l) => detailLinks.add(l));
        log(`  ${url} → ${found.length} événements, ${links.length} liens`);
        if (!found.length && !links.length) break;
        if (!tpl.includes('{page}')) break;
      }
    }
    // Les fiches détail contiennent souvent l'adresse et les coordonnées exactes.
    const known = new Set(raws.filter((r) => r.postcode && r.lat != null).map((r) => r.url));
    for (const link of detailLinks) {
      if (known.has(link)) continue;
      try {
        const html = await fetchText(link);
        raws.push(...extractEvents(html, link));
      } catch (e) {
        log(`  ${link} → ${e.message}`);
        failures++;
      }
    }
  }
  if (!raws.length && failures) throw new Error(`${failures} requête(s) en échec, aucun événement`);
  return raws;
}
