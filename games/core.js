/* ============================================================
   RETRO ARCADE HUB — GAME CORE FRAMEWORK
   Loads any game engine, wires canvas, HUD, per-game custom
   touch controls, score/coin collection, pause/restart/exit.
   ============================================================ */

// ---- engine registry ----
// Game files define top-level functions (neonRacer, cyberShooter, ...)
// that become globals. Map game id -> engine function name, resolve
// lazily so script load order never matters.
const GAME_ENGINE = {
  'neon-racer':     'neonRacer',
  'cyber-shooter':  'cyberShooter',
  'pixel-dungeon':  'pixelDungeon',
  'light-cycle':    'lightCycle',
  'neon-snake':     'neonSnake',
  'brick-breaker':  'brickBreaker',
  'tetris-blitz':   'tetrisBlitz',
  'flappy-neon':    'flappyNeon',
  'pac-runner':     'pacRunner',
  'space-invaders': 'spaceInvaders',
  'water-sort':     'waterSort',
  'triple-sort':    'tripleSort',
  'fruit-slash':    'fruitSlash',
  'ludo-king':      'ludoKing',
  'carrom-pool':    'carromPool',
  '2048':           'game2048',
  'hill-climb':     'hillClimb',
  'temple-run':     'templeRun',
  'candy-crush':    'candyCrush',
  'snake-classic':  'snakeClassic'
};

// true when the game's engine file is loaded (window[fn] is a function)
function engineReady(id) {
  return typeof window[GAME_ENGINE[id]] === 'function';
}

// ---- game runtime state ----
let currentGame = null;   // engine instance
let currentEngine = null; // function
let gameState = { id: null, running: false, paused: false, over: false, score: 0, coinsEarned: 0, touches: {}, keys: {} };
// per-game touch/pointer binding (carrom, temple, snake-classic use canvas swipes)
let canvasSwipe = { startX: 0, startY: 0, started: false };
let swipeBinding = null; // { el, handlers } or null

const CTRL_BTN_LABELS = {
  boost:  { icon: 'gauge-high',  text: 'BOOST' },
  action: { icon: 'bolt',        text: 'ACTION' },
  drift:  { icon: 'wind',        text: 'DRIFT' }
};

