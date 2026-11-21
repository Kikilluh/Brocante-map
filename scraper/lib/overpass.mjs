// Requête à l'API Overpass (OpenStreetMap) avec serveurs de secours : si le serveur principal est
// injoignable, saturé (429) ou en erreur (5xx), on essaie le suivant.
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const UA = 'BrocanteMapBot/1.0 (+https://github.com/kikilluh/brocante-map)';

// Serveurs en échec répété pendant cette collecte : ignorés ensuite (évite d'attendre leurs délais à chaque requête)
const strikes = new Map();
const MAX_STRIKES = 2;

/**
 * Exécute la requête Overpass QL et renvoie le JSON ; lève une erreur si tous les serveurs échouent.
 * timeoutMs = délai pour le premier serveur ; le temps total de la requête est plafonné à 1,5 fois ce délai.
 */
export async function overpass(query, timeoutMs = 180000) {
  const errors = [];
  const deadline = Date.now() + timeoutMs * 1.5;
  const servers = ENDPOINTS.filter((u) => (strikes.get(u) ?? 0) < MAX_STRIKES);
  for (const url of servers.length ? servers : ENDPOINTS) {
    const left = deadline - Date.now();
    if (left < 15000) { errors.push('temps écoulé'); break; }
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: new URLSearchParams({ data: query }),
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(Math.min(timeoutMs, left)),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.remark && /runtime error|timed out|out of memory/i.test(data.remark) && !(data.elements?.length)) throw new Error(data.remark.slice(0, 120));
      strikes.set(url, 0);
      return data;
    } catch (e) {
      strikes.set(url, (strikes.get(url) ?? 0) + 1);
      errors.push(`${new URL(url).host} : ${e.message}`);
    }
  }
  throw new Error(errors.join(' ; '));
}

/**
 * Zone Overpass d'un département. Particularité : le Rhône est découpé dans OpenStreetMap en
 * « Rhône » (69D) et « Métropole de Lyon » (69M) ; on prend les deux.
 */
export function deptArea(dept) {
  // Paris : code « 75C » (Ville de Paris) dans OpenStreetMap selon les périodes ; on accepte les deux
  const ref = dept === '69' ? '["ref:INSEE"~"^69[DM]?$"]' : dept === '75' ? '["ref:INSEE"~"^75C?$"]' : `["ref:INSEE"="${dept}"]`;
  return `area${ref}["admin_level"="6"]->.d;`;
}
