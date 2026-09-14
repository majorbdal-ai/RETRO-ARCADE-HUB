/* ============================================================
   RETRO ARCADE HUB — 70 LEGENDARY GAMES. 1 ARENA. WHO IS THE KING?
   Website (browser) build — localStorage data layer (Supabase-ready later)
   ============================================================ */
'use strict';

// B3 FIX [088-090]: HTML escape — prevents XSS from username injection in innerHTML
function escHTML(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ==================== API LAYER (optional PHP backend) ==================== */
// Code-side readiness for a future backend (audit #5):
// - Default: GitHub Pages (no PHP) → auto local mode.
// - Override via ?api=https://your-host/ in URL to point at a real backend.
// - Never breaks the game when the backend is absent — graceful guest fallback.
const API_BASE = (() => {
  try {
    const q = new URLSearchParams(location.search).get('api');
    if (q) return q.replace(/\/+$/, '') + '/index.php';
  } catch (e) {}
  return 'api/index.php'; // relative — resolves only when a backend actually exists
})();
const BACKEND_AVAILABLE = null; // set true when first api() call succeeds

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
  equipped: store.get(K.equipped, { skin: null, vehicle: null, effect: null, booster: null, theme: 'neon' }),
  daily: store.get(K.daily, {}),
  stats: store.get(K.stats, { gamesPlayed: 0, totalScore: 0, bestCombo: 0 }),
  dailyBonus: store.get('rh_dailyBonus', null),
  best: store.get(K.best, {}),
  achievements: store.get(K.achievements, []),
  dailyQuest: store.get(K.dailyQuest, {}),
  lastPlay: store.get(K.lastPlay, 0),
  streak: store.get(K.streak, 0),
  streakClaimed: store.get('rh_streakClaimed', {}),
  favorites: store.get('rh_favorites', []),
  recentlyPlayed: store.get('rh_recently', []),
  combo: store.get('rh_combo', { count: 0, lastTime: 0, bestSession: 0 }),
  stars: store.get('rah_stars', {})
};
// [P1 hardening] normalize critical numerics on boot — never let poisoned storage reach UI [140-153]
if (typeof state.coins !== 'number' || !isFinite(state.coins) || state.coins < 0) state.coins = 0;
if (typeof state.profile.xp !== 'number' || !isFinite(state.profile.xp) || state.profile.xp < 0) state.profile.xp = 0;
if (typeof state.profile.level !== 'number' || !isFinite(state.profile.level)) state.profile.level = 1;
if (!state.profile.username || typeof state.profile.username !== 'string') state.profile.username = 'BIMAN_USER_92';
if (state.scores && typeof state.scores === 'object') {
  for (const k in state.scores) {
    const v = state.scores[k];
    if (typeof v !== 'number' || !isFinite(v) || v < 0) delete state.scores[k];
  }
}
if (state.best && typeof state.best === 'object') {
  for (const k in state.best) {
    const v = state.best[k];
    if (typeof v !== 'number' || !isFinite(v) || v < 0) delete state.best[k];
  }
}