// ---- per-game canvas touch binding (carrom / temple-run / snake-classic) ----
// Game engines exposing pointerDown/pointerMove/pointerUp or swipe/onSwipe
// get their touch events wired to the canvas automatically.
function bindGameTouch(engine) {
  unbindGameTouch();
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  // pointer-drag style (carrom)
  if (typeof engine.pointerDown === 'function') {
    const down = (e) => { e.preventDefault(); const r = canvas.getBoundingClientRect(); engine.pointerDown(e.clientX - r.left, e.clientY - r.top); };
    const move = (e) => { e.preventDefault(); const r = canvas.getBoundingClientRect(); engine.pointerMove(e.clientX - r.left, e.clientY - r.top); };
    const up = (e) => { e.preventDefault(); engine.pointerUp(); };
    canvas.addEventListener('touchstart', down, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', up, { passive: false });
    canvas.addEventListener('mousedown', down, { passive: false });
    canvas.addEventListener('mousemove', move, { passive: false });
    canvas.addEventListener('mouseup', up, { passive: false });
    swipeBinding = { el: canvas, type: 'pointer', handlers: { down, move, up } };
    return;
  }
  // swipe style (temple-run / snake-classic)
  if (typeof engine.swipe === 'function' || typeof engine.onSwipe === 'function') {
    const cb = typeof engine.swipe === 'function' ? engine.swipe : engine.onSwipe;
    const start = (e) => {
      const t = e.touches ? e.touches[0] : e;
      canvasSwipe.startX = t.clientX; canvasSwipe.startY = t.clientY; canvasSwipe.started = true;
      if (e.preventDefault) e.preventDefault();
    };
    const end = (e) => {
      if (!canvasSwipe.started) return;
      const t = e.changedTouches ? e.changedTouches[0] : e;
      const dx = t.clientX - canvasSwipe.startX;
      const dy = t.clientY - canvasSwipe.startY;
      canvasSwipe.started = false;
      if (Math.hypot(dx, dy) > 20) cb(dx, dy);
      if (e.preventDefault) e.preventDefault();
    };
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchend', end, { passive: false });
    canvas.addEventListener('mousedown', start, { passive: false });
    canvas.addEventListener('mouseup', end, { passive: false });
    swipeBinding = { el: canvas, type: 'swipe', handlers: { start, end } };
    return;
  }
}
function unbindGameTouch() {
  if (swipeBinding) {
    const { el, type, handlers } = swipeBinding;
    if (type === 'pointer') {
      el.removeEventListener('touchstart', handlers.down);
      el.removeEventListener('touchmove', handlers.move);
      el.removeEventListener('touchend', handlers.up);
      el.removeEventListener('mousedown', handlers.down);
      el.removeEventListener('mousemove', handlers.move);
      el.removeEventListener('mouseup', handlers.up);
    } else {
      el.removeEventListener('touchstart', handlers.start);
      el.removeEventListener('touchend', handlers.end);
      el.removeEventListener('mousedown', handlers.start);
      el.removeEventListener('mouseup', handlers.end);
    }
    swipeBinding = null;
  }
}
// keyboard for snake-classic (arrows already global; route to engine too)
function routeKeyToEngine(e) {
  if (currentGame && typeof currentGame.onKey === 'function') {
    currentGame.onKey(e.code);
  }
}
function keyDown(e) {
  routeKeyToEngine(e);
  if (gameState.id && !gameState.over) {
    gameState.keys[e.code] = true;
    e.preventDefault();
  }
}
function keyUp(e) { gameState.keys[e.code] = false; }

// ---- touch buttons ----
function pressed(control, isDown, ev) {
  if (ev && ev.preventDefault) ev.preventDefault();
  gameState.touches[control] = isDown;
  if (isDown && navigator.vibrate) { try { navigator.vibrate(20); } catch (e) {} }
}

// ---- draw per-game custom control panel ----
function drawControls(gameId) {
  const layout = CONTROL_LAYOUT[gameId] || { joystick: false, btns: ['action'], label: 'TAP' };
  const wrap = document.getElementById('touchControls');
  if (!wrap) return;
  let html = '';
  // control hint label
  html += `<div class="ctrl-hint">${layout.label}</div>`;
  if (layout.joystick) {
    html += `<div class="joystick" id="joystick"><div class="knob" id="jKnob"></div></div>`;
  }
  const btnHtml = (layout.btns || []).map(b => {
    const lb = CTRL_BTN_LABELS[b] || { icon: 'circle', text: b.toUpperCase() };
    return `<button class="ctrl-btn${b === 'boost' ? ' ctrl-boost' : ''}${b === 'drift' ? ' ctrl-drift' : ''}" id="btn_${b}"
      ontouchstart="pressed('${b}',true,event)" ontouchend="pressed('${b}',false,event)" ontouchcancel="pressed('${b}',false,event)"
      onmousedown="pressed('${b}',true,event)" onmouseup="pressed('${b}',false,event)" onmouseleave="pressed('${b}',false,event)">
      <i class="fa-solid fa-${lb.icon}"></i>${lb.text}</button>`;
  }).join('');
  if (btnHtml) html += `<div class="ctrl-group">${btnHtml}</div>`;
  wrap.innerHTML = html;
  // wire joystick
  if (layout.joystick) initJoystick();
}

// ---- joystick (virtual) ----
let joystickActive = false;
function initJoystick() {
  const j = document.getElementById('joystick');
  const knob = document.getElementById('jKnob');
  if (!j || !knob) return;
  let base = null;
  const setKnob = (dx, dy) => {
    const max = 34;
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, len / max);
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    gameState.touches.left = dx < -12;
    gameState.touches.right = dx > 12;
    gameState.touches.up = dy < -12;
    gameState.touches.down = dy > 12;
  };
  j.addEventListener('touchstart', (e) => {
    e.preventDefault(); const t = e.touches[0];
    const r = j.getBoundingClientRect();
    base = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    joystickActive = true;
  }, { passive: false });
  j.addEventListener('touchmove', (e) => {
    e.preventDefault(); if (!base) return;
    const t = e.touches[0];
    setKnob(t.clientX - base.x, t.clientY - base.y);
  }, { passive: false });
  j.addEventListener('touchend', () => {
    base = null; joystickActive = false;
    knob.style.transform = 'translate(0,0)';
    gameState.touches.left = gameState.touches.right = gameState.touches.up = gameState.touches.down = false;
  }, { passive: false });
  // mouse fallback
  j.addEventListener('mousedown', (e) => {
    const r = j.getBoundingClientRect();
    base = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; joystickActive = true;
  });
  j.addEventListener('mousemove', (e) => {
    if (!base) return; setKnob(e.clientX - base.x, e.clientY - base.y);
  });
  j.addEventListener('mouseup', () => {
    base = null; joystickActive = false; knob.style.transform = 'translate(0,0)';
    gameState.touches.left = gameState.touches.right = gameState.touches.up = gameState.touches.down = false;
  });
}

