// Service worker : l'application s'ouvre même sans réseau (dernières données connues).
const VERSION = 'v27';
const SHELL = [
  './', 'index.html', 'app.js', 'style.css', 'manifest.webmanifest', 'mentions-legales.html',
  'icons/icon.svg', 'icons/icon-192.png',
  'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css',
  'vendor/markercluster/leaflet.markercluster.js', 'vendor/markercluster/MarkerCluster.css', 'vendor/markercluster/MarkerCluster.Default.css',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // tuiles, géocodage : réseau direct
  if (url.pathname.startsWith('/__/')) return; // URL réservées de Firebase (configuration, connexion)
  // Réseau d'abord (données et pages toujours à jour), cache en secours hors connexion
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r ?? caches.match('index.html'))),
  );
});