// v7.35: read-only bridge so games/core.js can see equipped shop items
// (state is module-scoped; engines must not mutate it)
window.getEquippedState = () => (state.equipped ? {
  skin: state.equipped.skin || null,
  vehicle: state.equipped.vehicle || null,
  effect: state.equipped.effect || null,
  booster: state.equipped.booster || null
} : { skin: null, vehicle: null, effect: null, booster: null });

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
  store.set('rh_streakClaimed', state.streakClaimed);
  store.set('rh_favorites', state.favorites);
  store.set('rh_recently', state.recentlyPlayed);
  store.set('rh_combo', state.combo);
  store.set('rah_stars', state.stars || {});
  store.set('rh_dailyBonus', state.dailyBonus);
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
    if (!res.ok) return { ok: false, error: 'net' };
    const j = await res.json();
    if (j && j.ok) window.BACKEND_AVAILABLE = true;
    return j;
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
  // guest mode: keep the chosen username locally so progress feels personal
  if (!auth.user) { state.profile.username = u; saveState(); }
}
async function refreshLeaderboard() {
  const r = await api('leaderboard');
  const me = auth.user || state.profile.username;
  const list = document.getElementById('boardList');
  // [P0 fix] API unavailable on GitHub Pages (no PHP) → use local scores from rah_scores
  let rows = (r && r.ok && Array.isArray(r.rows)) ? r.rows : [];
  if (!rows.length && state.scores) {
    rows = Object.entries(state.scores)
      .filter(([, sc]) => typeof sc === 'number' && isFinite(sc) && sc > 0)
      .map(([gid, sc]) => ({ username: me, game: gid, score: sc }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }
  if (!list) return;
  if (!rows.length) { list.innerHTML = '<div style="padding:14px;text-align:center;color:var(--dim,#888)">🏆 Play games to set scores — leaderboard fills locally!</div>'; return; }
  list.innerHTML = rows.map((b, i) => {
    const safeUser = escHTML(String(b.username || '?').slice(0, 16));
    return `
    <div class="card rank-row ${b.username === me ? 'me' : ''}" style="margin-bottom:8px">
      <div class="rank-no">${i < 3 ? '<span class="crown">👑</span>' : '#' + (i + 1)}</div>
      <div class="rank-avatar">${escHTML((String(b.username || '?')[0] || '?').toUpperCase())}</div>
      <div class="rank-name">${safeUser}${b.username === me ? ' <span style="color:var(--cyan);font-size:10px">(YOU)</span>' : ''}</div>
      <div class="rank-score">${Number(b.score).toLocaleString()}</div>
    </div>`}).join('');
}
async function syncScore(gameId, score) {
  if (!auth.user) return;
  try { await api('save_score', { username: auth.user, game: gameId, score }); refreshLeaderboard(); } catch (e) {}
}

/* ==================== 70 GAMES ==================== */
const GAMES = [
  { id: '2048', name: '2048', icon: '🔢', color: '#EDC22E', desc: 'Swipe merge, reach 2048', featured: true, type: '2048', cat: 'Arcade', controls: 'swipe4' },
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
// TODAY'S CHALLENGE (v7.39): returns the daily challenge game id. Falls back
// to a deterministic server-free pick (mirror of the cron pool — seeded by day
// index exactly like rotate_daily.js) so offline / live_state.json-down still
// has a real, stable daily challenge. The bonus payout in core.js reads THIS
// same function, so banner and reward can never disagree.
const CHALL_FALLBACK_POOL = ['2048']; // offline fallback — always a real daily challenge for the live game
function liveChallenge() {
  if (LIVE && LIVE.challenge) return LIVE.challenge;
  // deterministic: same game all day, rotates daily (rot = whole-day index)
  const dayIdx = Math.floor(Date.now() / 86400000);
  return CHALL_FALLBACK_POOL[dayIdx % CHALL_FALLBACK_POOL.length];
}
function liveBotBoost() { return (LIVE && Array.isArray(LIVE.botBoost)) ? LIVE.botBoost : null; }
window.liveChallenge = liveChallenge; // core.js reads the SAME source for the bonus

/* ==================== NAVIGATION ==================== */
const PAGES = ['home', 'arcade', 'board', 'shop', 'profile', 'game'];
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
    // v7.47.6: in-game = immersive — hide hub chrome (search bar + bottom nav)
    const tb = document.getElementById('topBar');
    if (tb) tb.style.display = 'none';
    const bn = document.getElementById('bottomNav');
    if (bn) bn.style.display = 'none';
  } else {
    document.body.classList.remove('game-active');
    const tb = document.getElementById('topBar');
    if (tb && tb.style.display === 'none') tb.style.display = 'flex';
    const bn = document.getElementById('bottomNav');
    if (bn && bn.style.display === 'none') bn.style.display = 'flex';
  }
  if (['home','arcade','shop','board','profile'].includes(page)) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === page));
  }
  // v7.15: hub soundtrack switches page/tempo (stop inside a game)
  if (page !== 'game') {
    if (window.AppMusic) { try { window.AppMusic.applyPage(page); window.AppMusic.start(); } catch (e) {} }
  } else if (window.AppMusic) {
    try { window.AppMusic.stop(); } catch (e) {}
  }
  if (page === 'home') renderHome();
  else if (page === 'arcade') renderArcadeGrid('');
  else if (page === 'board') renderBoard('weekly');
  else if (page === 'shop') renderShop();
  else if (page === 'profile') renderProfile();
  updateCoinDisplay();
}
function navInit() {
  document.querySelectorAll('.nav-item').forEach(n => n.addEventListener('click', () => go(n.dataset.page)));
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
function ripple(e, btn) {
  const b = btn || e.currentTarget;
  if (!b || typeof b.getBoundingClientRect !== 'function') return;
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
document.addEventListener('click', (e) => { const b = e.target.closest('.btn'); if (b) ripple(e, b); });
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
  state = { coins: 0, profile: { username: 'BIMAN_USER_92', level: 1, wins: 0, avatar: '👤', xp: 0 }, scores: {}, inventory: [], equipped: { skin: null, vehicle: null, effect: null, theme: 'neon' }, daily: {}, stats: { gamesPlayed: 0, totalScore: 0, bestCombo: 0 }, best: {}, lastPlay: 0, streak: 0, streakClaimed: {}, favorites: [], recentlyPlayed: [], combo: { count: 0, lastTime: 0, bestSession: 0 }, dailyBonus: null, stars: {} };
  saveState();   // persist the reset (B3: state actually resets everywhere)
  applyTheme((state.equipped && state.equipped.theme) || 'neon');
  closeDeleteModal();
  toast('Account deleted');
  go('home'); updateCoinDisplay();
  if (typeof renderProfile === 'function') renderProfile();
  if (typeof renderArcadeGrid === 'function') renderArcadeGrid();
  // server-side delete (if backend ever connected) — best-effort
  if (auth && auth.user) { try { api('delete_account', { username: auth.user }).then(() => {}); } catch (e) {} auth.user = null; }
}
/* ==================== RENDER: HOME ==================== */
function isFav(id) { return (state.favorites || []).includes(id); }
/* Mastery stars (v7.32): persisted per-game ★ rating from endGame (max kept). */
function getGameStars(id) { return Math.max(0, Math.min(3, (state.stars || {})[id] || 0)); }
function starRow(id, size = 10) {
  const s = getGameStars(id);
  const on = 'color:var(--yellow);text-shadow:0 0 6px rgba(255,230,0,.8)';
  const off = 'color:rgba(255,255,255,.22)';
  return '<span style="font-size:' + size + 'px;letter-spacing:1px">' +
    '<span style="' + (s >= 1 ? on : off) + '">★</span>' +
    '<span style="' + (s >= 2 ? on : off) + '">★</span>' +
    '<span style="' + (s >= 3 ? on : off) + '">★</span></span>';
}
function starText(id) { return getGameStars(id) + '/3'; }
function masteredCount() {
  const stars = state.stars || {};
  return GAMES.filter(g => (stars[g.id] || 0) >= 3).length;
}
function totalStarsEarned() {
  const stars = state.stars || {};
  return GAMES.reduce((acc, g) => acc + Math.min(3, stars[g.id] || 0), 0);
}
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

/* ==================== DAILY STREAK (v7.9) ====================
   Consecutive-day habit loop: play ANY game once per day to keep the
   flame alive. Milestones pay out coins once each; the calendar dots
   show the last 7 days at a glance. */
const STREAK_MILESTONES = [
  { day: 7,  reward: 500,  ico: '🔥', label: '7 DAYS' },
  { day: 14, reward: 1200, ico: '⚡', label: '14 DAYS' },
  { day: 30, reward: 3000, ico: '👑', label: '30 DAYS' }
];
function dayStart(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
function updateStreak() {
  const now = Date.now();
  const today = dayStart(now);
  state.lastPlay = state.lastPlay || 0;
  state.streak = state.streak || 0;
  // first play of this calendar day?
  if (state.lastPlay < today) {
    const yest = today - 86400000;
    const wasYest = state.lastPlay >= yest && state.lastPlay < today;
    state.streak = wasYest ? state.streak + 1 : 1;
    state.lastPlay = today;
    // milestone coin payout (once per day each)
    const st = state.streak;
    STREAK_MILESTONES.forEach(m => {
      if (st >= m.day && !(state.streakClaimed || {})[m.day]) {
        state.streakClaimed = state.streakClaimed || {};
        state.streakClaimed[m.day] = true;
        state.coins += m.reward;
        saveState(); updateCoinDisplay();
        setTimeout(() => toast('🔥 ' + m.day + '-DAY STREAK! +' + m.reward + ' 🪙'), 1200);
      }
    });
    saveState();
    // refresh profile if it's open
    const pp = document.getElementById('page-profile');
    if (pp && pp.classList.contains('active')) renderProfile();
  }
}
function streakLast7(now = Date.now()) {
  const out = [];
  const today = dayStart(now);
  for (let i = 6; i >= 0; i--) {
    const d = today - i * 86400000;
    const played = state.lastPlay ? state.lastPlay >= d && state.lastPlay < d + 86400000 : false;
    out.push({ played, today: i === 0 });
  }
  return out;
}
/* ==================== DAILY BONUS (7-day escalating coin claim) ==================== */
const DAILY_BONUS = [120, 150, 200, 260, 340, 450, 600];
function dailyBonusInfo(now = Date.now()) {
  const today = dayStart(now);
  const db = state.dailyBonus || { day: 0, lastClaim: 0 };
  const sameDay = db.lastClaim >= today;
  let day = (db.day || 0) % 7;                 // 0..6, cycles every 7 days
  if (db.lastClaim && !sameDay && (db.lastClaim < dayStart(db.lastClaim) + 86400000)) {
    const yest = today - 86400000;
    const wasYest = db.lastClaim >= yest && db.lastClaim < today;
    if (!wasYest) day = 0;                      // missed a day → reset to day 1
  }
  return {
    today, day,                                             // next claimable index 0..6
    claimedToday: sameDay,
    amount: DAILY_BONUS[day],
    claimed: db.lastClaim ? dayStart(db.lastClaim) : 0
  };
}
function bonusChipHtml(d) {
  const rewards = DAILY_BONUS.map((amt, i) =>
    `<span class="sd-reward${i === d.day && !d.claimedToday ? ' got' : ''}" style="${i === d.day && !d.claimedToday ? 'border-color:#FFD700;color:#FFE600' : ''}">${i + 1}d · ${amt.toLocaleString()}🪙</span>`
  ).join('');
  const btn = d.claimedToday
    ? `<div style="font-size:11px;color:var(--green);font-weight:700">✓ CLAIMED — come back tomorrow!</div>`
    : `<button class="btn btn-primary" onclick="claimDailyBonus(event)" style="width:100%;padding:12px;font-size:13px;margin-top:8px"><i class="fa-solid fa-gift"></i> CLAIM ${d.amount.toLocaleString()} 🪙</button>`;
  return `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="font-size:26px">🎁</span>
      <div style="flex:1;min-width:150px">
        <div style="font-size:13px;color:#fff;font-weight:800">DAILY BONUS</div>
        <div style="font-size:10px;color:var(--sub)">Day ${d.day + 1}/7 · FREE coins, resets if you miss a day</div>
      </div>
      <span style="font-size:22px;font-weight:900;font-family:'Orbitron',sans-serif;color:var(--gold,#FFD700)">+${d.amount.toLocaleString()}</span>
    </div>
    <div class="streak-rewards" style="margin-top:8px">${rewards}</div>
    ${btn}`;
}
function renderDailyBonus() {
  const d = dailyBonusInfo();
  const hero = document.getElementById('dailyBonusHero');
  if (hero) hero.innerHTML = `<div class="widget" style="padding:12px 14px;background:linear-gradient(135deg,rgba(255,180,0,.12),rgba(255,59,107,.08));border:1px solid rgba(255,180,0,.35)">${bonusChipHtml(d)}</div>`;
  const w = document.getElementById('dailyBonusWidget');
  if (w) w.innerHTML = `<b style="font-size:13px;color:#fff">🎁 DAILY BONUS</b><div style="margin-top:8px">${bonusChipHtml(d)}</div>`;
}
function claimDailyBonus(e) {
  if (e) e.stopPropagation();
  const d = dailyBonusInfo();
  if (d.claimedToday) { toast('Already claimed today — come back tomorrow!'); return; }
  state.dailyBonus = { day: (d.day + 1) % 7, lastClaim: d.today };
  state.coins += d.amount;
  saveState(); updateCoinDisplay(); renderDailyBonus();
  if (typeof renderProfile === 'function') renderProfile();
  toast('🎁 Daily Bonus +' + d.amount.toLocaleString() + ' 🪙');
  if (typeof window.hapticVibe === 'function') { try { window.hapticVibe('win'); } catch (e2) {} }
}
/* ==================== MASTERY STARS (v7.32) ==================== */
function renderMastery() {
  const wrap = document.getElementById('masteryWidget');
  if (!wrap) return;
  const mastered = masteredCount();
  const total = totalStarsEarned();
  const pct = Math.round(total / (GAMES.length * 3) * 100);
  let html = '<div style="font-size:11px;font-weight:700;color:var(--yellow);letter-spacing:.5px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">' +
    '<span>⭐ MASTERY STARS</span>' +
    '<span style="color:var(--sub);font-weight:400">' + total + ' / ' + (GAMES.length * 3) + '</span></div>' +
    '<div style="display:flex;gap:3px;align-items:center;margin-bottom:6px">' +
    '<div class="xp-bar" style="flex:1;height:10px"><div class="xp-fill" style="width:' + pct + '%"></div></div>' +
    '<span style="font-size:10px;color:var(--sub)">' + pct + '%</span></div>' +
    '<div style="font-size:10px;color:var(--sub)">' + mastered + ' game' + (mastered === 1 ? '' : 's') + ' MASTERED 🏆 — get 3★ in every game to fill the board!</div>';
  wrap.innerHTML = html;
}
function renderStreak() {
  const wrap = document.getElementById('streakWidget');
  if (!wrap) return;
  const st = state.streak || 0;
  const days = streakLast7();
  const nextMilestone = STREAK_MILESTONES.find(m => st < m.day);
  const progress = nextMilestone ? Math.min(100, Math.round(st / nextMilestone.day * 100)) : 100;
  const heat = Math.min(30, 1 + Math.floor((st - 1) / 2));
  const dots = days.map(d =>
    `<div class="sd-dot${d.played ? ' on' : ''}${d.today ? ' today' : ''}" title="${d.today ? 'TODAY' : dayStartLabel(d)}">${d.played && d.today ? '🔥' : ''}</div>`
  ).join('');
  wrap.innerHTML = `
    <div class="streak-top">
      <div class="streak-flame" style="filter:hue-rotate(${heat * 8}deg)">🔥</div>
      <div class="streak-num">${st}<span class="streak-day">DAY${st === 1 ? '' : 'S'}</span></div>
      <div class="streak-keep">${st > 0 ? 'COME BACK TOMORROW!' : 'PLAY A GAME TO START!'}</div>
    </div>
    <div class="streak-dots">${dots}</div>
    <div class="streak-bar">
      ${nextMilestone
        ? `NEXT: <b>${nextMilestone.ico} ${nextMilestone.label}</b> — <b>${nextMilestone.reward.toLocaleString()} 🪙</b>`
        : `MAX STREAK — <b>${st}-DAY LEGEND 👑</b>`}
      <div class="progress-track" style="margin-top:6px"><div class="progress-fill" style="width:${progress}%;background:linear-gradient(90deg,#FF9D00,#FF3B6B)"></div></div>
      <div style="font-size:10px;color:var(--sub);margin-top:4px">${Math.min(st, (nextMilestone || {}).day || st)}/${nextMilestone ? nextMilestone.day : st} DAYS</div>
    </div>
    <div class="streak-rewards">
      ${STREAK_MILESTONES.map(m =>
        `<span class="sd-reward${st >= m.day ? ' got' : ''}">${m.ico} ${m.day}d ${state.streakClaimed && state.streakClaimed[m.day] ? '✓' : (m.reward / 1000) + 'k🪙'}</span>`
      ).join('')}
    </div>`;
}
function dayStartLabel(d) {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return days[new Date(d).getDay()];
}
function renderDiscovery() {
  const rows = [
    ['trendRow', [...GAMES].sort((a,b) => {
      // pseudo-popularity: deterministic hash — feels live
      let ha=0, hb=0;
      for (let k=0;k<a.id.length;k++) ha=(ha*31+a.id.charCodeAt(k))>>>0;
      for (let k=0;k<b.id.length;k++) hb=(hb*31+b.id.charCodeAt(k))>>>0;
      return (hb%1000)-(ha%1000);
    }).slice(0,10), '🔥'],
    ['topRow', [...GAMES].sort((a,b) => {
      const rate = (g) => { let h = 0; for (const ch of g.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return 4.0 + (h % 10) / 10; };
      return rate(b) - rate(a);
    }).slice(0,10), '⭐'],
    ['newRow', [...GAMES].slice(-10).reverse(), '🆕']
  ];
  rows.forEach(([rowId, list, mark]) => {
    const row = document.getElementById(rowId);
    if (!row) return;
    row.innerHTML = list.map(g => `<div class="card game-card" style="cursor:pointer;position:relative;flex-shrink:0;width:118px;padding:10px" onclick="playGame('${g.id}')">
      <button class="fav-btn" data-fav="${g.id}" onclick="toggleFavorite('${g.id}', event)" style="position:absolute;top:4px;left:4px;z-index:5;background:rgba(0,0,0,.5);border:none;border-radius:999px;width:22px;height:22px;font-size:11px;cursor:pointer;color:${isFav(g.id) ? 'var(--pink)' : '#888'};display:flex;align-items:center;justify-content:center">${isFav(g.id) ? '❤️' : '🤍'}</button>
      <div style="height:64px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,rgba(255,255,255,.05),rgba(255,255,255,.02));overflow:hidden">${gameLogo(g.id)}</div>
      <div style="font-size:10px;font-weight:700;margin-top:6px;text-align:center;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${g.name}</div>
      <div style="font-size:9px;color:var(--sub);text-align:center;margin-top:2px">${mark} ${g.cat || ''}</div>
    </div>`).join('');
  });
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
    if (cg) {
      // v7.39: the banner shows the REAL reward (best +40🪙) — the payout is
      // now wired in core.js endGame, so the promise is honest.
      const challBest = (state && state.best && state.best[challId]) || 0;
      challHtml = `
      <div class="deal-banner" style="display:flex;align-items:center;gap:10px;justify-content:center;cursor:pointer;margin:6px 0 14px" onclick="playGame('${cg.id}')">
        <span style="font-size:18px">🏆</span>
        <span>TODAY'S CHALLENGE: <b>${cg.name}</b> — beat <b>${challBest.toLocaleString()}</b> for <b>+40 🪙</b>!</span>
        <span style="font-size:13px">▶</span>
      </div>`;
    }
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
  renderHomeGrid();
  renderDiscovery();
  renderFavorites();
  renderRecent();

    // NEW UI: Featured Carousel (horizontal scroll with featured games)
    renderFeaturedCarousel();
  }

  // v7.17: daily bonus on home hero (fresh state every render)
  renderDailyBonus();

  // NEW UI: Home Category Tabs
  let currentHomeCat = 'ALL';
  let currentHomeQuery = '';
  function setHomeQuery(q) {
    currentHomeQuery = (q || '').toLowerCase();
    renderHomeGrid();
  }
  function setHomeCat(cat) {
    currentHomeCat = cat;
    document.querySelectorAll('#homeCatTabs .cat-tab').forEach(t => 
      t.classList.toggle('active', t.dataset.cat === cat));
    renderHomeGrid();
  }

  function renderHomeGrid() {
    const q = currentHomeQuery;
    const c = currentHomeCat.toUpperCase();
    let list = GAMES;
    if (q) list = list.filter(g => g.name.toLowerCase().includes(q) || g.desc.toLowerCase().includes(q));
    if (c !== 'ALL') list = list.filter(g => (g.cat || '').toUpperCase() === c);
    const html = list.map((g) => {
      const ready = !!engineReady(g.id);
      const isNew = ready && GAMES.indexOf(g) >= GAMES.length - 8;
      const isHot = ready && !!g.featured;
      const isMastered = ready && getGameStars(g.id) >= 3;
      const badge = !ready ? 'SOON' : isMastered ? 'MASTERED' : isNew ? 'NEW' : isHot ? 'HOT' : (state.best[g.id] ? 'BEST ' + state.best[g.id].toLocaleString() : 'PLAY');
      const badgeColor = !ready ? 'var(--sub)' : isMastered ? 'var(--gold)' : isNew ? 'var(--green)' : isHot ? 'var(--pink)' : 'var(--cyan)';
      // pseudo play-count (deterministic from id + date — feels live)
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
        <span style="margin-left:auto;color:var(--yellow)">${starRow(g.id)}</span>
      </div>
      <button class="btn ${ready ? 'btn-primary' : 'btn-ghost'}" style="width:100%;padding:8px;font-size:11px;margin-top:6px" onclick="event.stopPropagation();${ready ? `playGame('${g.id}')` : `comingSoon('${g.name}')`}">${ready ? '▶ PLAY' : 'COMING SOON &#128274;'}</button>
    </div>`;
    }).join('');
    const g1 = document.getElementById('gameGrid');
    if (g1) g1.innerHTML = html || comingSoonBlock();
  }



function comingSoonBlock() {
  return `<div style="grid-column:1/-1;text-align:center;padding:36px 16px;border:1px dashed rgba(139,92,246,.4);border-radius:var(--radius-lg);background:linear-gradient(160deg,rgba(139,92,246,.08),rgba(34,211,238,.04),rgba(236,72,153,.06));box-shadow:inset 0 0 40px rgba(139,92,246,.05)">
    <div style="font-size:44px;margin-bottom:12px;filter:drop-shadow(0 0 18px rgba(139,92,246,.6))">🚀</div>
    <div class="font-orbitron" style="font-size:18px;letter-spacing:1px;background:linear-gradient(90deg,#8B5CF6,#22D3EE,#EC4899);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;margin-bottom:8px">GAMES ARE LOADING</div>
    <div style="color:var(--sub);font-size:var(--font-sm);max-width:280px;margin:0 auto;line-height:1.6">70 original arcade classics are being prepared. Check back soon — the arcade is almost ready! 🕹️</div>
  </div>`;
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
  if (svg) {
    if (svg.startsWith('data:image')) {
      return `<img src="${svg}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:14px" loading="lazy">`;
    }
    return `<svg viewBox="0 0 120 120" style="width:100%;height:100%;display:block" xmlns="http://www.w3.org/2000/svg">${svg.replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`;
  }
  const g = GAMES.find(x => x.id === id);
  // size param only affects the emoji fallback — game logos use full-bleed images
  return `<span style="font-size:${(size || 120) * 0.28}px;filter:drop-shadow(0 4px 12px ${g ? g.color : '#fff'}66)">${g ? g.icon : '🎮'}</span>`;
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
    // real mastery stars (v7.32) — replaces fake hash rating
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
            <span style="font-size:var(--font-xs);color:var(--yellow);font-family:'Orbitron',sans-serif">${starRow(g.id)}</span>
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
          <span style="font-size:var(--font-xs);color:var(--yellow);font-family:'Orbitron',sans-serif">${starRow(g.id)}</span>
        </div>
        <button class="btn ${ready ? 'btn-primary' : 'btn-ghost'}" style="width:100%;padding:8px;font-size:11px;margin-top:6px" onclick="${ready ? `playGame('${g.id}')` : `comingSoon('${g.name}')`}">${ready ? '▶ PLAY' : 'COMING SOON &#128274;'}</button>
      </div>`;
    }
  }).join('');
  const g1 = document.getElementById('gameGrid');
  const g2 = document.getElementById('arcadeGrid');
  let emptyBlock = '';
  if (!html) {
    if (q || c !== 'ALL') {
      emptyBlock = `<div class="empty-state" style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:32px 16px;text-align:center;color:var(--sub)">
        <div style="font-size:38px">🔍</div>
        <div style="font-size:var(--font-sm);font-weight:700;color:var(--text)">NO GAMES FOUND</div>
        <div style="font-size:var(--font-xs);max-width:220px">${q ? `No game matches "<b>${q}</b>"` : 'No games in this category yet'}</div>
        <button class="btn btn-primary" onclick="resetSearch()" style="padding:8px 18px;font-size:12px;margin-top:6px"><i class="fa-solid fa-xmark"></i> CLEAR SEARCH</button>
      </div>`;
    } else {
      emptyBlock = comingSoonBlock();
    }
  }
  const htmlOut = html || emptyBlock;
  if (g1) g1.innerHTML = htmlOut;
  if (g2) g2.innerHTML = htmlOut;

  // show/hide reset button in arcade search bar
  const sReset = document.getElementById('searchResetBtn');
  if (sReset) sReset.style.display = q ? 'flex' : 'none';
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
function resetSearch() {
  const inp = document.getElementById('arcadeSearch');
  if (inp) inp.value = '';
  currentCatFilter = 'ALL';
  const wrap = document.getElementById('catFilter');
  if (wrap) wrap.querySelectorAll('.cat-chip').forEach(ch => ch.classList.toggle('active', ch.innerText.trim() === 'ALL'));
  renderArcadeGrid();
}

/* ==================== SHOP ==================== */
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
function renderBoard(range = 'weekly', gameId = null) {
  const myBest = Object.values(state.best).reduce((a, b) => a + b, 0);
  const myName = state.profile.username;
  // live-rotated bot scores (deterministic per rot; falls back to 1.0)
  const boost = liveBotBoost() || [1,1,1,1,1,1,1,1];
  let list = BOTS.map((b, i) => ({ ...b, score: Math.round(b.score * (boost[i] || 1)), me: false, bot: true }));
  // game-wise: show per-game best scores
  const gameSel = document.getElementById('boardGameSelect');
  if (range === 'game') {
    // populate dropdown if empty
    if (gameSel && gameSel.options.length <= 1) {
      const played = GAMES.filter(g => state.best[g.id] > 0);
      gameSel.innerHTML = '<option value="">Select a game...</option>' + played.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
      // add all games if none played
      if (played.length === 0) gameSel.innerHTML = GAMES.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    }
    if (gameSel) gameSel.style.display = 'block';
    if (gameId && state.best[gameId]) {
      // show only this game's scores — bots get random-ish scores for this game
      list = BOTS.map((b, i) => ({
        ...b,
        score: Math.round((state.best[gameId] || 0) * (0.3 + (boost[i] || 1) * 0.5)),
        me: false,
        bot: true
      }));
      list.push({ name: myName, score: state.best[gameId] || 0, avatar: state.profile.avatar, me: true });
      list.sort((a, b) => b.score - a.score);
    } else {
      // no game selected — show overall
      list.push({ name: myName, score: Math.max(myBest, 100), avatar: state.profile.avatar, me: true });
      list.sort((a, b) => b.score - a.score);
    }
  } else {
    if (gameSel) gameSel.style.display = 'none';
    list.push({ name: myName, score: Math.max(myBest, 100), avatar: state.profile.avatar, me: true });
    if (range === 'alltime') list.forEach(b => b.score = Math.round(b.score * 1.7));
    else if (range === 'friends') {
      // "TOP PLAYERS" — deterministic per-rotation bot lineup, no fake "friends" claim
      const rot = ((liveBotBoost() && Math.floor(Date.now() / 86400000)) || 0);
      const n = 5 + (rot % 3); // 5-7 bots, shuffles daily
      const pool = BOTS.slice().sort((a, b) => b.score - a.score);
      const picked = [];
      for (let i = 0; i < pool.length && picked.length < n; i++) {
        if ((i + rot) % 2 === 0) picked.push(pool[i]);
      }
      list = picked.map((b, i) => ({ ...b, score: Math.round(b.score * (boost[i % boost.length] || 1)), me: false, bot: true }));
      list.push({ name: myName, score: Math.max(myBest, 100), avatar: state.profile.avatar, me: true, bot: false });
      list.sort((a, b) => b.score - a.score);
    }
    list.sort((a, b) => b.score - a.score);
  }
  const myRank = list.findIndex(b => b.me) + 1;
  const myRow = list.find(b => b.me);
  // stats strip — top 3 highlight
  const top3 = list.slice(0, 3);
  const boardStats = document.getElementById('boardStats');
  if (boardStats) {
    const medals = ['🥇','🥈','🥉'];
    boardStats.innerHTML = top3.map((b, i) => `
      <div style="flex:1;text-align:center;padding:10px 4px;border-radius:14px;background:linear-gradient(160deg,rgba(139,92,246,.12),rgba(13,13,26,.5));border:1px solid rgba(139,92,246,.25);backdrop-filter:blur(10px)">
        <div style="font-size:20px">${medals[i]}</div>
        <div style="font-size:10px;color:var(--sub);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHTML(b.name)}</div>
      </div>`).join('');
  }
  const mc = document.getElementById('myRankCard');
  if (mc) {
    mc.style.display = '';
    mc.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;padding:4px 2px">
      <div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(145deg,#8B5CF6,#EC4899);display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-weight:900;font-size:14px;color:#F1F0FF;box-shadow:0 0 16px rgba(139,92,246,.5)">#${myRank}</div>
      <div class="rank-avatar" style="width:40px;height:40px;font-size:18px">${myRow.avatar}</div>
      <div style="flex:1">
        <div style="font-weight:800;color:#F1F0FF;font-size:14px">${escHTML(myRow.name)} <span style="font-size:9px;color:var(--sub)">YOU</span></div>
      </div>
    </div>`;
  }
  document.getElementById('boardList').innerHTML = list.slice(0, 12).map((b, i) => `
    <div class="card rank-row ${b.me ? 'me' : ''}" style="margin-bottom:8px;${i === 0 ? 'border-color:rgba(139,92,246,.5);box-shadow:0 0 18px rgba(139,92,246,.18)' : ''}">
      <div class="rank-no">${i < 3 ? '<span class="crown">👑</span>' : '#' + (i + 1)}</div>
      <div class="rank-avatar">${escHTML(b.avatar)}</div>
      <div class="rank-name">${escHTML(b.name)}${b.me ? ' <span style="color:var(--cyan);font-size:10px">(YOU)</span>' : ''}</div>
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
  const unameInp = document.getElementById('usernameInput');
  if (unameInp) unameInp.value = p.username || '';
  const lvlEl = document.getElementById('playerLevel');
  if (lvlEl) lvlEl.innerHTML = '<span style="background:linear-gradient(90deg,#EC4899,#8B5CF6);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent">LVL ' + p.level + '</span>' + (p.level >= 30 ? ' <span style="color:#F59E0B">👑</span>' : '');
  const xb = document.getElementById('xpBar');
  if (xb) xb.style.width = xpPct + '%';
  const xl = document.getElementById('xpPctLabel');
  if (xl) xl.innerText = xpPct + '% · ' + Math.round(xpCur) + '/' + Math.round(xpNeed) + ' XP';
  document.getElementById('statWins').innerText = state.stats.gamesPlayed;
  document.getElementById('statCoins').innerText = state.coins.toLocaleString();
  document.getElementById('statSkins').innerText = skinsOwned + '/24';
  const favEl = document.getElementById('statFav');
  if (favEl) favEl.innerText = (state.favorites || []).length;
  const streakEl = document.getElementById('statStreak');
  if (streakEl) streakEl.innerText = (state.streak || 0) + 'd';
  // Combo stats
  const comboEl = document.getElementById('statCombo');
  if (comboEl) comboEl.innerText = (state.combo || {}).bestSession || 0;
  const comboCurEl = document.getElementById('statComboCur');
  if (comboCurEl) {
    const cc = state.combo || { count: 0 };
    if (cc.count >= 2) {
      comboCurEl.style.display = 'block';
      comboCurEl.innerHTML = `<span style="color:${getComboTier(cc.count).color}">🔥 ${cc.count}x ACTIVE</span> <span style="color:var(--sub);font-size:10px">×${getComboMultiplier(cc.count)} mult</span>`;
    } else {
      comboCurEl.style.display = 'block';
      comboCurEl.innerHTML = '<span style="color:var(--sub)">Play games back-to-back!</span>';
    }
  }
  // v7.15: lifetime run + revive stats on the profile
  const runEl = document.getElementById('statRuns');
  if (runEl) runEl.innerText = (state.stats.runs || 0).toLocaleString();
  const revEl = document.getElementById('statRevives');
  if (revEl) revEl.innerText = (state.stats.revivesUsed || 0);
  // v7.15: keep profile SOUND panel labels in sync
  const profSfx = document.getElementById('profSfxBtn');
  if (profSfx) profSfx.innerText = (typeof window.isMuted === 'function' && window.isMuted()) ? 'SOUND FX: OFF' : 'SOUND FX: ON';
  const profMusic = document.getElementById('profMusicBtn');
  if (profMusic && window.AppMusic) profMusic.innerText = window.AppMusic.isPlaying() ? 'MUSIC: ON' : 'MUSIC: OFF';
  renderStreak();
  renderMastery();
  renderDailyBonus();

  // ACHIEVEMENTS (visual grid, v7.5 redesign) — v7.15: dynamic count
  const ACH_META = [
    { id: 'first',   ico: '🏆', name: 'FIRST BLOOD' },
    { id: 'win10',   ico: '⚡', name: 'ARCADE ADDICT' },
    { id: 'win50',   ico: '🔥', name: 'FIFTY & FIERCE' },
    { id: 'score1k', ico: '💎', name: 'FOUR-FIGURE' },
    { id: 'score10k',ico: '👑', name: 'HIGH ROLLER' },
    { id: 'combo8',  ico: '🌀', name: 'COMBO STARTER' },
    { id: 'master',  ico: '🎯', name: 'GAME MASTER' },
    { id: 'coins500',ico: '💰', name: 'RICH KID' },
    { id: 'win100',  ico: '⭐', name: 'CENTURY CLUB' },
    { id: 'win500',  ico: '👟', name: 'SNEAKER LEGEND' },
    { id: 'win1000', ico: '📿', name: 'MARATHON MAN' },
    { id: 'score100k',ico:'🌋', name: 'LIFETIME 100K' },
    { id: 'score1m', ico: '🪐', name: 'LIFETIME 1M' },
    { id: 'rich5k',  ico: '💸', name: 'TYCOON' },
    { id: 'rich50k', ico: '🏦', name: 'COIN VAULT' },
    { id: 'revive25',ico: '🐍', name: 'NO RETREAT' }
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
/* Per-game skin mapping — each game gets its own palette (skin-by-game).
   Map game type/category → theme id. Individual games can be overridden below. */
const GAME_SKIN = { _default: 'neon' };
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
  { id: 'neon',   name: 'DARK NEON FUSION', ico: '🌌', desc: 'Deep navy + electric purple/cyan/pink glow', price: 0, palette: {
    bg:'#0D0D1A', glow1:'rgba(139,92,246,.14)', glow2:'rgba(236,72,153,.12)',
    grid:'rgba(139,92,246,.07)', gridv:'rgba(34,211,238,.06)',
    cyan:'#22D3EE', cyan2:'#0EA5E9', pink:'#EC4899', pink2:'#8B5CF6',
    yellow:'#F59E0B', yellow2:'#EF4444', green:'#34D399', red:'#F43F5E',
    accent:'#8B5CF6', accent2:'#EC4899', glass:'rgba(255,255,255,.07)',
    glassBorder:'rgba(139,92,246,.3)', panel:'#121218', sub:'#9CA3AF',
    bgGridSize:'44px 44px' } },
  { id: 'void',   name: 'VOID DARK',   ico: '🌑', desc: 'Pure black, minimal neon',  price: 0, palette: {
    bg:'#000000', glow1:'rgba(139,92,246,.07)', glow2:'rgba(0,0,0,0)',
    grid:'rgba(139,92,246,.04)', gridv:'rgba(99,102,241,.04)',
    cyan:'#A78BFA', cyan2:'#6D28D9', pink:'#C084FC', pink2:'#7C3AED',
    yellow:'#E9D5FF', yellow2:'#a78bfa', green:'#34D399', red:'#F87171',
    accent:'#A78BFA', accent2:'#C084FC', glass:'rgba(255,255,255,.05)',
    glassBorder:'rgba(167,139,250,.35)', panel:'#050508', sub:'#9CA3AF',
    bgGridSize:'44px 44px' } },
  { id: 'sunset', name: 'RETRO SUNSET', ico: '🌇', desc: 'Orange/purple retro vibe', price: 0, palette: {
    bg:'#0B0608', glow1:'rgba(255,107,53,.09)', glow2:'rgba(255,0,128,.07)',
    grid:'rgba(255,107,53,.05)', gridv:'rgba(255,0,128,.05)',
    cyan:'#FFB347', cyan2:'#ff8c00', pink:'#FF6B6B', pink2:'#FF2E63',
    yellow:'#FFD166', yellow2:'#ff9d00', green:'#06D6A0', red:'#FF4D4D',
    accent:'#FFB347', accent2:'#FF6B6B', glass:'rgba(255,255,255,.06)',
    glassBorder:'rgba(255,107,53,.35)', panel:'#12090C', sub:'#B08968',
    bgGridSize:'44px 44px' } },
  { id: 'matrix', name: 'MATRIX GREEN', ico: '💚', desc: 'Green rain terminal look', price: 0, palette: {
    bg:'#020804', glow1:'rgba(34,255,136,.08)', glow2:'rgba(0,255,100,.05)',
    grid:'rgba(34,255,136,.05)', gridv:'rgba(0,255,100,.04)',
    cyan:'#22FF88', cyan2:'#00CC66', pink:'#00FFAA', pink2:'#00B366',
    yellow:'#B8FF5C', yellow2:'#7FDB39', green:'#39FF88', red:'#FF4D4D',
    accent:'#22FF88', accent2:'#00FFAA', glass:'rgba(255,255,255,.06)',
    glassBorder:'rgba(34,255,136,.4)', panel:'#02130A', sub:'#86D9AC',
    bgGridSize:'0 0' } },
  { id: 'royal',  name: 'GOLD ROYAL',  ico: '👑', desc: 'Gold & black luxury',      price: 0, palette: {
    bg:'#070600', glow1:'rgba(255,215,0,.09)', glow2:'rgba(128,0,128,.06)',
    grid:'rgba(255,215,0,.05)', gridv:'rgba(128,0,128,.04)',
    cyan:'#FFD700', cyan2:'#FFB300', pink:'#E6B800', pink2:'#B8860B',
    yellow:'#FFD700', yellow2:'#FFAA00', green:'#FFC107', red:'#E53935',
    accent:'#FFD700', accent2:'#E6B800', glass:'rgba(255,255,255,.06)',
    glassBorder:'rgba(255,215,0,.4)', panel:'#0E0B00', sub:'#C4A870',
    bgGridSize:'44px 44px' } },
  { id: 'neon2',  name: 'NEON VOID',   ico: '🌌', desc: 'Deep purple-blue neon',     price: 0, palette: {
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
let themeBgCtx = null, themeBgRaf = null, themeParticles = [], themeShooting = [], themeTrail = [], frame = 0; // B6: frame counter (declared — strict-mode safe)
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
  if (typeof frame !== 'number') frame = 0; else frame++; // B6: frame counter for alternating glow
  // B6 FIX [111,116]: pause background FX during gameplay to save FPS
  if (document.body.classList.contains('game-active')) { themeBgRaf = requestAnimationFrame(themeBgLoop); return; }
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
  // B6 FIX [112]: cap connections per frame — avoids O(n²) blowup on large screens
  ctx.lineWidth = .6;
  let linesDrawn = 0;
  const MAX_LINES = 60;
  const glowFrame = (frame % 2 === 0); // alternate bloom glow frames (perf)
  for (let i = 0; i < themeParticles.length && linesDrawn < MAX_LINES; i++) {
    const p = themeParticles[i];
    p.x += p.vx; p.y += p.vy; p.pulse += .02;
    if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20;
    if (p.y < -20) p.y = H + 20; if (p.y > H + 20) p.y = -20;
    // only draw lines to the nearest few — skip far ones fast
    for (let j = i + 1; j < themeParticles.length; j++) {
      const q = themeParticles[j];
      const dx = p.x - q.x, dy = p.y - q.y;
      if (dx > 130 || dy > 130 || dx < -130 || dy < -130) continue; // cheap reject
      const d = Math.hypot(dx, dy);
      if (d < 130) {
        ctx.strokeStyle = (p.hue === 'accent' ? accent : accent2);
        ctx.globalAlpha = (1 - d / 130) * .18;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        if (++linesDrawn >= MAX_LINES) break;
      }
    }
    const col = p.hue === 'accent' ? accent : accent2;
    // bloom glow (radial gradient) — every other frame saves AA cost
    if (glowFrame) {
      ctx.globalAlpha = (.25 + .2 * Math.sin(p.pulse)) * .5;
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
      glow.addColorStop(0, col); glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2); ctx.fill();
    }
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

/* Apply a full theme palette to CSS variables (6 themes + per-game skins) */
function applyTheme(id, silent) {
  // resolve: exact theme, or a game id → its palette, else default neon
  let t = THEMES.find(x => x.id === id);
  if (!t) t = THEMES[0];
  // PERSIST only on explicit user choice (non-silent). Silent calls (game-skin apply,
  // exit-restore) must NOT overwrite the saved theme preference with a game palette.
  if (!silent) {
    state.equipped.theme = id;
    saveState();
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

/* ==================== SESSION COMBO SYSTEM (v8.0) ==================== */
// Combo increments each game you play back-to-back (within 3 min window).
// Higher combo = bigger coin/XP multiplier. Milestones at 5/10/15/20.
// Lives in core.js scope (used by launchGame/endGame there); UI helpers in app.js.
const COMBO_WINDOW_MS = 3 * 60 * 1000; // 3 minutes between games to keep combo alive
function getComboMultiplier(count) {
  if (count <= 1) return 1.0;
  if (count <= 3) return 1.2;
  if (count <= 5) return 1.5;
  if (count <= 8) return 2.0;
  if (count <= 12) return 2.5;
  if (count <= 16) return 3.0;
  if (count <= 20) return 4.0;
  return 5.0;
}
function getComboTier(count) {
  if (count >= 20) return { name: 'LEGENDARY', color: '#FFD700', glow: 'rgba(255,215,0,.6)' };
  if (count >= 15) return { name: 'INSANE', color: '#FF10F0', glow: 'rgba(255,16,240,.5)' };
  if (count >= 10) return { name: 'MEGA', color: '#00FFFF', glow: 'rgba(0,255,255,.5)' };
  if (count >= 5)  return { name: 'HOT', color: '#FF6B35', glow: 'rgba(255,107,53,.4)' };
  if (count >= 3)  return { name: 'WARM', color: '#39FF88', glow: 'rgba(57,255,136,.4)' };
  return { name: '', color: '', glow: '' };
}
function updateComboHUD() {
  const el = document.getElementById('hudCombo');
  if (!el) return;
  const c = state.combo || { count: 0 };
  if (c.count < 2) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  const mult = getComboMultiplier(c.count);
  const tier = getComboTier(c.count);
  el.innerHTML = `<i class="fa-solid fa-fire"></i> ${c.count}x COMBO` + (mult > 1 ? ` <span style="color:var(--green);font-size:10px">×${mult}</span>` : '');
  el.style.color = tier.color;
  el.style.borderColor = tier.color + '55';
  el.style.background = tier.color + '15';
  el.style.textShadow = '0 0 8px ' + tier.glow;
}
function applyComboMilestone(count) {
  // Milestone rewards at specific combo levels
  const MILESTONES = [
    { at: 5,  coins: 100, msg: '🔥 5x COMBO! +100 🪙' },
    { at: 10, coins: 300, msg: '⚡ 10x COMBO! +300 🪙' },
    { at: 15, coins: 700, msg: '🌀 15x COMBO! +700 🪙' },
    { at: 20, coins: 1500, msg: '👑 20x COMBO! LEGENDARY +1500 🪙' }
  ];
  const m = MILESTONES.find(x => x.at === count);
  if (m) {
    state.coins += m.coins;
    setTimeout(() => {
      toast(m.msg);
      if (typeof window.hapticVibe === 'function') { try { window.hapticVibe('win'); } catch (e) {} }
    }, 1200);
  }
}
function comboTimeRemaining() {
  if (!state.combo || !state.combo.lastTime) return 0;
  const remain = COMBO_WINDOW_MS - (Date.now() - state.combo.lastTime);
  return Math.max(0, Math.ceil(remain / 1000));
}
// NOTE: comboTimeRemaining is kept as a shared helper (used by a future countdown chip)

/* ==================== INIT ==================== */

// v7.47.2: shop page — category tabs + coin balance (empty hub, items later)
function setShopCat(cat) {
  document.querySelectorAll('#shopTabs .tab').forEach(t => {
    t.classList.toggle('active', t.dataset.cat === cat);
  });
}
function updateShopCoin() {
  const el = document.getElementById('shopCoinDisplay');
  if (el && typeof state !== 'undefined') el.innerText = (state.coins || 0).toLocaleString();
}
function renderShop() {
  updateShopCoin();
}

// v7.46.2: empty-hub layout — hide game sections when no games, show clean coming-soon card
function toggleEmptyHub() {
  const gs = document.getElementById('gameSections');
  const eh = document.getElementById('emptyHubHome');
  const at = document.getElementById('arcadeToolbar');
  const hasGames = (typeof GAMES !== 'undefined') && GAMES.length > 0;
  if (gs) gs.style.display = hasGames ? '' : 'none';
  if (eh) eh.style.display = hasGames ? 'none' : '';
  if (at) { at.style.display = hasGames ? 'flex' : 'none'; }
  // top bar search — pointless when no games
  const sb = document.querySelector('#topBar .search-bar');
  if (sb) sb.style.display = hasGames ? '' : 'none';
}

function init() {
  initErrorHandler();
  toggleEmptyHub();
  // hero text: set immediately from GAMES.length (avoids stale SW cache "COMING SOON")
  const hg = document.getElementById('heroSubCount');
  if (hg) hg.innerText = GAMES.length > 0 ? (GAMES.length + ' GAME' + (GAMES.length > 1 ? 'S' : '') + ' · PLAY INSTANTLY') : '70 CLASSICS · COMING SOON';
  renderShop();
  openAuth();
  navInit();
  initCRT();
  // v7.15: apply persisted mute state at boot (icons sync once DOM is ready)
  if (typeof window.setMuted === 'function') {
    try {
      const wasMuted = localStorage.getItem('rah_muted') === '1';
      window.setMuted(wasMuted);
    } catch (e) {}
  }
  // theme system — apply saved theme + start dynamic particle bg
  globalTheme = state.equipped.theme || 'neon';
  if (typeof applyTheme === 'function') applyTheme(state.equipped.theme || 'neon', true);
  if (typeof initThemeCanvas === 'function') initThemeCanvas();
  // live rotation state (featured/deal/challenge/bots) — safe fallback if missing
  loadLive(() => { try { go('home'); } catch (e) {} });
  // PWA offline support
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then(reg => {
        // check for updates every page load — new SW activates quickly
        reg.update();
        // if a new SW is waiting, skip waiting so updates apply immediately
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          // never hard-reload mid-game — that kills the player's session
          if (document.getElementById('page-game')?.classList.contains('active')) return;
          location.reload();
        });
      }).catch(() => {});
    });
  }
  // hide boot, show UI
  // v7.15: unlock audio on the first user gesture (browsers block autoplay)
  const unlockOnce = () => {
    if (typeof window.setMusicMuted === 'function') {
      try { window.setMusicMuted(false); } catch (e) {}
      if (typeof window.startMusic === 'function') { try { window.startMusic(); } catch (e) {} }
    }
    window.removeEventListener('pointerdown', unlockOnce);
    window.removeEventListener('touchend', unlockOnce);
    window.removeEventListener('keydown', unlockOnce);
  };
  window.addEventListener('pointerdown', unlockOnce);
  window.addEventListener('touchend', unlockOnce);
  window.addEventListener('keydown', unlockOnce);
  document.getElementById('bootLoader').style.display = 'none';
  document.getElementById('topBar').style.display = 'flex';
  document.getElementById('bottomNav').style.display = 'flex';
  document.getElementById('app').style.display = 'block';
  go('home');
  updateCoinDisplay();
  // version badge
  showVersionBadge();
  bootDone = true;
}
document.addEventListener('DOMContentLoaded', init);
// Global error handler — show errorScreen for uncaught errors
let bootDone = false;
function initErrorHandler() {
  window.addEventListener('error', function(e) {
    // ignore harmless ripple/UI errors — only block the screen if the APP failed to boot
    if (!bootDone) {
      const el = document.getElementById('errorScreen');
      const msg = document.getElementById('errorMsg');
      if (el && msg) {
        // [P2 384] never surface raw error strings on screen — generic friendly message only
        msg.textContent = 'The app hit a snag while starting. Tap RELOAD to try again — your progress is safe.';
        el.classList.add('show');
      }
    }
  });
  window.addEventListener('unhandledrejection', function(e) {
    if (!bootDone) {
      const el = document.getElementById('errorScreen');
      const msg = document.getElementById('errorMsg');
      if (el && msg) {
        msg.textContent = 'Async error: ' + (e.reason?.message || String(e.reason || 'unknown'));
        el.classList.add('show');
      }
    }
  });
}

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
      if (gc) {
        if (d.games > 0) gc.innerText = d.games;
        else gc.innerText = 'RETRO';  // empty hub: "RETRO ARCADE" instead of "0 GAMES"
      }
      const sg = document.getElementById('heroStatGames');
      if (sg) sg.innerText = d.games > 0 ? (d.games + '+') : (GAMES.length > 0 ? GAMES.length + '+' : '70+');
      const hsc = document.getElementById('heroSubCount');
      if (hsc) hsc.innerText = d.games > 0 ? (d.games + ' GAMES · PLAY INSTANTLY') : (GAMES.length > 0 ? GAMES.length + ' GAME' + (GAMES.length > 1 ? 'S' : '') + ' · PLAY INSTANTLY' : '70 CLASSICS · COMING SOON');
      // dynamic hero badge version
      const hv = document.getElementById('heroVersionText');
      if (hv) hv.innerText = `NEW UPDATE v${d.version}`;
      // page title too
      if (d.games) document.title = document.title.replace(/\d+ Games/, d.games + ' Games');
    });
    // AUTO-UPDATE: if server version differs from last seen, refresh once to pick up new code
    fetch('version.json').then(r => r.json()).then(d => {
      const last = localStorage.getItem('rh_version');
      if (last && last !== d.version) {
        // never reload mid-game — application update applies on next load
        if (!document.getElementById('page-game')?.classList.contains('active')) {
          localStorage.setItem('rh_version', d.version);
          location.reload();
        }
      }
      localStorage.setItem('rh_version', d.version);
    }).catch(() => {});
  } catch (e) {}
}

// ── Username editor ──
function promptUsername() {
  const inp = document.getElementById('usernameInput');
  if (inp) { inp.focus(); inp.select(); }
}
function setUsername(name) {
  name = (name || '').trim().slice(0, 16) || 'PLAYER';
  state.profile.username = name;
  saveState();
  const el = document.getElementById('playerName');
  if (el) el.innerText = name;
  const inp = document.getElementById('usernameInput');
  if (inp) inp.value = name;
  toast('Name set: ' + name);
}
