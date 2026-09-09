/* ============================================================
   RETRO ARCADE HUB — 15+ LEGENDS. 1 ARENA. WHO IS THE KING?
   Website (browser) build — localStorage data layer (Supabase-ready later)
   ============================================================ */
'use strict';

/* ==================== API LAYER (InfinityFree PHP backend) ==================== */
const API_BASE = 'api/index.php'; // সাইটের api/ ফোল্ডারে — পাবলিক

/* ==================== STORAGE ==================== */
const K = {
  profile: 'rah_profile',
  coins: 'rah_coins',
  scores: 'rah_scores',
  inventory: 'rah_inventory',
  equipped: 'rah_equipped',
  daily: 'rah_daily',
  theme: 'rah_theme',
  stats: 'rah_stats',
  best: 'rah_best',
  achievements: 'rah_achievements',
  dailyQuest: 'rah_dailyQuest',
  lastPlay: 'rah_lastPlay',
  streak: 'rah_streak'
};
const store = {
  get(key, def) { try { const v = localStorage.getItem(key); return v === null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
};

/* ==================== STATE ==================== */
let state = {
  coins: store.get(K.coins, 0),
  profile: store.get(K.profile, { username: 'BIMAN_USER_92', level: 1, wins: 0, avatar: '👤', xp: 0 }),
  scores: store.get(K.scores, {}),
  inventory: store.get(K.inventory, []),
  equipped: store.get(K.equipped, { skin: null, vehicle: null, effect: null, theme: 'neon' }),
  daily: store.get(K.daily, {}),
  stats: store.get(K.stats, { gamesPlayed: 0, totalScore: 0, bestCombo: 0 }),
  best: store.get(K.best, {}),
  achievements: store.get(K.achievements, []),
  dailyQuest: store.get(K.dailyQuest, {}),
  lastPlay: store.get(K.lastPlay, 0),
  streak: store.get(K.streak, 0),
  favorites: store.get('rh_favorites', []),
  recentlyPlayed: store.get('rh_recently', [])
};

function saveState() {
  store.set(K.coins, state.coins);
  store.set(K.profile, state.profile);
  store.set(K.scores, state.scores);
  store.set(K.inventory, state.inventory);
  store.set(K.equipped, state.equipped);
  store.set(K.daily, state.daily);
  store.set(K.stats, state.stats);
  store.set(K.best, state.best);
  store.set(K.achievements, state.achievements);
  store.set(K.dailyQuest, state.dailyQuest);
  store.set(K.lastPlay, state.lastPlay);
  store.set(K.streak, state.streak);
  store.set('rh_favorites', state.favorites);
  store.set('rh_recently', state.recentlyPlayed);
}

/* ==================== API LAYER (InfinityFree PHP backend) ==================== */
const auth = {
  token: store.get('rah_auth_token', null),
  user: store.get('rah_auth_user', null)
};
async function api(action, data = {}) {
  try {
    const body = new URLSearchParams({ action, ...data });
    const res = await fetch(API_BASE + '?action=' + action, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body
    });
    return await res.json();
  } catch (e) { return { ok: false, error: 'net' }; }
}
function setAuthUser(u) { auth.user = u; store.set('rah_auth_user', u); }
let authMode = 'login';
function openAuthModal(mode = 'login') {
  authMode = mode;
  document.getElementById('authTitle').innerText = mode === 'login' ? '🎮 LOGIN' : '🆕 SIGN UP';
  document.getElementById('authBtn').innerText = mode === 'login' ? 'LOGIN' : 'SIGN UP';
  document.getElementById('authToggle').innerText = mode === 'login' ? 'SIGN UP' : 'LOGIN';
  document.getElementById('authMsg').innerText = '';
  document.getElementById('authModal').classList.add('show');
}
function closeAuthModal() { document.getElementById('authModal').classList.remove('show'); }
function toggleAuthMode() { openAuthModal(authMode === 'login' ? 'signup' : 'login'); }
async function authSubmit() {
  const u = document.getElementById('authUser').value.trim();
  const p = document.getElementById('authPass').value;
  const msg = document.getElementById('authMsg');
  if (u.length < 3) { msg.innerText = '⚠ Username at least 3 characters'; return; }
  if (p.length < 4) { msg.innerText = '⚠ Password at least 4 characters'; return; }
  msg.innerText = '⏳ Please wait...';
  const r = await api(authMode, { username: u, password: p });
  if (r.ok) {
    setAuthUser(r.username || u);
    state.profile.username = r.username || u;
    saveState();
    msg.style.color = 'var(--green)'; msg.innerText = '✅ Welcome, ' + (r.username || u) + '!';
    setTimeout(() => { closeAuthModal(); renderProfile(); refreshLeaderboard(); }, 900);
  } else if (r.error === 'taken') { msg.style.color = 'var(--red)'; msg.innerText = '❌ Username already taken — try another'; }
  else if (r.error === 'wrong') { msg.style.color = 'var(--red)'; msg.innerText = '❌ Wrong username or password'; }
  else { msg.style.color = 'var(--red)'; msg.innerText = '⚠ Server offline — playing locally (guest mode)'; closeAuthModal(); }
}
async function refreshLeaderboard() {
  const r = await api('leaderboard');
  if (!r.ok || !r.rows) return;
  const me = auth.user || state.profile.username;
  const list = document.getElementById('boardList');
  if (list) list.innerHTML = r.rows.slice(0, 12).map((b, i) => `
    <div class="card rank-row ${b.username === me ? 'me' : ''}" style="margin-bottom:8px">
      <div class="rank-no">${i < 3 ? '<span class="crown">👑</span>' : '#' + (i + 1)}</div>
      <div class="rank-avatar">${(b.username[0] || '?').toUpperCase()}</div>
      <div class="rank-name">${b.username}${b.username === me ? ' <span style="color:var(--cyan);font-size:10px">(YOU)</span>' : ''}</div>
      <div class="rank-score">${Number(b.score).toLocaleString()}</div>
    </div>`).join('');
}
async function syncScore(gameId, score) {
  if (!auth.user) return;
  try { await api('save_score', { username: auth.user, game: gameId, score }); refreshLeaderboard(); } catch (e) {}
}

/* ==================== 20 GAMES ==================== */
const GAMES = [
  { id: 'neon-racer',    name: 'NEON RACER',    icon: '🏎️', color: '#00FFFF', desc: 'Dodge traffic, collect coins, nitro boost', featured: true, type: 'racer', cat: 'Action', controls: 'tilt-steer' },
  { id: 'cyber-shooter',    name: 'CYBER SHOOTER',    icon: '🚀', color: '#FF10F0', desc: 'Blast alien armadas, combo kills, 3 lives', featured: true, type: 'shooter', cat: 'Action', controls: 'joystick-auto' },
  { id: 'pixel-dungeon',    name: 'PIXEL DUNGEON',    icon: '🗡️', color: '#FFE600', desc: 'Descend, dodge traps, find key, open chest', featured: true, type: 'dungeon', cat: 'Action', controls: 'joystick-btn' },
  { id: 'light-cycle',    name: 'LIGHT CYCLE',    icon: '🏍️', color: '#39FF88', desc: 'Tron-style grid duel — don\'t hit walls', featured: true, type: 'cycle', cat: 'Action', controls: 'swipe4' },
  { id: 'neon-snake',    name: 'NEON SNAKE',    icon: '🐍', color: '#22D3EE', desc: 'Glowing classic, speed up each food', featured: false, type: 'snake', cat: 'Arcade', controls: 'swipe4' },
  { id: 'brick-breaker',    name: 'BRICK BREAKER',    icon: '🧱', color: '#F59E0B', desc: 'Paddle-ball, clear all bricks, power-ups', featured: false, type: 'breaker', cat: 'Arcade', controls: 'drag-paddle' },
  { id: 'tetris-blitz',    name: 'TETRIS BLITZ',    icon: '🧩', color: '#A855F7', desc: 'Fast Tetris, line clear, hold piece', featured: false, type: 'tetris', cat: 'Puzzle', controls: 'swipe-move-tap-rotate' },
  { id: 'flappy-neon',    name: 'FLAPPY NEON',    icon: '🐦', color: '#D946EF', desc: 'Flap through neon pipes, avoid crash', featured: false, type: 'flappy', cat: 'Arcade', controls: 'tap-flap' },
  { id: 'pac-runner',    name: 'PAC-RUNNER',    icon: '🟡', color: '#FBBF24', desc: 'Eat coins, avoid ghosts, power pellets', featured: false, type: 'pac', cat: 'Arcade', controls: 'swipe4' },
  { id: 'space-invaders',    name: 'SPACE INVADERS',    icon: '👾', color: '#F97316', desc: 'Clear alien waves, auto-shoot, shields', featured: false, type: 'invaders', cat: 'Arcade', controls: 'drag-move' },
  { id: 'tank-battle',    name: 'TANK BATTLE',    icon: '🪖', color: '#84CC16', desc: 'Dual-stick tank duel — move + turret aim', featured: true, type: 'tank', cat: 'Action', controls: 'dual-joystick' },
  { id: 'airstrike',    name: 'AIR STRIKE',    icon: '💣', color: '#EAB308', desc: 'Bomber run — hold to aim, release to drop', featured: false, type: 'bomber', cat: 'Action', controls: 'hold-aim-release' },
  { id: 'water-sort',    name: 'WATER SORT',    icon: '🧪', color: '#38BDF8', desc: 'Color match puzzle, pour bottles', featured: false, type: 'watersort', cat: 'Puzzle', controls: 'tap-to-pour' },
  { id: 'triple-sort',    name: 'TRIPLE SORT',    icon: '📦', color: '#22D3EE', desc: 'Goods puzzle, match 3 on shelf', featured: false, type: 'triplesort', cat: 'Puzzle', controls: 'tap-to-move' },
  { id: 'fruit-slash',    name: 'FRUIT SLASH',    icon: '🍎', color: '#F87171', desc: 'Fruit Ninja style, swipe to slash', featured: false, type: 'fruitslash', cat: 'Arcade', controls: 'swipe-any' },
  { id: 'fruit-merge',    name: 'FRUIT MERGE',    icon: '🍇', color: '#A3E635', desc: 'Drop fruits, merge same into bigger', featured: false, type: 'fruitmerge', cat: 'Puzzle', controls: 'drag-drop' },
  { id: 'bubble-shooter',    name: 'BUBBLE SHOOTER',    icon: '🫧', color: '#60A5FA', desc: 'Match 3 bubbles, clear the board', featured: true, type: 'bubble', cat: 'Puzzle', controls: 'drag-aim-release' },
  { id: 'piano-tiles',    name: 'PIANO TILES',    icon: '🎹', color: '#C084FC', desc: 'Tap black tiles, don\'t miss', featured: false, type: 'piano', cat: 'Arcade', controls: 'multi-tap' },
  { id: 'ludo-king',    name: 'LUDO KING',    icon: '🎲', color: '#F59E0B', desc: '2-4 player, pass & play, vs bot', featured: false, type: 'ludo', cat: 'Board', controls: 'tap-roll-tap-piece' },
  { id: 'carrom-pool',    name: 'CARROM POOL',    icon: '🎯', color: '#EAB308', desc: 'Striker drag & shoot, queen cover', featured: false, type: 'carrom', cat: 'Board', controls: 'drag-aim-release' },
  { id: '2048',    name: '2048',    icon: '🔢', color: '#84CC16', desc: 'Swipe merge, reach 2048', featured: false, type: '2048', cat: 'Arcade', controls: 'swipe4' },
  { id: 'hill-climb',    name: 'HILL CLIMB',    icon: '🚙', color: '#F97316', desc: 'Gas/brake, collect fuel, upgrade shop', featured: false, type: 'hillclimb', cat: 'Action', controls: 'hold-gas-brake' },
  { id: 'temple-run',    name: 'TEMPLE RUN',    icon: '🏃', color: '#EF4444', desc: 'Endless runner, swipe jump/slide/turn', featured: false, type: 'templerun', cat: 'Action', controls: 'swipe4' },
  { id: 'candy-crush',    name: 'CANDY CRUSH',    icon: '🍬', color: '#EC4899', desc: '3-match blast, line/color bombs', featured: false, type: 'candy', cat: 'Arcade', controls: 'drag-swap' },
  { id: 'snake-classic',    name: 'SNAKE CLASSIC',    icon: '🐍', color: '#22C55E', desc: 'Nokia 1100 style, keypad + swipe', featured: false, type: 'snakeclassic', cat: 'Arcade', controls: 'dpad+swipe' },
  { id: 'duck-hunt',    name: 'DUCK HUNT',    icon: '🦆', color: '#FBBF24', desc: 'Tap the ducks before they fly away', featured: false, type: 'duckhunt', cat: 'Arcade', controls: 'tap-target' },
  { id: 'neon-dash',    name: 'NEON DASH',    icon: '⚡', color: '#22D3EE', desc: 'Geometry-Dash style, hold to jump', featured: true, type: 'dash', cat: 'Action', controls: 'tap-hold-jump' },
  { id: 'color-switch',    name: 'COLOR SWITCH',    icon: '🎨', color: '#F472B6', desc: 'Match the ball color, one-tap switch', featured: false, type: 'colorswitch', cat: 'Arcade', controls: 'tap-switch' },
  { id: 'neon-jumper',    name: 'NEON JUMPER',    icon: '🦘', color: '#4ADE80', desc: 'Doodle-Jump style, hold L/R to bounce', featured: false, type: 'jumper', cat: 'Arcade', controls: 'hold-lr' },
  { id: 'stack-drop',    name: 'STACK DROP',    icon: '🧱', color: '#F59E0B', desc: 'Tap to drop blocks, build the tower', featured: false, type: 'stack', cat: 'Arcade', controls: 'tap-drop' },
  { id: 'helix-drop',    name: 'HELIX DROP',    icon: '🌀', color: '#38BDF8', desc: 'Swipe to rotate, hold to fall', featured: false, type: 'helix', cat: 'Arcade', controls: 'swipe-rotate-tap' },
  { id: 'traffic-racer',    name: 'TRAFFIC RACER',    icon: '🏁', color: '#F97316', desc: 'Lane-steer endless highway racer', featured: false, type: 'traffic', cat: 'Action', controls: 'tap-steer' },
  { id: 'dino-run',    name: 'DINO RUN',    icon: '🦖', color: '#A3E635', desc: 'Chrome dino — jump & duck the cacti', featured: false, type: 'dino', cat: 'Action', controls: 'tap-jump-drag-duck' },
  { id: 'sling-birds',    name: 'SLING BIRDS',    icon: '🐦', color: '#FB923C', desc: 'Angry-Birds style slingshot mayhem', featured: true, type: 'sling', cat: 'Action', controls: 'slingshot-drag' },
  { id: 'space-miner',    name: 'SPACE MINER',    icon: '⛏️', color: '#FFD700', desc: 'Mine asteroids, upgrade ship, defeat bosses', featured: true, type: 'miner', cat: 'Action', controls: 'move-mine' },
  { id: 'neon-slam',    name: 'NEON SLAM',    icon: '🏓', color: '#00FFFF', desc: 'Breakout with powerups, combos, endless levels', featured: true, type: 'slam', cat: 'Action', controls: 'drag-paddle' },
  { id: 'neon-tower',    name: 'NEON TOWER',    icon: '🏗️', color: '#7B61FF', desc: 'Stack the tower — precision timing', featured: true, type: 'tower', cat: 'Puzzle', controls: 'tap-drop' },
  { id: 'cosmic-dash',    name: 'COSMIC DASH',    icon: '🚀', color: '#00FFFF', desc: 'Gravity-flip space runner with portals', featured: true, type: 'dash', cat: 'Action', controls: 'tap-thrust' },
  { id: 'lazer-maze',    name: 'LAZER MAZE',    icon: '🔦', color: '#FF3B6B', desc: 'Rotate mirrors to guide the laser home', featured: true, type: 'lazer', cat: 'Puzzle', controls: 'tap-mirror' },
  { id: 'time-rush',    name: 'TIME RUSH',    icon: '⏪', color: '#7B61FF', desc: 'Jump, dodge, and rewind time when you crash', featured: true, type: 'rewind', cat: 'Action', controls: 'tap-jump-hold-rewind' },
  { id: 'pong',    name: 'NEON PONG',    icon: '🏓', color: '#00FFFF', desc: 'Classic pong vs AI — drag paddle', featured: false, type: 'pong', cat: 'Sports', controls: 'drag-paddle' },
  { id: 'table-tennis',    name: 'TABLE TENNIS',    icon: '🏓', color: '#FF10F0', desc: 'Drag paddle rally, timing smashes', featured: false, type: 'pingpong', cat: 'Sports', controls: 'drag-paddle' },
  { id: 'bowling-strike',    name: 'BOWLING STRIKE',    icon: '🎳', color: '#60A5FA', desc: 'Swipe to bowl — power & curve', featured: false, type: 'bowling', cat: 'Sports', controls: 'swipe-bowl' },
  { id: 'cricket-sixer',    name: 'CRICKET SIXER',    icon: '🏏', color: '#FBBF24', desc: 'Timing tap — smash every ball for six', featured: true, type: 'cricket', cat: 'Sports', controls: 'timing-tap' },
  { id: 'hoop-dunk',    name: 'HOOP DUNK',    icon: '🏀', color: '#FB923C', desc: 'Drag-aim the basketball into the hoop', featured: false, type: 'basket', cat: 'Sports', controls: 'drag-aim-release' },
  { id: 'archery-master',    name: 'ARCHERY MASTER',    icon: '🏹', color: '#4ADE80', desc: 'Drag-aim with wind — hit the bullseye', featured: false, type: 'archery', cat: 'Sports', controls: 'drag-aim-wind' },
  { id: 'soccer-penalty',    name: 'PENALTY KICK',    icon: '⚽', color: '#22C55E', desc: 'Drag-aim & power the penalty kick', featured: false, type: 'soccer', cat: 'Sports', controls: 'drag-aim-power' },
  { id: 'athletics-sprint',    name: 'SPRINT KING',    icon: '🏃', color: '#F59E0B', desc: 'Tap-tap-tap to sprint, time the start', featured: false, type: 'sprint', cat: 'Sports', controls: 'rapid-tap' },
  { id: 'flow-free',    name: 'FLOW FREE',    icon: '🔗', color: '#22D3EE', desc: 'Connect matching dots, fill the grid', featured: false, type: 'flow', cat: 'Puzzle', controls: 'drag-path' },
  { id: 'word-search',    name: 'WORD SEARCH',    icon: '🔤', color: '#F472B6', desc: 'Drag over letters to find words', featured: false, type: 'wordsearch', cat: 'Puzzle', controls: 'drag-path' },
  { id: 'memory-match',    name: 'MEMORY MATCH',    icon: '🃏', color: '#C084FC', desc: 'Flip cards, match pairs', featured: false, type: 'memory', cat: 'Puzzle', controls: 'tap-flip' },
  { id: 'mine-sweeper',    name: 'MINE SWEEPER',    icon: '💣', color: '#F97316', desc: 'Reveal cells, flag the mines', featured: false, type: 'minesweeper', cat: 'Puzzle', controls: 'tap+longpress' },
  { id: 'sudoku',    name: 'SUDOKU',    icon: '🧮', color: '#38BDF8', desc: 'Classic sudoku — place 1-9', featured: false, type: 'sudoku', cat: 'Puzzle', controls: 'tap-cell-number' },
  { id: 'mastermind',    name: 'MASTERMIND',    icon: '🧠', color: '#FF10F0', desc: 'Crack the color code in 10 tries', featured: false, type: 'mastermind', cat: 'Puzzle', controls: 'tap-colors' },
  { id: 'simon-says',    name: 'SIMON SAYS',    icon: '🔴', color: '#F87171', desc: 'Repeat the light sequence', featured: false, type: 'simon', cat: 'Puzzle', controls: 'tap-sequencing' },
  { id: 'tic-tac-toe',    name: 'TIC TAC TOE',    icon: '⭕', color: '#00FFFF', desc: 'Classic 3-in-a-row vs bot', featured: false, type: 'tictactoe', cat: 'Puzzle', controls: 'tap-cell' },
  { id: 'connect-four',    name: 'CONNECT FOUR',    icon: '🟡', color: '#FBBF24', desc: 'Drop discs, 4-in-a-row vs bot', featured: false, type: 'connect4', cat: 'Puzzle', controls: 'tap-column' },
  { id: 'checkers',    name: 'CHECKERS',    icon: '♟️', color: '#4ADE80', desc: 'Jump the pieces, capture all', featured: false, type: 'checkers', cat: 'Puzzle', controls: 'tap-piece-move' },
  { id: 'slide-puzzle',    name: 'SLIDE PUZZLE',    icon: '🧩', color: '#A855F7', desc: '15-puzzle — slide tiles in order', featured: false, type: 'slide', cat: 'Puzzle', controls: 'tap-adjacent' },
  { id: 'nonogram',    name: 'NONOGRAM',    icon: '🎲', color: '#60A5FA', desc: 'Picross — fill cells by the clues', featured: false, type: 'nonogram', cat: 'Puzzle', controls: 'tap-fill-longpress' },
  { id: 'lucky-spin',    name: 'LUCKY SPIN',    icon: '🎡', color: '#FF10F0', desc: 'Spin the wheel — win coins & prizes', featured: false, type: 'spin', cat: 'Casino', controls: 'tap-spin' },
  { id: 'pinball',       name: 'NEON PINBALL',   icon: '🎰', color: '#F97316', desc: 'Classic pinball — flippers, bumpers, combos', featured: false, type: 'pinball', cat: 'Retro', controls: 'flipper-dual' },
  { id: 'crossy-neon',   name: 'CROSSY NEON',    icon: '🐸', color: '#4ADE80', desc: 'Cross the road — dodge cars, logs & water', featured: false, type: 'crossy', cat: 'Retro', controls: 'swipe4' },
  { id: 'trash-sorter',  name: 'TRASH SORTER',   icon: '🗑️', color: '#38BDF8', desc: 'Sort waste into the right recycle bin', featured: false, type: 'trash', cat: 'Retro', controls: 'tap-3bin' },
  { id: 'ladder-climb',  name: 'LADDER CLIMB',   icon: '⛰️', color: '#F59E0B', desc: 'Tap to grab holds, climb the mountain', featured: false, type: 'climb', cat: 'Retro', controls: 'tap-grab' },
  { id: 'math-dash',     name: 'MATH DASH',      icon: '🧮', color: '#22D3EE', desc: 'Solve fast math under the timer', featured: false, type: 'math', cat: 'Retro', controls: 'tap-4' },
  { id: 'bounce',        name: 'BOUNCE',         icon: '🔴', color: '#FF3B3B', desc: 'Nokia classic — red ball, break all bricks', featured: true, type: 'bounce', cat: 'Retro', controls: 'dpad+swipe' },
  { id: 'space-impact',  name: 'SPACE IMPACT',   icon: '👾', color: '#00FF44', desc: 'Nokia side-scrolling shooter — waves + bosses', featured: true, type: 'impact', cat: 'Retro', controls: 'dpad+btn-fire' },
  { id: 'bantumi',       name: 'BANTUMI',        icon: '🪨', color: '#D4A574', desc: 'Nokia Mancala — sow seeds, capture stones', featured: false, type: 'bantumi', cat: 'Board', controls: 'tap-pit' },
  { id: 'reversi',       name: 'REVERSI',        icon: '⚫', color: '#4ADE80', desc: 'Nokia Othello — flip discs, outsmart AI', featured: false, type: 'reversi', cat: 'Board', controls: 'tap-cell' }
];


/* ==================== LIVE STATE (auto-rotated 4x/day by GitHub Actions) ==================== */
/* live_state.json is generated by scripts/rotate_daily.js on a cron — the app
   only READS it to rotate featured / daily deal / challenge / bot scores.
   Safe: if missing or invalid, everything falls back to static defaults. */
let LIVE = null;
function loadLive(cb) {
  if (location.protocol === 'file:') { cb && cb(); return; }
  fetch('live_state.json', { cache: 'no-store' })
    .then(r => { if (!r.ok) throw 0; return r.json(); })
    .then(d => { LIVE = d; cb && cb(); })
    .catch(() => { LIVE = null; cb && cb(); });
}
function liveFeatured() {
  if (LIVE && Array.isArray(LIVE.featured) && LIVE.featured.length) return LIVE.featured;
  return null;
}
function liveDeal() { return (LIVE && LIVE.deal && LIVE.deal.item) ? LIVE.deal : null; }
function liveChallenge() { return (LIVE && LIVE.challenge) ? LIVE.challenge : null; }
function liveBotBoost() { return (LIVE && Array.isArray(LIVE.botBoost)) ? LIVE.botBoost : null; }
function liveRot() { return (LIVE && typeof LIVE.rot === 'number') ? LIVE.rot : 0; }

/* ==================== NAVIGATION ==================== */
const PAGES = ['home', 'arcade', 'shop', 'board', 'profile', 'store', 'themes', 'game'];
function go(page) {
  // animate current page out smoothly, then switch (premium feel)
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (el) {
    el.classList.add('active');
    // replay slide-in animation for each switch
    el.style.animation = 'none';
    void el.offsetWidth; // reflow to restart CSS animation
    el.style.animation = '';
  }
  if (page === 'game') {
    document.body.classList.add('game-active');
  } else {
    document.body.classList.remove('game-active');
  }
  if (['home','arcade','shop','board','profile'].includes(page)) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  }
  if (page === 'home') renderHome();
  else if (page === 'arcade') renderArcadeGrid('');
  else if (page === 'shop') renderShop();
  else if (page === 'board') renderBoard('weekly');
  else if (page === 'profile') renderProfile();
  else if (page === 'store') renderCoinStore();
  else if (page === 'themes') renderThemes();
  updateCoinDisplay();
}
function navInit() {
  document.querySelectorAll('.nav-item').forEach(n => n.addEventListener('click', () => go(n.dataset.page)));
  document.querySelectorAll('#shopTabs .tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('#shopTabs .tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active'); renderShop(t.dataset.tab);
  }));
  document.querySelectorAll('#boardTabs .tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('#boardTabs .tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active'); renderBoard(t.dataset.range);
  }));
  
  // NEW UI: Home category tabs
  document.querySelectorAll('#homeCatTabs .cat-tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('#homeCatTabs .cat-tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active'); 
    setHomeCat(t.dataset.cat);
  }));
  
  // NEW UI: Arcade view toggle
  document.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.view-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    setArcadeView(b.dataset.view);
  }));
  
  // NEW UI: Arcade sort/filter
  const arcadeSort = document.getElementById('arcadeSort');
  if (arcadeSort) arcadeSort.addEventListener('change', () => renderArcadeGrid());
  
  // NEW UI: Shop filter/sort
  const shopFilter = document.getElementById('shopFilter');
  const shopSort = document.getElementById('shopSort');
  if (shopFilter) shopFilter.addEventListener('change', () => renderShop(currentShopTab || 'skins'));
  if (shopSort) shopSort.addEventListener('change', () => renderShop(currentShopTab || 'skins'));
}
function updateCoinDisplay() {
  const c = document.getElementById('coinDisplay');
  if (c) c.innerText = state.coins.toLocaleString();
}

