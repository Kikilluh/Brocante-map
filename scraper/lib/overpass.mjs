// Requête à l'API Overpass (OpenStreetMap) avec serveurs de secours : si le serveur principal est
// injoignable, saturé (429) ou en erreur (5xx), on essaie le suivant.
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const UA = 'BrocanteMapBot/1.0 (+https://github.com/kikilluh/brocante-map)';

/** Exécute la requête Overpass QL et renvoie le JSON ; lève une erreur si tous les serveurs échouent. */
export async function overpass(query, timeoutMs = 180000) {
  const errors = [];
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: new URLSearchParams({ data: query }),
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.remark && /runtime error|timed out|out of memory/i.test(data.remark) && !(data.elements?.length)) throw new Error(data.remark.slice(0, 120));
      return data;
    } catch (e) {
      errors.push(`${new URL(url).host} : ${e.message}`);
    }
  }
  throw new Error(errors.join(' ; '));
}
