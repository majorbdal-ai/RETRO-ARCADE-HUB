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
  best: 'rah_best'
};
const store = {
  get(key, def) { try { const v = localStorage.getItem(key); return v === null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
};

/* ==================== STATE ==================== */
let state = {
  coins: store.get(K.coins, 0),
  profile: store.get(K.profile, { username: 'BIMAN_USER_92', level: 1, wins: 0, avatar: '👤', xp: 0 }),
  scores: store.get(K.scores, {}), // { gameId: [ {score, at}, ... ] }
  inventory: store.get(K.inventory, []), // owned item ids
  equipped: store.get(K.equipped, { skin: null, vehicle: null, effect: null, theme: 'neon' }),
  daily: store.get(K.daily, {}),
  stats: store.get(K.stats, { gamesPlayed: 0, totalScore: 0, bestCombo: 0 }),
  best: store.get(K.best, {}) // { gameId: bestScore }
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
  { id: 'math-dash',     name: 'MATH DASH',      icon: '🧮', color: '#22D3EE', desc: 'Solve fast math under the timer', featured: false, type: 'math', cat: 'Retro', controls: 'tap-4' }
];


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
function confirmDelete() {
  const v = document.getElementById('deleteInput').value.trim();
  if (v.toUpperCase() !== 'DELETE') { toast('Type DELETE to confirm'); return; }
  Object.values(K).forEach(k => localStorage.removeItem(k));
  state = { coins: 0, profile: { username: 'BIMAN_USER_92', level: 1, wins: 0, avatar: '👤', xp: 0 }, scores: {}, inventory: [], equipped: { skin: null, vehicle: null, effect: null, theme: 'neon' }, daily: {}, stats: { gamesPlayed: 0, totalScore: 0, bestCombo: 0 }, best: {} };
  closeDeleteModal();
  toast('Account deleted');
  go('home'); updateCoinDisplay();
}
/* ==================== RENDER: HOME ==================== */
function comingSoon(name, e) {
  if (e) e.stopPropagation();
  toast(name + ' — coming soon! Pick your favourites 👑');
}
function renderHome() {
  const feat = GAMES.filter(g => g.featured);
  document.getElementById('featuredGrid').innerHTML = feat.map((g, i) => `
    <div class="featured-card" style="background:linear-gradient(145deg,${g.color}33,#0A0E16 65%)">
      <div class="f-ico" style="color:${g.color}">${g.icon}</div>
      <span class="badge" style="position:absolute;top:10px;right:10px">${engineReady(g.id) ? 'PLAY' : 'SOON'}</span>
      <h3>${g.name}</h3>
      <p style="font-size:10px;color:var(--sub)">${g.desc}</p>
      <button class="btn btn-primary play-btn" style="padding:7px 14px;font-size:11px" onclick="playGame('${g.id}')">${engineReady(g.id) ? '▶ PLAY NOW' : 'COMING SOON'}</button>
    </div>`).join('');
  renderGameGrid('');
}
// current category filter
let currentCatFilter = 'ALL';

function renderGameGrid(filter = '', cat = '') {
  const q = (filter || '').toLowerCase();
  const c = (cat || currentCatFilter).toUpperCase();
  let list = GAMES;
  if (q) list = list.filter(g => g.name.toLowerCase().includes(q) || g.desc.toLowerCase().includes(q));
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
  const g2 = document.getElementById('arcadeGrid');
  if (g1) g1.innerHTML = html;
  if (g2) g2.innerHTML = html;
}

function renderArcadeGrid(filter = '') {
  renderGameGrid(filter);
  // render category filter chips
  const wrap = document.getElementById('catFilter');
  if (!wrap) return;
  const cats = ['ALL', ...new Set(GAMES.map(g => g.cat).filter(Boolean).sort())];
  wrap.innerHTML = cats.map(c => {
    const active = currentCatFilter.toUpperCase() === c.toUpperCase();
    return `<button class="cat-chip ${active ? 'active' : ''}" onclick="setCatFilter('${c}')" style="padding:6px 12px;border-radius:999px;font-size:10px;font-weight:700;border:none;cursor:pointer;background:${active ? 'var(--pink)' : 'rgba(255,255,255,.08)'};color:${active ? '#fff' : 'var(--text)'};white-space:nowrap">${c}</button>`;
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
  const items = SHOP_ITEMS[tab] || [];
  const ownerType = tab === 'skins' ? 'skin' : tab === 'vehicles' ? 'vehicle' : tab === 'effects' ? 'effect' : 'booster';
  document.getElementById('shopItems').innerHTML = items.map(it => {
    const owned = state.inventory.includes(it.id);
    const equipped = state.equipped[ownerType] === it.id;
    return `
    <div class="card shop-item">
      <div class="s-ico" style="border-color:${it.price > 1000 ? '#FFE600' : 'rgba(255,255,255,.15)'}">${it.ico}</div>
      <div class="s-info">
        <h4>${it.name}</h4>
        <p>${it.desc}</p>
      </div>
      <div>
        ${owned
          ? `<button class="btn ${equipped ? 'btn-ghost' : 'btn-primary'}" style="padding:8px 12px;font-size:11px" onclick="equipItem('${it.id}','${ownerType}')">${equipped ? 'EQUIPPED ✓' : 'EQUIP'}</button>`
          : `<button class="btn btn-yellow" style="padding:8px 12px;font-size:11px" onclick="buyItem('${it.id}','${ownerType}',${it.price})"><i class="fa-solid fa-coins"></i>${it.price.toLocaleString()}</button>`}
      </div>
    </div>`;
  }).join('');
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
  let list = BOTS.map(b => ({ ...b, me: false }));
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
  document.getElementById('avatarBig').innerText = p.avatar || '👤';
  document.getElementById('playerName').innerText = p.username;
  document.getElementById('playerLevel').innerText = 'LVL ' + p.level + (p.level >= 30 ? ' VIP' : '');
  document.getElementById('statWins').innerText = p.wins;
  document.getElementById('statCoins').innerText = state.coins.toLocaleString();
  document.getElementById('statSkins').innerText = skinsOwned + '/24';
  const achDone = Math.min(20, Math.round(p.wins * 0.5 + skinsOwned));
  document.getElementById('achCount').innerText = achDone + '/20';
  document.getElementById('achBar').style.width = (achDone / 20 * 100) + '%';
  const achs = [
    { ico: '🏆', name: 'FIRST WIN', done: p.wins >= 1 },
    { ico: '⚡', name: 'SPEED DEMON', done: (state.stats.bestCombo || 0) >= 8 },
    { ico: '💎', name: 'COLLECTOR', done: skinsOwned >= 5 },
    { ico: '🔥', name: 'COMBO MASTER', done: (state.stats.bestCombo || 0) >= 12 },
    { ico: '🎯', name: 'SHARPSHOOTER', done: p.wins >= 5 },
    { ico: '👑', name: 'KING OF ARCADE', done: p.wins >= 10 }
  ];
  document.getElementById('achList').innerHTML = achs.map(a => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)">
      <span style="font-size:18px;opacity:${a.done ? 1 : .35}">${a.ico}</span>
      <span style="flex:1;font-size:13px;color:${a.done ? '#fff' : 'var(--sub)'}">${a.name}</span>
      <span style="font-size:10px;font-weight:700;color:${a.done ? 'var(--green)' : 'var(--sub)'}">${a.done ? 'DONE ✓' : 'LOCKED 🔒'}</span>
    </div>`).join('');
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
  'dino-run': 'sunset', 'sling-birds': 'void', 'hill-climb': 'sunset',
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
    yellow:'#B8FF5C', yellow2:'#7FDB39', green:'#39FF88', red:'#FF5C5C',
    accent:'#22FF88', accent2:'#00FFAA', glass:'rgba(255,255,255,.05)',
    glassBorder:'rgba(34,255,136,.35)', panel:'#02130A', sub:'#7BCBA0',
    bgGridSize:'0 0' } },
  { id: 'royal',  name: 'GOLD ROYAL',  ico: '👑', desc: 'Gold & black luxury',      price: 1000, palette: {
    bg:'#070600', glow1:'rgba(255,215,0,.09)', glow2:'rgba(128,0,128,.06)',
    grid:'rgba(255,215,0,.05)', gridv:'rgba(128,0,128,.04)',
    cyan:'#FFD700', cyan2:'#FFB300', pink:'#E6B800', pink2:'#B8860B',
    yellow:'#FFD700', yellow2:'#FFAA00', green:'#FFC107', red:'#E53935',
    accent:'#FFD700', accent2:'#E6B800', glass:'rgba(255,255,255,.06)',
    glassBorder:'rgba(255,215,0,.4)', panel:'#0E0B00', sub:'#A89060',
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

/* Dynamic particle / neon-arc background canvas — theme-aware */
let themeBgCtx = null, themeBgRaf = null, themeParticles = [];
function initThemeCanvas() {
  const c = document.getElementById('themeCanvas');
  if (!c || !c.getContext) return;
  themeBgCtx = c.getContext('2d');
  const size = () => { c.width = innerWidth; c.height = innerHeight; };
  size();
  addEventListener('resize', size);
  // spawn particles (arcs + dots) based on current palette — capped for perf
  themeParticles = [];
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
  // pause the canvas when tab hidden (perf)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopThemeCanvas();
    else if (!themeBgRaf) themeBgRaf = requestAnimationFrame(themeBgLoop);
  });
  themeBgRaf = requestAnimationFrame(themeBgLoop);
}
function themeBgLoop() {
  const ctx = themeBgCtx; if (!ctx) return;
  const c = document.getElementById('themeCanvas');
  const W = c.width, H = c.height;
  ctx.clearRect(0, 0, W, H);
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00FFFF';
  const accent2 = getComputedStyle(document.documentElement).getPropertyValue('--accent2').trim() || '#FF10F0';
  // draw connecting lines between near particles (neon web)
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
    ctx.globalAlpha = .4 + .3 * Math.sin(p.pulse);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  themeBgRaf = requestAnimationFrame(themeBgLoop);
}
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

// version badge
function showVersionBadge() {
  try {
    if (location.protocol === 'file:') return;
    fetch('version.json').then(r => r.json()).then(d => {
      const badge = document.createElement('div');
      badge.style.cssText = 'position:fixed;bottom:8px;right:8px;z-index:5;font-size:9px;opacity:.4;color:var(--sub);font-family:monospace';
      badge.innerText = `v${d.version} · ${d.games} games`;
      document.body.appendChild(badge);
    });
  } catch (e) {}
}