/* ==================== TOAST + RIPPLE + MODAL ==================== */
let toastTimer = null;
function toast(msg) {
  const t = document.getElementById('toast');
  t.innerText = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
function ripple(e) {
  const b = e.currentTarget;
  const r = b.getBoundingClientRect();
  const d = Math.max(r.width, r.height);
  const ink = document.createElement('span');
  ink.className = 'ripple-ink';
  ink.style.width = ink.style.height = d + 'px';
  ink.style.left = (e.clientX - r.left - d / 2) + 'px';
  ink.style.top = (e.clientY - r.top - d / 2) + 'px';
  b.appendChild(ink);
  setTimeout(() => ink.remove(), 650);
  if (navigator.vibrate) { try { navigator.vibrate(50); } catch (e2) {} }
}
document.addEventListener('click', (e) => { const b = e.target.closest('.btn'); if (b) ripple(e); });
function popScore(x, y, text) {
  const el = document.createElement('div');
  el.className = 'score-pop';
  el.style.left = x + 'px'; el.style.top = y + 'px';
  el.innerText = text;
  // spring: start tiny → overshoot → settle (cubic-bezier handles it)
  el.style.transform = 'scale(.4)';
  document.body.appendChild(el);
  // force reflow to restart animation for rapid pops (multi-score combo)
  void el.offsetWidth;
  el.style.animation = 'scorePop .9s cubic-bezier(.22,1.61,.36,1) forwards';
  setTimeout(() => el.remove(), 950);
}
/* Login/Register modal (local) */
function openAuth() {
  let name = localStorage.getItem('rah_username');
  if (!name) {
    name = 'BIMAN_USER_' + Math.floor(100 + Math.random() * 899);
    localStorage.setItem('rah_username', name);
  }
  state.profile.username = name;
  saveState();
}

/* ==================== DELETE ACCOUNT ==================== */
function openDeleteModal() { document.getElementById('deleteModal').classList.add('show'); }
function closeDeleteModal() { document.getElementById('deleteModal').classList.remove('show'); }

/* ==================== PWA INSTALL + OFFLINE DETECTION ==================== */
let deferredPrompt = null;
let installShown = false;
function openInstallModal() {
  const m = document.getElementById('installModal');
  if (m) m.classList.add('show');
}
function closeInstallModal() {
  const m = document.getElementById('installModal');
  if (m) m.classList.remove('show');
}
async function installPWA() {
  const btn = document.getElementById('installBtn');
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice.catch(() => ({}));
    deferredPrompt = null;
    closeInstallModal();
    if (choice && choice.outcome === 'accepted') {
      toast('Installed! 🎮 Game on.');
    } else {
      toast('OK — play in browser anytime');
    }
  } else if (navigator.userAgent.match(/iphone|ipad|ipod/i)) {
    // iOS Safari: no beforeinstallprompt — instruct manual Add to Home Screen
    toast('Tap Share → "Add to Home Screen" ⬆️');
    closeInstallModal();
  } else {
    toast('Already installed or unsupported — just keep playing!');
    closeInstallModal();
  }
}
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Never auto-prompt inside an installed/standalone app
  const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  if (standalone || navigator.standalone === true || installShown) return;
  installShown = true;
  setTimeout(openInstallModal, 4000);
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  toast('App installed — find it on your home screen! 🎮');
});
// Offline / online awareness — hub works fully from cache
function onlineState(online) {
  const off = document.getElementById('offlineBadge');
  const on = document.getElementById('onlineBadge');
  if (online) {
    if (off && off.style.display === 'block') {
      off.style.display = 'none';
      if (on) { on.style.display = 'block'; setTimeout(() => { on.style.display = 'none'; }, 2500); }
    }
  } else {
    if (off) off.style.display = 'block';
  }
  const badge = document.getElementById('heroOfflineBadge');
  if (badge) badge.style.display = 'inline';
}
window.addEventListener('online', () => onlineState(true));
window.addEventListener('offline', () => onlineState(false));
if (navigator.onLine === false) onlineState(false); // show offline badge right away
function confirmDelete() {
  const v = document.getElementById('deleteInput').value.trim();
  if (v.toUpperCase() !== 'DELETE') { toast('Type DELETE to confirm'); return; }
  Object.values(K).forEach(k => localStorage.removeItem(k));
  state = { coins: 0, profile: { username: 'BIMAN_USER_92', level: 1, wins: 0, avatar: '👤', xp: 0 }, scores: {}, inventory: [], equipped: { skin: null, vehicle: null, effect: null, theme: 'neon' }, daily: {}, stats: { gamesPlayed: 0, totalScore: 0, bestCombo: 0 }, best: {}, favorites: [], recentlyPlayed: [] };
  closeDeleteModal();
  toast('Account deleted');
  go('home'); updateCoinDisplay();
}
/* ==================== RENDER: HOME ==================== */
function isFav(id) { return (state.favorites || []).includes(id); }
function toggleFavorite(id, e) {
  if (e) e.stopPropagation();
  state.favorites = state.favorites || [];
  const i = state.favorites.indexOf(id);
  const g = GAMES.find(x => x.id === id);
  if (i >= 0) { state.favorites.splice(i, 1); toast((g ? g.name : id) + ' removed from favourites 💔'); }
  else { state.favorites.unshift(id); toast((g ? g.name : id) + ' added to favourites ❤️'); }
  saveState();
  // refresh visible hearts + home favorites row
  document.querySelectorAll(`[data-fav="${id}"]`).forEach(el => {
    el.innerHTML = isFav(id) ? '❤️' : '🤍';
    el.classList.toggle('on', isFav(id));
  });
  const favRow = document.getElementById('favGrid');
  if (favRow) renderFavorites();
  const recRow = document.getElementById('recentGrid');
  if (recRow) renderRecent();
}
function markPlayed(id) {
  state.recentlyPlayed = state.recentlyPlayed || [];
  state.recentlyPlayed = [id, ...state.recentlyPlayed.filter(x => x !== id)].slice(0, 8);
  saveState();
}
function renderFavorites() {
  const favRow = document.getElementById('favGrid');
  if (!favRow) return;
  const favs = (state.favorites || []).map(id => GAMES.find(x => x.id === id)).filter(Boolean);
  const favCount = document.getElementById('favCount');
  if (favCount) favCount.innerText = favs.length + ' ❤';
  if (!favs.length) {
    favRow.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:16px;color:var(--sub);font-size:var(--font-xs)">No favourites yet — tap ♥ on any game card</div>`;
    return;
  }
  favRow.innerHTML = favs.map(g => `<div class="card game-card" style="cursor:pointer;position:relative;padding:10px" onclick="playGame('${g.id}')">
    <button class="fav-btn" data-fav="${g.id}" onclick="toggleFavorite('${g.id}', event)" style="position:absolute;top:5px;left:5px;z-index:5;background:rgba(0,0,0,.45);border:none;border-radius:999px;width:22px;height:22px;font-size:11px;cursor:pointer;color:var(--pink);display:flex;align-items:center;justify-content:center">❤️</button>
    <div style="height:64px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,rgba(255,255,255,.05),rgba(255,255,255,.02));overflow:hidden">${gameLogo(g.id)}</div>
    <div style="font-size:11px;font-weight:700;margin-top:6px;text-align:center;color:var(--text)">${g.name}</div>
  </div>`).join('');
}
function renderRecent() {
  const recRow = document.getElementById('recentGrid');
  if (!recRow) return;
  const recs = (state.recentlyPlayed || []).map(id => GAMES.find(x => x.id === id)).filter(Boolean);
  const recCount = document.getElementById('recentCount');
  if (recCount) recCount.innerText = recs.length + ' 🕹';
  if (!recs.length) {
    recRow.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:16px;color:var(--sub);font-size:var(--font-xs)">Play a game and it will show up here</div>`;
    return;
  }
  recRow.innerHTML = recs.map(g => `<div class="card game-card" style="cursor:pointer;position:relative;padding:10px" onclick="playGame('${g.id}')">
    <div style="height:64px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,rgba(255,255,255,.05),rgba(255,255,255,.02));overflow:hidden">${gameLogo(g.id)}</div>
    <div style="font-size:11px;font-weight:700;margin-top:6px;text-align:center;color:var(--text)">${g.name}</div>
  </div>`).join('');
}
/* ==================== RENDER: HOME ==================== */
function comingSoon(name, e) {
  if (e) e.stopPropagation();
  toast(name + ' — coming soon! Pick your favourites 👑');
}
function renderHome() {
  // live-rotated featured (fallback: static featured flags)
  let feat = [];
  const liveFeat = liveFeatured();
  if (liveFeat) {
    feat = liveFeat.map(id => GAMES.find(g => g.id === id)).filter(Boolean);
  }
  if (!feat.length) feat = GAMES.filter(g => g.featured);
  const challId = liveChallenge();
  let challHtml = '';
  if (challId) {
    const cg = GAMES.find(g => g.id === challId);
    if (cg) challHtml = `
      <div class="deal-banner" style="display:flex;align-items:center;gap:10px;justify-content:center;cursor:pointer;margin:6px 0 14px" onclick="playGame('${cg.id}')">
        <span style="font-size:18px">🏆</span>
        <span>TODAY'S CHALLENGE: <b>${cg.name}</b> — beat your best &amp; earn bonus coins!</span>
        <span style="font-size:13px">▶</span>
      </div>`;
  }
  const featGrid = document.getElementById('featuredCarousel') || document.getElementById('featuredGrid');
  if (featGrid) {
    // remove previously-inserted challenge banners (avoid duplicates on re-render)
    featGrid.parentElement.querySelectorAll('.deal-banner').forEach(b => b.remove());
    featGrid.insertAdjacentHTML('beforebegin', challHtml);
    featGrid.innerHTML = feat.map((g, i) => `
    <div class="featured-card" style="background:linear-gradient(145deg,${g.color}33,#0A0E16 65%)">
      <div class="f-ico" style="color:${g.color};width:44px;height:44px;display:flex">${gameLogo(g.id)}</div>
      <span class="badge" style="position:absolute;top:10px;right:10px">${engineReady(g.id) ? 'PLAY' : 'SOON'}</span>
      <h3>${g.name}</h3>
      <p style="font-size:10px;color:var(--sub)">${g.desc}</p>
      <button class="btn btn-primary play-btn" style="padding:7px 14px;font-size:11px" onclick="playGame('${g.id}')">${engineReady(g.id) ? '▶ PLAY NOW' : 'COMING SOON'}</button>
    </div>`).join('');
  }
  renderGameGrid('');
  renderFavorites();
  renderRecent();

    // NEW UI: Featured Carousel (horizontal scroll with featured games)
    renderFeaturedCarousel();
  }

  // NEW UI: Home Category Tabs
  let currentHomeCat = 'ALL';
  function setHomeCat(cat) {
    currentHomeCat = cat;
    document.querySelectorAll('#homeCatTabs .cat-tab').forEach(t => 
      t.classList.toggle('active', t.dataset.cat === cat));
    renderHomeGrid();
  }

  function renderHomeGrid() {
    const q = ''.toLowerCase();
    const c = currentHomeCat.toUpperCase();
    let list = GAMES;
    if (c !== 'ALL') list = list.filter(g => (g.cat || '').toUpperCase() === c);
    const html = list.map(g => {
      const ready = !!engineReady(g.id);
      const badge = ready ? 'OPEN' : 'SOON';
      return `<div class="card game-card" style="cursor:pointer;position:relative">
        <span class="badge" style="position:absolute;top:8px;right:8px;font-size:8px">${badge}</span>
        <div class="thumb" style="border-color:${g.color}55;box-shadow:0 0 14px ${g.color}22">${g.icon}</div>
        <h4>${g.name}</h4>
        <p>${g.desc}</p>
        <button class="btn ${ready ? 'btn-primary' : 'btn-ghost'}" style="width:100%;padding:8px;font-size:11px;margin-top:6px" onclick="${ready ? `playGame('${g.id}')` : `comingSoon('${g.name}')`}">${ready ? '▶ PLAY' : 'COMING SOON &#128274;'}</button>
      </div>`;
    }).join('');
    const g1 = document.getElementById('gameGrid');
    if (g1) g1.innerHTML = html;
  }

  // NEW UI: Featured Carousel (horizontal scroll)
  function renderFeaturedCarousel() {
    const feat = liveFeatured() ? liveFeatured().map(id => GAMES.find(g => g.id === id)).filter(Boolean) 
      : GAMES.filter(g => g.featured);
    const carousel = document.getElementById('featuredCarousel');
    if (!carousel) return;
    carousel.innerHTML = feat.map((g, i) => `
      <div class="featured-card" style="background:linear-gradient(145deg,${g.color}33,#0A0E16 65%);flex-shrink:0;scroll-snap-align:start;width:260px">
        <div class="f-ico" style="color:${g.color};width:44px;height:44px;display:flex">${gameLogo(g.id)}</div>
        <span class="badge" style="position:absolute;top:10px;right:10px">${engineReady(g.id) ? 'PLAY' : 'SOON'}</span>
        <h3>${g.name}</h3>
        <p style="font-size:var(--font-xs);color:var(--sub)">${g.desc}</p>
        <button class="btn btn-primary play-btn" style="width:100%;padding:var(--space-sm);font-size:var(--font-xs);margin-top:var(--space-sm)" onclick="playGame('${g.id}')">${engineReady(g.id) ? '▶ PLAY NOW' : 'COMING SOON'}</button>
      </div>`).join('');
  }

  // NEW UI: Home category filter
  function setHomeCat(cat) {
    currentHomeCat = cat;
    document.querySelectorAll('#homeCatTabs .cat-tab').forEach(t => 
      t.classList.toggle('active', t.dataset.cat === cat));
    renderHomeGrid();
  }

  // current category filter
  let currentCatFilter = 'ALL';

  // NEW UI: Arcade view mode (grid/list)
  let arcadeViewMode = 'grid';
  function setArcadeView(mode) {
    arcadeViewMode = mode;
    document.querySelectorAll('.view-btn').forEach(b => 
      b.classList.toggle('active', b.dataset.view === mode));
    const grid = document.getElementById('arcadeGrid');
    if (grid) grid.classList.toggle('list-view', mode === 'list');
    renderArcadeGrid();
  }

