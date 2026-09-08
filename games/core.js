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
  'snake-classic':  'snakeClassic',
  'tank-battle':          'tankBattle',
  'airstrike':          'airStrike',
  'fruit-merge':          'fruitMerge',
  'bubble-shooter':          'bubbleShooter',
  'piano-tiles':          'pianoTiles',
  'duck-hunt':          'duckHunt',
  'neon-dash':          'neonDash',
  'color-switch':          'colorSwitch',
  'neon-jumper':          'neonJumper',
  'stack-drop':          'stackDrop',
  'helix-drop':          'helixDrop',
  'traffic-racer':          'trafficRacer',
  'dino-run':          'dinoRun',
  'sling-birds':          'slingBirds',
  'pong':          'pong',
  'table-tennis':          'tableTennis',
  'bowling-strike':          'bowlingStrike',
  'cricket-sixer':          'cricketSixer',
  'hoop-dunk':          'hoopDunk',
  'archery-master':          'archeryMaster',
  'soccer-penalty':          'soccerPenalty',
  'athletics-sprint':          'athleticsSprint',
  'flow-free':          'flowFree',
  'word-search':          'wordSearch',
  'memory-match':          'memoryMatch',
  'mine-sweeper':          'mineSweeper',
  'sudoku':          'sudoku',
  'mastermind':          'mastermind',
  'simon-says':          'simonSays',
  'tic-tac-toe':          'ticTacToe',
  'connect-four':          'connectFour',
  'checkers':          'checkers',
  'slide-puzzle':          'slidePuzzle',
  'nonogram':          'nonogram',
  'lucky-spin':          'luckySpin',
  'pinball':          'pinBall',
  'crossy-neon':          'crossyNeon',
  'trash-sorter':          'trashSorter',
  'ladder-climb':          'ladderClimb',
  'math-dash':          'mathDash',
};

// true when the game's engine file is available (all 60 are; lazy-loaded on launch)
function engineReady(id) {
  return !!GAME_ENGINE[id];
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
  // generic swipe fallback → touches (snake, light-cycle, 2048, invaders, pac-runner, etc.)
  if (typeof engine.swipe !== 'function' && typeof engine.onSwipe !== 'function' && typeof engine.pointerDown !== 'function') {
    let swipeDirTimer = null;
    const clearDir = () => { gameState.touches.left = gameState.touches.right = gameState.touches.up = gameState.touches.down = false; };
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
      if (Math.hypot(dx, dy) > 20) {
        clearDir();
        if (Math.abs(dx) > Math.abs(dy)) { gameState.touches.left = dx < 0; gameState.touches.right = dx > 0; }
        else { gameState.touches.up = dy < 0; gameState.touches.down = dy > 0; }
        clearTimeout(swipeDirTimer);
        swipeDirTimer = setTimeout(clearDir, 300); // hold direction briefly so touch→key bridge fires
      }
      if (e.preventDefault) e.preventDefault();
    };
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchend', end, { passive: false });
    canvas.addEventListener('mousedown', start, { passive: false });
    canvas.addEventListener('mouseup', end, { passive: false });
    swipeBinding = { el: canvas, type: 'swipe', handlers: { start, end } };
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

// ---- lock page scroll during gameplay (mobile) ----
function lockGameScroll(lock) {
  const lockFn = (e) => { e.preventDefault(); };
  if (lock) {
    if (!window.__scrollLock) {
      window.__scrollLock = lockFn;
      document.addEventListener('touchmove', lockFn, { passive: false });
    }
  } else if (window.__scrollLock) {
    document.removeEventListener('touchmove', window.__scrollLock);
    window.__scrollLock = null;
  }
}

// ---- synth sound effects (WebAudio, zero assets) ----
let sfxCtx = null;
function ensureSfx() {
  try {
    if (!sfxCtx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) sfxCtx = new AC(); }
    if (sfxCtx && sfxCtx.state === 'suspended') sfxCtx.resume();
  } catch (e) {}
  return sfxCtx;
}
function sfxTone(freq, dur, type, gain, slideTo) {
  if (isMuted()) return;
  const ctx = ensureSfx(); if (!ctx) return;
  try {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(gain || 0.05, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  } catch (e) {}
}
const SFX = {
  click()  { sfxTone(660, 0.06, 'square', 0.035); },
  pop()    { sfxTone(520, 0.09, 'sine', 0.06, 880); },
  coin()   { sfxTone(988, 0.08, 'square', 0.045); setTimeout(() => sfxTone(1319, 0.14, 'square', 0.045), 70); },
  hit()    { sfxTone(180, 0.12, 'sawtooth', 0.05, 90); },
  over()   { sfxTone(392, 0.18, 'sawtooth', 0.05, 130); setTimeout(() => sfxTone(196, 0.28, 'sawtooth', 0.05, 60), 160); },
  launch() { sfxTone(440, 0.1, 'square', 0.045, 880); },
  win()    { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => sfxTone(f, 0.12, 'square', 0.045), i * 90)); }
};
window.playSfx = (n) => { try { SFX[n] && SFX[n](); } catch (e) {} };

