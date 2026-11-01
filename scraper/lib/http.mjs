// Client HTTP poli : délai entre requêtes, User-Agent identifiable, respect basique de robots.txt.

const robotsCache = new Map();
let lastRequest = 0;
let settings = { delayMs: 1500, userAgent: 'BrocanteMapBot/1.0' };

export function configureHttp(opts) {
  settings = { ...settings, ...opts };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function throttle(delayMs = settings.delayMs) {
  const wait = lastRequest + delayMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();
}

async function robotsAllows(url) {
  const { origin, pathname } = new URL(url);
  if (!robotsCache.has(origin)) {
    let rules = [];
    try {
      const res = await fetch(`${origin}/robots.txt`, { headers: { 'User-Agent': settings.userAgent } });
      if (res.ok) {
        let applies = false;
        for (const line of (await res.text()).split('\n')) {
          const [k, ...rest] = line.split(':');
          const v = rest.join(':').trim();
          const key = k.trim().toLowerCase();
          if (key === 'user-agent') applies = v === '*' || /brocantemap/i.test(v);
          else if (applies && key === 'disallow' && v) rules.push(v);
        }
      }
    } catch {
      rules = [];
    }
    robotsCache.set(origin, rules);
  }
  return !robotsCache.get(origin).some((rule) => pathname.startsWith(rule.replace(/\*.*$/, '')));
}

export async function fetchText(url, { json = false, headers = {}, checkRobots = true, delayMs } = {}) {
  if (checkRobots && !(await robotsAllows(url))) throw new Error(`robots.txt interdit ${url}`);
  await throttle(delayMs);
  const res = await fetch(url, {
    headers: { 'User-Agent': settings.userAgent, 'Accept-Language': 'fr-FR,fr;q=0.9', ...headers },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} sur ${url.replace(/(api_key|key)=[^&]+/g, '$1=…')} ${body.slice(0, 300)}`);
  }
  return json ? res.json() : res.text();
}