function gameLogo(id, size = 120) {
  const svg = (window.GAME_LOGOS && window.GAME_LOGOS[id]) || '';
  if (svg) return `<svg viewBox="0 0 120 120" style="width:100%;height:100%;display:block" xmlns="http://www.w3.org/2000/svg">${svg.replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`;
  const g = GAMES.find(x => x.id === id);
  return `<span style="font-size:${size * 0.28}px;filter:drop-shadow(0 4px 12px ${g ? g.color : '#fff'}66)">${g ? g.icon : '🎮'}</span>`;
}

function renderGameGrid(filter = '', cat = '') {
  const q = (filter || '').toLowerCase();
  const c = (cat || currentCatFilter).toUpperCase();
  let list = GAMES;
  if (q) list = list.filter(g => g.name.toLowerCase().includes(q) || g.desc.toLowerCase().includes(q));
  if (c !== 'ALL') list = list.filter(g => (g.cat || '').toUpperCase() === c);
  const html = list.map((g, i) => {
    const ready = !!engineReady(g.id);
    // NEW-ish games (last 8 in array) get NEW badge; featured get HOT
    const isNew = ready && i >= GAMES.length - 8;
    const isHot = ready && !!g.featured;
    const badge = !ready ? 'SOON' : isNew ? 'NEW' : isHot ? 'HOT' : (state.best[g.id] ? 'BEST ' + state.best[g.id].toLocaleString() : 'PLAY');
    const badgeColor = !ready ? 'var(--sub)' : isNew ? 'var(--green)' : isHot ? 'var(--pink)' : 'var(--cyan)';
    // pseudo play-count (deterministic from id + date — feels live)
    const today = new Date().toDateString();
    let h = 0; for (let k = 0; k < g.id.length; k++) h = (h * 31 + g.id.charCodeAt(k)) >>> 0;
    const daySeed = h % 7;
    const plays = 1200 + ((h + daySeed * 310) % 9800); // 1.2k–11k fake-plays
    const logo = gameLogo(g.id);
    return `<div class="card game-card" style="cursor:pointer;position:relative" onclick="playGame('${g.id}')">
      <button class="fav-btn" data-fav="${g.id}" onclick="toggleFavorite('${g.id}', event)" style="position:absolute;top:6px;left:6px;z-index:5;background:rgba(0,0,0,.45);border:none;border-radius:999px;width:26px;height:26px;font-size:13px;cursor:pointer;color:${isFav(g.id) ? 'var(--pink)' : '#888'};display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);transition:transform var(--transition-fast)">${isFav(g.id) ? '❤️' : '🤍'}</button>
      <span class="badge" style="position:absolute;top:8px;right:8px;font-size:8px;background:${badgeColor}22;color:${badgeColor};border:1px solid ${badgeColor}55">${badge}</span>
      <div class="thumb" style="border-color:${g.color}55;box-shadow:0 0 14px ${g.color}22">${logo}</div>
      <h4>${g.name}</h4>
      <p>${g.desc}</p>
      <div style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:10px;color:var(--sub)">
        <span style="color:${g.color}">●</span>
        <span>${plays.toLocaleString()} played</span>
        <span style="margin-left:auto;color:var(--yellow)">★ ${(4.0 + (h % 10) / 10).toFixed(1)}</span>
      </div>
      <button class="btn ${ready ? 'btn-primary' : 'btn-ghost'}" style="width:100%;padding:8px;font-size:11px;margin-top:6px" onclick="event.stopPropagation();${ready ? `playGame('${g.id}')` : `comingSoon('${g.name}')`}">${ready ? '▶ PLAY' : 'COMING SOON &#128274;'}</button>
    </div>`;
  }).join('');
  const g1 = document.getElementById('gameGrid');
  const g2 = document.getElementById('arcadeGrid');
  if (g1) g1.innerHTML = html;
  if (g2) g2.innerHTML = html;
}