// ---- touch buttons (with ripple visual feedback) ----
let lastRippleAt = 0;
function pressed(control, isDown, ev) {
  if (ev && ev.preventDefault) ev.preventDefault();
  gameState.touches[control] = isDown;
  if (isDown) {
    if (navigator.vibrate) { try { navigator.vibrate(20); } catch (e) {} }
    if (typeof window.playSfx === 'function') { try { window.playSfx('click'); } catch (e) {} }
  }
  // touch ripple — visual press feedback on the control (throttled)
  const now = Date.now();
  const btn = ev && ev.currentTarget;
  if (isDown && btn && btn.getBoundingClientRect && now - lastRippleAt > 90) {
    lastRippleAt = now;
    try {
      const r = btn.getBoundingClientRect();
      const ink = document.createElement('span');
      ink.className = 'ripple-ink';
      ink.style.cssText = `position:absolute;border-radius:50%;background:rgba(255,255,255,.35);width:${r.width}px;height:${r.width}px;left:0;top:0;transform:scale(0);animation:rippleAnim .5s ease-out forwards;pointer-events:none`;
      btn.style.position = btn.style.position || 'relative';
      btn.appendChild(ink);
      setTimeout(() => ink.remove(), 550);
    } catch (e) {}
  }
}

// ---- draw per-game custom control panel ----
function drawControls(gameId) {
  const layout = CONTROL_LAYOUT[gameId] || { type: 'tap', hint: 'TAP' };
  const wrap = document.getElementById('touchControls');
  if (!wrap) return;
  let html = '';
  // control hint label
  html += `<div class="ctrl-hint">${layout.hint || 'TAP'}</div>`;

  const type = layout.type || 'tap';
  // Canvas-based / no virtual buttons (game handles its own canvas touch)
  if (type === 'canvas') {
    html += `<div class="ctrl-spacer"></div>`;
  }
  // Swipe + rotate button (tetris: swipe move + tap rotate)
  else if (type === 'swipe+drag') {
    html += `<div class="ctrl-group"><button class="ctrl-btn" id="btn_action" ontouchstart="pressed('action',true,event)" ontouchend="pressed('action',false,event)" ontouchcancel="pressed('action',false,event)" onmousedown="pressed('action',true,event)" onmouseup="pressed('action',false,event)" onmouseleave="pressed('action',false,event)"><i class="fa-solid fa-rotate"></i>ROTATE</button></div>`;
  }
  // Swipe-only
  else if (type === 'swipe') {
    html += `<div class="ctrl-spacer"></div>`;
  }
  // Virtual joystick (single)
  else if (type === 'joystick') {
    html += `<div class="joystick" id="joystick"><div class="knob" id="jKnob"></div></div>`;
  }
  // Joystick + ACTION button (pixel-dungeon: move + attack)
  else if (type === 'joystick2') {
    html += `<div class="joystick" id="joystick"><div class="knob" id="jKnob"></div></div>`;
    html += `<div class="ctrl-group"><button class="ctrl-btn" id="btn_action" ontouchstart="pressed('action',true,event)" ontouchend="pressed('action',false,event)" ontouchcancel="pressed('action',false,event)" onmousedown="pressed('action',true,event)" onmouseup="pressed('action',false,event)" onmouseleave="pressed('action',false,event)"><i class="fa-solid fa-hand-fist"></i>ATTACK</button></div>`;
  }
  // Dual joystick (tank battle)
  else if (type === 'dual') {
    html += `<div class="joystick" id="joyL"><div class="knob" id="jKnobL"></div></div>`;
    html += `<div class="joystick" id="joyR"><div class="knob" id="jKnobR"></div></div>`;
  }
  // Tilt display (accelerometer-based on device; buttons fallback)
  else if (type === 'tilt') {
    html += `<div class="ctrl-tilt"><i class="fa-solid fa-mobile-screen-button"></i><span>TILT</span></div>`;
    html += `<div class="ctrl-group">
      <button class="ctrl-btn ctrl-boost" id="btn_boost" ontouchstart="pressed('boost',true,event)" ontouchend="pressed('boost',false,event)" ontouchcancel="pressed('boost',false,event)" onmousedown="pressed('boost',true,event)" onmouseup="pressed('boost',false,event)" onmouseleave="pressed('boost',false,event)"><i class="fa-solid fa-gauge-high"></i>BOOST</button>
      <button class="ctrl-btn ctrl-drift" id="btn_drift" ontouchstart="pressed('drift',true,event)" ontouchend="pressed('drift',false,event)" ontouchcancel="pressed('drift',false,event)" onmousedown="pressed('drift',true,event)" onmouseup="pressed('drift',false,event)" onmouseleave="pressed('drift',false,event)"><i class="fa-solid fa-wind"></i>DRIFT</button>
    </div>`;
  }
  // Touch-split (hill-climb: left gas / right brake)
  else if (type === 'touch') {
    html += `<div class="ctrl-touch-left" id="touchLeft" ontouchstart="pressed('gas',true,event)" ontouchend="pressed('gas',false,event)" ontouchcancel="pressed('gas',false,event)" onmousedown="pressed('gas',true,event)" onmouseup="pressed('gas',false,event)" onmouseleave="pressed('gas',false,event)"><i class="fa-solid fa-gas-pump"></i><span>GAS</span></div>`;
    html += `<div class="ctrl-touch-right" id="touchRight" ontouchstart="pressed('brake',true,event)" ontouchend="pressed('brake',false,event)" ontouchcancel="pressed('brake',false,event)" onmousedown="pressed('brake',true,event)" onmouseup="pressed('brake',false,event)" onmouseleave="pressed('brake',false,event)"><i class="fa-solid fa-brake-warning"></i><span>BRAKE</span></div>`;
  }
  // Tap-only: single big action button (or just hint)
  else if (type === 'tap') {
    html += `<div class="ctrl-tap-area" id="ctrlTap" onclick="pressed('action',true,event);setTimeout(()=>pressed('action',false,event),80)"><i class="fa-solid fa-hand-pointer"></i><span>TAP</span></div>`;
  } else {
    html += `<div class="ctrl-spacer"></div>`;
  }
  wrap.innerHTML = html;
  // wire joystick(s)
  if (type === 'joystick') initJoystick('joystick', 'jKnob', 'main');
  else if (type === 'dual') { initJoystick('joyL', 'jKnobL', 'left'); initJoystick('joyR', 'jKnobR', 'right'); }
}

