/* RETRO ARCADE HUB — Service Worker for offline PWA support.
   v6.7: cache-first for app shell, pre-cache ALL 66 game engines at install
   (whole arcade playable offline), stale-while-revalidate for engines,
   navigation fallback to index.html, versioned cache with cleanup. */
const CACHE = 'retro-arcade-hub-v7.8.0';
const STATIC_CORE = [
  './',
  './index.html',
  './app.js',
  './version.json',
  './manifest.webmanifest',
  './assets/logos.js',
  './games/core.js',
  './games/controls.js'
];
// Pre-cache ALL game engines so the entire arcade is playable offline.
const ENGINE_PRELOAD = [
  './games/air_strike.js',
  './games/archery_master.js',
  './games/athletics_sprint.js',
  './games/bowling_strike.js',
  './games/brick_breaker.js',
  './games/bubble_shooter.js',
  './games/candy_crush.js',
  './games/carrom_pool.js',
  './games/checkers.js',
  './games/color_switch.js',
  './games/connect_four.js',
  './games/cosmic_dash.js',
  './games/cricket_sixer.js',
  './games/crossy_neon.js',
  './games/cyber_shooter.js',
  './games/dino_run.js',
  './games/duck_hunt.js',
  './games/flappy_neon.js',
  './games/flow_free.js',
  './games/fruit_merge.js',
  './games/fruit_slash.js',
  './games/game2048.js',
  './games/helix_drop.js',
  './games/hill_climb.js',
  './games/hoop_dunk.js',
  './games/ladder_climb.js',
  './games/lazer_maze.js',
  './games/light_cycle.js',
  './games/lucky_spin.js',
  './games/ludo_king.js',
  './games/mastermind.js',
  './games/math_dash.js',
  './games/bounce.js',
  './games/space_impact.js',
  './games/bantumi.js',
  './games/reversi.js',
  './games/memory_match.js',
  './games/mine_sweeper.js',
  './games/neon_dash.js',
  './games/neon_jumper.js',
  './games/neon_racer.js',
  './games/neon_slam.js',
  './games/neon_snake.js',
  './games/neon_tower.js',
  './games/nonogram.js',
  './games/pac_runner.js',
  './games/piano_tiles.js',
  './games/pin_ball.js',
  './games/pixel_dungeon.js',
  './games/pong.js',
  './games/simon_says.js',
  './games/slide_puzzle.js',
  './games/sling_birds.js',
  './games/snake_classic.js',
  './games/soccer_penalty.js',
  './games/space_invaders.js',
  './games/space_miner.js',
  './games/stack_drop.js',
  './games/sudoku.js',
  './games/table_tennis.js',
  './games/tank_battle.js',
  './games/temple_run.js',
  './games/tetris_blitz.js',
  './games/tic_tac_toe.js',
  './games/time_rush.js',
  './games/traffic_racer.js',
  './games/trash_sorter.js',
  './games/triple_sort.js',
  './games/water_sort.js',
  './games/word_search.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(STATIC_CORE))
      .then(() => caches.open(CACHE + '-engines').then((c) => c.addAll(ENGINE_PRELOAD)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE && k !== CACHE + '-engines').map((k) => caches.delete(k)))
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

  // App shell → cache-first (offline-first)
  if (url.pathname.endsWith('/') || url.pathname.endsWith('index.html')) {
    e.respondWith(
      caches.match(e.request).then((m) => m || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      }))
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