function renderArcadeGrid(filter = '') {
  const q = (filter || '').toLowerCase();
  const c = currentCatFilter.toUpperCase();
  const sort = (document.getElementById('arcadeSort') || {}).value || 'featured';
  let list = GAMES;
  if (q) list = list.filter(g => g.name.toLowerCase().includes(q) || g.desc.toLowerCase().includes(q));
  if (c !== 'ALL') list = list.filter(g => (g.cat || '').toUpperCase() === c);
  // sort
  if (sort === 'name') list.sort((a,b) => a.name.localeCompare(b.name));
  else if (sort === 'category') list.sort((a,b) => (a.cat||'').localeCompare(b.cat||''));
  else if (sort === 'newest') list.reverse(); // assume newer games at end
  // else featured first (default)
  
  const html = list.map(g => {
    const ready = !!engineReady(g.id);
    const badge = ready ? 'OPEN' : 'SOON';
    // list view needs different structure
    const isList = arcadeViewMode === 'list';
    if (isList) {
      return `<div class="card game-card" style="cursor:pointer;position:relative;display:flex;align-items:center;gap:var(--space-md);padding:var(--space-md);min-height:80px">
        <button class="fav-btn" data-fav="${g.id}" onclick="toggleFavorite('${g.id}', event)" style="position:absolute;top:6px;left:6px;z-index:5;background:rgba(0,0,0,.45);border:none;border-radius:999px;width:24px;height:24px;font-size:12px;cursor:pointer;color:${isFav(g.id) ? 'var(--pink)' : '#888'};display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)">${isFav(g.id) ? '❤️' : '🤍'}</button>
        <span class="badge" style="position:absolute;top:8px;right:8px;font-size:8px">${badge}</span>
        <div class="thumb" style="width:60px;height:60px;flex-shrink:0;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,rgba(255,255,255,.05),rgba(255,255,255,.02));border-color:${g.color}55;box-shadow:0 0 14px ${g.color}22">${gameLogo(g.id)}</div>
        <div class="info" style="flex:1;min-width:0">
          <h4 style="font-size:var(--font-sm);font-weight:700;color:#fff;margin-bottom:var(--space-xs);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${g.name}</h4>
          <p style="font-size:var(--font-xs);color:var(--sub);margin-bottom:var(--space-xs);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${g.desc}</p>
          <div style="display:flex;align-items:center;gap:var(--space-xs);flex-wrap:wrap">
            <span style="font-size:var(--font-xs);color:var(--sub);background:rgba(255,255,255,.06);padding:2px 8px;border-radius:999px">${g.cat || '—'}</span>
            <span style="font-size:var(--font-xs);color:var(--yellow);font-family:'Orbitron',sans-serif">★ ${(Math.random()*4+1).toFixed(1)}</span>
          </div>
        </div>
        <div class="actions" style="flex-shrink:0">
          <button class="btn ${ready ? 'btn-primary' : 'btn-ghost'}" style="padding:var(--space-xs) var(--space-md);font-size:var(--font-xs)" onclick="${ready ? `playGame('${g.id}')` : `comingSoon('${g.name}')`}">${ready ? '▶ PLAY' : 'COMING'}</button>
        </div>
      </div>`;
    } else {
      return `<div class="card game-card" style="cursor:pointer;position:relative">
        <button class="fav-btn" data-fav="${g.id}" onclick="toggleFavorite('${g.id}', event)" style="position:absolute;top:6px;left:6px;z-index:5;background:rgba(0,0,0,.45);border:none;border-radius:999px;width:24px;height:24px;font-size:12px;cursor:pointer;color:${isFav(g.id) ? 'var(--pink)' : '#888'};display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)">${isFav(g.id) ? '❤️' : '🤍'}</button>
        <span class="badge" style="position:absolute;top:8px;right:8px;font-size:8px">${ready ? 'OPEN' : 'SOON'}</span>
        <div class="thumb" style="height:80px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,rgba(255,255,255,.05),rgba(255,255,255,.02));border-color:${g.color}55;box-shadow:0 0 14px ${g.color}22">${gameLogo(g.id)}</div>
        <h4 style="font-size:var(--font-sm);font-weight:700;color:#fff;margin-bottom:var(--space-xs);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${g.name}</h4>
        <p style="font-size:var(--font-xs);color:var(--sub);margin-bottom:var(--space-sm);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${g.desc}</p>
        <div style="display:flex;align-items:center;justify-content:space-between;align-items:center;margin-bottom:var(--space-sm)">
          <span style="font-size:var(--font-xs);color:var(--sub);background:rgba(255,255,255,.06);padding:2px 8px;border-radius:999px">${g.cat || '—'}</span>
          <span style="font-size:var(--font-xs);color:var(--yellow);font-family:'Orbitron',sans-serif">★ ${(Math.random()*4+1).toFixed(1)}</span>
        </div>
        <button class="btn ${ready ? 'btn-primary' : 'btn-ghost'}" style="width:100%;padding:8px;font-size:11px;margin-top:6px" onclick="${ready ? `playGame('${g.id}')` : `comingSoon('${g.name}')`}">${ready ? '▶ PLAY' : 'COMING SOON &#128274;'}</button>
      </div>`;
    }
  }).join('');
  const g1 = document.getElementById('gameGrid');
  const g2 = document.getElementById('arcadeGrid');
  if (g1) g1.innerHTML = html;
  if (g2) g2.innerHTML = html;
  // apply list view class
  if (g2) g2.classList.toggle('list-view', arcadeViewMode === 'list');
  
  // render category filter chips
  const wrap = document.getElementById('catFilter');
  if (!wrap) return;
  const cats = ['ALL', ...new Set(GAMES.map(g => g.cat).filter(Boolean).sort())];
  wrap.innerHTML = cats.map(c => {
    const active = currentCatFilter.toUpperCase() === c.toUpperCase();
    return `<button class="cat-chip ${active ? 'active' : ''}" onclick="setCatFilter('${c}')" style="padding:6px 12px;border-radius:999px;font-size:var(--font-xs);font-weight:700;border:none;cursor:pointer;background:${active ? 'var(--pink)' : 'rgba(255,255,255,.08)'};color:${active ? '#fff' : 'var(--text)'};white-space:nowrap;transition:all var(--transition-fast)">${c}</button>`;
  }).join('');
}

