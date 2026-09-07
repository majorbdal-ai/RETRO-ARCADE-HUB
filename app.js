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

/* ==================== 15 GAMES ==================== */
const GAMES = [
  { id: 'neon-racer',  name: 'NEON RACER',   icon: '🏎️', color: '#00FFFF', desc: 'Dodge cars, grab stars, nitro 2x', featured: true,  type: 'racer',  controls: 'Left/Right steer · B/Shift Nitro' },
  { id: 'cyber-shooter', name: 'CYBER SHOOTER', icon: '🚀', color: '#FF10F0', desc: 'Blast alien armadas, combo kills', featured: true, type: 'shooter', controls: 'Left/Right move · Space shoot' },
  { id: 'pixel-dungeon', name: 'PIXEL DUNGEON', icon: '🗡️', color: '#FFE600', desc: 'Descend, dodge traps, grab loot', featured: true, type: 'dungeon', controls: 'Left/Right move · Space jump' },
  { id: 'light-cycle', name: 'LIGHT CYCLE', icon: '🏍️', color: '#39FF88', desc: 'Tron-style grid duel — don\'t crash', featured: true, type: 'cycle', controls: 'Arrows turn · avoid walls' },
  { id: 'neon-snake', name: 'NEON SNAKE', icon: '🐍', color: '#22D3EE', desc: 'Glowing classic, speed up each food', featured: false, type: 'snake', controls: 'Arrows turn' },
  { id: 'brick-breaker', name: 'BRICK BREAKER', icon: '🧱', color: '#F59E0B', desc: 'Paddle-ball, clear boards, turbo', featured: false, type: 'breaker', controls: 'Left/Right · Space launch' },
  { id: 'cyber-pong', name: 'CYBER PONG', icon: '🏓', color: '#10B981', desc: 'Speed-increasing rally vs AI', featured: false, type: 'pong', controls: 'Up/Down move paddle' },
  { id: 'neon-flappy', name: 'NEON FLAPPY', icon: '🐦', color: '#D946EF', desc: 'Flap a neon ship through columns', featured: false, type: 'flappy', controls: 'Space/tap to flap' },
  { id: 'cyber-racer', name: 'CYBER RACER', icon: '🛞', color: '#EC4899', desc: 'Highway dodge, coins, nitro flames', featured: false, type: 'racer2', controls: 'Left/Right · B Nitro' },
  { id: 'galaxy-invaders', name: 'GALAXY INVADERS', icon: '👾', color: '#A855F7', desc: 'Classic invaders, waves, shields', featured: false, type: 'invaders', controls: 'Left/Right · Space shoot' },
  { id: 'volley-clash', name: 'VOLLEY CLASH', icon: '🏐', color: '#F97316', desc: '2-player volleyball rally', featured: false, type: 'volley', controls: 'A/D or Left/Right' },
  { id: 'astro-hop', name: 'ASTRO HOP', icon: '👨‍🚀', color: '#38BDF8', desc: 'Platform hopper with gravity bounce', featured: false, type: 'hopper', controls: 'Left/Right · Space jump' },
  { id: 'laser-maze', name: 'LASER MAZE', icon: '🔦', color: '#FDE047', desc: 'Slide through moving laser walls', featured: false, type: 'maze', controls: 'Arrows move' },
  { id: 'coin-catch', name: 'COIN CATCH', icon: '🪙', color: '#FBBF24', desc: 'Catch coins, avoid bombs', featured: false, type: 'catch', controls: 'Left/Right move' },
  { id: 'space-miner', name: 'SPACE MINER', icon: '⛏️', color: '#94A3B8', desc: 'Mine asteroids, avoid hazards', featured: false, type: 'miner', controls: 'Arrows move · Space dig' }
];

