// Extraction des événements décrits en schema.org (JSON-LD et microdonnées).
// La plupart des sites d'annonces de brocantes publient ces balises pour Google,
// ce qui donne un extracteur générique bien plus robuste qu'un parseur HTML par site.

import { cleanText, decodeEntities } from './normalize.mjs';

const EVENT_TYPES = /Event$|^Festival$|^SaleEvent$/;

function typesOf(node) {
  const t = node?.['@type'];
  return (Array.isArray(t) ? t : [t]).filter(Boolean).map(String);
}

function walk(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach((n) => walk(n, out));
  if (typesOf(node).some((t) => EVENT_TYPES.test(t))) out.push(node);
  for (const key of ['@graph', 'itemListElement', 'item', 'subEvent', 'mainEntity']) {
    if (node[key]) walk(node[key], out);
  }
}

export function extractJsonLdEvents(html) {
  const out = [];
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const txt = m[1].trim().replace(/^<!--|-->$/g, '');
    try {
      walk(JSON.parse(txt), out);
    } catch {
      try {
        walk(JSON.parse(decodeEntities(txt)), out);
      } catch {
        /* JSON invalide : ignoré */
      }
    }
  }
  return out;
}

/** Microdonnées minimales : itemtype=".../Event" avec itemprop name/startDate/... */
export function extractMicrodataEvents(html) {
  const out = [];
  const re = /<([a-z]+)[^>]*itemtype\s*=\s*["']https?:\/\/schema\.org\/(\w*Event)["'][^>]*>/gi;
  const starts = [];
  let m;
  while ((m = re.exec(html))) starts.push(m.index);
  starts.forEach((pos, i) => {
    const chunk = html.slice(pos, starts[i + 1] ?? pos + 20000);
    const prop = (name) => {
      const r = new RegExp(`itemprop\\s*=\\s*["']${name}["'][^>]*?(?:content|datetime)\\s*=\\s*["']([^"']+)["']|itemprop\\s*=\\s*["']${name}["'][^>]*>([\\s\\S]*?)<`, 'i');
      const mm = chunk.match(r);
      return mm ? cleanText(mm[1] ?? mm[2]) : null;
    };
    const node = {
      '@type': 'Event',
      name: prop('name'),
      startDate: prop('startDate'),
      endDate: prop('endDate'),
      url: prop('url'),
      location: {
        name: prop('location') ,
        address: {
          streetAddress: prop('streetAddress'),
          postalCode: prop('postalCode'),
          addressLocality: prop('addressLocality'),
        },
        geo: { latitude: prop('latitude'), longitude: prop('longitude') },
      },
    };
    if (node.name && node.startDate) out.push(node);
  });
  return out;
}

function first(v) {
  return Array.isArray(v) ? v[0] : v;
}

/** Convertit un noeud schema.org Event en objet "brut" attendu par makeEvent. */
export function schemaEventToRaw(ev, pageUrl) {
  const loc = first(ev.location) || {};
  let addr = first(loc.address) || {};
  if (typeof addr === 'string') addr = { streetAddress: addr };
  const geo = first(loc.geo) || {};
  const url = first(ev.url) || first(ev['@id']) || pageUrl;
  return {
    title: ev.name,
    start: ev.startDate,
    end: ev.endDate,
    description: ev.description,
    url: typeof url === 'string' && /^https?:/.test(url) ? url : pageUrl,
    address: [loc.name, addr.streetAddress].filter(Boolean).join(', ') || null,
    postcode: addr.postalCode,
    city: addr.addressLocality,
    lat: geo.latitude,
    lon: geo.longitude,
  };
}

export function extractEvents(html, pageUrl) {
  const nodes = extractJsonLdEvents(html);
  if (!nodes.length) nodes.push(...extractMicrodataEvents(html));
  return nodes.map((n) => schemaEventToRaw(n, pageUrl));
}

export function extractLinks(html, baseUrl, pattern) {
  const re = new RegExp(pattern);
  const links = new Set();
  const hrefRe = /href\s*=\s*["']([^"'#]+)["']/gi;
  let m;
  while ((m = hrefRe.exec(html))) {
    try {
      const u = new URL(decodeEntities(m[1]), baseUrl).href;
      if (re.test(u)) links.add(u);
    } catch {
      /* URL invalide */
    }
  }
  return [...links];
}