function setCatFilter(c) {
  currentCatFilter = c;
  renderArcadeGrid();
  document.getElementById('arcadeSearch').value = '';
}

/* ==================== SHOP ==================== */
const SHOP_ITEMS = {
  skins: [
    { id: 'skin-dragon', name: 'DRAGON SKIN', ico: '🐉', price: 500, desc: 'Snake turns into a fire dragon' },
    { id: 'skin-cyber',  name: 'NEON PHANTOM', ico: '👻', price: 800, desc: 'Phantom glow for every game' },
    { id: 'skin-gold',   name: 'GOLD LEGEND', ico: '🏆', price: 1500, desc: 'Pure gold — for kings only' }
  ],
  vehicles: [
    { id: 'veh-falcon', name: 'FALCON X', ico: '🏎️', price: 900, desc: 'Racer: sleek falcon body' },
    { id: 'veh-viper',  name: 'VIPER GT', ico: '🐍', price: 1200, desc: 'Racer: venom-green viper' },
    { id: 'veh-phantom', name: 'PHANTOM CYCLE', ico: '🏍️', price: 700, desc: 'Light cycle black edition' }
  ],
  effects: [
    { id: 'fx-fire',   name: 'FIRE TRAIL', ico: '🔥', price: 400, desc: 'Explosions leave fire trails' },
    { id: 'fx-rainbow', name: 'RAINBOW', ico: '🌈', price: 650, desc: 'Neon rainbow score pops' },
    { id: 'fx-stars',  name: 'STARBURST', ico: '✨', price: 300, desc: 'Sparks on every hit' }
  ],
  boosters: [
    { id: 'boost-2x',    name: '2X SCORE', ico: '⚡', price: 200, desc: 'Double score for 1 game' },
    { id: 'boost-shield',name: 'SHIELD', ico: '🛡️', price: 150, desc: '1 free crash per game' },
    { id: 'boost-slow',  name: 'SLOW MOTION', ico: '⏳', price: 100, desc: 'Enemies move slower 1 game' }
  ]
};
function renderShop(tab = 'skins') {
  currentShopTab = tab;
  
  // update tab active states
  document.querySelectorAll('#shopTabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  
  // live daily deal banner (rotates 4x/day)
  const deal = liveDeal();
  const dealEl = document.getElementById('liveDealBanner');
  const dealText = document.getElementById('dealText');
  if (dealEl && dealText) {
    if (deal && tab === 'skins') {
      dealEl.style.display = 'flex';
      dealText.innerHTML = `${deal.name} — <b>${deal.pct}% OFF</b> — FIRST BUY TODAY!`;
    } else {
      dealEl.style.display = 'none';
    }
  }
  
  // update shop coin display
  const shopCoin = document.getElementById('shopCoinDisplay');
  if (shopCoin) shopCoin.innerText = state.coins.toLocaleString();
  
  // filter/sort values
  const filter = (document.getElementById('shopFilter') || {}).value || 'all';
  const sort = (document.getElementById('shopSort') || {}).value || 'price-asc';
  
  const ownerType = tab === 'skins' ? 'skin' : tab === 'vehicles' ? 'vehicle' : tab === 'effects' ? 'effect' : 'booster';
  
  let items = SHOP_ITEMS[tab] || [];
  
  // filter
  if (filter === 'owned') items = items.filter(it => state.inventory.includes(it.id));
  else if (filter === 'equipped') items = items.filter(it => state.equipped[ownerType] === it.id);
  else if (filter === 'unowned') items = items.filter(it => !state.inventory.includes(it.id));
  
  // sort
  if (sort === 'price-asc') items.sort((a,b) => a.price - b.price);
  else if (sort === 'price-desc') items.sort((a,b) => b.price - a.price);
  else if (sort === 'name') items.sort((a,b) => a.name.localeCompare(b.name));
  
  document.getElementById('shopItems').innerHTML = items.map(it => {
    const owned = state.inventory.includes(it.id);
    const equipped = state.equipped[ownerType] === it.id;
    return `
    <div class="shop-item ${owned ? 'owned' : ''} ${equipped ? 'equipped' : ''}">
      <div class="item-icon" style="color:${it.price > 1000 ? 'var(--yellow)' : 'var(--cyan)'}">${it.ico}</div>
      <div class="item-name">${it.name}</div>
      <div class="item-desc">${it.desc}</div>
      <div class="item-price">
        ${equipped 
          ? `<span class="price-tag">EQUIPPED ✓</span>`
          : owned 
            ? `<button class="btn btn-small btn-ghost" onclick="equipItem('${it.id}','${ownerType}')">EQUIP</button>`
            : `<button class="btn btn-small btn-yellow" onclick="buyItem('${it.id}','${ownerType}',${it.price})"><i class="fa-solid fa-coins"></i> ${it.price.toLocaleString()}</button>`
        }
      </div>
    </div>`;
  }).join('');
  
  // update live deal banner text
  if (document.getElementById('dealText')) {
    const deal2 = liveDeal();
    if (deal2 && deal2.item) {
      const dealItem = SHOP_ITEMS.skins.find(s => s.id === deal2.item);
      if (dealItem) document.getElementById('dealText').innerHTML = `${dealItem.name} — <b>${deal2.pct}% OFF</b> — FIRST BUY TODAY!`;
    }
  }
}
function buyItem(id, type, price) {
  if (state.inventory.includes(id)) { toast('Already owned'); return; }
  if (state.coins < price) { toast('Not enough coins — play games!'); return; }
  state.coins -= price;
  state.inventory.push(id);
  saveState(); updateCoinDisplay(); renderShop();
  toast('Purchased! 🛒');
}
function equipItem(id, type) {
  state.equipped[type] = id;
  saveState(); renderShop(); renderProfile(); renderThemes();
  toast('Equipped! ⚡');
}

/* ==================== LEADERBOARD ==================== */
const BOTS = [
  { name: 'ZX_PULSE', score: 842190, avatar: '⚡' },
  { name: 'NEO_MATRIX', score: 731450, avatar: '🤖' },
  { name: 'GHOST_RIDER', score: 684230, avatar: '👻' },
  { name: 'CYBER_SAGE', score: 512900, avatar: '🧙' },
  { name: 'VOLT_KING', score: 489300, avatar: '⚡' },
  { name: 'PIXEL_WARRIOR', score: 412750, avatar: '🛡️' },
  { name: 'NOVA_BLAZE', score: 322100, avatar: '🔥' },
  { name: 'TURBO_TITAN', score: 256800, avatar: '🚀' }
];
function renderBoard(range = 'weekly') {
  const myBest = Object.values(state.best).reduce((a, b) => a + b, 0);
  const myName = state.profile.username;
  // live-rotated bot scores (deterministic per rot; falls back to 1.0)
  const boost = liveBotBoost() || [1,1,1,1,1,1,1,1];
  let list = BOTS.map((b, i) => ({ ...b, score: Math.round(b.score * (boost[i] || 1)), me: false }));
  list.push({ name: myName, score: Math.max(myBest, 100), avatar: state.profile.avatar, me: true });
  if (range === 'alltime') list.forEach(b => b.score = Math.round(b.score * 1.7));
  else if (range === 'friends') list = list.filter(b => b.me || Math.random() < 0.4);
  list.sort((a, b) => b.score - a.score);
  const myRank = list.findIndex(b => b.me) + 1;
  const myRow = list.find(b => b.me);
  document.getElementById('myRankCard').innerHTML = `
    <div style="display:flex;align-items:center;gap:10px">
      <div style="font-family:'Press Start 2P',monospace;font-size:12px;color:var(--yellow)">#${myRank}</div>
      <div class="rank-avatar" style="width:36px;height:36px;font-size:16px">${myRow.avatar}</div>
      <div style="flex:1">
        <div style="font-weight:700;color:#fff;font-size:13px">YOU</div>
        <div style="font-size:11px;color:var(--sub)">${myRow.score.toLocaleString()} PTS</div>
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--green)">+${Math.round(myRow.score * 0.15).toLocaleString()} <span style="color:var(--sub)">TO NEXT</span></div>
    </div>
    <div style="margin-top:8px;font-size:11px;color:var(--sub)">YOUR RANK: <b style="color:var(--cyan)">#${myRank}</b> · ${myRow.score.toLocaleString()} PTS</div>`;
  document.getElementById('boardList').innerHTML = list.slice(0, 12).map((b, i) => `
    <div class="card rank-row ${b.me ? 'me' : ''}" style="margin-bottom:8px">
      <div class="rank-no">${i < 3 ? '<span class="crown">👑</span>' : '#' + (i + 1)}</div>
      <div class="rank-avatar">${b.avatar}</div>
      <div class="rank-name">${b.name}${b.me ? ' <span style="color:var(--cyan);font-size:10px">(YOU)</span>' : ''}</div>
      <div class="rank-score">${b.score.toLocaleString()}</div>
    </div>`).join('');
}

/* ==================== PROFILE ==================== */
function renderProfile() {
  const p = state.profile;
  const skinsOwned = state.inventory.filter(id => id.startsWith('skin-') || id.startsWith('veh-')).length;
  state.streak = state.streak || 0;
  const xpCur = p.xp || 0, xpNeed = 100 * Math.pow(p.level, 1.35);
  const xpPct = Math.min(100, Math.round(xpCur / xpNeed * 100));
  document.getElementById('avatarBig').innerText = p.avatar || '👤';
  document.getElementById('playerName').innerText = p.username;
  document.getElementById('playerLevel').innerHTML = 'LVL ' + p.level + (p.level >= 30 ? ' <span style="color:var(--gold)">VIP</span>' : '') + `<div class="xp-bar"><div class="xp-fill" style="width:${xpPct}%"></div><span class="xp-label">${Math.round(xpCur)}/${Math.round(xpNeed)}</span></div>`;
  document.getElementById('statWins').innerText = state.stats.gamesPlayed;
  document.getElementById('statCoins').innerText = state.coins.toLocaleString();
  document.getElementById('statSkins').innerText = skinsOwned + '/24';
  const favEl = document.getElementById('statFav');
  if (favEl) favEl.innerText = (state.favorites || []).length;

  // ACHIEVEMENTS (visual grid, v7.5 redesign)
  const ACH_META = [
    { id: 'first',   ico: '🏆', name: 'FIRST BLOOD' },
    { id: 'win10',   ico: '⚡', name: 'ARCADE ADDICT' },
    { id: 'win50',   ico: '🔥', name: 'FIFTY & FIERCE' },
    { id: 'score1k', ico: '💎', name: 'FOUR-FIGURE' },
    { id: 'score10k',ico: '👑', name: 'HIGH ROLLER' },
    { id: 'combo8',  ico: '🌀', name: 'COMBO STARTER' },
    { id: 'master',  ico: '🎯', name: 'GAME MASTER' },
    { id: 'coins500',ico: '💰', name: 'RICH KID' }
  ];
  const achUnlocked = ACH_META.filter(a => (state.achievements || []).includes(a.id)).length;
  document.getElementById('achCount').innerText = achUnlocked + '/' + ACH_META.length;
  document.getElementById('achBar').style.width = (achUnlocked / ACH_META.length * 100) + '%';
  document.getElementById('achList').innerHTML = ACH_META.map(a => {
    const done = (state.achievements || []).includes(a.id);
    return `<div class="ach-card${done ? ' done' : ''}">
      <div class="ach-ico" style="opacity:${done ? 1 : .3}">${a.ico}</div>
      <div class="ach-name">${a.name}</div>
      <div class="ach-status">${done ? '<span style="color:var(--green)">✓ DONE</span>' : '🔒'}</div>
    </div>`;
  }).join('');

  // DAILY MISSIONS (v7.5: card style with progress)
  const dqWrap = document.getElementById('dailyQuestList');
  if (dqWrap) {
    const dq = state.dailyQuest || {};
    if (dq.date && dq.list) {
      dqWrap.innerHTML = dq.list.map(q => {
        const done = (dq.done || []).includes(q.id);
        const pct = Math.min(100, Math.round(q.prog / q.target * 100));
        return `<div class="mission-card${done ? ' done' : ''}">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:18px;opacity:${done ? 1 : .5}">${q.ico}</span>
            <div style="flex:1">
              <div style="font-size:12px;font-weight:700;color:${done ? 'var(--green)' : '#fff'}">${q.desc}</div>
              <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
                <div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${done ? 'var(--green)' : 'var(--accent)'}"></div></div>
                <span style="font-size:10px;color:var(--sub)">${Math.min(q.prog,q.target)}/${q.target}</span>
              </div>
            </div>
            <span style="font-size:11px;font-weight:800;color:var(--gold);white-space:nowrap">+${q.reward} 🪙</span>
          </div>
        </div>`;
      }).join('');
    } else {
      dqWrap.innerHTML = '<div style="font-size:12px;color:var(--sub);padding:10px 0">Play any mission game today to unlock!</div>';
    }
  }
}

/* ==================== COIN STORE ==================== */
const COIN_PACKS = [
  { coins: 500, price: 2.99, tag: null },
  { coins: 1200, price: 5.99, tag: 'POPULAR' },
  { coins: 2500, price: 9.99, tag: null },
  { coins: 5000, price: 17.99, tag: 'BEST VALUE' }
];
function renderCoinStore() {
  document.getElementById('coinPacks').innerHTML = COIN_PACKS.map(p => `
    <div class="card pack-card">
      ${p.tag ? `<span class="badge">${p.tag}</span>` : ''}
      <div class="coins">${p.coins.toLocaleString()}</div>
      <div style="font-size:11px;color:var(--sub)">COINS</div>
      <div class="price">$${p.price.toFixed(2)}</div>
      <button class="btn btn-primary" style="width:100%;padding:10px" onclick="toast('Payment gateway comes with app release — this is a demo store')"><i class="fa-solid fa-lock"></i> BUY NOW</button>
    </div>`).join('');
}

/* Per-game skin mapping — each game gets its own palette (skin-by-game).
   Map game type/category → theme id. Individual games can be overridden below. */
const GAME_SKIN = {
  // Action neon
  'neon-racer': 'neon', 'cyber-shooter': 'neon2', 'pixel-dungeon': 'void',
  'light-cycle': 'neon', 'neon-snake': 'neon', 'tank-battle': 'matrix',
  'airstrike': 'sunset', 'neon-dash': 'neon', 'traffic-racer': 'sunset',
  'dino-run': 'sunset', 'sling-birds': 'void', 'space-miner': 'royal', 'neon-slam': 'neon', 'neon-tower': 'royal', 'cosmic-dash': 'void', 'lazer-maze': 'matrix', 'time-rush': 'sunset', 'hill-climb': 'sunset',
  'temple-run': 'void', 'helix-drop': 'matrix',
  // Arcade vibrant
  'flappy-neon': 'neon', 'pac-runner': 'void', 'space-invaders': 'matrix',
  'brick-breaker': 'neon2', 'tetris-blitz': 'neon2',
  'fruit-slash': 'sunset', 'piano-tiles': 'void', 'candy-crush': 'sunset',
  'snake-classic': 'matrix', 'duck-hunt': 'void', 'color-switch': 'neon2',
  'neon-jumper': 'neon', 'stack-drop': 'neon', 'lucky-spin': 'royal',
  '2048': 'void',
  // Puzzle / brain
  'water-sort': 'neon2', 'triple-sort': 'neon2', 'fruit-merge': 'sunset',
  'bubble-shooter': 'neon2', 'flow-free': 'neon', 'word-search': 'sunset',
  'memory-match': 'neon2', 'mine-sweeper': 'matrix', 'sudoku': 'void',
  'mastermind': 'neon', 'simon-says': 'sunset', 'tic-tac-toe': 'void',
  'connect-four': 'sunset', 'checkers': 'royal', 'slide-puzzle': 'neon2',
  'nonogram': 'void',
  // Sports
  'pong': 'neon', 'table-tennis': 'neon2', 'bowling-strike': 'void',
  'cricket-sixer': 'royal', 'hoop-dunk': 'sunset', 'archery-master': 'matrix',
  'soccer-penalty': 'neon', 'athletics-sprint': 'sunset',
  // Retro / classic
  'pinball': 'neon', 'crossy-neon': 'void', 'trash-sorter': 'matrix',
  'ladder-climb': 'sunset', 'math-dash': 'neon2',
  // Board
  'ludo-king': 'royal', 'carrom-pool': 'sunset',
  // default
  '_default': 'neon'
};
/* Apply a game's skin palette while playing (skin-by-game). Falls back to global. */
function applyGameSkin(gameId) {
  const themeId = GAME_SKIN[gameId] || GAME_SKIN._default || 'neon';
  // remember the user's chosen theme as the "global" — game skin is transient
  if (!globalTheme || globalTheme === 'game') globalTheme = state.equipped.theme || 'neon';
  applyTheme(themeId, true);
}

/* ==================== THEMES ==================== */
/* 6 full theme palettes — each sets the ENTIRE CSS variable set.
   Applied via applyTheme() → CSS custom properties → instant skin change. */
const THEMES = [
  { id: 'neon',   name: 'NEON CYBER',   ico: '🌆', desc: 'Default cyan/pink glow',   price: 0, palette: {
    bg:'#05070A', glow1:'rgba(0,255,255,.08)', glow2:'rgba(255,16,240,.07)',
    grid:'rgba(0,255,255,.05)', gridv:'rgba(255,16,240,.05)',
    cyan:'#00FFFF', cyan2:'#00b8ff', pink:'#FF10F0', pink2:'#b900ff',
    yellow:'#FFE600', yellow2:'#ff9d00', green:'#39FF88', red:'#FF3B6B',
    accent:'#00FFFF', accent2:'#FF10F0', glass:'rgba(255,255,255,.06)',
    glassBorder:'rgba(0,255,255,.35)', panel:'#0A0E16', sub:'#8A93A6',
    bgGridSize:'44px 44px' } },
  { id: 'void',   name: 'VOID DARK',   ico: '🌑', desc: 'Pure black, minimal neon',  price: 0, palette: {
    bg:'#000000', glow1:'rgba(139,92,246,.07)', glow2:'rgba(0,0,0,0)',
    grid:'rgba(139,92,246,.04)', gridv:'rgba(99,102,241,.04)',
    cyan:'#A78BFA', cyan2:'#6D28D9', pink:'#C084FC', pink2:'#7C3AED',
    yellow:'#E9D5FF', yellow2:'#a78bfa', green:'#34D399', red:'#F87171',
    accent:'#A78BFA', accent2:'#C084FC', glass:'rgba(255,255,255,.05)',
    glassBorder:'rgba(167,139,250,.35)', panel:'#050508', sub:'#9CA3AF',
    bgGridSize:'44px 44px' } },
  { id: 'sunset', name: 'RETRO SUNSET', ico: '🌇', desc: 'Orange/purple retro vibe', price: 400, palette: {
    bg:'#0B0608', glow1:'rgba(255,107,53,.09)', glow2:'rgba(255,0,128,.07)',
    grid:'rgba(255,107,53,.05)', gridv:'rgba(255,0,128,.05)',
    cyan:'#FFB347', cyan2:'#ff8c00', pink:'#FF6B6B', pink2:'#FF2E63',
    yellow:'#FFD166', yellow2:'#ff9d00', green:'#06D6A0', red:'#FF4D4D',
    accent:'#FFB347', accent2:'#FF6B6B', glass:'rgba(255,255,255,.06)',
    glassBorder:'rgba(255,107,53,.35)', panel:'#12090C', sub:'#B08968',
    bgGridSize:'44px 44px' } },
  { id: 'matrix', name: 'MATRIX GREEN', ico: '💚', desc: 'Green rain terminal look', price: 600, palette: {
    bg:'#020804', glow1:'rgba(34,255,136,.08)', glow2:'rgba(0,255,100,.05)',
    grid:'rgba(34,255,136,.05)', gridv:'rgba(0,255,100,.04)',
    cyan:'#22FF88', cyan2:'#00CC66', pink:'#00FFAA', pink2:'#00B366',
    yellow:'#B8FF5C', yellow2:'#7FDB39', green:'#39FF88', red:'#FF4D4D',
    accent:'#22FF88', accent2:'#00FFAA', glass:'rgba(255,255,255,.06)',
    glassBorder:'rgba(34,255,136,.4)', panel:'#02130A', sub:'#86D9AC',
    bgGridSize:'0 0' } },
  { id: 'royal',  name: 'GOLD ROYAL',  ico: '👑', desc: 'Gold & black luxury',      price: 1000, palette: {
    bg:'#070600', glow1:'rgba(255,215,0,.09)', glow2:'rgba(128,0,128,.06)',
    grid:'rgba(255,215,0,.05)', gridv:'rgba(128,0,128,.04)',
    cyan:'#FFD700', cyan2:'#FFB300', pink:'#E6B800', pink2:'#B8860B',
    yellow:'#FFD700', yellow2:'#FFAA00', green:'#FFC107', red:'#E53935',
    accent:'#FFD700', accent2:'#E6B800', glass:'rgba(255,255,255,.06)',
    glassBorder:'rgba(255,215,0,.4)', panel:'#0E0B00', sub:'#C4A870',
    bgGridSize:'44px 44px' } },
  { id: 'neon2',  name: 'NEON VOID',   ico: '🌌', desc: 'Deep purple-blue neon',     price: 200, palette: {
    bg:'#030510', glow1:'rgba(99,102,241,.1)', glow2:'rgba(0,255,255,.06)',
    grid:'rgba(99,102,241,.06)', gridv:'rgba(0,255,255,.05)',
    cyan:'#38BDF8', cyan2:'#0EA5E9', pink:'#818CF8', pink2:'#6366F1',
    yellow:'#A5F3FC', yellow2:'#22D3EE', green:'#4ADE80', red:'#FB7185',
    accent:'#38BDF8', accent2:'#818CF8', glass:'rgba(255,255,255,.06)',
    glassBorder:'rgba(99,102,241,.4)', panel:'#05071A', sub:'#8E9BBF',
    bgGridSize:'44px 44px' } }
];
/* Active global theme + quick-cycle helper */
let globalTheme = 'neon';
function cycleTheme() {
  const order = THEMES.map(t => t.id);
  const i = order.indexOf(globalTheme);
  const next = order[(i + 1) % order.length];
  applyTheme(next);
  toast('Theme: ' + THEMES.find(t => t.id === next).name + ' ' + THEMES.find(t => t.id === next).ico);
}

/* Dynamic particle / neon-arc background canvas — theme-aware (v6.4: bloom, trails, themed FX) */
let themeBgCtx = null, themeBgRaf = null, themeParticles = [], themeShooting = [], themeTrail = [];
let themeFx = 'web';  // 'web' | 'matrix' | 'stars' | 'sunset' | 'gold'
function initThemeCanvas() {
  const c = document.getElementById('themeCanvas');
  if (!c || !c.getContext) return;
  // Respect reduced-motion: skip animated background entirely
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  themeBgCtx = c.getContext('2d');
  const size = () => { c.width = innerWidth; c.height = innerHeight; };
  size();
  addEventListener('resize', size);
  // spawn particles (arcs + dots) based on current palette — capped for perf
  themeParticles = []; themeShooting = []; themeTrail = [];
  const n = Math.min(24, Math.floor(innerWidth / 40)); // fewer particles = smoother on mobile
  for (let i = 0; i < n; i++) {
    themeParticles.push({
      x: Math.random() * innerWidth, y: Math.random() * innerHeight,
      vx: (Math.random() - .5) * .4, vy: (Math.random() - .5) * .4,
      r: 1 + Math.random() * 2,
      hue: Math.random() < .5 ? 'accent' : 'accent2',
      a: .3 + Math.random() * .4, pulse: Math.random() * Math.PI * 2
    });
  }
  // shooting star occasionally
  spawnShooting();
  // pause the canvas when tab hidden (perf)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopThemeCanvas();
    else if (!themeBgRaf) themeBgRaf = requestAnimationFrame(themeBgLoop);
  });
  themeBgRaf = requestAnimationFrame(themeBgLoop);
}

