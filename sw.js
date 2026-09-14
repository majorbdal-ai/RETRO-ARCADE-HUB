/* RETRO ARCADE HUB — Service Worker for offline PWA support.
   v7.12.0: global game FX (screen shake, particles, death flash, combo glow)
   pre-cache ALL 70 game engines at install
   (whole arcade playable offline), stale-while-revalidate for engines,
   navigation fallback to index.html, versioned cache with cleanup. */
const CACHE = 'retro-arcade-hub-v7.47.6';
const STATIC_CORE = [
  './',
  './index.html',
  './app.js',
  './version.json',
  './manifest.webmanifest',
  './assets/logos.js',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-512-maskable.png',
  './assets/og-cover.png',
  './assets/favicon-32.png',
  './assets/favicon-16.png',
  './games/core.js',
  './games/controls.js',
  './2048/index.html',
  './2048/style/main.css',
  './2048/style/fonts/clear-sans.css',
  './2048/style/fonts/ClearSans-Bold-webfont.svg',
  './2048/style/fonts/ClearSans-Bold-webfont.woff',
  './2048/style/fonts/ClearSans-Light-webfont.svg',
  './2048/style/fonts/ClearSans-Light-webfont.woff',
  './2048/style/fonts/ClearSans-Regular-webfont.svg',
  './2048/style/fonts/ClearSans-Regular-webfont.woff',
  './2048/js/bind_polyfill.js',
  './2048/js/classlist_polyfill.js',
  './2048/js/animframe_polyfill.js',
  './2048/js/keyboard_input_manager.js',
  './2048/js/html_actuator.js',
  './2048/js/grid.js',
  './2048/js/tile.js',
  './2048/js/local_storage_manager.js',
  './2048/js/game_manager.js',
  './2048/js/application.js',
  './robots.txt',
  './sitemap.xml'
];
// B5 FIX [099-102]: add font/icon CDN to cache for offline use
const CDN_FONTS = [
  'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Orbitron:wght@700;900&family=Space+Grotesk:wght@400;500;700&family=Lato:wght@400;700;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];
// Pre-cache ALL game engines so the entire arcade is playable offline.
const ENGINE_PRELOAD = [
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(STATIC_CORE))
      // B5 FIX [105]: cache engines individually — one 404 won't kill entire install
      .then(() => caches.open(CACHE + '-engines').then(async (c) => {
        for (const url of ENGINE_PRELOAD) {
          try { await c.add(url); } catch (e) { /* skip missing engine */ }
        }
      }))
      // B5 FIX [099-102]: cache font CDN for offline
      .then(() => caches.open(CACHE + '-fonts').then(async (c) => {
        for (const url of CDN_FONTS) {
          try { await c.add(url); } catch (e) { /* skip if offline */ }
        }
      }))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE && k !== CACHE + '-engines' && k !== CACHE + '-fonts').map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // Navigation requests → network-first, fall back to cached shell (deep offline)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request).then((m) => m || caches.match('./index.html')))
    );
    return;
  }

  // App shell → network-first (so updates propagate instantly), fallback cached
  if (url.pathname.endsWith('/') || url.pathname.endsWith('index.html')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request).then((m) => m || caches.match('./index.html')))
    );
    return;
  }

  // Game engines → stale-while-revalidate (instant offline, updates in background)
  if (url.pathname.includes('/games/')) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        const network = fetch(e.request).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE + '-engines').then((c) => c.put(e.request, copy));
          }
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Everything else → network-first, cache fallback
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