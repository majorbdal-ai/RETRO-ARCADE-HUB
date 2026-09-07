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
function comingSoon(name, e) {
  if (e) e.stopPropagation();
  toast(name + ' — coming soon! Pick your favourites 👑');
}
function renderHome() {
  const feat = GAMES.filter(g => g.featured);
  document.getElementById('featuredGrid').innerHTML = feat.map((g, i) => `
    <div class="featured-card" style="background:linear-gradient(145deg,${g.color}33,#0A0E16 65%)">
      <div class="f-ico" style="color:${g.color}">${g.icon}</div>
      <span class="badge" style="position:absolute;top:10px;right:10px">COMING SOON</span>
      <h3>${g.name}</h3>
      <p style="font-size:10px;color:var(--sub)">${g.desc}</p>
      <button class="btn btn-primary play-btn" style="padding:7px 14px;font-size:11px" onclick="comingSoon('${g.name}')">COMING SOON</button>
    </div>`).join('');
  renderGameGrid('');
}
function renderGameGrid(filter = '') {
  const q = (filter || '').toLowerCase();
  const list = GAMES.filter(g => !q || g.name.toLowerCase().includes(q) || g.desc.toLowerCase().includes(q));
  const html = list.map(g => `
    <div class="card game-card" style="cursor:pointer;position:relative">
      <span class="badge" style="position:absolute;top:8px;right:8px;font-size:8px">SOON</span>
      <div class="thumb" style="border-color:${g.color}55;box-shadow:0 0 14px ${g.color}22">${g.icon}</div>
      <h4>${g.name}</h4>
      <p>${g.desc}</p>
      <button class="btn btn-ghost" style="width:100%;padding:8px;font-size:11px;margin-top:6px" onclick="comingSoon('${g.name}')">COMING SOON &#128274;</button>
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

/* ==================== GAME CORE (disabled — pick favourites later) ==================== */
let game = { id: null, running: false, paused: false, over: false, score: 0, touches: {}, keys: {} };

/* ==================== INIT ==================== */
function init() {
  openAuth();
  navInit();
  // hide boot, show UI
  document.getElementById('bootLoader').style.display = 'none';
  document.getElementById('topBar').style.display = 'flex';
  document.getElementById('bottomNav').style.display = 'flex';
  document.getElementById('app').style.display = 'block';
  go('home');
  updateCoinDisplay();
}
document.addEventListener('DOMContentLoaded', init);