// ---- joystick (virtual) — multi-instance (main / left / right) ----
let joystickActive = false;
function initJoystick(elId, knobId, axis) {
  const j = document.getElementById(elId);
  const knob = document.getElementById(knobId);
  if (!j || !knob) return;
  let base = null;
  const setKnob = (dx, dy) => {
    const max = 34;
    const len = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, len / max);
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    if (axis === 'left') {
      gameState.touches.up = dy < -12;
      gameState.touches.down = dy > 12;
      gameState.touches.left = dx < -12;
      gameState.touches.right = dx > 12;
      gameState.touches.tankMove = { x: dx / max, y: dy / max };
    } else if (axis === 'right') {
      gameState.touches.tankAim = { x: dx / max, y: dy / max };
    } else {
      gameState.touches.left = dx < -12;
      gameState.touches.right = dx > 12;
      gameState.touches.up = dy < -12;
      gameState.touches.down = dy > 12;
    }
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
    if (axis === 'left') { gameState.touches.up = gameState.touches.down = gameState.touches.left = gameState.touches.right = false; gameState.touches.tankMove = null; }
    else if (axis === 'right') { gameState.touches.tankAim = null; }
    else { gameState.touches.left = gameState.touches.right = gameState.touches.up = gameState.touches.down = false; }
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
    if (axis === 'left') { gameState.touches.up = gameState.touches.down = gameState.touches.left = gameState.touches.right = false; gameState.touches.tankMove = null; }
    else if (axis === 'right') { gameState.touches.tankAim = null; }
    else { gameState.touches.left = gameState.touches.right = gameState.touches.up = gameState.touches.down = false; }
  });
}


