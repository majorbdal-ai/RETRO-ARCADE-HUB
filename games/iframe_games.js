/* ============================================================
   RETRO ARCADE HUB — ORIGINAL (ZIP) GAMES IFRAME HOST
   Isolated host code for games that ship as their own full
   web app (2048, Neon Flap, ...). Each game stays in its own
   folder with its own index.html + assets — zero mixing.
   The hub only frames the pristine app and bridges coins.
   Loaded AFTER games/core.js (uses its state/targets/hooks).
   ============================================================ */
'use strict';

// ---------------- 2048 (original app) ----------------
let _2048lastBest = 0;      // hub-side copy of the original game's best score
let _2048started = false;   // true once the iframe engine has booted a run
let _2048maxTile = 0;       // hub-side max tile seen this session (tier haptics)

function launchOrig2048() {
  const g = GAMES.find(x => x.id === '2048');
  if (typeof window.pushGameHistory === 'function') { try { window.pushGameHistory(); } catch (e) {} }
  if (typeof window.applyGameSkin === 'function') { try { window.applyGameSkin('2048'); } catch (e) {} }
  go('game');
  if (document.fullscreenEnabled && !document.fullscreenElement) {
    try { const p = document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  }
  if (typeof window.showTutorialToast === 'function') { try { window.showTutorialToast(g, '2048'); } catch (e) {} }
  document.getElementById('hudGameTitle').innerText = g.name;
  document.getElementById('hudScore').innerText = '0';
  const hudLivesEl = document.getElementById('hudLives');
  if (hudLivesEl) hudLivesEl.style.display = 'none';
  const hudComboEl = document.getElementById('hudCombo');
  if (hudComboEl) hudComboEl.style.display = 'none';
  const hudRevengeEl = document.getElementById('hudRevenge');
  if (hudRevengeEl) hudRevengeEl.style.display = 'none';
  lockGameScroll(true);
  gameState = { id: '2048', running: true, paused: false, over: false, score: 0, coinsEarned: 0, touches: {}, keys: {} };
  document.body.classList.add('game-2048');
  // switch the canvas host to the original app
  const canvas = document.getElementById('gameCanvas');
  const frame = document.getElementById('orig2048Frame');
  const stage = document.getElementById('orig2048Stage');
  if (canvas) canvas.style.display = 'none';
  if (stage) stage.style.display = 'flex';
  if (frame) {
    frame.style.display = 'block';
    // (re)load the pristine original — never mutated.
    // Version query defeats stale SW/browser caches that kept the pre-override
    // 2048 page (duplicate title, desktop-size board cut off on phones).
    frame.src = '2048/index.html?v=' + (window.APP_VERSION || Date.now());
  }
  _2048started = false;
  _2048lastBest = 0;
  _2048maxTile = 0;
  const coinsEl = document.getElementById('origLocalCoins');
  if (coinsEl) coinsEl.innerText = '0';
  const hubScore = document.getElementById('orig2048Score');
  if (hubScore) hubScore.innerText = '0';
  const hubBest = document.getElementById('orig2048Best');
  if (hubBest) hubBest.innerText = String(state.best['2048'] || 0);
  // keep the hub HUD top score in sync with the original's live score via rAF polling
  if (window._2048poll) { try { clearInterval(window._2048poll); } catch (e) {} }
  window._2048poll = setInterval(() => {
    try {
      const fr = document.getElementById('orig2048Frame');
      if (fr && fr.contentWindow && fr.contentWindow.localStorage) {
        const ls = fr.contentWindow.localStorage;
        const stJSON = ls.getItem('gameState');
        if (stJSON) {
          const st = JSON.parse(stJSON);
          if (st && typeof st.score === 'number') {
            _2048started = true;
            const bestNow = parseInt(ls.getItem('bestScore') || '0', 10) || 0;
            try { _2048hapticBridge(st, bestNow); } catch (e) {}
            if (st.score !== gameState.score) {
              gameState.score = st.score;
              document.getElementById('hudScore').innerText = String(st.score);
              const hb = document.getElementById('orig2048Score');
              if (hb) hb.innerText = String(st.score);
              const cEl = document.getElementById('origLocalCoins');
              if (cEl) cEl.innerText = String(Math.floor(st.score / 10));
            }
          }
        }
        const best = parseInt(ls.getItem('bestScore') || '0', 10) || 0;
        if (best > _2048lastBest) {
          _2048lastBest = best;
          const hb = document.getElementById('orig2048Best');
          if (hb) hb.innerText = String(Math.max(best, state.best['2048'] || 0));
        }
      }
    } catch (e) {}
  }, 500);
  document.getElementById('gameOverOverlay').classList.remove('show');
}

// Haptic bridge for iframe originals (2048 pristine zip = zero vibration, unlike
// Neon Flap which vibrates via me.device.vibrate). The hub polls each iframe's own
// LocalStorage — it can tap THE SAME data for feel: tile-tier buzzes, merge-back
// buzz, best-score beat pulse, game-over rattle. Fired only from the poll (the
// originals' internals are never touched). Mirrors core.js haptic() patterns.
// `st` = the ORIGINAL serialized game state {score, over, won, grid}; `best` is
// read separately from its own localStorage key (the original does not serialize it).
function _2048hapticBridge(st, bestNow) {
  if (!navigator || typeof navigator.vibrate !== 'function' || !st) return;
  // max tile on the board this tick (from the original's own grid)
  let maxTile = 0;
  try {
    if (st.grid && Array.isArray(st.grid.cells)) {
      for (const c of st.grid.cells) {
        for (const t of c) { if (t && t.value > maxTile) maxTile = t.value; }
      }
    }
  } catch (e) {}
  // tile tiers: 32/64/128/256/512… → escalating buzz (feels like a shake)
  if (maxTile > _2048maxTile) {
    const t = maxTile;
    _2048maxTile = t;
    const tries = Math.log2(t) || 0;
    if (t >= 128 && tries && tries % 2 === 0) {
      const buzz = Math.min(30 + tries * 4, 80);
      try { navigator.vibrate([buzz, 30, Math.min(buzz + 20, 90)]); } catch (e) {}
    } else if (t >= 16) {
      try { navigator.vibrate(18); } catch (e) {}
    }
  }
  // new-best beat pulse (once per run)
  if (bestNow > _2048lastBest) {
    _2048lastBest = bestNow;
    try { navigator.vibrate([20, 30, 20, 30, 60]); } catch (e) {}
  }
  // game-over rattle (light only; the overlay handles the heavy death feel)
  if (st.over && !_2048hapticFiredOver) {
    _2048hapticFiredOver = true;
    try { navigator.vibrate([40, 30, 70]); } catch (e) {}
  }
}
let _2048hapticFiredOver = false; // one rattle per run

// Coin bridge for the original 2048: called when the player leaves the iframe
// (LOBBY) or on a run's game-over. Uses the ORIGINAL game's own state, so a
// 100%-untouched zip needs zero instrumentation.
function settleOrig2048() {
  if (!gameState.id || gameState.id !== '2048') return;
  if (gameState.over) return; // already settled
  gameState.over = true;
  gameState.running = false;
  let score = gameState.score || 0;
  let coins = 0;
  try {
    const frame = document.getElementById('orig2048Frame');
    if (frame && frame.contentWindow && frame.contentWindow.localStorage) {
      const ls = frame.contentWindow.localStorage;
      const stJSON = ls.getItem('gameState');
      if (stJSON) {
        const st = JSON.parse(stJSON);
        if (st && typeof st.score === 'number') score = Math.max(score, st.score);
      }
      const best = parseInt(ls.getItem('bestScore') || '0', 10) || 0;
      if (best > _2048lastBest) _2048lastBest = best;
      const hubBest = document.getElementById('orig2048Best');
      if (hubBest) hubBest.innerText = String(Math.max(score, best, state.best['2048'] || 0));
    }
  } catch (e) {}
  // coins from the ORIGINAL scoring (10% of score like the hub economy)
  coins = Math.floor(score / 10);
  clearInterval(window._2048poll);
  window._2048poll = null;
  const prevBest = state.best['2048'] || 0;
  const isNewBest = score > prevBest;
  if (isNewBest) state.best['2048'] = score;
  // TODAY'S CHALLENGE (v7.39): the original 2048 settles here (not via
  // endGame), so the once-per-day beat-your-best bonus is paid out here too.
  const challId2048 = (typeof window.liveChallenge === 'function') ? (window.liveChallenge() || null) : null;
  if (challId2048 === '2048' && isNewBest && score > 0) {
    const challKey = 'rah_chall_' + new Date().toDateString();
    try {
      if (localStorage.getItem(challKey) !== 'done') {
        localStorage.setItem(challKey, 'done');
        state.coins += 40;
        if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
        if (typeof window.hapticVibe === 'function') { try { window.hapticVibe('win'); } catch (e) {} }
        setTimeout(() => toast('🏆 CHALLENGE BONUS: +40 🪙'), 900);
      }
    } catch (e) {}
  }
  if (Math.floor(score / 10) > 0) state.coins += Math.floor(score / 10);
  if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
  if (gameFX) { try { gameFX.deathFX(); } catch(e) {} }
  const gc = document.getElementById('gameCanvas');
  const frameEl = document.getElementById('orig2048Frame');
  const stageEl = document.getElementById('orig2048Stage');
  if (gc) gc.style.display = '';
  if (frameEl) { try { frameEl.style.display = 'none'; } catch (e) {} }
  if (stageEl) stageEl.style.display = 'none';
  document.body.classList.remove('game-2048');
  document.getElementById('gameOverOverlay').classList.add('show');
  document.getElementById('overScore').innerText = String(score);
  document.getElementById('overCoins').innerText = String(Math.floor(score / 10));
  document.getElementById('overBest').innerText = String(Math.max(prevBest, score));
  // stars via the same GAME_TARGETS tiering as every other game
  const tgt = GAME_TARGETS['2048'];
  let stars = !tgt ? 1 : score >= tgt ? 3 : score >= tgt * 0.6 ? 2 : 1;
  if (typeof state.stars !== 'object' || state.stars === null) state.stars = {};
  const prevStars = state.stars['2048'] || 0;
  if (stars > prevStars) state.stars['2048'] = stars;
  const starEls = document.querySelectorAll('#overStars span');
  if (starEls.length) {
    for (let i = 0; i < 3; i++) {
      starEls[i].style.opacity = i < stars ? '1' : '0.22';
      starEls[i].style.filter = i < stars ? 'none' : 'grayscale(1)';
    }
  }
  document.getElementById('overStarProg').style.display = stars >= 1 ? 'block' : 'none';
  const fill = document.getElementById('overStarProgFill');
  const label = document.getElementById('overStarProgLabel');
  if (fill) fill.style.width = (Math.min(100, Math.floor((score / tgt) * 100)) + '%');
  if (label) label.innerText = 'NEXT STAR: ' + (tgt && score < tgt ? tgt + ' | ' + Math.floor(score / tgt * 100) + '%' : 'MAX ★★★');
  reviveUsed = false;
  pendingRevenge = false;
  gameState.coinsEarned = coins;
  if (typeof window.saveState === 'function') { try { window.saveState(); } catch (e) {} }
  if (typeof window.updateCoinDisplay === 'function') { try { window.updateCoinDisplay(); } catch (e) {} }
}

// restart for the original 2048 = reload the pristine iframe
function restartOrig2048() {
  if (!gameState.id || gameState.id !== '2048') return;
  if (gameState.over) { gameState.over = false; }
  clearInterval(window._2048poll); window._2048poll = null;
  _2048lastBest = 0;
  _2048maxTile = 0;
  _2048hapticFiredOver = false;
  const gc = document.getElementById('gameCanvas');
  const frameEl = document.getElementById('orig2048Frame');
  try {
    if (frameEl && frameEl.contentWindow && frameEl.contentWindow.location) {
      frameEl.contentWindow.location.reload();
    } else if (frameEl) { frameEl.src = '2048/index.html'; }
  } catch (e) { if (frameEl) frameEl.src = '2048/index.html'; }
  if (gc) gc.style.display = 'none';
  const stg = document.getElementById('orig2048Stage');
  if (stg) stg.style.display = 'flex';
  gameState = { id: '2048', running: true, paused: false, over: false, score: 0, coinsEarned: 0, touches: {}, keys: {} };
  document.getElementById('hudScore').innerText = '0';
  document.getElementById('gameOverOverlay').classList.remove('show');
  const rCoins = document.getElementById('origLocalCoins');
  if (rCoins) rCoins.innerText = '0';
  const hb = document.getElementById('orig2048Score');
  if (hb) hb.innerText = '0';
  if (window._2048poll) {} else {
    window._2048poll = setInterval(() => {
      try {
        const fr = document.getElementById('orig2048Frame');
        if (fr && fr.contentWindow && fr.contentWindow.localStorage) {
          const ls = fr.contentWindow.localStorage;
          const stJSON = ls.getItem('gameState');
          if (stJSON) {
            const st = JSON.parse(stJSON);
            if (st && typeof st.score === 'number') {
              _2048started = true;
              if (st.score !== gameState.score) {
                gameState.score = st.score;
                document.getElementById('hudScore').innerText = String(st.score);
                const scEl = document.getElementById('orig2048Score');
                if (scEl) scEl.innerText = String(st.score);
                const cEl = document.getElementById('origLocalCoins');
                if (cEl) cEl.innerText = String(Math.floor(st.score / 10));
              }
            }
          }
        }
      } catch (e) {}
    }, 500);
  }
}

// ---------------- NEON FLAP (original app) ----------------
let _nfFrame = null;
let _sfPoll = null;
let _sfLastBest = 0;
let _sfBracket = 0;         // last landmark bracket seen (topSteps/10) — hub milestone haptics

function launchOrigNeonFlap() {
  const g = GAMES.find(x => x.id === 'neon-flap');
  if (!g) return;
  if (typeof window.pushGameHistory === 'function') { try { window.pushGameHistory(); } catch (e) {} }
  if (typeof window.applyGameSkin === 'function') { try { window.applyGameSkin('neon-flap'); } catch (e) {} }
  go('game');
  if (document.fullscreenEnabled && !document.fullscreenElement) {
    try { const p = document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  }
  if (typeof window.showTutorialToast === 'function') { try { window.showTutorialToast(g, 'neon-flap'); } catch (e) {} }
  document.getElementById('hudGameTitle').innerText = g.name;
  document.getElementById('hudScore').innerText = '0';
  const hudLivesEl = document.getElementById('hudLives');
  if (hudLivesEl) hudLivesEl.style.display = 'none';
  const hudComboEl = document.getElementById('hudCombo');
  if (hudComboEl) hudComboEl.style.display = 'none';
  const hudRevengeEl = document.getElementById('hudRevenge');
  if (hudRevengeEl) hudRevengeEl.style.display = 'none';
  lockGameScroll(true);
  gameState = { id: 'neon-flap', running: true, paused: false, over: false, score: 0, coinsEarned: 0, touches: {}, keys: {} };
  document.body.classList.add('game-neonflap');
  const canvas = document.getElementById('gameCanvas');
  const stage = document.getElementById('neonflapStage');
  if (canvas) canvas.style.display = 'none';
  if (stage) stage.style.display = 'flex';
  _nfFrame = document.getElementById('neonflapFrame');
  if (_nfFrame) {
    _nfFrame.style.display = 'block';
    _nfFrame.src = 'neon-flap/index.html?v=' + (window.APP_VERSION || Date.now());
  }
  _sfLastBest = 0;
  _sfBracket = 0;
  const coinsEl = document.getElementById('sfCoins');
  if (coinsEl) coinsEl.innerText = '0';
  // poll the iframe's own localStorage score (engine stores topSteps)
  if (_sfPoll) clearInterval(_sfPoll);
  _sfPoll = setInterval(() => {
    if (!gameState || gameState.id !== 'neon-flap') return;
    try {
      if (_nfFrame && _nfFrame.contentWindow && _nfFrame.contentWindow.localStorage) {
        const ls = _nfFrame.contentWindow.localStorage;
        const top = parseInt(ls.getItem('topSteps') || '0', 10) || 0;
        if (top > _sfLastBest) {
          // milestone brackets: every 10 steps above a previous all-time high
          // (the poll only sees topSteps cross a NEW best) → short tick. Distinct
          // from the engine's own collision buzz (me.device.vibrate(500)).
          _sfLastBest = top;
          const br = Math.floor(top / 10);
          if (br > _sfBracket && navigator && typeof navigator.vibrate === 'function') {
            _sfBracket = br;
            // 10/20/30… = light tick; every 50 (50/100/150) = win pulse
            try { navigator.vibrate(br % 5 === 0 ? [20, 30, 20, 30, 60] : 15); } catch (e) {}
          }
          if (document.getElementById('hudScore')) document.getElementById('hudScore').innerText = String(top);
        }
      }
    } catch (e) {}
  }, 800);
}

// settle = award hub coins from the game's own best steps (blind-box economy)
function settleOrigNeonFlap() {
  if (!gameState || gameState.id !== 'neon-flap' || gameState.over) return;
  gameState.over = true;
  gameState.running = false;
  let score = gameState.score || 0;
  try {
    if (_nfFrame && _nfFrame.contentWindow && _nfFrame.contentWindow.localStorage) {
      const ls = _nfFrame.contentWindow.localStorage;
      const top = parseInt(ls.getItem('topSteps') || '0', 10) || 0;
      score = Math.max(score, top);
    }
  } catch (e) {}
  const coins = Math.floor(score / 10);
  gameState.score = score;
  gameState.coinsEarned = coins;
  const prevBest = state.best['neon-flap'] || 0;
  const isNewBest = score > prevBest;
  if (isNewBest) state.best['neon-flap'] = score;
  if (coins > 0) state.coins += coins;
  if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
  if (gameFX) { try { gameFX.deathFX(); } catch (e) {} }
  if (_sfPoll) clearInterval(_sfPoll);
  _sfPoll = null;
  const gc = document.getElementById('gameCanvas');
  const stg = document.getElementById('neonflapStage');
  if (gc) gc.style.display = '';
  if (stg) stg.style.display = 'none';
  document.body.classList.remove('game-neonflap');
  document.getElementById('gameOverOverlay').classList.add('show');
  document.getElementById('overScore').innerText = String(score);
  document.getElementById('overCoins').innerText = String(coins);
  document.getElementById('overBest').innerText = String(Math.max(prevBest, score));
  const tgt = GAME_TARGETS['neon-flap'];
  let stars = !tgt ? 1 : score >= tgt ? 3 : score >= tgt * 0.6 ? 2 : 1;
  if (typeof state.stars !== 'object' || state.stars === null) state.stars = {};
  const prevStars = state.stars['neon-flap'] || 0;
  if (stars > prevStars) state.stars['neon-flap'] = stars;
  const starEls = document.querySelectorAll('#overStars span');
  if (starEls.length) {
    for (let i = 0; i < 3; i++) {
      starEls[i].style.opacity = i < stars ? '1' : '0.22';
      starEls[i].style.filter = i < stars ? 'none' : 'grayscale(1)';
    }
  }
  document.getElementById('overStarProg').style.display = stars >= 1 ? 'block' : 'none';
  const fill = document.getElementById('overStarProgFill');
  if (fill) fill.style.width = (tgt ? Math.min(100, Math.floor((score / tgt) * 100)) : 100) + '%';
  const label = document.getElementById('overStarProgLabel');
  if (label) label.innerText = 'NEXT STAR: ' + (tgt && score < tgt ? tgt + ' | ' + Math.floor(score / tgt * 100) + '%' : 'MAX ★★★');
  reviveUsed = false;
  pendingRevenge = false;
  if (typeof window.saveState === 'function') { try { window.saveState(); } catch (e) {} }
  if (typeof window.updateCoinDisplay === 'function') { try { window.updateCoinDisplay(); } catch (e) {} }
  setTimeout(() => toast('🪙 Earned: ' + coins), 700);
}

function restartOrigNeonFlap() {
  if (!gameState || gameState.id !== 'neon-flap') return;
  if (gameState.over) gameState.over = false;
  if (_sfPoll) clearInterval(_sfPoll);
  _sfPoll = null;
  _sfLastBest = 0;
  _sfBracket = 0;
  const gc = document.getElementById('gameCanvas');
  if (gc) gc.style.display = 'none';
  const stg = document.getElementById('neonflapStage');
  if (stg) stg.style.display = 'flex';
  if (_nfFrame) {
    try {
      if (_nfFrame.contentWindow && _nfFrame.contentWindow.location) {
        _nfFrame.contentWindow.location.reload();
      } else { _nfFrame.src = 'neon-flap/index.html'; }
    } catch (e) { _nfFrame.src = 'neon-flap/index.html'; }
  }
  gameState = { id: 'neon-flap', running: true, paused: false, over: false, score: 0, coinsEarned: 0, touches: {}, keys: {} };
  document.getElementById('hudScore').innerText = '0';
  document.getElementById('overScore').innerText = '0';
  document.getElementById('gameOverOverlay').classList.remove('show');
  document.body.classList.add('game-neonflap');
  const cEl = document.getElementById('sfCoins');
  if (cEl) cEl.innerText = '0';
  _sfPoll = setInterval(() => {
    if (!gameState || gameState.id !== 'neon-flap') return;
    try {
      if (_nfFrame && _nfFrame.contentWindow && _nfFrame.contentWindow.localStorage) {
        const ls = _nfFrame.contentWindow.localStorage;
        const top = parseInt(ls.getItem('topSteps') || '0', 10) || 0;
        if (top > _sfLastBest) {
          _sfLastBest = top;
          const br = Math.floor(top / 10);
          if (br > _sfBracket && navigator && typeof navigator.vibrate === 'function') {
            _sfBracket = br;
            try { navigator.vibrate(br % 5 === 0 ? [20, 30, 20, 30, 60] : 15); } catch (e) {}
          }
          if (document.getElementById('hudScore')) document.getElementById('hudScore').innerText = String(top);
        }
      }
    } catch (e) {}
  }, 800);
}