/* ==================== NAVIGATION ==================== */
const PAGES = ['home', 'arcade', 'shop', 'board', 'profile', 'store', 'themes', 'game'];
function go(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');
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
  const h = document.getElementById('hudCoins');
  if (h) h.innerText = state.coins.toLocaleString();
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
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
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
function renderHome() {
  const feat = GAMES.filter(g => g.featured);
  document.getElementById('featuredGrid').innerHTML = feat.map((g, i) => `
    <div class="featured-card" style="background:linear-gradient(145deg,${g.color}33,#0A0E16 65%)" onclick="launchGame('${g.id}')">
      <div class="f-ico" style="color:${g.color}">${g.icon}</div>
      <h3>${g.name}</h3>
      <p style="font-size:10px;color:var(--sub)">${g.desc}</p>
      <button class="btn btn-primary play-btn" style="padding:7px 14px;font-size:11px">PLAY →</button>
    </div>`).join('');
  renderGameGrid('');
}
function renderGameGrid(filter = '') {
  const q = (filter || '').toLowerCase();
  const list = GAMES.filter(g => !q || g.name.toLowerCase().includes(q) || g.desc.toLowerCase().includes(q));
  const html = list.map(g => `
    <div class="card game-card" onclick="launchGame('${g.id}')">
      <div class="thumb" style="border-color:${g.color}55;box-shadow:0 0 14px ${g.color}22">${g.icon}</div>
      <h4>${g.name}</h4>
      <p>${g.desc}</p>
      <p style="margin-top:5px;color:${g.color};font-size:10px;font-weight:700">${g.controls}</p>
    </div>`).join('');
  const g1 = document.getElementById('gameGrid');
  const g2 = document.getElementById('arcadeGrid');
  if (g1) g1.innerHTML = html;
  if (g2) g2.innerHTML = html;
}

/* ==================== RENDER: ARCADE ==================== */
function renderArcadeGrid(filter = '') {
  renderGameGrid(filter);
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

/* ==================== THEMES ==================== */
const THEMES = [
  { id: 'neon', name: 'NEON CYBER', ico: '🌆', desc: 'Default cyan/pink glow', price: 0 },
  { id: 'void', name: 'VOID DARK', ico: '🌑', desc: 'Pure black, minimal neon', price: 0 },
  { id: 'sunset', name: 'RETRO SUNSET', ico: '🌇', desc: 'Orange/purple retro vibe', price: 400 },
  { id: 'matrix', name: 'MATRIX GREEN', ico: '💚', desc: 'Green rain terminal look', price: 600 },
  { id: 'royal', name: 'GOLD ROYAL', ico: '👑', desc: 'Gold & black luxury', price: 1000 }
];
function renderThemes() {
  document.getElementById('themeList').innerHTML = THEMES.map(t => {
    const owned = t.price === 0 || state.inventory.includes('theme-' + t.id);
    const active = state.equipped.theme === t.id;
    return `
    <div class="card shop-item">
      <div class="s-ico" style="border-color:${active ? '#00FFFF' : 'rgba(255,255,255,.15)'};box-shadow:${active ? '0 0 16px rgba(0,255,255,.4)' : 'none'}">${t.ico}</div>
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
function applyTheme(id, silent) {
  state.equipped.theme = id;
  saveState();
  if (!silent) toast('Theme applied!');
  const root = document.documentElement.style;
  if (id === 'neon') { root.setProperty('--bg', '#05070A'); root.setProperty('--pink', '#FF10F0'); }
  else if (id === 'void') { root.setProperty('--bg', '#000000'); root.setProperty('--pink', '#8B5CF6'); }
  else if (id === 'sunset') { root.setProperty('--bg', '#0B0608'); root.setProperty('--pink', '#FF6B35'); }
  else if (id === 'matrix') { root.setProperty('--bg', '#020804'); root.setProperty('--pink', '#22FF88'); }
  else if (id === 'royal') { root.setProperty('--bg', '#070600'); root.setProperty('--pink', '#FFD700'); }
  document.getElementById('bgGrid').style.backgroundSize = id === 'matrix' ? '0 0' : '44px 44px';
}

/* ==================== GAME CORE ==================== */
let game = {
  id: null, running: false, paused: false, over: false,
  score: 0, level: 1, combo: 0, bestCombo: 0,
  coinsEarned: 0, boosters: {}, cfg: null, keys: {}, touches: {},
  ctx: null, raf: null, last: 0, acc: 0, dtFixed: 1000 / 60,
  canvasW: 800, canvasH: 450
};
const TUT = {
  'neon-racer': 'Left/Right steer · B/Shift = Nitro 2x score',
  'cyber-shooter': 'Left/Right move · Space shoot · Combo = bonus',
  'pixel-dungeon': 'Move with Left/Right · Space jump · Dodge traps',
  'light-cycle': 'Arrows turn · Don\'t crash into walls or yourself',
  'neon-snake': 'Arrows turn · Eat food · Speed grows',
  'brick-breaker': 'Left/Right paddle · Space launch · Turbo = B',
  'cyber-pong': 'Up/Down move · First to reach wins',
  'neon-flappy': 'Space/tap to flap · Pass columns',
  'cyber-racer': 'Left/Right steer · B Nitro · Grab coins',
  'galaxy-invaders': 'Left/Right move · Space shoot · Waves',
  'volley-clash': 'A/D or Left/Right move · Ball physics',
  'astro-hop': 'Left/Right · Space jump · Let\'s bounce',
  'laser-maze': 'Arrows slide · Dodge moving lasers',
  'coin-catch': 'Left/Right catch coins · Dodge bombs',
  'space-miner': 'Arrows move · Space mine · Avoid hazards'
};
function launchGame(id) {
  const g = GAMES.find(x => x.id === id);
  if (!g) return;
  game.id = id; game.running = true; game.paused = false; game.over = false;
  game.score = 0; game.level = 1; game.combo = 0; game.bestCombo = 0; game.coinsEarned = 0;
  game.keys = {}; game.touches = {}; game.parts = [];
  game.boosters = { shield: state.inventory.includes('boost-shield'), slow: state.inventory.includes('boost-slow'), x2: state.inventory.includes('boost-2x') };
  // (re)init engine state
  if (ENGINES[id] && ENGINES[id].init) ENGINES[id].init(game);
  go('game');
  document.getElementById('hudGameTitle').innerText = g.name + ' - LEVEL ' + game.level;
  document.getElementById('hudScore').innerText = '0';
  document.getElementById('hudCoins').innerText = state.coins.toLocaleString();
  const c = document.getElementById('gameCanvas');
  c.width = game.canvasW; c.height = game.canvasH;
  showTutorial(g.controls);
  if (isTouchDevice()) showTouchControls(true);
  startLoop();
  setGameCanvasSize();
}
function setGameCanvasSize() {
  const wrap = document.getElementById('gameCanvasWrap');
  const c = document.getElementById('gameCanvas');
  const w = wrap.clientWidth, h = wrap.clientHeight;
  const scale = Math.min(w / game.canvasW, h / game.canvasH);
  c.style.width = (game.canvasW * scale) + 'px';
  c.style.height = (game.canvasH * scale) + 'px';
}
window.addEventListener('resize', () => { if (game.running) setGameCanvasSize(); });
function showTutorial(text) {
  const t = document.createElement('div');
  t.id = 'tutTip';
  t.style.cssText = 'position:absolute;bottom:14px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.8);border:1px solid rgba(0,255,255,.4);color:#fff;font-size:11px;padding:8px 14px;border-radius:99px;z-index:90;white-space:nowrap;pointer-events:none;transition:opacity .5s';
  t.innerText = text;
  const w = document.getElementById('gameCanvasWrap');
  w.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 600); }, 4500);
}
function isTouchDevice() { return ('ontouchstart' in window) || navigator.maxTouchPoints > 0; }
function showTouchControls(on) { document.getElementById('touchControls').classList.toggle('show', on); }
function pressed(key, val, e) { if (e) e.preventDefault(); game.touches[key] = val; }
function launchFromHome(id) { launchGame(id); }
function exitToHub() {
  stopLoop();
  game.running = false;
  document.getElementById('touchControls').classList.remove('show');
  go('arcade');
}
function togglePause() {
  if (!game.running || game.over) return;
  game.paused = !game.paused;
  if (game.paused) stopLoop();
  else { game.last = 0; startLoop(); }
}
function restartGame() {
  stopLoop();
  launchGame(game.id);
}
function shareGame() {
  const text = 'I scored ' + game.score.toLocaleString() + ' in ' + (GAMES.find(g => g.id === game.id) || {}).name + ' on RETRO ARCADE HUB! 🎮';
  if (navigator.share) { navigator.share({ text }).catch(() => {}); }
  else { navigator.clipboard && navigator.clipboard.writeText(text).then(() => toast('Copied to clipboard!')); }
}
function startLoop() {
  stopLoop();
  game.ctx = document.getElementById('gameCanvas').getContext('2d');
  const loop = (ts) => {
    if (!game.running || game.paused || game.over) return;
    if (!game.last) game.last = ts;
    let dt = ts - game.last; game.last = ts;
    if (dt > 100) dt = 100;
    game.acc += dt;
    const step = game.dtFixed * (game.boosters.slow ? 1.35 : 1);
    while (game.acc >= step) { updateGame(step / 1000, game); game.acc -= step; }
    renderGame(game);
    game.raf = requestAnimationFrame(loop);
  };
  game.raf = requestAnimationFrame(loop);
}
function stopLoop() { if (game.raf) { cancelAnimationFrame(game.raf); game.raf = null; } }

/* ==================== SCORE / COIN HELPERS ==================== */
function addScore(base, multMax) {
  game.combo = Math.min(game.combo + 1, multMax || 15);
  game.bestCombo = Math.max(game.bestCombo, game.combo);
  const mult = 1 + Math.min(game.combo, 10) * 0.1;
  let pts = Math.round(base * mult * (game.boosters.x2 ? 2 : 1));
  game.score += pts;
  document.getElementById('hudScore').innerText = game.score.toLocaleString();
  if (mult > 1.5) popScore(80, 90, 'COMBO x' + mult.toFixed(1) + '!');
  return pts;
}
function addCoinsToState(coins) {
  state.coins += coins; saveState(); updateCoinDisplay();
}
function endGame(win) {
  if (game.over) return;
  game.over = true;
  stopLoop();
  const coins = Math.max(1, Math.floor(game.score * 0.1));
  game.coinsEarned = coins;
  addCoinsToState(coins);
  // stats
  state.stats.gamesPlayed++; state.stats.totalScore += game.score;
  state.stats.bestCombo = Math.max(state.stats.bestCombo, game.bestCombo);
  if (win) state.profile.wins++;
  saveState();
  // best per game
  const prevBest = state.best[game.id] || 0;
  if (game.score > prevBest) state.best[game.id] = game.score;
  saveState();
  document.getElementById('overScore').innerText = game.score.toLocaleString();
  document.getElementById('overCoins').innerText = coins.toLocaleString();
  document.getElementById('overBest').innerText = Math.max(prevBest, game.score).toLocaleString();
  document.getElementById('overLevel').innerText = game.level;
  document.getElementById('gameOverOverlay').classList.add('show');
  syncScore(game.id, game.score); // সার্ভারে সেভ (লগইন থাকলে)
}
function winGame() { endGame(true); }
function loseGame() { endGame(false); }

/* ==================== ROUTE + UPDATE/RENDER DISPATCH ==================== */
function updateGame(dt, g) {
  const fn = ENGINES[g.id];
  if (fn && fn.update) fn.update(dt, g);
}
function renderGame(g) {
  const fn = ENGINES[g.id];
  g.ctx.clearRect(0, 0, g.canvasW, g.canvasH);
  if (fn && fn.render) fn.render(g);
}

/* ==================== GAME ENGINES (15) ==================== */
const ENGINES = {};

/* --- 01 NEON RACER (highway racer) --- */
ENGINES['neon-racer'] = (() => {
  let S = null;
  const init = (g) => { S = { px: 375, py: 330, pw: 45, ph: 75, roadW: 320, scroll: 0, cars: [], coins: [], spawn: 0, cSpawn: 0 }; };
  const update = (dt, g) => {
    const s = S; const boost = g.touches.boost ? 2.2 : 1;
    const speed = 440 * boost;
    const st = 420 * boost;
    if (g.touches.left && s.px > 400 - s.roadW / 2 + 8) s.px -= 430 * dt;
    if (g.touches.right && s.px < 400 + s.roadW / 2 - s.pw - 8) s.px += 430 * dt;
    s.scroll += speed * dt; if (s.scroll > 100) s.scroll -= 100;
    if (boost && Math.random() < 0.5) {
      spawnP(g, s.px + 8, s.py + s.ph + 4, 0, 240, '#FFE600');
      spawnP(g, s.px + s.pw - 8, s.py + s.ph + 4, 0, 240, '#FF10F0');
    }
    g.score += (boost ? 2 : 1);
    document.getElementById('hudScore').innerText = g.score.toLocaleString();
    s.spawn -= dt;
    if (s.spawn <= 0) {
      const lanes = [400 - 105, 400 - 35, 400 + 35, 400 + 105];
      s.cars.push({ x: lanes[Math.floor(Math.random() * 4)] - 20, y: -90, w: 42, h: 72, c: ['#3B82F6', '#10B981', '#A855F7', '#EC4899'][Math.floor(Math.random() * 4)] });
      s.spawn = 0.8 + Math.random() * 0.7;
    }
    s.cSpawn -= dt;
    if (s.cSpawn <= 0) {
      const lanes = [400 - 105, 400 - 35, 400 + 35, 400 + 105];
      s.coins.push({ x: lanes[Math.floor(Math.random() * 4)], y: -30, r: 9 });
      s.cSpawn = 1.2 + Math.random() * 1.8;
    }
    s.coins.forEach(c => { c.y += speed * dt; });
    for (let i = s.coins.length - 1; i >= 0; i--) {
      const c = s.coins[i];
      if (c.x > s.px - c.r && c.x < s.px + s.pw + c.r && c.y > s.py - c.r && c.y < s.py + s.ph + c.r) {
        g.score += 60; document.getElementById('hudScore').innerText = g.score.toLocaleString();
        s.coins.splice(i, 1); coinsBurst(g, c.x, c.y); playTone(880, 0.08, 'triangle');
      } else if (c.y > 480) s.coins.splice(i, 1);
    }
    s.cars.forEach(e => { e.y += (speed - e.speed) * dt * 0.6; });
    // relative speed: cars scroll down slower than road => move up slightly
    for (let i = s.cars.length - 1; i >= 0; i--) {
      const e = s.cars[i];
      if (e.y > 480) { s.cars.splice(i, 1); continue; }
      if (s.px + 4 < e.x + e.w && s.px + s.pw - 4 > e.x && s.py + 4 < e.y + e.h && s.py + s.ph - 4 > e.y) {
        boom(g, s.px + s.pw / 2, s.py + s.ph / 2); loseGame(); return;
      }
    }
  };
  const render = (g) => {
    const s = S, ctx = g.ctx;
    ctx.fillStyle = '#06080F'; ctx.fillRect(0, 0, 800, 450);
    ctx.fillStyle = '#111622'; ctx.fillRect(400 - s.roadW / 2, 0, s.roadW, 450);
    ctx.fillStyle = '#DC2626'; ctx.fillRect(400 - s.roadW / 2 - 8, 0, 8, 450); ctx.fillRect(400 + s.roadW / 2, 0, 8, 450);
    const off = s.scroll % 80;
    ctx.fillStyle = '#FFFFFF';
    for (let y = -off; y < 450; y += 80) { ctx.fillRect(400 - s.roadW / 2 - 8, y, 8, 40); ctx.fillRect(400 + s.roadW / 2, y, 8, 40); }
    ctx.fillStyle = '#374151';
    for (let y = -off; y < 450; y += 80) { ctx.fillRect(400 - 45, y, 4, 40); ctx.fillRect(400 + 45, y, 4, 40); }
    s.coins.forEach(c => { ctx.fillStyle = '#F59E0B'; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 0.4, 0, 7); ctx.fill(); });
    // player
    ctx.fillStyle = '#DC2626'; ctx.fillRect(s.px + 4, s.py + 10, s.pw - 8, s.ph - 15);
    ctx.fillStyle = '#1E293B'; ctx.fillRect(s.px + 8, s.py + 25, s.pw - 16, 15);
    ctx.fillStyle = '#22D3EE'; ctx.fillRect(s.px + 10, s.py + 25, 6, 15);
    ctx.fillStyle = '#000'; ctx.fillRect(s.px - 2, s.py + 12, 6, 14); ctx.fillRect(s.px + s.pw - 4, s.py + 12, 6, 14); ctx.fillRect(s.px - 2, s.py + s.ph - 22, 6, 14); ctx.fillRect(s.px + s.pw - 4, s.py + s.ph - 22, 6, 14);
    ctx.fillStyle = '#FEE2E2'; ctx.fillRect(s.px + 6, s.py + 8, 8, 3); ctx.fillRect(s.px + s.pw - 14, s.py + 8, 8, 3);
    s.cars.forEach(e => {
      ctx.fillStyle = e.c; ctx.fillRect(e.x + 4, e.y + 10, e.w - 8, e.h - 15);
      ctx.fillStyle = '#1E293B'; ctx.fillRect(e.x + 8, e.y + e.h - 35, e.w - 16, 12);
      ctx.fillStyle = '#000'; ctx.fillRect(e.x - 2, e.y + 12, 6, 14); ctx.fillRect(e.x + e.w - 4, e.y + 12, 6, 14); ctx.fillRect(e.x - 2, e.y + e.h - 22, 6, 14); ctx.fillRect(e.x + e.w - 4, e.y + e.h - 22, 6, 14);
    });
    drawParts(g);
  };
  return { init, update, render };
})();

/* --- 02 CYBER SHOOTER --- */
ENGINES['cyber-shooter'] = (() => {
  let S = null;
  const init = (g) => { S = { ship: { x: 375, y: 385, w: 50, h: 26 }, bullets: [], enemies: [], stars: [], cd: 0, spawn: 0 }; for (let i = 0; i < 50; i++) S.stars.push({ x: Math.random() * 800, y: Math.random() * 450, s: 0.5 + Math.random() * 2, v: 40 + Math.random() * 120 }); };
  const update = (dt, g) => {
    const s = S;
    if (g.touches.left && s.ship.x > 0) s.ship.x -= 460 * dt;
    if (g.touches.right && s.ship.x < 800 - s.ship.w) s.ship.x += 460 * dt;
    s.cd -= dt;
    if (g.touches.action && s.cd <= 0) { s.bullets.push({ x: s.ship.x + s.ship.w / 2 - 3, y: s.ship.y, w: 6, h: 14, v: 560 }); s.cd = 0.18; playTone(880, 0.06, 'square', 0.03); }
    s.spawn -= dt;
    if (s.spawn <= 0) { s.enemies.push({ x: 30 + Math.random() * 740, y: -30, w: 36, h: 26, v: 150 + Math.random() * 100, off: Math.random() * 10, sv: 1 + Math.random() * 3 }); s.spawn = 0.5 + Math.random() * 0.4; }
    s.bullets.forEach(b => b.y -= b.v * dt); s.bullets = s.bullets.filter(b => b.y > -20);
    s.enemies.forEach(e => { e.y += e.v * dt; e.x += Math.sin(e.y * 0.015 + e.off) * 0.8; });
    for (let bi = s.bullets.length - 1; bi >= 0; bi--) {
      const b = s.bullets[bi];
      for (let ei = s.enemies.length - 1; ei >= 0; ei--) {
        const e = s.enemies[ei];
        if (b.x < e.x + e.w && b.x + b.w > e.x && b.y < e.y + e.h && b.y + b.h > e.y) {
          boom(g, e.x + e.w / 2, e.y + e.h / 2); playTone(520, 0.1, 'triangle', 0.05);
          s.bullets.splice(bi, 1); s.enemies.splice(ei, 1);
          addScore(10);
          break;
        }
      }
    }
    for (let ei = s.enemies.length - 1; ei >= 0; ei--) {
      const e = s.enemies[ei];
      if (e.y > 455 || (e.x < s.ship.x + s.ship.w && e.x + e.w > s.ship.x && e.y < s.ship.y + s.ship.h && e.y + e.h > s.ship.y)) { boom(g, s.ship.x + 25, s.ship.y + 13); loseGame(); return; }
      if (e.y > 470) s.enemies.splice(ei, 1);
    }
    s.stars.forEach(st => { st.y += st.v * dt; if (st.y > 450) { st.y = 0; st.x = Math.random() * 800; } });
  };
  const render = (g) => {
    const s = S, ctx = g.ctx;
    ctx.fillStyle = '#0B0E14'; ctx.fillRect(0, 0, 800, 450);
    ctx.fillStyle = '#fff'; s.stars.forEach(st => { ctx.globalAlpha = st.v / 160; ctx.fillRect(st.x, st.y, st.s, st.s); }); ctx.globalAlpha = 1;
    // ship
    ctx.fillStyle = '#FF3B7C'; ctx.beginPath(); ctx.moveTo(s.ship.x + 25, s.ship.y); ctx.lineTo(s.ship.x + s.ship.w, s.ship.y + s.ship.h); ctx.lineTo(s.ship.x + s.ship.w - 8, s.ship.y + s.ship.h); ctx.lineTo(s.ship.x + 25, s.ship.y + s.ship.h - 6); ctx.lineTo(s.ship.x + 8, s.ship.y + s.ship.h); ctx.lineTo(s.ship.x, s.ship.y + s.ship.h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#22D3EE'; ctx.beginPath(); ctx.moveTo(s.ship.x + 25, s.ship.y + 6); ctx.lineTo(s.ship.x + 30, s.ship.y + 16); ctx.lineTo(s.ship.x + 20, s.ship.y + 16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#22D3EE'; s.bullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));
    ctx.fillStyle = '#A855F7'; s.enemies.forEach(e => { ctx.fillRect(e.x + 4, e.y, e.w - 8, e.h - 8); ctx.fillRect(e.x, e.y + 6, 4, e.h - 12); ctx.fillRect(e.x + e.w - 4, e.y + 6, 4, e.h - 12); });
    drawParts(g);
  };
  return { init, update, render };
})();

/* --- 03 PIXEL DUNGEON --- */
ENGINES['pixel-dungeon'] = (() => {
  let S = null;
  const init = (g) => { S = { p: { x: 380, y: 320, w: 30, h: 30, vy: 0, on: true }, lava: [], doors: [], score: 0, spawn: 0.6, best: 0, at: 0 }; };
  const update = (dt, g) => {
    const s = S;
    if (g.touches.left && s.p.x > 10) s.p.x -= 300 * dt;
    if (g.touches.right && s.p.x < 760) s.p.x += 300 * dt;
    if (g.touches.action && s.p.on) { s.p.vy = -520; s.p.on = false; }
    s.p.vy += 1300 * dt; s.p.y += s.p.vy * dt;
    if (s.p.y >= 320) { s.p.y = 320; s.p.vy = 0; s.p.on = true; }
    if (s.p.y <= 10) s.p.y = 10;
    s.spawn -= dt;
    if (s.spawn <= 0) {
      if (Math.random() < 0.7) s.lava.push({ x: 800, w: 50 + Math.random() * 90, h: 14, y: 300 + Math.random() * 90, v: 260 + Math.random() * 120 });
      else s.doors.push({ x: 800, h: 200, gapY: 100 + Math.random() * 200, v: 200 });
      s.spawn = 0.6 + Math.random() * 0.5;
    }
    s.lava.forEach(l => l.x -= l.v * dt); s.lava = s.lava.filter(l => l.x > -100);
    s.doors.forEach(d => d.x -= d.v * dt); s.doors = s.doors.filter(d => d.x > -100);
    for (const l of s.lava) { if (s.p.x + 8 < l.x + l.w && s.p.x + s.p.w - 8 > l.x && s.p.y + s.p.h > l.y && s.p.y < l.y + l.h) { boom(g, s.p.x + 15, s.p.y + 15); loseGame(); return; } }
    for (const d of s.doors) { if (s.p.x + s.p.w > d.x && s.p.x < d.x + 40) { const top = d.gapY, bot = d.gapY + 90; if (s.p.y < top || s.p.y + s.p.h > bot) { boom(g, s.p.x + 15, s.p.y + 15); loseGame(); return; } } }
    g.score += 1; document.getElementById('hudScore').innerText = g.score.toLocaleString();
  };
  const render = (g) => {
    const s = S, ctx = g.ctx;
    ctx.fillStyle = '#0A0B12'; ctx.fillRect(0, 0, 800, 450);
    ctx.fillStyle = '#191B26'; ctx.fillRect(0, 320, 800, 130);
    s.lava.forEach(l => { ctx.fillStyle = '#FF4500'; ctx.fillRect(l.x, l.y, l.w, l.h); ctx.fillStyle = '#FFE600'; ctx.fillRect(l.x, l.y, l.w, 4); });
    s.doors.forEach(d => { ctx.fillStyle = '#8B5CF6'; ctx.fillRect(d.x, 0, 40, d.gapY); ctx.fillRect(d.x, d.gapY + 90, 40, 450 - d.gapY - 90); ctx.fillStyle = '#C4B5FD'; ctx.fillRect(d.x, d.gapY, 40, 4); ctx.fillRect(d.x, d.gapY + 90, 40, 4); });
    ctx.fillStyle = '#39FF88'; ctx.fillRect(s.p.x, s.p.y, s.p.w, s.p.h); ctx.fillStyle = '#FF10F0'; ctx.fillRect(s.p.x + 6, s.p.y - 8, 18, 8);
    drawParts(g);
  };
  return { init, update, render };
})();

/* --- 04 LIGHT CYCLE --- */
ENGINES['light-cycle'] = (() => {
  let S = null;
  const init = (g) => { S = { x: 400, y: 400, dx: 0, dy: -22, trail: [], grid: Array.from({ length: Math.ceil(450 / 22) }, () => Array(Math.ceil(800 / 22)).fill(0)), dead: false, step: 0 }; };
  const update = (dt, g) => {
    const s = S;
    if (g.touches.left && s.dx === 0) { s.dx = -22; s.dy = 0; }
    if (g.touches.right && s.dx === 0) { s.dx = 22; s.dy = 0; }
    if (g.touches.up && s.dy === 0) { s.dx = 0; s.dy = -22; }
    if (g.touches.down && s.dy === 0) { s.dx = 0; s.dy = 22; }
    s.step += dt;
    if (s.step >= 0.09) {
      s.step -= 0.09;
      s.x += s.dx; s.y += s.dy;
      const gx = Math.floor(s.x / 22), gy = Math.floor(s.y / 22);
      if (s.x < 0 || s.x >= 800 || s.y < 0 || s.y >= 450 || s.grid[gy] && s.grid[gy][gx]) { loseGame(); return; }
      s.grid[gy][gx] = 1; s.trail.push({ x: s.x, y: s.y });
      g.score += 2; document.getElementById('hudScore').innerText = g.score.toLocaleString();
    }
  };
  const render = (g) => {
    const s = S, ctx = g.ctx;
    ctx.fillStyle = '#02040A'; ctx.fillRect(0, 0, 800, 450);
    ctx.strokeStyle = 'rgba(0,255,255,.06)'; ctx.lineWidth = 1;
    for (let x = 0; x < 800; x += 22) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 450); ctx.stroke(); }
    for (let y = 0; y < 450; y += 22) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(800, y); ctx.stroke(); }
    ctx.fillStyle = '#00FFFF';
    s.trail.forEach(t => ctx.fillRect(t.x - 8, t.y - 8, 16, 16));
    ctx.fillStyle = '#FF10F0'; ctx.beginPath(); ctx.arc(s.x, s.y, 10, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, 7); ctx.fill();
    drawParts(g);
  };
  return { init, update, render };
})();

/* --- 05 NEON SNAKE --- */
ENGINES['neon-snake'] = (() => {
  let S = null;
  const init = (g) => { S = { snake: [{ x: 160, y: 160 }, { x: 140, y: 160 }, { x: 120, y: 160 }], food: { x: 300, y: 200 }, dx: 20, dy: 0, t: 0, interval: 0.1, q: [] }; spawnFood(); };
  const spawnFood = () => {
    if (!S) return;
    let ok = false;
    while (!ok) {
      S.food.x = Math.floor(Math.random() * 39) * 20 + 10;
      S.food.y = Math.floor(Math.random() * 21) * 20 + 10;
      ok = true;
      for (const p of S.snake) if (p.x === S.food.x && p.y === S.food.y) { ok = false; break; }
    }
  };
  const update = (dt, g) => {
    const s = S;
    if (g.touches.left && s.dx === 0 && s.q[s.q.length - 1] !== 'left') s.q.push('left');
    if (g.touches.right && s.dx === 0 && s.q[s.q.length - 1] !== 'right') s.q.push('right');
    if (g.touches.up && s.dy === 0 && s.q[s.q.length - 1] !== 'up') s.q.push('up');
    if (g.touches.down && s.dy === 0 && s.q[s.q.length - 1] !== 'down') s.q.push('down');
    s.t += dt;
    if (s.t >= s.interval) {
      s.t -= s.interval;
      if (s.q.length) { const d = s.q.shift(); if (d === 'left' && s.dx === 0) { s.dx = -20; s.dy = 0; } else if (d === 'right' && s.dx === 0) { s.dx = 20; s.dy = 0; } else if (d === 'up' && s.dy === 0) { s.dx = 0; s.dy = -20; } else if (d === 'down' && s.dy === 0) { s.dx = 0; s.dy = 20; } }
      const head = { x: s.snake[0].x + s.dx, y: s.snake[0].y + s.dy };
      if (head.x < 0 || head.x >= 800 || head.y < 0 || head.y >= 450) { loseGame(); return; }
      for (const p of s.snake) if (head.x === p.x && head.y === p.y) { loseGame(); return; }
      s.snake.unshift(head);
      if (head.x === s.food.x && head.y === s.food.y) {
        addScore(20); playTone(880, 0.09, 'triangle'); s.interval = Math.max(0.06, s.interval - 0.001);
        spawnFood();
      } else s.snake.pop();
    }
  };
  const render = (g) => {
    const s = S, ctx = g.ctx;
    ctx.fillStyle = '#0B0E14'; ctx.fillRect(0, 0, 800, 450);
    ctx.strokeStyle = '#181E29'; ctx.lineWidth = 1;
    for (let x = 0; x < 800; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 450); ctx.stroke(); }
    for (let y = 0; y < 450; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(800, y); ctx.stroke(); }
    ctx.fillStyle = '#FF3B7C'; ctx.fillRect(s.food.x - 8, s.food.y - 8, 16, 16);
    s.snake.forEach((p, i) => { ctx.fillStyle = i === 0 ? '#22D3EE' : '#3B82F6'; ctx.fillRect(p.x - 9, p.y - 9, 18, 18); });
    drawParts(g);
  };
  return { init, update, render };
})();

/* --- 06 BRICK BREAKER --- */
ENGINES['brick-breaker'] = (() => {
  let S = null;
  const init = (g) => { S = { ball: { x: 400, y: 380, dx: 0, dy: 0, r: 8, active: false }, pad: { x: 350, w: 110 }, bricks: [], cols: 10, rows: 5, bw: 66, bh: 22, padTop: 410, padSpeed: 480, trail: [] }; build(); };
  const build = () => { S.bricks = []; for (let c = 0; c < S.cols; c++) { S.bricks[c] = []; for (let r = 0; r < S.rows; r++) S.bricks[c][r] = { s: 1 }; } };
  const update = (dt, g) => {
    const b = S;
    const speed = g.touches.boost ? 760 : b.padSpeed;
    if (g.touches.left && b.pad.x > 0) b.pad.x -= speed * dt;
    if (g.touches.right && b.pad.x < 800 - b.pad.w) b.pad.x += speed * dt;
    if (!b.ball.active) {
      b.ball.x = b.pad.x + b.pad.w / 2; b.ball.y = b.padTop - b.ball.r - 2;
      if (g.touches.action) { b.ball.active = true; const a = (Math.random() - 0.5) * 1.2; b.ball.dx = Math.cos(a) * 380; b.ball.dy = -Math.abs(Math.sin(a) * 380); }
    } else {
      b.trail.push({ x: b.ball.x, y: b.ball.y }); if (b.trail.length > 10) b.trail.shift();
      b.ball.x += b.ball.dx * dt; b.ball.y += b.ball.dy * dt;
      if (b.ball.x - b.ball.r < 0) { b.ball.x = b.ball.r; b.ball.dx = -b.ball.dx; }
      if (b.ball.x + b.ball.r > 800) { b.ball.x = 800 - b.ball.r; b.ball.dx = -b.ball.dx; }
      if (b.ball.y - b.ball.r < 0) { b.ball.y = b.ball.r; b.ball.dy = -b.ball.dy; }
      if (b.ball.y + b.ball.r >= b.padTop && b.ball.y - b.ball.r <= b.padTop + 14 && b.ball.x >= b.pad.x && b.ball.x <= b.pad.x + b.pad.w) {
        b.ball.y = b.padTop - b.ball.r;
        const rel = (b.ball.x - (b.pad.x + b.pad.w / 2)) / (b.pad.w / 2);
        b.ball.dx = rel * 420; b.ball.dy = -Math.sqrt(Math.max(16000, 420 * 420 - b.ball.dx * b.ball.dx));
        playTone(520, 0.07, 'triangle', 0.04);
      }
      let won = true;
      for (let c = 0; c < b.cols; c++) for (let r = 0; r < b.rows; r++) {
        const br = b.bricks[c][r];
        if (br.s === 1) {
          won = false;
          const bx = c * (b.bw + 8) + 30, by = r * (b.bh + 8) + 50;
          if (b.ball.x + b.ball.r > bx && b.ball.x - b.ball.r < bx + b.bw && b.ball.y + b.ball.r > by && b.ball.y - b.ball.r < by + b.bh) {
            const ol = (b.ball.x + b.ball.r) - bx, or2 = (bx + b.bw) - (b.ball.x - b.ball.r), ot = (b.ball.y + b.ball.r) - by, ob = (by + b.bh) - (b.ball.y - b.ball.r);
            const m = Math.min(ol, or2, ot, ob);
            if (m === ol || m === or2) b.ball.dx = -b.ball.dx; else b.ball.dy = -b.ball.dy;
            br.s = 0; addScore(15); playTone(660, 0.06, 'square', 0.04); boom(g, bx + b.bw / 2, by + b.bh / 2);
          }
        }
      }
      if (won) { g.score += 500; document.getElementById('hudScore').innerText = g.score.toLocaleString(); build(); playTone(880, 0.15, 'square', 0.05); }
      if (b.ball.y > 470) loseGame();
    }
  };
  const render = (g) => {
    const b = S, ctx = g.ctx;
    ctx.fillStyle = '#0B0E14'; ctx.fillRect(0, 0, 800, 450);
    for (let c = 0; c < b.cols; c++) for (let r = 0; r < b.rows; r++) if (b.bricks[c][r].s === 1) {
      const bx = c * (b.bw + 8) + 30, by = r * (b.bh + 8) + 50;
      ctx.fillStyle = r % 2 === 0 ? '#FF3B7C' : '#22D3EE'; ctx.fillRect(bx, by, b.bw, b.bh);
      ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(bx, by, b.bw, 4);
    }
    ctx.fillStyle = '#F59E0B'; ctx.fillRect(b.pad.x, b.padTop, b.pad.w, 12); ctx.fillStyle = '#FBBF24'; ctx.fillRect(b.pad.x, b.padTop, b.pad.w, 3);
    b.trail.forEach((t, i) => { ctx.globalAlpha = i / b.trail.length * 0.35; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(t.x, t.y, b.ball.r * 0.8, 0, 7); ctx.fill(); }); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(b.ball.x, b.ball.y, b.ball.r, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
    drawParts(g);
  };
  return { init, update, render };
})();

/* --- 07 CYBER PONG --- */
ENGINES['cyber-pong'] = (() => {
  let S = null;
  const init = (g) => { S = { ball: { x: 400, y: 225, dx: 260, dy: 160, r: 9 }, pl: { x: 20, y: 180, w: 12, h: 85 }, ai: { x: 768, y: 180, w: 12, h: 85 }, trail: [] }; };
  const update = (dt, g) => {
    const s = S;
    const sp = g.touches.boost ? 700 : 460;
    if (g.touches.up && s.pl.y > 10) s.pl.y -= sp * dt;
    if (g.touches.down && s.pl.y < 450 - s.pl.h - 10) s.pl.y += sp * dt;
    const target = s.ball.y - s.ai.h / 2;
    if (Math.abs(target - s.ai.y) > 12) s.ai.y += Math.sign(target - s.ai.y) * 300 * dt;
    if (s.ai.y < 10) s.ai.y = 10; if (s.ai.y > 450 - s.ai.h - 10) s.ai.y = 450 - s.ai.h - 10;
    s.trail.push({ x: s.ball.x, y: s.ball.y }); if (s.trail.length > 8) s.trail.shift();
    s.ball.x += s.ball.dx * dt; s.ball.y += s.ball.dy * dt;
    if (s.ball.y - s.ball.r < 0) { s.ball.y = s.ball.r; s.ball.dy = -s.ball.dy; }
    if (s.ball.y + s.ball.r > 450) { s.ball.y = 450 - s.ball.r; s.ball.dy = -s.ball.dy; }
    if (s.ball.x - s.ball.r < s.pl.x + s.pl.w && s.ball.x + s.ball.r > s.pl.x && s.ball.y > s.pl.y && s.ball.y < s.pl.y + s.pl.h) {
      s.ball.x = s.pl.x + s.pl.w + s.ball.r;
      const rel = (s.ball.y - (s.pl.y + s.pl.h / 2)) / (s.pl.h / 2);
      s.ball.dx = Math.abs(s.ball.dx) * 1.05; s.ball.dy = rel * 320;
      addScore(10); playTone(520, 0.07, 'triangle', 0.04);
    }
    if (s.ball.x + s.ball.r > s.ai.x && s.ball.x - s.ball.r < s.ai.x + s.ai.w && s.ball.y > s.ai.y && s.ball.y < s.ai.y + s.ai.h) {
      s.ball.x = s.ai.x - s.ball.r;
      const rel = (s.ball.y - (s.ai.y + s.ai.h / 2)) / (s.ai.h / 2);
      s.ball.dx = -Math.abs(s.ball.dx) * 1.05; s.ball.dy = rel * 320;
      playTone(440, 0.06, 'square', 0.03);
    }
    if (s.ball.x < 0) { loseGame(); return; }
    if (s.ball.x > 800) { g.score += 100; document.getElementById('hudScore').innerText = g.score.toLocaleString(); playTone(990, 0.1, 'triangle'); boom(g, 400, 225); s.ball.x = 400; s.ball.y = 225; s.ball.dx = -260; s.ball.dy = (Math.random() - 0.5) * 160; }
  };
  const render = (g) => {
    const s = S, ctx = g.ctx;
    ctx.fillStyle = '#0B0E14'; ctx.fillRect(0, 0, 800, 450);
    ctx.strokeStyle = '#181E29'; ctx.lineWidth = 4; ctx.setLineDash([8, 12]);
    ctx.beginPath(); ctx.moveTo(400, 0); ctx.lineTo(400, 450); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#22D3EE'; ctx.fillRect(s.pl.x, s.pl.y, s.pl.w, s.pl.h);
    ctx.fillStyle = '#FF10F0'; ctx.fillRect(s.ai.x, s.ai.y, s.ai.w, s.ai.h);
    s.trail.forEach((t, i) => { ctx.globalAlpha = i / s.trail.length * 0.35; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(t.x, t.y, s.ball.r * 0.8, 0, 7); ctx.fill(); }); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, s.ball.r, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
    drawParts(g);
  };
  return { init, update, render };
})();

/* --- 08 NEON FLAPPY --- */
ENGINES['neon-flappy'] = (() => {
  let S = null;
  const init = (g) => { S = { ship: { x: 150, y: 200, r: 14, vy: 0 }, pipes: [], spawn: 0, stars: [] }; for (let i = 0; i < 30; i++) S.stars.push({ x: Math.random() * 800, y: Math.random() * 450, s: 1 + Math.random() * 2, v: 25 + Math.random() * 40 }); };
  const update = (dt, g) => {
    const s = S;
    s.ship.vy += 1400 * dt; s.ship.y += s.ship.vy * dt;
    if (Math.random() < 0.4) spawnP(g, s.ship.x - 12, s.ship.y, -160, 0, '#D946EF');
    if (g.touches.action) { s.ship.vy = -440; playTone(700, 0.05, 'square', 0.03); }
    s.spawn -= dt;
    if (s.spawn <= 0) {
      const gap = 150, min = 60, max = 450 - gap - min;
      const top = min + Math.random() * (max - min);
      s.pipes.push({ x: 820, top, bot: 450 - top - gap, w: 60, passed: false });
      s.spawn = 1.9;
    }
    s.pipes.forEach(p => { p.x -= 190 * dt; if (!p.passed && p.x + p.w < s.ship.x) { p.passed = true; addScore(10); playTone(880, 0.08, 'triangle'); } });
    s.pipes = s.pipes.filter(p => p.x > -80);
    s.stars.forEach(st => { st.x -= st.v * dt; if (st.x < 0) { st.x = 810; st.y = Math.random() * 450; } });
    if (s.ship.y - s.ship.r < 0 || s.ship.y + s.ship.r > 450) { boom(g, s.ship.x, s.ship.y); loseGame(); return; }
    for (const p of s.pipes) {
      if (s.ship.x + s.ship.r > p.x && s.ship.x - s.ship.r < p.x + p.w && (s.ship.y - s.ship.r < p.top || s.ship.y + s.ship.r > 450 - p.bot)) { boom(g, s.ship.x, s.ship.y); loseGame(); return; }
    }
  };
  const render = (g) => {
    const s = S, ctx = g.ctx;
    ctx.fillStyle = '#0B0E14'; ctx.fillRect(0, 0, 800, 450);
    ctx.fillStyle = 'rgba(217,70,239,.4)'; s.stars.forEach(st => ctx.fillRect(st.x, st.y, st.s, st.s));
    s.pipes.forEach(p => { ctx.fillStyle = '#D946EF'; ctx.fillRect(p.x, 0, p.w, p.top); ctx.fillRect(p.x, 450 - p.bot, p.w, p.bot); ctx.fillStyle = '#F472B6'; ctx.fillRect(p.x, p.top - 12, p.w, 12); ctx.fillRect(p.x, 450 - p.bot, p.w, 12); });
    ctx.save(); ctx.translate(s.ship.x, s.ship.y); const tilt = Math.min(0.7, Math.max(-0.5, s.ship.vy * 0.001)); ctx.rotate(tilt);
    ctx.fillStyle = '#22D3EE'; ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-12, -9); ctx.lineTo(-6, 0); ctx.lineTo(-12, 9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FF3B7C'; ctx.fillRect(-12, -3, 5, 6); ctx.restore();
    drawParts(g);
  };
  return { init, update, render };
})();

/* --- 09 CYBER RACER 2 --- */
ENGINES['cyber-racer'] = (() => {
  let S = null;
  const init = (g) => { S = { p: { x: 375, y: 340, w: 45, h: 75 }, cars: [], coins: [], sp: 0, csp: 0, scroll: 0 }; };
  const update = (dt, g) => {
    const s = S; const boost = g.touches.boost ? 2.2 : 1;
    const speed = 420 * boost;
    if (g.touches.left && s.p.x > 30) s.p.x -= 440 * dt;
    if (g.touches.right && s.p.x < 725) s.p.x += 440 * dt;
    s.scroll += speed * dt; if (s.scroll > 80) s.scroll -= 80;
    if (boost && Math.random() < 0.5) { spawnP(g, s.p.x + 8, s.p.y + s.p.h, 0, 220, '#F59E0B'); spawnP(g, s.p.x + s.p.w - 8, s.p.y + s.p.h, 0, 220, '#FF3B7C'); }
    g.score += boost ? 2 : 1; document.getElementById('hudScore').innerText = g.score.toLocaleString();
    s.sp -= dt;
    if (s.sp <= 0) { const lanes = [120, 290, 470, 640]; s.cars.push({ x: lanes[Math.floor(Math.random() * 4)], y: -90, w: 42, h: 70, c: ['#3B82F6', '#10B981', '#A855F7', '#EC4899'][Math.floor(Math.random() * 4)] }); s.sp = 0.9 + Math.random() * 0.7; }
    s.csp -= dt;
    if (s.csp <= 0) { const lanes = [120, 290, 470, 640]; s.coins.push({ x: lanes[Math.floor(Math.random() * 4)], y: -30, r: 9 }); s.csp = 1.4 + Math.random() * 1.7; }
    s.coins.forEach(c => c.y += speed * 1.1 * dt);
    for (let i = s.coins.length - 1; i >= 0; i--) {
      const c = s.coins[i];
      if (c.x > s.p.x - c.r && c.x < s.p.x + s.p.w + c.r && c.y > s.p.y - c.r && c.y < s.p.y + s.p.h + c.r) {
        g.score += 70; document.getElementById('hudScore').innerText = g.score.toLocaleString(); playTone(990, 0.08, 'triangle'); boom(g, c.x, c.y); s.coins.splice(i, 1);
      } else if (c.y > 480) s.coins.splice(i, 1);
    }
    s.cars.forEach(e => { e.y += (speed - e.speed) * dt * 0.55; });
    for (let i = s.cars.length - 1; i >= 0; i--) {
      const e = s.cars[i];
      if (e.y > 480) { s.cars.splice(i, 1); continue; }
      if (s.p.x + 4 < e.x + e.w && s.p.x + s.p.w - 4 > e.x && s.p.y + 4 < e.y + e.h && s.p.y + s.p.h - 4 > e.y) {
        if (g.boosters.shield) { g.boosters.shield = false; state.inventory = state.inventory.filter(id => id !== 'boost-shield'); saveState(); boom(g, e.x + 20, e.y + 30); s.cars.splice(i, 1); playTone(300, 0.2, 'sawtooth', 0.05); }
        else { boom(g, s.p.x + 22, s.p.y + 35); loseGame(); return; }
      }
    }
  };
  const render = (g) => {
    const s = S, ctx = g.ctx;
    ctx.fillStyle = '#06080F'; ctx.fillRect(0, 0, 800, 450);
    ctx.fillStyle = '#111622'; ctx.fillRect(60, 0, 680, 450);
    ctx.fillStyle = '#DC2626'; ctx.fillRect(52, 0, 8, 450); ctx.fillRect(740, 0, 8, 450);
    const off = s.scroll % 80;
    ctx.fillStyle = '#fff'; for (let y = -off; y < 450; y += 80) { ctx.fillRect(52, y, 8, 40); ctx.fillRect(740, y, 8, 40); }
    ctx.fillStyle = '#374151'; for (let y = -off; y < 450; y += 80) { ctx.fillRect(205, y, 4, 40); ctx.fillRect(375, y, 4, 40); ctx.fillRect(545, y, 4, 40); }
    s.coins.forEach(c => { ctx.fillStyle = '#F59E0B'; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 0.4, 0, 7); ctx.fill(); });
    ctx.fillStyle = '#DC2626'; ctx.fillRect(s.p.x + 4, s.p.y + 10, s.p.w - 8, s.p.h - 15);
    ctx.fillStyle = '#1E293B'; ctx.fillRect(s.p.x + 8, s.p.y + 25, s.p.w - 16, 15); ctx.fillStyle = '#22D3EE'; ctx.fillRect(s.p.x + 10, s.p.y + 25, 6, 15);
    ctx.fillStyle = '#000'; ctx.fillRect(s.p.x - 2, s.p.y + 12, 6, 14); ctx.fillRect(s.p.x + s.p.w - 4, s.p.y + 12, 6, 14); ctx.fillRect(s.p.x - 2, s.p.y + s.p.h - 22, 6, 14); ctx.fillRect(s.p.x + s.p.w - 4, s.p.y + s.p.h - 22, 6, 14);
    ctx.fillStyle = '#FEE2E2'; ctx.fillRect(s.p.x + 6, s.p.y + 8, 8, 3); ctx.fillRect(s.p.x + s.p.w - 14, s.p.y + 8, 8, 3);
    s.cars.forEach(e => { ctx.fillStyle = e.c; ctx.fillRect(e.x + 4, e.y + 10, e.w - 8, e.h - 15); ctx.fillStyle = '#1E293B'; ctx.fillRect(e.x + 8, e.y + e.h - 35, e.w - 16, 12); ctx.fillStyle = '#000'; ctx.fillRect(e.x - 2, e.y + 12, 6, 14); ctx.fillRect(e.x + e.w - 4, e.y + 12, 6, 14); ctx.fillRect(e.x - 2, e.y + e.h - 22, 6, 14); ctx.fillRect(e.x + e.w - 4, e.y + e.h - 22, 6, 14); });
    drawParts(g);
  };
  return { init, update, render };
})();

/* --- 10 GALAXY INVADERS --- */
ENGINES['galaxy-invaders'] = (() => {
  let S = null;
  const init = (g) => { S = { ship: { x: 375, w: 50 }, bullets: [], eb: [], aliens: [], dir: 1, drop: 0, cd: 0, fire: 0, wave: 1, rows: 3, cols: 8 }; build(g); };
  const build = (g) => {
    S.aliens = [];
    for (let r = 0; r < S.rows; r++) for (let c = 0; c < S.cols; c++) S.aliens.push({ x: 80 + c * 70, y: 40 + r * 45, w: 44, h: 32, alive: true, c: ['#FF10F0', '#00FFFF', '#FFE600'][r] });
  };
  const update = (dt, g) => {
    const s = S;
    if (g.touches.left && s.ship.x > 10) s.ship.x -= 480 * dt;
    if (g.touches.right && s.ship.x < 740) s.ship.x += 480 * dt;
    s.cd -= dt;
    if (g.touches.action && s.cd <= 0 && s.bullets.length < 4) { s.bullets.push({ x: s.ship.x + 25, y: 420, v: 620 }); s.cd = 0.22; playTone(880, 0.05, 'square', 0.03); }
    s.bullets.forEach(b => b.y -= b.v * dt); s.bullets = s.bullets.filter(b => b.y > 0);
    let edge = false, bottom = 420;
    s.aliens.forEach(a => { if (!a.alive) return; a.x += s.dir * 40 * dt; if (a.x < 10 || a.x + a.w > 790) edge = true; if (a.y > bottom) bottom = a.y; });
    if (edge) { s.dir = -s.dir; s.aliens.forEach(a => a.y += 14); }
    s.fire -= dt;
    if (s.fire <= 0) { const alive = s.aliens.filter(a => a.alive); if (alive.length) { const a = alive[Math.floor(Math.random() * alive.length)]; s.eb.push({ x: a.x + a.w / 2, y: a.y + a.h, v: 260 }); } s.fire = 0.7; }
    s.eb.forEach(b => b.y += b.v * dt); s.eb = s.eb.filter(b => b.y < 450);
    for (let bi = s.bullets.length - 1; bi >= 0; bi--) {
      const b = s.bullets[bi];
      for (let ai = s.aliens.length - 1; ai >= 0; ai--) {
        const a = s.aliens[ai];
        if (a.alive && b.x > a.x && b.x < a.x + a.w && b.y > a.y && b.y < a.y + a.h) {
          a.alive = false; s.bullets.splice(bi, 1); addScore(10); playTone(520, 0.07, 'triangle', 0.04); boom(g, a.x + 22, a.y + 16); break;
        }
      }
    }
    if (!s.aliens.some(a => a.alive)) { s.wave++; s.rows = Math.min(5, s.rows + 1); build(g); g.score += 300; playTone(990, 0.12, 'square', 0.05); }
    for (const b of s.eb) if (b.x > s.ship.x - 10 && b.x < s.ship.x + 60 && b.y > 410 && b.y < 450) { boom(g, s.ship.x + 25, 430); loseGame(); return; }
    if (bottom >= 400) { boom(g, s.ship.x + 25, 430); loseGame(); return; }
  };
  const render = (g) => {
    const s = S, ctx = g.ctx;
    ctx.fillStyle = '#07080F'; ctx.fillRect(0, 0, 800, 450);
    ctx.fillStyle = '#22D3EE'; ctx.fillRect(s.ship.x, 420, s.ship.w, 22); ctx.fillStyle = '#67E8F9'; ctx.fillRect(s.ship.x + 8, 422, 34, 6);
    s.bullets.forEach(b => { ctx.fillStyle = '#39FF88'; ctx.fillRect(b.x - 2, b.y, 4, 16); });
    s.eb.forEach(b => { ctx.fillStyle = '#FF3B7C'; ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, 7); ctx.fill(); });
    s.aliens.forEach(a => { if (!a.alive) return; ctx.fillStyle = a.c; ctx.fillRect(a.x, a.y, a.w, a.h); ctx.fillStyle = '#000'; ctx.fillRect(a.x + 8, a.y + 8, 7, 7); ctx.fillRect(a.x + a.w - 15, a.y + 8, 7, 7); });
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Orbitron'; ctx.fillText('WAVE ' + s.wave, 650, 30);
    drawParts(g);
  };
  return { init, update, render };
})();

/* --- 11 VOLLEY CLASH --- */
ENGINES['volley-clash'] = (() => {
  let S = null;
  const init = (g) => { S = { ball: { x: 400, y: 300, dx: 120, dy: -60, r: 12 }, p1: { x: 300, y: 410, w: 90, h: 14 }, p2: { x: 460, y: 410, w: 90, h: 14 }, net: 400 }; };
  const update = (dt, g) => {
    const s = S;
    const sp = 520;
    if (g.touches.left) s.p1.x -= sp * dt;
    if (g.touches.right) s.p1.x += sp * dt;
    // simple AI for p2
    if (s.ball.x > s.net && s.ball.y < 400) { if (s.p2.x + s.p2.w / 2 < s.ball.x - 20) s.p2.x += 240 * dt; else if (s.p2.x + s.p2.w / 2 > s.ball.x + 20) s.p2.x -= 240 * dt; }
    s.p1.x = Math.max(10, Math.min(790 - s.p1.w, s.p1.x)); s.p2.x = Math.max(10, Math.min(790 - s.p2.w, s.p2.x));
    s.ball.x += s.ball.dx * dt; s.ball.y += s.ball.dy * dt;
    if (s.ball.y - s.ball.r < 0) s.ball.dy = -s.ball.dy;
    if (s.ball.y + s.ball.r > 450) { loseGame(); return; }
    // net
    if (s.ball.x > s.net - 4 && s.ball.x < s.net + 4) {
      if (s.ball.y > 180 && s.ball.y < 300) { s.ball.dx = -s.ball.dx; }
      else if (s.ball.y > 300) { s.ball.dx = -s.ball.dx; s.ball.dy = -Math.abs(s.ball.dy); }
    }
    // paddles
    if (s.ball.x > s.p1.x && s.ball.x < s.p1.x + s.p1.w && s.ball.y + s.ball.r > s.p1.y && s.ball.y - s.ball.r < s.p1.y + s.p1.h) {
      s.ball.y = s.p1.y - s.ball.r; const rel = (s.ball.x - (s.p1.x + s.p1.w / 2)) / (s.p1.w / 2);
      s.ball.dx = rel * 380; s.ball.dy = -Math.abs(300 * (1 - Math.abs(rel) * 0.5) + 120);
      if (s.ball.dy > -140) s.ball.dy = -140;
      addScore(10); playTone(520, 0.06, 'triangle', 0.04);
    }
    if (s.ball.x > s.p2.x && s.ball.x < s.p2.x + s.p2.w && s.ball.y + s.ball.r > s.p2.y && s.ball.y - s.ball.r < s.p2.y + s.p2.h) {
      s.ball.y = s.p2.y - s.ball.r;
      const rel = (s.ball.x - (s.p2.x + s.p2.w / 2)) / (s.p2.w / 2);
      s.ball.dx = -rel * 380; s.ball.dy = -Math.abs(330);
      playTone(440, 0.06, 'square', 0.03);
    }
    // out left/right -> other scores
    if (s.ball.x < -20 || s.ball.x > 820) { g.score += 50; document.getElementById('hudScore').innerText = g.score.toLocaleString(); s.ball.x = 400; s.ball.y = 250; s.ball.dx = (Math.random() < 0.5 ? -1 : 1) * 140; s.ball.dy = -80; playTone(880, 0.09, 'triangle'); }
  };
  const render = (g) => {
    const s = S, ctx = g.ctx;
    ctx.fillStyle = '#0A0C14'; ctx.fillRect(0, 0, 800, 450);
    ctx.fillStyle = '#1A2030'; ctx.fillRect(0, 350, 800, 100);
    ctx.fillStyle = '#22D3EE'; ctx.fillRect(s.p1.x, s.p1.y, s.p1.w, s.p1.h);
    ctx.fillStyle = '#FF10F0'; ctx.fillRect(s.p2.x, s.p2.y, s.p2.w, s.p2.h);
    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 3; ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.moveTo(s.net, 170); ctx.lineTo(s.net, 340); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#fff'; ctx.fillRect(s.net - 2, 170, 4, 170);
    ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, s.ball.r, 0, 7); ctx.fillStyle = '#FFE600'; ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, s.ball.r * 0.4, 0, 7); ctx.fill();
    drawParts(g);
  };
  return { init, update, render };
})();

/* --- 12 ASTRO HOP --- */
ENGINES['astro-hop'] = (() => {
  let S = null;
  const init = (g) => { S = { p: { x: 150, y: 300, w: 36, h: 36, vy: 0, on: false }, plat: [], spawn: 0.4, boost: 0, scroll: 0 }; for (let i = 0; i < 6; i++) S.plat.push({ x: i * 140 + 20, y: 380 - i * 30, w: 100 }); };
  const update = (dt, g) => {
    const s = S;
    if (g.touches.left) s.p.x -= 360 * dt;
    if (g.touches.right) s.p.x += 360 * dt;
    if (g.touches.action && s.p.on) { s.p.vy = -560; s.p.on = false; playTone(700, 0.05, 'square', 0.03); }
    s.p.vy += 1200 * dt; s.p.y += s.p.vy * dt;
    if (s.p.y > 440) { boom(g, s.p.x + 18, s.p.y); loseGame(); return; }
    s.p.on = false;
    for (const pl of s.plat) {
      if (s.p.vy > 0 && s.p.x + s.p.w > pl.x && s.p.x < pl.x + pl.w && s.p.y + s.p.h >= pl.y && s.p.y + s.p.h <= pl.y + 22) {
        s.p.y = pl.y - s.p.h; s.p.vy = 0; s.p.on = true;
      }
    }
    s.scroll += dt;
    if (s.scroll > s.spawn) {
      s.scroll = 0; s.spawn = Math.max(0.35, 0.5 - s.boost * 0.005);
      const y = Math.max(80, Math.min(420, s.p.y + (Math.random() - 0.5) * 260));
      s.plat.push({ x: Math.min(680, s.p.x + (Math.random() < 0.5 ? -1 : 1) * (170 + Math.random() * 120)), y, w: 90 + Math.random() * 40 });
      s.boost++;
    }
    s.plat = s.plat.filter(pl => pl.y < 460 && pl.x > -120 && pl.x < 900);
    g.score += dt * 40; document.getElementById('hudScore').innerText = Math.floor(g.score).toLocaleString();
  };
  const render = (g) => {
    const s = S, ctx = g.ctx;
    ctx.fillStyle = '#04070F'; ctx.fillRect(0, 0, 800, 450);
    ctx.strokeStyle = 'rgba(56,189,248,.15)';
    for (let x = 0; x < 800; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - 60, 450); ctx.stroke(); }
    s.plat.forEach(pl => { ctx.fillStyle = '#38BDF8'; ctx.fillRect(pl.x, pl.y, pl.w, 12); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(pl.x, pl.y, pl.w, 3); });
    ctx.fillStyle = '#FF10F0'; ctx.fillRect(s.p.x, s.p.y, s.p.w, s.p.h);
    ctx.fillStyle = '#fff'; ctx.fillRect(s.p.x + 6, s.p.y + 6, 12, 12);
    ctx.fillStyle = '#22D3EE'; ctx.fillRect(s.p.x + 2, s.p.y - 4, 32, 5);
    drawParts(g);
  };
  return { init, update, render };
})();

/* --- 13 LASER MAZE --- */
ENGINES['laser-maze'] = (() => {
  let S = null;
  const init = (g) => { S = { p: { x: 60, y: 60, w: 26, h: 26 }, exit: { x: 720, y: 380, w: 40, h: 40 }, lasers: [], sp: 0 }; };
  const addLaser = (g) => {
    const horiz = Math.random() < 0.5;
    const gap = 90 + Math.random() * 90;
    if (horiz) { const y = 50 + Math.random() * 300; S.lasers.push({ horiz: true, y, gap, gx: 60 + Math.random() * 500, dir: Math.random() < 0.5 ? 1 : -1, speed: 120 + Math.random() * 120 }); }
    else { const x = 50 + Math.random() * 550; S.lasers.push({ horiz: false, x, gap, gx: 40 + Math.random() * 300, dir: Math.random() < 0.5 ? 1 : -1, speed: 120 + Math.random() * 120 }); }
  };
  const update = (dt, g) => {
    const s = S;
    const sp = 330;
    if (g.touches.left && s.p.x > 0) s.p.x -= sp * dt;
    if (g.touches.right && s.p.x < 770) s.p.x += sp * dt;
    if (g.touches.up && s.p.y > 0) s.p.y -= sp * dt;
    if (g.touches.down && s.p.y < 420) s.p.y += sp * dt;
    s.sp -= dt;
    if (s.sp <= 0) { addLaser(g); s.sp = 1.0; }
    s.lasers.forEach(l => { l.gx += l.dir * l.speed * dt; if (l.gx < 20) { l.gx = 20; l.dir = 1; } if (l.gx > 660) { l.gx = 660; l.dir = -1; } });
    s.lasers = s.lasers.filter(l => l.gx > -300 && l.gx < 1100);
    for (const l of s.lasers) {
      let hit = false;
      if (l.horiz) {
        if (s.p.y < l.y + 10 && s.p.y + s.p.h > l.y - 10) {
          if (s.p.x + s.p.w < l.gx || s.p.x > l.gx + l.gap) hit = true;
        }
      } else {
        if (s.p.x < l.x + 10 && s.p.x + s.p.w > l.x - 10) {
          if (s.p.y + s.p.h < l.gx || s.p.y > l.gx + l.gap) hit = true;
        }
      }
      if (hit) { boom(g, s.p.x + 13, s.p.y + 13); loseGame(); return; }
    }
    if (s.p.x + s.p.w > s.exit.x && s.p.x < s.exit.x + s.exit.w && s.p.y + s.p.h > s.exit.y && s.p.y < s.exit.y + s.exit.h) { winGame(); return; }
    g.score += dt * 60; document.getElementById('hudScore').innerText = Math.floor(g.score).toLocaleString();
  };
  const render = (g) => {
    const s = S, ctx = g.ctx;
    ctx.fillStyle = '#05070C'; ctx.fillRect(0, 0, 800, 450);
    ctx.strokeStyle = 'rgba(0,255,255,.08)'; ctx.lineWidth = 1; for (let x = 0; x < 800; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 450); ctx.stroke(); } for (let y = 0; y < 450; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(800, y); ctx.stroke(); }
    ctx.fillStyle = '#39FF88'; ctx.fillRect(s.exit.x, s.exit.y, s.exit.w, s.exit.h); ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.fillText('EXIT', s.exit.x + 2, s.exit.y + 26);
    s.lasers.forEach(l => {
      if (l.horiz) { ctx.fillStyle = '#FF3B7C'; ctx.fillRect(0, l.y - 4, l.gx, 8); ctx.fillRect(l.gx + l.gap, l.y - 4, 800 - l.gx - l.gap, 8); ctx.fillStyle = '#fff'; ctx.fillRect(l.gx - 4, l.y - 7, 8, 14); ctx.fillRect(l.gx + l.gap - 4, l.y - 7, 8, 14); }
      else { ctx.fillStyle = '#FF3B7C'; ctx.fillRect(l.x - 4, 0, 8, l.gx); ctx.fillRect(l.x - 4, l.gx + l.gap, 8, 450 - l.gx - l.gap); ctx.fillStyle = '#fff'; ctx.fillRect(l.x - 7, l.gx - 4, 14, 8); ctx.fillRect(l.x - 7, l.gx + l.gap - 4, 14, 8); }
    });
    ctx.fillStyle = '#00FFFF'; ctx.fillRect(s.p.x, s.p.y, s.p.w, s.p.h); ctx.fillStyle = '#fff'; ctx.fillRect(s.p.x + 6, s.p.y + 6, 14, 14);
    drawParts(g);
  };
  return { init, update, render };
})();

/* --- 14 COIN CATCH --- */
ENGINES['coin-catch'] = (() => {
  let S = null;
  const init = (g) => { S = { p: { x: 350, w: 90 }, coins: [], bombs: [], sp: 0, bsp: 0 }; };
  const update = (dt, g) => {
    const s = S;
    if (g.touches.left && s.p.x > 5) s.p.x -= 520 * dt;
    if (g.touches.right && s.p.x < 705) s.p.x += 520 * dt;
    s.sp -= dt;
    if (s.sp <= 0) { s.coins.push({ x: 20 + Math.random() * 760, y: -20, r: 12 }); s.sp = 0.5 + Math.random() * 0.5; }
    s.bsp -= dt;
    if (s.bsp <= 0) { s.bombs.push({ x: 20 + Math.random() * 760, y: -20, r: 13 }); s.bsp = 1.4 + Math.random() * 1.5; }
    s.coins.forEach(c => c.y += 300 * dt); s.bombs.forEach(b => b.y += 320 * dt);
    for (let i = s.coins.length - 1; i >= 0; i--) {
      const c = s.coins[i];
      if (c.y + c.r > 415 && c.y - c.r < 445 && c.x > s.p.x - c.r && c.x < s.p.x + s.p.w + c.r) { addScore(10); playTone(990, 0.08, 'triangle'); s.coins.splice(i, 1); }
      else if (c.y > 470) s.coins.splice(i, 1);
    }
    for (let i = s.bombs.length - 1; i >= 0; i--) {
      const b = s.bombs[i];
      if (b.y + b.r > 415 && b.y - b.r < 445 && b.x > s.p.x - b.r && b.x < s.p.x + s.p.w + b.r) { boom(g, b.x, b.y); loseGame(); return; }
      if (b.y > 470) s.bombs.splice(i, 1);
    }
  };
  const render = (g) => {
    const s = S, ctx = g.ctx;
    ctx.fillStyle = '#0B0E14'; ctx.fillRect(0, 0, 800, 450);
    ctx.fillStyle = '#111622'; ctx.fillRect(0, 420, 800, 30);
    s.coins.forEach(c => { ctx.fillStyle = '#F59E0B'; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 7); ctx.fill(); ctx.fillStyle = '#FFE600'; ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 0.5, 0, 7); ctx.fill(); });
    s.bombs.forEach(b => { ctx.fillStyle = '#1B1E28'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.fillStyle = '#FF3B7C'; ctx.font = 'bold 14px sans-serif'; ctx.fillText('💣', b.x - 8, b.y + 5); });
    ctx.fillStyle = '#00FFFF'; ctx.fillRect(s.p.x, 418, s.p.w, 26); ctx.fillStyle = '#fff'; ctx.fillRect(s.p.x + 8, 422, 20, 6); ctx.fillRect(s.p.x + s.p.w - 28, 422, 20, 6);
    drawParts(g);
  };
  return { init, update, render };
})();

/* --- 15 SPACE MINER --- */
ENGINES['space-miner'] = (() => {
  let S = null;
  const init = (g) => { S = { p: { x: 380, y: 380, w: 34, h: 34 }, rocks: [], gems: [], sp: 0, gsp: 0, dir: 1 }; };
  const update = (dt, g) => {
    const s = S;
    const sp = 320;
    s.dir = 0;
    if (g.touches.left) { s.p.x -= sp * dt; s.dir = -1; }
    if (g.touches.right) { s.p.x += sp * dt; s.dir = 1; }
    if (g.touches.up && s.p.y > 0) s.p.y -= sp * dt;
    if (g.touches.down && s.p.y < 400) s.p.y += sp * dt;
    s.p.x = Math.max(5, Math.min(765, s.p.x)); s.p.y = Math.max(5, Math.min(400, s.p.y));
    s.sp -= dt;
    if (s.sp <= 0) { const side = Math.random() < 0.5 ? -1 : 1; s.rocks.push({ x: side < 0 ? -30 : 830, y: 20 + Math.random() * 360, r: 16 + Math.random() * 10, vx: side * (140 + Math.random() * 100), vy: (Math.random() - 0.5) * 60 }); s.sp = 0.7 + Math.random() * 0.9; }
    s.gsp -= dt;
    if (s.gsp <= 0) { s.gems.push({ x: 20 + Math.random() * 760, y: 20 + Math.random() * 350, r: 9 }); s.gsp = 1.2 + Math.random() * 1.5; }
    s.rocks.forEach(r => { r.x += r.vx * dt; r.y += r.vy * dt; if (r.y < 10 || r.y > 440) r.vy = -r.vy; });
    s.rocks = s.rocks.filter(r => r.x > -60 && r.x < 860);
    for (let i = s.rocks.length - 1; i >= 0; i--) {
      const r = s.rocks[i];
      const dx = s.p.x + s.p.w / 2 - r.x, dy = s.p.y + s.p.h / 2 - r.y;
      if (Math.sqrt(dx * dx + dy * dy) < r.r + 18) {
        if (g.boosters.shield) { g.boosters.shield = false; state.inventory = state.inventory.filter(id => id !== 'boost-shield'); saveState(); boom(g, r.x, r.y); playTone(300, 0.2, 'sawtooth', 0.05); s.rocks.splice(i, 1); }
        else { boom(g, s.p.x + 17, s.p.y + 17); loseGame(); return; }
      }
    }
    for (let i = s.gems.length - 1; i >= 0; i--) {
      const gm = s.gems[i];
      const dx = s.p.x + s.p.w / 2 - gm.x, dy = s.p.y + s.p.h / 2 - gm.y;
      if (Math.sqrt(dx * dx + dy * dy) < gm.r + 20) { addScore(25); playTone(990, 0.1, 'triangle'); boom(g, gm.x, gm.y); s.gems.splice(i, 1); }
    }
    if (g.touches.action) { playTone(220, 0.04, 'square', 0.03); }
  };
  const render = (g) => {
    const s = S, ctx = g.ctx;
    ctx.fillStyle = '#030409'; ctx.fillRect(0, 0, 800, 450);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.3 + Math.random() * 0.5; ctx.fillRect((i * 137) % 800, (i * 83) % 450, 1.5, 1.5); } ctx.globalAlpha = 1;
    s.rocks.forEach(r => { ctx.fillStyle = '#6B7280'; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 7); ctx.fill(); ctx.fillStyle = '#9CA3AF'; ctx.beginPath(); ctx.arc(r.x - r.r * 0.25, r.y - r.r * 0.25, r.r * 0.5, 0, 7); ctx.fill(); });
    s.gems.forEach(gm => { ctx.fillStyle = '#00FFFF'; ctx.beginPath(); ctx.arc(gm.x, gm.y, gm.r, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(gm.x, gm.y, gm.r * 0.4, 0, 7); ctx.fill(); });
    ctx.fillStyle = '#FFB800'; ctx.fillRect(s.p.x, s.p.y, s.p.w, s.p.h); ctx.fillStyle = '#1E293B'; ctx.fillRect(s.p.x + 3, s.p.y + 8, 28, 16);
    if (s.dir !== 0) { ctx.fillStyle = '#FFE600'; ctx.fillRect(s.dir > 0 ? s.p.x + s.p.w : s.p.x - 8, s.p.y + 12, 8, 6); }
    drawParts(g);
  };
  return { init, update, render };
})();

/* ==================== PARTICLES ==================== */
game.parts = [];
function spawnP(g, x, y, vx, vy, color, life = 0.6) {
  g.parts.push({ x, y, vx, vy, color, life, max: life, s: 2 + Math.random() * 3 });
}
function boom(g, x, y) {
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 160;
    spawnP(g, x, y, Math.cos(a) * v, Math.sin(a) * v, ['#FF3B7C', '#00FFFF', '#FFE600', '#fff'][Math.floor(Math.random() * 4)]);
  }
}
function coinsBurst(g, x, y) {
  for (let i = 0; i < 8; i++) { const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 90; spawnP(g, x, y, Math.cos(a) * v, Math.sin(a) * v, '#FFE600'); }
}
function drawParts(g) {
  for (let i = g.parts.length - 1; i >= 0; i--) {
    const p = g.parts[i];
    p.x += p.vx * 0.016; p.y += p.vy * 0.016; p.life -= 0.016;
    if (p.life <= 0) { g.parts.splice(i, 1); continue; }
    g.ctx.globalAlpha = Math.max(0, p.life / p.max);
    g.ctx.fillStyle = p.color;
    g.ctx.beginPath(); g.ctx.arc(p.x, p.y, p.s, 0, 7); g.ctx.fill();
  }
  g.ctx.globalAlpha = 1;
}

/* ==================== WEB AUDIO (tiny) ==================== */
let AC = null;
function ensureAudio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); }
function playTone(freq, dur, type = 'square', vol = 0.035) {
  if (!AC) return;
  try {
    const o = AC.createOscillator(), gn = AC.createGain();
    o.type = type; o.frequency.value = freq;
    gn.gain.setValueAtTime(vol, AC.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
    o.connect(gn); gn.connect(AC.destination);
    o.start(); o.stop(AC.currentTime + dur);
  } catch (e) {}
}
document.addEventListener('pointerdown', ensureAudio, { once: true });
document.addEventListener('keydown', ensureAudio, { once: true });

/* ==================== KEYBOARD ==================== */
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'action', KeyK: 'action',
  ShiftLeft: 'boost', ShiftRight: 'boost', KeyL: 'boost',
  KeyJ: 'drift'
};
document.addEventListener('keydown', (e) => {
  const a = KEYMAP[e.code];
  if (a) { game.keys[a] = true; game.touches[a] = true; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); }
  if (e.code === 'KeyP') togglePause();
});
document.addEventListener('keyup', (e) => {
  const a = KEYMAP[e.code];
  if (a) { game.keys[a] = false; game.touches[a] = false; }
});

/* ==================== INIT ==================== */
function init() {
  openAuth();
  navInit();
  // run engine init for all games lazily
  Object.keys(ENGINES).forEach(k => { if (ENGINES[k].init) ENGINES[k].init(game); });
  // hide boot, show UI
  document.getElementById('bootLoader').style.display = 'none';
  document.getElementById('topBar').style.display = 'flex';
  document.getElementById('bottomNav').style.display = 'flex';
  document.getElementById('app').style.display = 'block';
  go('home');
  updateCoinDisplay();
}
document.addEventListener('DOMContentLoaded', init);