// ---- touch → keyboard bridge ----
// Many engines read gameState.keys (keyboard codes). On mobile we translate
// on-screen touches/swipes into key states so EVERY game gets touch controls.
const TOUCH_KEY_MAP = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', action: 'Space', boost: 'ShiftRight' };
let touchKeyTimer = null;
let touchedKeys = {};
function startTouchKeySync() {
  stopTouchKeySync();
  touchKeyTimer = setInterval(() => {
    if (!gameState.running || gameState.over) return;
    for (const [t, k] of Object.entries(TOUCH_KEY_MAP)) {
      if (gameState.touches[t]) {
        if (!touchedKeys[k]) { touchedKeys[k] = true; gameState.keys[k] = true; }
      } else if (touchedKeys[k]) {
        touchedKeys[k] = false; gameState.keys[k] = false;
      }
    }
  }, 40);
}
function stopTouchKeySync() {
  if (touchKeyTimer) { clearInterval(touchKeyTimer); touchKeyTimer = null; }
  touchedKeys = {};
}

// ---- on-demand engine loader (lazy load for mobile perf) ----
function loadGameEngine(id, cb) {
  const fn = GAME_ENGINE[id];
  if (!fn) { cb(null); return; }
  if (typeof window[fn] === 'function') { cb(window[fn]); return; }
  const fname = fn.replace(/([A-Z])/g, m => '_' + m.toLowerCase()).replace(/^_/, '');
  const file = fn === 'game2048' ? 'games/game2048.js'
    : (fname === 'pin_ball' ? 'games/pin_ball.js' : 'games/' + fname + '.js');
  const s = document.createElement('script');
  s.src = file;
  s.onload = () => cb(window[fn] || null);
  s.onerror = () => cb(null);
  document.head.appendChild(s);
}

// ---- launch a game by id (lazy-loads engine for mobile perf) ----
function launchGame(id) {
  const g = GAMES.find(x => x.id === id);
  if (!g) { toast('Game not found'); return; }
  if (typeof window.playSfx === 'function') { try { window.playSfx('launch'); } catch (e) {} }
  const engine = window[GAME_ENGINE[id]];
  if (typeof engine === 'function') { bootGame(id, engine); return; }
  // engine not loaded yet — lazy load it (performance), show loading screen
  const gl = document.getElementById('gameLoading');
  if (gl) gl.classList.add('show');
  loadGameEngine(id, (eng) => {
    if (gl) gl.classList.remove('show');
    if (typeof eng === 'function') bootGame(id, eng);
    else toast(g.name + ' — coming soon! 🔒');
  });
}

function bootGame(id, engine) {
  const g = GAMES.find(x => x.id === id);
  // browser back should exit the game
  pushGameHistory();

  // per-game skin: apply the game's theme palette if it has one (skin-by-game)
  // (palettes map lives in app.js; if the game has a theme, use it during play)
  if (typeof window.applyGameSkin === 'function') {
    try { window.applyGameSkin(id); } catch (e) {}
  }

  // switch to game page
  go('game');
  document.getElementById('hudGameTitle').innerText = g.name;
  document.getElementById('hudScore').innerText = '0';
  document.getElementById('hudCoins').innerText = '0';

  // lock page scroll during gameplay (mobile)
  lockGameScroll(true);

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
      if (typeof window.playSfx === 'function') { try { window.playSfx('coin'); } catch (e) {} }
    }
  );

  // draw per-game controls
  drawControls(id);
  const tcWrap = document.getElementById('touchControls');
  if (tcWrap) tcWrap.classList.add('show');

  // bind canvas touch (carrom/temple/snake-classic + all canvas-driven)
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

  // touch → key sync for keyboard-driven engines
  startTouchKeySync();
}

// ---- end game ---- (spring score pop + theme accent on overlay)
function endGame(score, coinsEarned) {
  gameState.over = true;
  gameState.running = false;
  gameState.score = score;
  gameState.coinsEarned = coinsEarned || 0;
  if (currentGame) { try { currentGame.pause(); } catch (e) {} }
  if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }

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
  // spring score pop on the overlay
  const ov = document.getElementById('gameOverOverlay');
  if (typeof window.popScore === 'function') {
    const r = (ov || document.body).getBoundingClientRect();
    window.popScore(r.left + r.width / 2 - 40, r.top + r.height / 2 - 30, '+' + score.toLocaleString());
  }
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
  lockGameScroll(false);
  // restore the user's global theme when leaving a game (skin-by-game off)
  if (typeof window.applyTheme === 'function' && typeof window.globalTheme === 'string') {
    try { window.applyTheme(window.globalTheme, true); } catch (e) {}
  }
  if (currentGame) { try { currentGame.destroy(); } catch (e) {} }
  currentGame = null;
  gameState = { id: null, running: false, paused: false, over: false, score: 0, coinsEarned: 0, touches: {}, keys: {} };
  window.removeEventListener('keydown', keyDown);
  window.removeEventListener('keyup', keyUp);
  stopTouchKeySync();
  const tcWrap = document.getElementById('touchControls');
  if (tcWrap) tcWrap.classList.remove('show');
  go('arcade');
  renderArcadeGrid('');
}