function spawnShooting() {
  if (themeShooting.length > 3) return;
  themeShooting.push({
    x: Math.random() * innerWidth, y: Math.random() * innerHeight * .5,
    vx: 2 + Math.random() * 4, vy: 1 + Math.random() * 2.5,
    life: 1, len: 60 + Math.random() * 60
  });
}

function themeCanvasFx() {
  // choose FX mode based on active theme
  const t = globalTheme || 'neon';
  themeFx = t === 'matrix' ? 'matrix' : t === 'void' ? 'stars' : t === 'sunset' ? 'sunset'
    : t === 'royal' ? 'gold' : 'web';
}

function themeBgLoop() {
  const ctx = themeBgCtx; if (!ctx) return;
  const c = document.getElementById('themeCanvas');
  const W = c.width, H = c.height;
  // fade last frame for trails (composite 'destination-out' or alpha fill)
  ctx.fillStyle = 'rgba(5,7,10,0.18)';
  ctx.fillRect(0, 0, W, H);
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00FFFF';
  const accent2 = getComputedStyle(document.documentElement).getPropertyValue('--accent2').trim() || '#FF10F0';

  // theme-specific backdrop FX
  themeCanvasFx();
  if (themeFx === 'matrix') drawMatrixRain(ctx, W, H, accent);
  else if (themeFx === 'stars') drawStarField(ctx, W, H);
  else if (themeFx === 'sunset') drawSunsetGlow(ctx, W, H);
  else if (themeFx === 'gold') drawGoldDust(ctx, W, H, accent, accent2);

  // connecting web lines between near particles (neon web) + bloom dots
  ctx.lineWidth = .6;
  for (let i = 0; i < themeParticles.length; i++) {
    const p = themeParticles[i];
    p.x += p.vx; p.y += p.vy; p.pulse += .02;
    if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20;
    if (p.y < -20) p.y = H + 20; if (p.y > H + 20) p.y = -20;
    for (let j = i + 1; j < themeParticles.length; j++) {
      const q = themeParticles[j];
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < 130) {
        ctx.strokeStyle = (p.hue === 'accent' ? accent : accent2);
        ctx.globalAlpha = (1 - d / 130) * .18;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      }
    }
    const col = p.hue === 'accent' ? accent : accent2;
    // bloom glow (radial gradient)
    ctx.globalAlpha = (.25 + .2 * Math.sin(p.pulse)) * .5;
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
    glow.addColorStop(0, col); glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2); ctx.fill();
    // core dot
    ctx.globalAlpha = .4 + .3 * Math.sin(p.pulse);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // shooting star streaks
  for (let i = themeShooting.length - 1; i >= 0; i--) {
    const s = themeShooting[i];
    s.x += s.vx; s.y += s.vy; s.life -= .008;
    const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * s.len, s.y - s.vy * s.len);
    grad.addColorStop(0, '#FFFFFF'); grad.addColorStop(.3, accent); grad.addColorStop(1, 'transparent');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.globalAlpha = Math.max(0, s.life) * .7;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * s.len, s.y - s.vy * s.len); ctx.stroke();
    if (s.life <= 0) themeShooting.splice(i, 1);
  }
  ctx.globalAlpha = 1;
  if (Math.random() < .003) spawnShooting();  // every ~5s

  themeBgRaf = requestAnimationFrame(themeBgLoop);
}

