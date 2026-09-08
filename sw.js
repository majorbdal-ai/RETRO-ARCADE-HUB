/* RETRO ARCADE HUB — Service Worker for offline PWA support.
   Caches the app shell + game engines so the hub works offline. */
const CACHE = 'retro-arcade-hub-v6.0.0';
const CORE = [
  './',
  './index.html',
  './app.js',
  './version.json',
  './manifest.webmanifest',
  './games/core.js',
  './games/controls.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // only handle same-origin GET (game engine files)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // network-first for game engines, cache fallback
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((m) => m || caches.match('./index.html')))
  );
});