// ---- launch a game by id ----
function launchGame(id) {
  const g = GAMES.find(x => x.id === id);
  if (!g) { toast('Game not found'); return; }
  const engine = window[GAME_ENGINE[id]];
  if (typeof engine !== 'function') { toast(g.name + ' — coming soon! 🔒'); return; }

  // switch to game page
  go('game');
  document.getElementById('hudGameTitle').innerText = g.name;
  document.getElementById('hudScore').innerText = '0';
  document.getElementById('hudCoins').innerText = '0';

  // reset game state
  gameState = { id, running: false, paused: false, over: false, score: 0, coinsEarned: 0, touches: {}, keys: {} };

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // create engine instance
  currentEngine = engine;
  currentGame = engine(canvas, ctx,
    (s) => { document.getElementById('hudScore').innerText = s; },
    (score, coinsEarned) => endGame(score, coinsEarned),
    (n) => {
      gameState.coinsEarned += n;
      state.coins += n;
      saveState(); updateCoinDisplay();
      document.getElementById('hudCoins').innerText = '0'; // updated at end
    }
  );

  // draw per-game controls
  drawControls(id);

  // bind canvas touch (carrom/temple/snake-classic)
  bindGameTouch(currentGame);

  // hide game over overlay
  document.getElementById('gameOverOverlay').classList.remove('show');

  // start
  gameState.running = true;
  currentGame.setInput(gameState.touches, gameState.keys);
  currentGame.start();

  // wire keyboard
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
}

// ---- end game ----
function endGame(score, coinsEarned) {
  gameState.over = true;
  gameState.running = false;
  gameState.score = score;
  gameState.coinsEarned = coinsEarned || 0;
  if (currentGame) { try { currentGame.pause(); } catch (e) {} }

  // award coins
  if (coinsEarned > 0) {
    state.coins += coinsEarned;
    saveState(); updateCoinDisplay();
  }

  // best score
  const prevBest = state.best[gameState.id] || 0;
  if (score > prevBest) state.best[gameState.id] = score;

  // stats
  state.stats.gamesPlayed++;
  state.stats.totalScore += score;

  // coins = score * 10% (spec)
  const scoreCoins = Math.floor(score * 0.1);
  state.coins += scoreCoins;
  saveState(); updateCoinDisplay();

  // sync to backend if logged in
  syncScore(gameState.id, score);

  // show overlay
  document.getElementById('overScore').innerText = score.toLocaleString();
  document.getElementById('overCoins').innerText = (coinsEarned + scoreCoins).toLocaleString();
  document.getElementById('overBest').innerText = (state.best[gameState.id] || 0).toLocaleString();
  document.getElementById('overLevel').innerText = '1';
  document.getElementById('gameOverOverlay').classList.add('show');
}

// ---- restart ----
function restartGame() {
  if (!gameState.id) return;
  document.getElementById('gameOverOverlay').classList.remove('show');
  launchGame(gameState.id);
}

// ---- exit to hub ----
function exitToHub() {
  unbindGameTouch();
  if (currentGame) { try { currentGame.destroy(); } catch (e) {} }
  currentGame = null;
  gameState = { id: null, running: false, paused: false, over: false, score: 0, coinsEarned: 0, touches: {}, keys: {} };
  window.removeEventListener('keydown', keyDown);
  window.removeEventListener('keyup', keyUp);
  go('arcade');
  renderArcadeGrid('');
}

// ---- pause / resume ----
function togglePause() {
  if (!gameState.id || gameState.over) return;
  if (gameState.paused) {
    gameState.paused = false;
    if (currentGame) { try { currentGame.resume(); } catch (e) {} }
  } else {
    gameState.paused = true;
    if (currentGame) { try { currentGame.pause(); } catch (e) {} }
  }
}

// ---- share ----
function shareGame() {
  const url = location.origin + location.pathname;
  const text = `I just scored ${gameState.score.toLocaleString()} on ${(GAMES.find(g => g.id === gameState.id) || {}).name} at RETRO ARCADE HUB! 👑`;
  if (navigator.share) {
    navigator.share({ title: 'RETRO ARCADE HUB', text, url }).catch(() => {});
  } else {
    toast('Try another platform to share');
  }
}

// ---- wire card clicks to launch (replaces comingSoon) ----
function playGame(id, e) {
  if (e) e.stopPropagation();
  launchGame(id);
}