// ---- Theme-specific backdrop FX ----
let matrixCols = [];
function drawMatrixRain(ctx, W, H, accent) {
  const fw = 14;
  if (!matrixCols.length) {
    for (let x = 0; x < W; x += fw) {
      matrixCols.push({ x, y: Math.random() * H, speed: 6 + Math.random() * 10, chars: [] });
    }
  }
  ctx.font = '12px monospace';
  matrixCols.forEach(col => {
    col.y += col.speed * 0.25;
    if (col.y - 20 > H) col.y = -20;
    const ch = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ01'.split('')[Math.floor(Math.random() * 30)];
    ctx.fillStyle = accent + '88';
    ctx.globalAlpha = .5;
    ctx.fillText(ch, col.x, col.y);
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = .8;
    ctx.fillText(ch, col.x, col.y - 16);
  });
  ctx.globalAlpha = 1;
}

let starTwinkle = [];
function drawStarField(ctx, W, H) {
  if (!starTwinkle.length) {
    for (let i = 0; i < 60; i++) {
      starTwinkle.push({ x: Math.random() * W, y: Math.random() * H, r: .5 + Math.random() * 1.5, p: Math.random() * 6.28, s: .02 + Math.random() * .04 });
    }
  }
  starTwinkle.forEach(s => {
    s.p += s.s;
    ctx.globalAlpha = .3 + .5 * Math.abs(Math.sin(s.p));
    ctx.fillStyle = '#CCD6FF';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawSunsetGlow(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(255,94,58,.10)');
  g.addColorStop(.5, 'rgba(249,115,22,.05)');
  g.addColorStop(1, 'rgba(255,16,240,.06)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // sun disc low on horizon
  const sx = W * .7, sy = H * .8, sr = Math.min(W, H) * .28;
  const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
  sg.addColorStop(0, 'rgba(255,180,90,.25)');
  sg.addColorStop(.5, 'rgba(255,120,50,.08)');
  sg.addColorStop(1, 'transparent');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
}

function drawGoldDust(ctx, W, H, accent, accent2) {
  const g = ctx.createRadialGradient(W * .5, H * .4, 0, W * .5, H * .4, Math.max(W, H) * .7);
  g.addColorStop(0, 'rgba(255,200,80,.06)');
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// interactive ripple on touch/click
function themeTouchRipple(x, y) {
  if (!themeBgCtx) return;
  const c = document.getElementById('themeCanvas');
  if (!c) return;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00FFFF';
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 1 + Math.random() * 2;
    themeParticles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      r: 1.5 + Math.random() * 2,
      hue: Math.random() < .5 ? 'accent' : 'accent2',
      a: .6, pulse: Math.random() * 6.28
    });
  }
  if (themeParticles.length > 60) themeParticles.splice(0, themeParticles.length - 60);
}
addEventListener('pointerdown', (e) => themeTouchRipple(e.clientX, e.clientY), { passive: true });

function stopThemeCanvas() { if (themeBgRaf) { cancelAnimationFrame(themeBgRaf); themeBgRaf = null; } }

function renderThemes() {
  document.getElementById('themeList').innerHTML = THEMES.map(t => {
    const owned = t.price === 0 || state.inventory.includes('theme-' + t.id);
    const active = state.equipped.theme === t.id;
    return `
    <div class="card shop-item">
      <div class="s-ico" style="border-color:${active ? t.palette.accent : 'rgba(255,255,255,.15)'};box-shadow:${active ? '0 0 16px ' + t.palette.accent : 'none'}">${t.ico}</div>
      <div class="s-info">
        <h4>${t.name}</h4>
        <p>${t.desc}</p>
      </div>
      <div>
        ${active ? '<button class="btn btn-ghost" style="padding:8px 12px;font-size:11px">ACTIVE ✓</button>'
          : owned ? `<button class="btn btn-primary" style="padding:8px 12px;font-size:11px" onclick="applyTheme('${t.id}')">APPLY</button>`
          : `<button class="btn btn-yellow" style="padding:8px 12px;font-size:11px" onclick="buyTheme('${t.id}',${t.price})"><i class="fa-solid fa-coins"></i>${t.price}</button>`}
      </div>
    </div>`;
  }).join('');
  applyTheme(state.equipped.theme, true);
}
function buyTheme(id, price) {
  if (state.coins < price) { toast('Not enough coins'); return; }
  state.coins -= price;
  state.inventory.push('theme-' + id);
  state.equipped.theme = id;
  saveState(); updateCoinDisplay(); renderThemes(); renderShop();
  toast('Theme applied! 🌆');
}
/* Apply a full theme palette to CSS variables (6 themes + per-game skins) */
function applyTheme(id, silent) {
  // resolve: exact theme, or a game id → its palette, else default neon
  let t = THEMES.find(x => x.id === id);
  if (!t) t = THEMES[0];
  state.equipped.theme = id;
  saveState();
  if (!silent) {
    globalTheme = id;
    toast('Theme: ' + t.name + ' ' + t.ico);
  }
  const root = document.documentElement.style;
  const p = t.palette;
  root.setProperty('--bg', p.bg);
  root.setProperty('--bg-glow-1', p.glow1);
  root.setProperty('--bg-glow-2', p.glow2);
  root.setProperty('--bg-grid', p.grid);
  root.setProperty('--bg-grid-v', p.gridv);
  root.setProperty('--cyan', p.cyan);
  root.setProperty('--cyan2', p.cyan2);
  root.setProperty('--pink', p.pink);
  root.setProperty('--pink2', p.pink2);
  root.setProperty('--yellow', p.yellow);
  root.setProperty('--yellow2', p.yellow2);
  root.setProperty('--green', p.green);
  root.setProperty('--red', p.red);
  root.setProperty('--accent', p.accent);
  root.setProperty('--accent2', p.accent2);
  root.setProperty('--glass', p.glass);
  root.setProperty('--glass-border', '1px solid ' + p.glassBorder);
  root.setProperty('--panel', p.panel);
  root.setProperty('--sub', p.sub);
  root.setProperty('--btn-grad', 'linear-gradient(135deg,' + p.accent + ',' + p.cyan2 + ')');
  root.setProperty('--btn-grad-2', 'linear-gradient(135deg,' + p.accent2 + ',' + p.pink2 + ')');
  root.setProperty('--card-hover-glow', p.accent + '44');
  root.setProperty('--glow', p.accent + '59');
  root.setProperty('--nav-bg', 'rgba(10,14,22,.75)');
  root.setProperty('--hud-bg', 'rgba(5,7,10,.85)');
  // grid size (matrix uses 0 0 = hidden grid)
  document.getElementById('bgGrid').style.backgroundSize = p.bgGridSize || '44px 44px';
  // theme color meta (PWA)
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', p.bg);
  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (manifestLink && location.protocol !== 'file:') {
    try {
      fetch('manifest.webmanifest').then(r => r.json()).then(m => {
        if (m) { m.theme_color = p.bg; m.background_color = p.bg; }
      }).catch(() => {});
    } catch (e) {}
  }
}

/* ==================== GAME CORE (disabled — pick favourites later) ==================== */
let game = { id: null, running: false, paused: false, over: false, score: 0, touches: {}, keys: {} };

/* ==================== INIT ==================== */
function init() {
  openAuth();
  navInit();
  initCRT();
  // theme system — apply saved theme + start dynamic particle bg
  globalTheme = state.equipped.theme || 'neon';
  if (typeof applyTheme === 'function') applyTheme(state.equipped.theme || 'neon', true);
  if (typeof initThemeCanvas === 'function') initThemeCanvas();
  // live rotation state (featured/deal/challenge/bots) — safe fallback if missing
  loadLive(() => { try { go('home'); } catch (e) {} });
  // PWA offline support
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
  // hide boot, show UI
  document.getElementById('bootLoader').style.display = 'none';
  document.getElementById('topBar').style.display = 'flex';
  document.getElementById('bottomNav').style.display = 'flex';
  document.getElementById('app').style.display = 'block';
  go('home');
  updateCoinDisplay();
  // version badge
  showVersionBadge();
}
document.addEventListener('DOMContentLoaded', init);

// version badge + hero counts stay in sync with version.json automatically
function showVersionBadge() {
  try {
    if (location.protocol === 'file:') return;
    fetch('version.json').then(r => r.json()).then(d => {
      const badge = document.createElement('div');
      badge.style.cssText = 'position:fixed;bottom:8px;right:8px;z-index:5;font-size:9px;opacity:.4;color:var(--sub);font-family:monospace';
      badge.innerText = `v${d.version} · ${d.games} games`;
      document.body.appendChild(badge);
      // keep hero copy truthful without hand-editing
      const gc = document.getElementById('heroGameCount');
      if (gc) gc.innerText = d.games;
      const sg = document.getElementById('heroStatGames');
      if (sg) sg.innerText = d.games + '+';
      const hsc = document.getElementById('heroSubCount');
      if (hsc) hsc.innerText = d.games + ' GAMES · PLAY INSTANTLY';
      // page title too
      if (d.games) document.title = document.title.replace(/\d+ Games/, d.games + ' Games');
    });
  } catch (e) {}
}