// ---- pause / resume ----
function togglePause() {
  if (!gameState.id || gameState.over) return;
  if (gameState.paused) {
    gameState.paused = false;
    document.getElementById('pauseOverlay').classList.remove('show');
    if (currentGame) { try { currentGame.resume(); } catch (e) {} }
  } else {
    gameState.paused = true;
    document.getElementById('pauseOverlay').classList.add('show');
    if (currentGame) { try { currentGame.pause(); } catch (e) {} }
  }
}

// ---- auto-pause when call / backgrounded (mobile) ----
function onVisibilityChange() {
  if (document.hidden && gameState.id && !gameState.paused && !gameState.over) {
    togglePause();
  }
}
document.addEventListener('visibilitychange', onVisibilityChange);

// ---- browser back button exits game instead of reloading ----
window.addEventListener('popstate', () => {
  if (gameState.id) { exitToHub(); }
});
// push a history entry when entering a game so back works
function pushGameHistory() {
  try { history.pushState({ game: true }, ''); } catch (e) {}
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

// ---- HOW TO PLAY (mobile) ----
function toggleHelp() {
  const h = document.getElementById('helpOverlay');
  if (!h) return;
  if (h.classList.contains('show')) { h.classList.remove('show'); return; }
  // load per-game help from CONTROL_LAYOUT hint + engine instructions
  const layout = (gameState.id && CONTROL_LAYOUT[gameState.id]) || {};
  const name = (GAMES.find(g => g.id === gameState.id) || {}).name || '';
  const hint = layout.hint || 'Tap to play this game.';
  // if game has its own howto, show it; else generic
  let desc = hint;
  if (currentGame && typeof currentGame.getHelp === 'function') {
    try { const hh = currentGame.getHelp(); if (hh) desc = hh; } catch (e) {}
  }
  document.getElementById('helpText').innerText = name + ' — ' + desc;
  if (gameState.id && !gameState.paused && !gameState.over) {
    // pause while showing help (non-destructively)
    gameState.paused = true;
    if (currentGame) { try { currentGame.pause(); } catch (e) {} }
  }
  h.classList.add('show');
}

// ---- MUTE toggle (mobile) ----
let muted = false;
function toggleMute() {
  muted = !muted;
  const ic = document.getElementById('muteIcon');
  if (ic) ic.innerText = muted ? '🔇' : '🔊';
  // suspend/resume synth audio context
  try {
    if (sfxCtx) { if (muted) sfxCtx.suspend(); else sfxCtx.resume(); }
  } catch (e) {}
  // stop any game audio objects
  try {
    document.querySelectorAll('audio, video').forEach(a => { if (muted) a.pause(); });
  } catch (e) {}
  toast(muted ? 'Sound OFF' : 'Sound ON');
}
function isMuted() { return muted; }

// ---- CRT effect toggle ----
function toggleCRT() {
  const el = document.getElementById('crtOverlay');
  if (!el) return;
  const on = el.classList.toggle('on');
  localStorage.setItem('rah_crt', on ? '1' : '0');
  toast(on ? 'CRT ON' : 'CRT OFF');
}
function initCRT() {
  const el = document.getElementById('crtOverlay');
  if (el && localStorage.getItem('rah_crt') === '1') el.classList.add('on');
}

// ---- FULLSCREEN toggle (mobile) ----
function toggleFullscreen() {
  const el = document.documentElement;
  const fsIcon = document.getElementById('fsIcon');
  const req = el.requestFullscreen || el.webkitRequestFullscreen || function(){};
  const exit = document.exitFullscreen || document.webkitExitFullscreen || function(){};
  if (!document.fullscreenElement) {
    const p = req.call(el);
    if (p && p.catch) p.catch(()=>{});
    if (fsIcon) fsIcon.className = 'fa-solid fa-compress';
  } else {
    exit.call(document);
    if (fsIcon) fsIcon.className = 'fa-solid fa-expand';
  }
}
document.addEventListener('fullscreenchange', () => {
  const fsIcon = document.getElementById('fsIcon');
  if (fsIcon) fsIcon.className = document.fullscreenElement ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
});

// ---- wire card clicks to launch (replaces comingSoon) ----
function playGame(id, e) {
  if (e) e.stopPropagation();
  launchGame(id);
}
