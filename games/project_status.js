/* ============================================================
   RETRO ARCADE HUB — PROJECT KNOWLEDGE BASE
   Auto-generated status tracker for the Q&A assistant.
   Updated whenever game files are added/verified.
   ============================================================ */

const PROJECT_STATUS = {
  name: 'RETRO ARCADE HUB',
  desc: 'Neon arcade mobile PWA website — 20 games, 7 pages, Supabase backend (pending keys), InfinityFree PHP API ready',
  spec: 'BIMAN DIGITAL NEON ARCADE BLITZ spec (20 games, 3 groups, shop/coin/theme/leaderboard)',
  currentPhase: 'All 20 game engines complete',
  progress: '100% game engines — live',
  pages: {
    home: '20-game grid + featured 4 + search',
    arcade: '20-game grid',
    game: 'Canvas + HUD + per-game custom controls',
    shop: '4 tabs (skins/themes/boosters/avatar frames)',
    board: 'Leaderboard weekly/all-time/per-game',
    profile: 'Stats WINS/COINS/SKINS/Achievements',
    store: 'Coin store (500/1200/2500/5000 packs)',
    themes: '3 theme preview'
  },
  games: {
    'neon-racer':     { file: 'games/neon_racer.js',     status: 'DONE', controls: 'STEER L/R + BOOST' },
    'cyber-shooter':  { file: 'games/cyber_shooter.js',  status: 'DONE', controls: 'JOYSTICK + AUTO FIRE' },
    'neon-snake':     { file: 'games/neon_snake.js',     status: 'DONE', controls: 'SWIPE' },
    'pixel-dungeon':  { file: 'games/pixel_dungeon.js',  status: 'DONE', controls: 'JOYSTICK + ATTACK' },
    'light-cycle':    { file: 'games/light_cycle.js',    status: 'DONE', controls: 'SWIPE TURN' },
    'brick-breaker':  { file: 'games/brick_breaker.js',  status: 'DONE', controls: 'DRAG + SERVE' },
    'tetris-blitz':   { file: 'games/tetris_blitz.js',   status: 'DONE', controls: 'JOYSTICK + ROTATE' },
    'flappy-neon':    { file: 'games/flappy_neon.js',    status: 'DONE', controls: 'TAP' },
    'space-invaders': { file: 'games/space_invaders.js', status: 'DONE', controls: 'JOYSTICK + AUTO' },
    'water-sort':     { file: 'games/water_sort.js',     status: 'DONE', controls: 'TAP POUR' },
    'triple-sort':    { file: 'games/triple_sort.js',    status: 'DONE', controls: 'TAP MOVE' },
    'fruit-slash':    { file: 'games/fruit_slash.js',    status: 'DONE', controls: 'SWIPE SLASH' },
    '2048':           { file: 'games/game2048.js',       status: 'DONE', controls: 'SWIPE MERGE' },
    'hill-climb':     { file: 'games/hill_climb.js',     status: 'DONE', controls: 'GAS + BRAKE' },
    'candy-crush':    { file: 'games/candy_crush.js',    status: 'DONE', controls: 'SWAP' },
    'pac-runner':     { file: 'games/pac_runner.js',     status: 'DONE', controls: 'SWIPE TURN' },
    'ludo-king':      { file: 'games/ludo_king.js',      status: 'DONE', controls: 'TAP ROLL' },
    'carrom-pool':    { file: 'games/carrom_pool.js',    status: 'DONE', controls: 'DRAG SHOOT' },
    'temple-run':     { file: 'games/temple_run.js',     status: 'DONE', controls: 'SWIPE' },
    'snake-classic':  { file: 'games/snake_classic.js',  status: 'DONE', controls: 'SWIPE/ARROWS' }
  },
  completed: 20,
  total: 20,
  infra: {
    api: 'InfinityFree PHP backend ready (api/index.php) — local tested 6/6',
    db: 'MariaDB local test passed; Supabase tables pending keys',
    deploy: 'GitHub Pages auto-deploy (pages.yml)',
    auth: 'Username+password auth (API), localStorage guest fallback'
  }
};