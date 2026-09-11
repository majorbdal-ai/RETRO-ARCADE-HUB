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
  'space-miner':          'spaceMiner',
  'neon-slam':          'neonSlam',
  'neon-tower':          'neonTower',
  'cosmic-dash':          'cosmicDash',
  'lazer-maze':          'lazerMaze',
  'time-rush':          'timeRush',
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
  'bounce':             'bounce',
  'space-impact':       'spaceImpact',
  'bantumi':            'bantumi',
  'reversi':            'reversi',
};

// true when the game's engine file is available (all 60 are; lazy-loaded on launch)
function engineReady(id) {
  return !!GAME_ENGINE[id];
}

// ---- game runtime state ----
let currentGame = null;   // engine instance
let currentEngine = null; // function
let gameState = { id: null, running: false, paused: false, over: false, score: 0, coinsEarned: 0, touches: {}, keys: {} };
let reviveUsed = false;            // one coin-continue per session (arcade rule)
let pendingReviveFloor = 0;        // score floor carried into the revived run
// 70 games — per-game star/retry/mission targets (single source of truth)
// 70 games — per-game star/retry/mission targets
// 1★ = play & score something · 2★ = 60% · 3★ = beat target (realistic per-game goals)
const GAME_TARGETS = {
  'neon-racer': 800, 'cyber-shooter': 150, 'pixel-dungeon': 12, 'light-cycle': 600,
  'neon-snake': 120, 'brick-breaker': 300, 'tetris-blitz': 12, 'flappy-neon': 50,
  'pac-runner': 150, 'space-invaders': 40, 'tank-battle': 15, 'airstrike': 300,
  'water-sort': 8, 'triple-sort': 25, 'fruit-slash': 40, 'fruit-merge': 32,
  'bubble-shooter': 20, 'piano-tiles': 100, 'ludo-king': 1, 'carrom-pool': 5,
  '2048': 512, 'hill-climb': 300, 'temple-run': 500, 'candy-crush': 60,
  'snake-classic': 100, 'duck-hunt': 12, 'neon-dash': 100, 'color-switch': 30,
  'neon-jumper': 150, 'stack-drop': 500, 'helix-drop': 200, 'traffic-racer': 700,
  'dino-run': 300, 'sling-birds': 9, 'space-miner': 1000, 'neon-slam': 500,
  'neon-tower': 1000, 'cosmic-dash': 80, 'lazer-maze': 6, 'time-rush': 60,
  'pong': 15, 'table-tennis': 20, 'bowling-strike': 100, 'cricket-sixer': 100,
  'hoop-dunk': 100, 'archery-master': 90, 'soccer-penalty': 15, 'athletics-sprint': 100,
  'flow-free': 8, 'word-search': 6, 'memory-match': 8, 'mine-sweeper': 8,
  'sudoku': 1, 'mastermind': 5, 'simon-says': 10, 'tic-tac-toe': 1,
  'connect-four': 1, 'checkers': 10, 'slide-puzzle': 30, 'nonogram': 8,
  'lucky-spin': 100, 'pinball': 7, 'crossy-neon': 25, 'trash-sorter': 12,
  'ladder-climb': 300, 'math-dash': 10, 'bounce': 250, 'space-impact': 600,
  'bantumi': 24, 'reversi': 2
};
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
// B1: canvas CSS → logical coordinate scaling + pointerId multi-touch tracking + touchcancel.
function canvasScale() {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return { sx: 1, sy: 1 };
  const r = canvas.getBoundingClientRect();
  return {
    sx: (canvas.width && r.width) ? (canvas.width / r.width) : 1,
    sy: (canvas.height && r.height) ? (canvas.height / r.height) : 1
  };
}
function canvasXY(clientX, clientY) {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return { x: clientX, y: clientY };
  const r = canvas.getBoundingClientRect();
  const { sx, sy } = canvasScale();
  return { x: (clientX - r.left) * sx, y: (clientY - r.top) * sy };
}
function bindGameTouch(engine) {
  unbindGameTouch();
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  // track active pointers per pointerId (multi-touch safe)
  const pointers = new Map();
  const primaryXY = (e) => {
    if (e.touches && e.touches.length) return canvasXY(e.touches[0].clientX, e.touches[0].clientY);
    return canvasXY(e.clientX, e.clientY);
  };
  // pointer-drag style (carrom)
  if (typeof engine.pointerDown === 'function') {
    const down = (e) => { e.preventDefault(); const { x, y } = canvasXY(e.clientX, e.clientY); engine.pointerDown(x, y); };
    const move = (e) => { e.preventDefault(); const { x, y } = canvasXY(e.clientX, e.clientY); engine.pointerMove(x, y); };
    const up = (e) => { e.preventDefault(); engine.pointerUp(); };
    canvas.addEventListener('touchstart', down, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', up, { passive: false });
    canvas.addEventListener('touchcancel', up, { passive: false });
    canvas.addEventListener('mousedown', down, { passive: false });
    canvas.addEventListener('mousemove', move, { passive: false });
    canvas.addEventListener('mouseup', up, { passive: false });
    canvas.addEventListener('mouseleave', up, { passive: false });
    swipeBinding = { el: canvas, type: 'pointer', handlers: { down, move, up } };
    return;
  }
  // generic swipe fallback → touches (snake, light-cycle, 2048, invaders, pac-runner, etc.)
  if (typeof engine.swipe !== 'function' && typeof engine.onSwipe !== 'function' && typeof engine.pointerDown !== 'function') {
    let swipeDirTimer = null;
    let activePointer = null;
    const clearDir = () => { gameState.touches.left = gameState.touches.right = gameState.touches.up = gameState.touches.down = false; };
    const start = (e) => {
      const t = e.touches ? e.touches[0] : e;
      if (e.touches) activePointer = e.touches[0].identifier;
      canvasSwipe.startX = t.clientX; canvasSwipe.startY = t.clientY; canvasSwipe.started = true;
      if (e.preventDefault) e.preventDefault();
    };
    const move = (e) => {
      if (!canvasSwipe.started) return;
      if (e.touches) {
        const t = Array.from(e.touches).find(t2 => t2.identifier === activePointer) || e.touches[0];
        const dx = t.clientX - canvasSwipe.startX;
        const dy = t.clientY - canvasSwipe.startY;
        clearDir();
        if (Math.hypot(dx, dy) > 20) {
          if (Math.abs(dx) > Math.abs(dy)) { gameState.touches.left = dx < 0; gameState.touches.right = dx > 0; }
          else { gameState.touches.up = dy < 0; gameState.touches.down = dy > 0; }
        }
      }
      if (e.preventDefault) e.preventDefault();
    };
    const end = (e) => {
      if (!canvasSwipe.started) return;
      const t = e.changedTouches ? e.changedTouches[0] : e;
      const dx = t.clientX - canvasSwipe.startX;
      const dy = t.clientY - canvasSwipe.startY;
      canvasSwipe.started = false; activePointer = null;
      if (Math.hypot(dx, dy) > 20) {
        clearDir();
        if (Math.abs(dx) > Math.abs(dy)) { gameState.touches.left = dx < 0; gameState.touches.right = dx > 0; }
        else { gameState.touches.up = dy < 0; gameState.touches.down = dy > 0; }
        clearTimeout(swipeDirTimer);
        swipeDirTimer = setTimeout(clearDir, 180); // B1: 300→180ms — tighter, still bridges touch→key
      }
      if (e.preventDefault) e.preventDefault();
    };
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end, { passive: false });
    canvas.addEventListener('touchcancel', end, { passive: false });
    canvas.addEventListener('mousedown', start, { passive: false });
    canvas.addEventListener('mousemove', move, { passive: false });
    canvas.addEventListener('mouseup', end, { passive: false });
    canvas.addEventListener('mouseleave', end, { passive: false });
    swipeBinding = { el: canvas, type: 'swipe', handlers: { start, move, end } };
    return;
  }
  // swipe style (temple-run / snake-classic)
  if (typeof engine.swipe === 'function' || typeof engine.onSwipe === 'function') {
    const cb = typeof engine.swipe === 'function' ? engine.swipe : engine.onSwipe;
    let activePointer = null;
    const start = (e) => {
      const t = e.touches ? e.touches[0] : e;
      if (e.touches) activePointer = e.touches[0].identifier;
      canvasSwipe.startX = t.clientX; canvasSwipe.startY = t.clientY; canvasSwipe.started = true;
      if (e.preventDefault) e.preventDefault();
    };
    const move = (e) => {
      if (!canvasSwipe.started) return;
      if (e.touches) {
        const t = Array.from(e.touches).find(t2 => t2.identifier === activePointer) || e.touches[0];
        const dx = t.clientX - canvasSwipe.startX;
        const dy = t.clientY - canvasSwipe.startY;
        if (Math.hypot(dx, dy) > 20) cb(dx, dy);
      }
      if (e.preventDefault) e.preventDefault();
    };
    const end = (e) => {
      if (!canvasSwipe.started) return;
      const t = e.changedTouches ? e.changedTouches[0] : e;
      const dx = t.clientX - canvasSwipe.startX;
      const dy = t.clientY - canvasSwipe.startY;
      canvasSwipe.started = false; activePointer = null;
      if (Math.hypot(dx, dy) > 20) cb(dx, dy);
      if (e.preventDefault) e.preventDefault();
    };
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end, { passive: false });
    canvas.addEventListener('touchcancel', end, { passive: false });
    canvas.addEventListener('mousedown', start, { passive: false });
    canvas.addEventListener('mousemove', move, { passive: false });
    canvas.addEventListener('mouseup', end, { passive: false });
    canvas.addEventListener('mouseleave', end, { passive: false });
    swipeBinding = { el: canvas, type: 'swipe', handlers: { start, move, end } };
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
      el.removeEventListener('touchcancel', handlers.up);
      el.removeEventListener('mousedown', handlers.down);
      el.removeEventListener('mousemove', handlers.move);
      el.removeEventListener('mouseup', handlers.up);
      el.removeEventListener('mouseleave', handlers.up);
    } else {
      el.removeEventListener('touchstart', handlers.start);
      el.removeEventListener('touchmove', handlers.move);
      el.removeEventListener('touchend', handlers.end);
      el.removeEventListener('touchcancel', handlers.end);
      el.removeEventListener('mousedown', handlers.start);
      el.removeEventListener('mousemove', handlers.move);
      el.removeEventListener('mouseup', handlers.end);
      el.removeEventListener('mouseleave', handlers.end);
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
window.playSfx = (n) => { if (muted) return; try { SFX[n] && SFX[n](); } catch (e) {} };

// ---- touch buttons (with ripple visual feedback) ----
let lastRippleAt = 0;
// Haptic patterns: tap=20ms, action=30ms, boom=80ms double, win=3 pulses
function haptic(pattern) {
  if (!navigator || !navigator.vibrate) return;
  if (muted) return; // v7.15: sound OFF also silences vibration
  try {
    if (pattern === 'tap') navigator.vibrate(20);
    else if (pattern === 'action') navigator.vibrate(30);
    else if (pattern === 'boom') navigator.vibrate([30, 40, 80]);
    else if (pattern === 'win') navigator.vibrate([20, 30, 20, 30, 60]);
    else if (pattern === 'over') navigator.vibrate([60, 40, 120]);
    else navigator.vibrate(25);
  } catch (e) {}
}
window.hapticVibe = haptic;

// Radial press (A/B/X/Y arcade buttons) — fires a tap + haptic
function radialPress(dir, ev) {
  if (ev && ev.preventDefault) ev.preventDefault();
  pressed(dir, true, ev);
  setTimeout(() => pressed(dir, false, ev), 80);
  haptic('tap');
}

// Swipe-zone: captures touch direction and sets touches
function initSwipeZone() {
  const zone = document.getElementById('swipeZone');
  if (!zone) return;
  let sx = 0, sy = 0, active = false;
  const clear = () => {
    active = false; sx = 0; sy = 0;
    gameState.touches.up = gameState.touches.down = gameState.touches.left = gameState.touches.right = false;
  };
  zone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    sx = t.clientX; sy = t.clientY; active = true;
  }, { passive: false });
  zone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!active) return;
    const t = e.touches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    const TH = 24;
    gameState.touches.left = dx < -TH;
    gameState.touches.right = dx > TH;
    gameState.touches.up = dy < -TH;
    gameState.touches.down = dy > TH;
    // track magnitude for analog feel
    gameState.touches.swipeMag = Math.min(1, Math.hypot(dx, dy) / 80);
  }, { passive: false });
  zone.addEventListener('touchend', clear, { passive: false });
  zone.addEventListener('touchcancel', clear, { passive: false });
  // mouse
  zone.addEventListener('mousedown', (e) => { sx = e.clientX; sy = e.clientY; active = true; });
  zone.addEventListener('mousemove', (e) => {
    if (!active) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    gameState.touches.left = dx < -24;
    gameState.touches.right = dx > 24;
    gameState.touches.up = dy < -24;
    gameState.touches.down = dy > 24;
  });
  zone.addEventListener('mouseup', clear);
  zone.addEventListener('mouseleave', clear);
}

// Rotary wheel: drag to rotate (converts angle → touches.left/right)
function initWheel() {
  const w = document.getElementById('ctrlWheel');
  if (!w) return;
  let startAngle = 0, active = false;
  const angleOf = (e) => {
    const r = w.getBoundingClientRect();
    const cx = r.left + r.width/2, cy = r.top + r.height/2;
    const x = e.clientX, y = e.clientY;
    return Math.atan2(y - cy, x - cx);
  };
  w.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    startAngle = angleOf(t); active = true;
  }, { passive: false });
  w.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!active) return;
    const t = e.touches[0];
    const a = angleOf(t);
    let d = a - startAngle;
    if (d > Math.PI) d -= Math.PI*2;
    if (d < -Math.PI) d += Math.PI*2;
    if (d > 0.2) { gameState.touches.left = false; gameState.touches.right = true; haptic('tap'); startAngle = a; }
    else if (d < -0.2) { gameState.touches.left = true; gameState.touches.right = false; haptic('tap'); startAngle = a; }
  }, { passive: false });
  w.addEventListener('touchend', () => { active = false; gameState.touches.left = gameState.touches.right = false; }, { passive: false });
  // mouse
  w.addEventListener('mousedown', (e) => { startAngle = angleOf(e); active = true; });
  w.addEventListener('mousemove', (e) => {
    if (!active) return;
    const a = angleOf(e);
    let d = a - startAngle;
    if (d > Math.PI) d -= Math.PI*2;
    if (d < -Math.PI) d += Math.PI*2;
    if (d > 0.2) { gameState.touches.right = true; gameState.touches.left = false; startAngle = a; }
    else if (d < -0.2) { gameState.touches.left = true; gameState.touches.right = false; startAngle = a; }
  });
  w.addEventListener('mouseup', () => { active = false; gameState.touches.left = gameState.touches.right = false; });
}

// B1 FIX [001,039-041]: deviceorientation tilt control — Neon Racer, Gyro games
let tiltActive = false;
let tiltCalibration = null; // null until first reading
function initTilt() {
  if (tiltActive) return;
  // iOS 13+ requires explicit permission
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(state => {
      if (state === 'granted') startTiltListening();
    }).catch(() => {});
  } else {
    startTiltListening();
  }
}
function startTiltListening() {
  window.addEventListener('deviceorientation', onTilt, { passive: true });
  tiltActive = true;
}
function onTilt(e) {
  if (!gameState.id || gameState.paused || gameState.over) return;
  // gamma: left/right tilt (-90 to 90), beta: front/back (-180 to 180)
  const gamma = e.gamma || 0;
  const beta = e.beta || 0;
  // calibrate on first reading to neutral position
  if (tiltCalibration === null) {
    tiltCalibration = { gamma, beta };
  }
  const dGamma = gamma - (tiltCalibration.gamma || 0);
  const dBeta = beta - (tiltCalibration.beta || 0);
  const THRESHOLD = 8; // degrees dead zone
  gameState.touches.left = dGamma < -THRESHOLD;
  gameState.touches.right = dGamma > THRESHOLD;
  gameState.touches.up = dBeta < -THRESHOLD;
  gameState.touches.down = dBeta > THRESHOLD;
}
function stopTilt() {
  if (tiltActive) {
    window.removeEventListener('deviceorientation', onTilt);
    tiltActive = false;
    tiltCalibration = null;
  }
}

function pressed(control, isDown, ev) {
  if (ev && ev.preventDefault) ev.preventDefault();
  gameState.touches[control] = isDown;
  if (isDown) {
    // own-press priority: a virtual button's own press beats any stale shared swipe/DPad mapping
    gameState.touchOwn = gameState.touchOwn || {};
    gameState.touchOwn[control] = true;
    if (navigator.vibrate) { try { navigator.vibrate(20); } catch (e) {} }
    if (typeof window.playSfx === 'function') { try { window.playSfx('click'); } catch (e) {} }
  } else {
    if (gameState.touchOwn) gameState.touchOwn[control] = false;
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

// ---- per-game custom control panel ----
let accMode = false;  // accessibility mode: bigger buttons, high contrast
function setAccMode(on) {
  accMode = !!on;
  document.body.classList.toggle('acc-mode', accMode);
  // re-render controls if a game is open
  const ctrlWrap = document.getElementById('touchControls');
  if (ctrlWrap && ctrlWrap.classList.contains('show') && typeof gameState !== 'undefined' && gameState.currentGame) {
    drawControls(gameState.currentGame);
  }
  localStorage.setItem('accMode', accMode ? '1' : '0');
}
// init from saved prefs
try { if (localStorage.getItem('accMode') === '1') setAccMode(true); } catch (e) {}

// Color-blind friendly mode (protanopia/deuteranopia safe) — toggles via profile
function toggleCbSafe() {
  const on = document.body.classList.toggle('cb-safe');
  try { localStorage.setItem('cbSafe', on ? '1' : '0'); } catch (e) {}
  return on;
}
try { if (localStorage.getItem('cbSafe') === '1') document.body.classList.add('cb-safe'); } catch (e) {}

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
  // Move (D-pad) + Mine action (space miner)
  else if (type === 'move-mine') {
    html += `<div class="ctrl-dpad"><div class="dpad">
      <button class="ctrl-btn dp-up" ontouchstart="pressed('up',true,event)" ontouchend="pressed('up',false,event)" ontouchcancel="pressed('up',false,event)" onmousedown="pressed('up',true,event)" onmouseup="pressed('up',false,event)" onmouseleave="pressed('up',false,event)"><i class="fa-solid fa-chevron-up"></i></button>
      <button class="ctrl-btn dp-left" ontouchstart="pressed('left',true,event)" ontouchend="pressed('left',false,event)" ontouchcancel="pressed('left',false,event)" onmousedown="pressed('left',true,event)" onmouseup="pressed('left',false,event)" onmouseleave="pressed('left',false,event)"><i class="fa-solid fa-chevron-left"></i></button>
      <button class="ctrl-btn dp-down" ontouchstart="pressed('down',true,event)" ontouchend="pressed('down',false,event)" ontouchcancel="pressed('down',false,event)" onmousedown="pressed('down',true,event)" onmouseup="pressed('down',false,event)" onmouseleave="pressed('down',false,event)"><i class="fa-solid fa-chevron-down"></i></button>
      <button class="ctrl-btn dp-right" ontouchstart="pressed('right',true,event)" ontouchend="pressed('right',false,event)" ontouchcancel="pressed('right',false,event)" onmousedown="pressed('right',true,event)" onmouseup="pressed('right',false,event)" onmouseleave="pressed('right',false,event)"><i class="fa-solid fa-chevron-right"></i></button>
    </div>
    <div class="ctrl-group">
      <button class="ctrl-btn ctrl-mine" ontouchstart="pressed('action',true,event)" ontouchend="pressed('action',false,event)" ontouchcancel="pressed('action',false,event)" onmousedown="pressed('action',true,event)" onmouseup="pressed('action',false,event)" onmouseleave="pressed('action',false,event)"><i class="fa-solid fa-bolt"></i>MINE</button>
    </div></div>`;
  }
  // Classic 4-way D-pad (no action)
  else if (type === 'dpad') {
    html += `<div class="ctrl-dpad-center"><div class="dpad">
      <button class="ctrl-btn dp-up" ontouchstart="pressed('up',true,event)" ontouchend="pressed('up',false,event)" ontouchcancel="pressed('up',false,event)" onmousedown="pressed('up',true,event)" onmouseup="pressed('up',false,event)" onmouseleave="pressed('up',false,event)"><i class="fa-solid fa-chevron-up"></i></button>
      <button class="ctrl-btn dp-left" ontouchstart="pressed('left',true,event)" ontouchend="pressed('left',false,event)" ontouchcancel="pressed('left',false,event)" onmousedown="pressed('left',true,event)" onmouseup="pressed('left',false,event)" onmouseleave="pressed('left',false,event)"><i class="fa-solid fa-chevron-left"></i></button>
      <button class="ctrl-btn dp-down" ontouchstart="pressed('down',true,event)" ontouchend="pressed('down',false,event)" ontouchcancel="pressed('down',false,event)" onmousedown="pressed('down',true,event)" onmouseup="pressed('down',false,event)" onmouseleave="pressed('down',false,event)"><i class="fa-solid fa-chevron-down"></i></button>
      <button class="ctrl-btn dp-right" ontouchstart="pressed('right',true,event)" ontouchend="pressed('right',false,event)" ontouchcancel="pressed('right',false,event)" onmousedown="pressed('right',true,event)" onmouseup="pressed('right',false,event)" onmouseleave="pressed('right',false,event)"><i class="fa-solid fa-chevron-right"></i></button>
    </div></div>`;
  }
  // Radial button menu (A/B/X/Y — arcade face buttons)
  else if (type === 'radial') {
    html += `<div class="ctrl-radial">
      <button class="ctrl-btn r-top" onclick="radialPress('up',event)"><i class="fa-solid fa-caret-up"></i></button>
      <button class="ctrl-btn r-left" onclick="radialPress('left',event)"><i class="fa-solid fa-caret-left"></i></button>
      <button class="ctrl-btn r-bottom" onclick="radialPress('down',event)"><i class="fa-solid fa-caret-down"></i></button>
      <button class="ctrl-btn r-right" onclick="radialPress('right',event)"><i class="fa-solid fa-caret-right"></i></button>
    </div>`;
  }
  // Steering wheel: left/right steer + boost
  else if (type === 'steer') {
    html += `<div class="ctrl-steer">
      <button class="ctrl-btn steer-left" ontouchstart="pressed('left',true,event)" ontouchend="pressed('left',false,event)" ontouchcancel="pressed('left',false,event)" onmousedown="pressed('left',true,event)" onmouseup="pressed('left',false,event)" onmouseleave="pressed('left',false,event)"><i class="fa-solid fa-arrow-left"></i>L</button>
      <button class="ctrl-btn steer-boost" ontouchstart="pressed('boost',true,event)" ontouchend="pressed('boost',false,event)" ontouchcancel="pressed('boost',false,event)" onmousedown="pressed('boost',true,event)" onmouseup="pressed('boost',false,event)" onmouseleave="pressed('boost',false,event)"><i class="fa-solid fa-gauge-high"></i>BOOST</button>
      <button class="ctrl-btn steer-right" ontouchstart="pressed('right',true,event)" ontouchend="pressed('right',false,event)" ontouchcancel="pressed('right',false,event)" onmousedown="pressed('right',true,event)" onmouseup="pressed('right',false,event)" onmouseleave="pressed('right',false,event)"><i class="fa-solid fa-arrow-right"></i>R</button>
    </div>`;
  }
  // Swipe-zone: swipe anywhere on the pad = direction (with on-screen compass)
  else if (type === 'swipe-zone') {
    html += `<div class="ctrl-swipe-zone" id="swipeZone"><i class="fa-solid fa-arrows-up-down-left-right"></i><span>SWIPE</span></div>`;
  }
  // Tap + Hold (tap = action, hold = alt power)
  else if (type === 'tap-hold') {
    html += `<div class="ctrl-taphold">
      <button class="ctrl-btn th-tap" ontouchstart="pressed('action',true,event)" ontouchend="pressed('action',false,event)" ontouchcancel="pressed('action',false,event)" onmousedown="pressed('action',true,event)" onmouseup="pressed('action',false,event)" onmouseleave="pressed('action',false,event)"><i class="fa-solid fa-hand-pointer"></i>TAP</button>
      <button class="ctrl-btn th-hold" ontouchstart="pressed('power',true,event)" ontouchend="pressed('power',false,event)" ontouchcancel="pressed('power',false,event)" onmousedown="pressed('power',true,event)" onmouseup="pressed('power',false,event)" onmouseleave="pressed('power',false,event)"><i class="fa-solid fa-bolt"></i>HOLD</button>
    </div>`;
  }
  // Pinch (zoom / scale control)
  else if (type === 'pinch') {
    html += `<div class="ctrl-pinch"><i class="fa-solid fa-hand-fist"></i><span>PINCH</span></div>`;
  }
  // Gyro display (device orientation; buttons fallback)
  else if (type === 'gyro') {
    html += `<div class="ctrl-tilt"><i class="fa-solid fa-compass"></i><span>GYRO</span></div>`;
    html += `<div class="ctrl-group">
      <button class="ctrl-btn" ontouchstart="pressed('left',true,event)" ontouchend="pressed('left',false,event)" ontouchcancel="pressed('left',false,event)" onmousedown="pressed('left',true,event)" onmouseup="pressed('left',false,event)" onmouseleave="pressed('left',false,event)"><i class="fa-solid fa-arrow-left"></i></button>
      <button class="ctrl-btn ctrl-boost" ontouchstart="pressed('boost',true,event)" ontouchend="pressed('boost',false,event)" ontouchcancel="pressed('boost',false,event)" onmousedown="pressed('boost',true,event)" onmouseup="pressed('boost',false,event)" onmouseleave="pressed('boost',false,event)"><i class="fa-solid fa-gauge-high"></i></button>
      <button class="ctrl-btn" ontouchstart="pressed('right',true,event)" ontouchend="pressed('right',false,event)" ontouchcancel="pressed('right',false,event)" onmousedown="pressed('right',true,event)" onmouseup="pressed('right',false,event)" onmouseleave="pressed('right',false,event)"><i class="fa-solid fa-arrow-right"></i></button>
    </div>`;
  }
  // Rotary wheel dial
  else if (type === 'wheel') {
    html += `<div class="ctrl-wheel" id="ctrlWheel"><i class="fa-solid fa-dial"></i><span>ROTATE</span></div>`;
  }
  // Swap (two-tap item swap for match games)
  else if (type === 'swap') {
    html += `<div class="ctrl-swap"><button class="ctrl-btn" onclick="pressed('action',true,event);setTimeout(()=>pressed('action',false,event),80)"><i class="fa-solid fa-arrows-rotate"></i>SWAP</button><span class="ctrl-swap-hint">TAP ITEM · TAP TARGET</span></div>`;
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
    html += `<div class="ctrl-spacer"></div>`;
    html += `<div class="ctrl-tap-area" id="ctrlTap" onclick="pressed('action',true,event);setTimeout(()=>pressed('action',false,event),80)"><i class="fa-solid fa-hand-pointer"></i><span>TAP</span></div>`;
  }
  // Simon: 4 hold-to-press pads (WATCH seq → HOLD the matching pad + RELEASE)
  else if (type === 'simon') {
    html += `<div class="ctrl-simon" id="ctrlSimon">` +
      `<button class="ctrl-btn simon-pad simon-g" ontouchstart="pressed('up',true,event)" ontouchend="pressed('up',false,event)" ontouchcancel="pressed('up',false,event)" onmousedown="pressed('up',true,event)" onmouseup="pressed('up',false,event)" onmouseleave="pressed('up',false,event)"><i class="fa-solid fa-square"></i>GREEN</button>` +
      `<button class="ctrl-btn simon-pad simon-r" ontouchstart="pressed('right',true,event)" ontouchend="pressed('right',false,event)" ontouchcancel="pressed('right',false,event)" onmousedown="pressed('right',true,event)" onmouseup="pressed('right',false,event)" onmouseleave="pressed('right',false,event)"><i class="fa-solid fa-square"></i>RED</button>` +
      `<button class="ctrl-btn simon-pad simon-y" ontouchstart="pressed('left',true,event)" ontouchend="pressed('left',false,event)" ontouchcancel="pressed('left',false,event)" onmousedown="pressed('left',true,event)" onmouseup="pressed('left',false,event)" onmouseleave="pressed('left',false,event)"><i class="fa-solid fa-square"></i>YELLOW</button>` +
      `<button class="ctrl-btn simon-pad simon-b" ontouchstart="pressed('down',true,event)" ontouchend="pressed('down',false,event)" ontouchcancel="pressed('down',false,event)" onmousedown="pressed('down',true,event)" onmouseup="pressed('down',false,event)" onmouseleave="pressed('down',false,event)"><i class="fa-solid fa-square"></i>BLUE</button>` +
      `</div>`;
  } else {
    html += `<div class="ctrl-spacer"></div>`;
  }
  wrap.innerHTML = html;
  // wire joystick(s)
  if (type === 'joystick') initJoystick('joystick', 'jKnob', 'main');
  else if (type === 'joystick2') { initJoystick('joystick', 'jKnob', 'main'); }
  else if (type === 'dual') { initJoystick('joyL', 'jKnobL', 'left'); initJoystick('joyR', 'jKnobR', 'right'); }
  // wire new control types
  else if (type === 'swipe-zone') initSwipeZone();
  else if (type === 'wheel') initWheel();
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
  if (typeof window.markPlayed === 'function') { try { window.markPlayed(id); } catch (e) {} }
  if (typeof window.playSfx === 'function') { try { window.playSfx('launch'); } catch (e) {} }

  // ==== SESSION COMBO (v8.0): increment if playing within time window ====
  if (!state.combo) state.combo = { count: 0, lastTime: 0, bestSession: 0 };
  const now = Date.now();
  if (state.combo.lastTime && (now - state.combo.lastTime) < COMBO_WINDOW_MS) {
    state.combo.count++;
    // gameFX: combo glow
    if (window.gameFX) { try { window.gameFX.comboFlash(state.combo.count); } catch(e) {} }
  } else {
    // new session — save previous combo's best if it was higher
    if (state.combo.count > (state.combo.bestSession || 0)) {
      state.combo.bestSession = state.combo.count;
    }
    state.combo.count = 1;
  }
  state.combo.lastTime = now;
  if (state.combo.count > (state.stats.bestCombo || 0)) {
    state.stats.bestCombo = state.combo.count;
  }
  saveState();

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

// legacy engine input adapter: exposes pressed()/down() from gameState touches+keys,
// plus touches/keys objects (bounce style), plus x/y pointer coords
function makeLegacyInput() {
  const KEYMAP = {
    enter: 'Enter', ' ': ' ', space: ' ', up: 'ArrowUp', down: 'ArrowDown',
    left: 'ArrowLeft', right: 'ArrowRight', w: 'KeyW', s: 'KeyS',
    a: 'KeyA', d: 'KeyD', tap: 'action'
  };
  const mapKey = (k) => KEYMAP[k] || k;
  return {
    touches: gameState.touches,
    keys: gameState.keys,
    x: null, y: null,
    pressed: (k) => {
      const K = mapKey(k);
      if (K === 'action') return !!gameState.touches.action;
      return !!gameState.keys[K] || !!gameState.keys[k];
    },
    down: (k) => {
      const K = mapKey(k);
      if (K === 'action') return !!gameState.touches.action;
      if (gameState.touches.left || gameState.touches.right || gameState.touches.up || gameState.touches.down) {
        if (K === 'ArrowLeft' || k === 'left') return !!gameState.touches.left;
        if (K === 'ArrowRight' || k === 'right') return !!gameState.touches.right;
        if (K === 'ArrowUp' || k === 'up') return !!gameState.touches.up;
        if (K === 'ArrowDown' || k === 'down') return !!gameState.touches.down;
      }
      return !!gameState.keys[K] || !!gameState.keys[k];
    },
    setTouches: (t) => { gameState.touches = t; }
  };
}

// ==== GAME FX v7.12 — screen shake, particles, death flash ====
window.gameFX = {
  shake(intensity = 1) {
    const wrap = document.getElementById('gameCanvasWrap');
    if (!wrap) return;
    const dur = Math.round(120 + intensity * 60);
    const amp = Math.round(2 + intensity * 4);
    wrap.style.setProperty('--shake-dur', dur + 'ms');
    wrap.style.setProperty('--shake-x', (Math.random() > .5 ? 1 : -1) * amp + 'px');
    wrap.style.setProperty('--shake-y', (Math.random() > .5 ? 1 : -1) * amp + 'px');
    wrap.classList.remove('fx-shake');
    void wrap.offsetWidth;
    wrap.classList.add('fx-shake');
    setTimeout(() => wrap.classList.remove('fx-shake'), dur);
  },
  burst(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'fx-particle';
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      const angle = (Math.PI * 2 * i) / count + (Math.random() - .5) * .5;
      const dist = 20 + Math.random() * 40;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const dur = .4 + Math.random() * .5;
      el.style.setProperty('--p-color', color || '#FFD700');
      el.style.setProperty('--p-dx', dx + 'px');
      el.style.setProperty('--p-dy', dy + 'px');
      el.style.setProperty('--p-dur', dur + 's');
      el.style.setProperty('--p-size', (3 + Math.random() * 5) + 'px');
      document.body.appendChild(el);
      setTimeout(() => el.remove(), dur * 1000 + 50);
    }
  },
  scoreFloat(text, color, x, y) {
    if (typeof window.popScore === 'function') {
      window.popScore(x || innerWidth / 2, y || innerHeight / 3, text);
    }
  },
  comboFlash(combo) {
    if (combo < 2) return;
    const chip = document.getElementById('hudCombo');
    if (!chip) return;
    chip.style.display = 'inline-flex';
    document.getElementById('hudComboVal').innerText = 'x' + combo;
    chip.classList.remove('fx-combo-flash');
    void chip.offsetWidth;
    chip.classList.add('fx-combo-flash');
  },
  deathFX() {
    // red flash overlay
    const ov = document.createElement('div');
    ov.className = 'fx-death-overlay';
    document.body.appendChild(ov);
    setTimeout(() => ov.remove(), 550);
    // heavy shake
    this.shake(3);
    // scattered particles from center
    const cx = innerWidth / 2, cy = innerHeight / 3;
    this.burst(cx, cy, '#ff4444', 12);
    this.burst(cx, cy, '#ff8800', 8);
  },
  coinFX(x, y) {
    this.burst(x || innerWidth / 2 + (Math.random() - .5) * 60, y || innerHeight / 3, '#FFD700', 6);
    this.shake(0.3);
  }
};

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
  // hide lives chip until an engine reports lives
  const hudLivesEl = document.getElementById('hudLives');
  if (hudLivesEl) hudLivesEl.style.display = 'none';
  // hide combo chip until combo active
  const hudComboEl = document.getElementById('hudCombo');
  if (hudComboEl) hudComboEl.style.display = 'none';

  // lock page scroll during gameplay (mobile)
  lockGameScroll(true);

  // reset game state
  gameState = { id, running: false, paused: false, over: false, score: 0, coinsEarned: 0, touches: {}, keys: {} };

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // create engine instance
  currentEngine = engine;
  let reviveFloor = pendingReviveFloor; pendingReviveFloor = 0;   // consumed once
  const onScoreCb = (s) => {
    const shown = s + reviveFloor;    // revive: add carried floor to the live score
    document.getElementById('hudScore').innerText = shown;
    // gameFX: subtle score particles every few points
    if (shown > 0 && shown % 5 === 0 && window.gameFX) {
      const scoreEl = document.getElementById('hudScore');
      const r = scoreEl.getBoundingClientRect();
      window.gameFX.burst(r.left + r.width/2, r.top + r.height/2, '#00ffff', 4);
    }
  };
  const onOverCb = (score, coinsEarned) => endGame(score + reviveFloor, coinsEarned);
  const onCoinCb = (n) => {
      gameState.coinsEarned += n;
      // B1 FIX [042]: do NOT add to state.coins here — endGame adds once at game over.
      updateCoinDisplay();
      document.getElementById('hudCoins').innerText = '0'; // updated at end
      // coin pop animation (roadmap 11)
      try {
        const hud = document.getElementById('hudCoins');
        const pop = document.createElement('span');
        pop.style.cssText = 'position:fixed;z-index:999;font-family:Orbitron,sans-serif;font-weight:900;color:var(--yellow);font-size:18px;pointer-events:none;text-shadow:0 0 10px rgba(255,230,0,.8);animation:coinPop .9s ease-out forwards';
        const r = hud.getBoundingClientRect();
        pop.style.left = (r.left + r.width/2 - 15) + 'px';
        pop.style.top = (r.top - 10) + 'px';
        pop.innerText = '+' + n;
        document.body.appendChild(pop);
        setTimeout(() => pop.remove(), 950);
      } catch (e) {}
      if (typeof window.playSfx === 'function') { try { window.playSfx('coin'); } catch (e) {} }
      // gameFX: coin particles
      if (window.gameFX) { try { window.gameFX.coinFX(); } catch(e) {} }
  };

  // engine API: new-style (canvas, ctx, onScore, onOver, onCoins) OR old-style (canvas, ctx, W, H, input, state)
  const oldStyle = engine.length >= 6;
  currentGame = oldStyle
    ? engine(canvas, ctx, canvas.width, canvas.height,
        makeLegacyInput(),
        { onScore: onScoreCb, onGameOver: onOverCb, onCoins: onCoinCb })
    : engine(canvas, ctx, onScoreCb, onOverCb, onCoinCb);

  // draw per-game controls
  drawControls(id);
  const tcWrap = document.getElementById('touchControls');
  if (tcWrap) tcWrap.classList.add('show');

  // B1 FIX [001,039-041]: start tilt listener for tilt/gyro control games
  if (typeof CONTROL_LAYOUT !== 'undefined' && CONTROL_LAYOUT[id]) {
    const cType = CONTROL_LAYOUT[id].type;
    if (cType === 'tilt' || cType === 'gyro') { try { initTilt(); } catch(e) {} }
  }

  // bind canvas touch (carrom/temple/snake-classic + all canvas-driven)
  bindGameTouch(currentGame);

  // hide game over overlay
  document.getElementById('gameOverOverlay').classList.remove('show');

  // flag for the rotate hint: only show once per game boot
  gameState.justStarted = true;
  gameState.hintShown = false;

  // start
  gameState.running = true;
  if (typeof currentGame.setInput === 'function') currentGame.setInput(gameState.touches, gameState.keys);
  currentGame.start();

  // wire keyboard
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);

  // touch → key sync for keyboard-driven engines
  startTouchKeySync();
  // big-screen orientation state (rotate hint on small portrait phones)
  updateGameOrientation();
}

// ---- end game ---- (spring score pop + theme accent on overlay)
function endGame(score, coinsEarned) {
  gameState.over = true;
  gameState.running = false;
  stopTilt(); // B1 [010]: clean up tilt on game over
  gameState.score = score;
  gameState.coinsEarned = coinsEarned || 0;
  if (currentGame) { try { currentGame.pause(); } catch (e) {} }
  if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
  // gameFX: death particles + screen shake + red flash
  if (window.gameFX) { try { window.gameFX.deathFX(); } catch(e) {} }

  // award coins from gameplay pickups (collected via onCoinCb during play)
  if (coinsEarned > 0) {
    state.coins += coinsEarned;
  }

  // best score
  const prevBest = state.best[gameState.id] || 0;
  const isNewBest = score > prevBest;
  if (isNewBest) state.best[gameState.id] = score;

  // stats
  state.stats.gamesPlayed++;
  state.stats.totalScore += score;
  // v7.15: lifetime run/revive counters (badge + leaderboard fuel)
  if (typeof state.stats.runs !== 'number') state.stats.runs = 0;
  state.stats.runs++;
  if (reviveUsed) {
    if (typeof state.stats.revivesUsed !== 'number') state.stats.revivesUsed = 0;
    state.stats.revivesUsed++;
  }

  // coins = score * 10% (spec)
  const scoreCoins = Math.floor(score * 0.1);
  state.coins += scoreCoins;

  // ==== PROGRESSION (v6.6) ====
  // XP: score/100 base + new-best bonus + game-completed bonus
  let xpGained = Math.max(1, Math.floor(score / 100)) + (isNewBest ? 25 : 0) + (score > 0 ? 10 : 0);
  let leveledUp = false, newLevel = 0;
  if (state.profile) {
    const xpNeeded = lvl => Math.floor(100 * Math.pow(lvl, 1.35));
    state.profile.xp = (state.profile.xp || 0) + xpGained;
    while (state.profile.xp >= xpNeeded(state.profile.level || 1)) {
      state.profile.xp -= xpNeeded(state.profile.level || 1);
      state.profile.level = (state.profile.level || 1) + 1;
      leveledUp = true; newLevel = state.profile.level;
      // level-up bonus coins
      state.coins += 50 * newLevel;
    }
    if (leveledUp && typeof window.hapticVibe === 'function') { try { window.hapticVibe('win'); } catch (e) {} }
  }

  // Achievements (persist)
  if (!state.achievements) state.achievements = [];
  const ACH = [
    { id: 'first',   ico: '🏆', name: 'First Blood',        test: () => state.stats.gamesPlayed >= 1 },
    { id: 'win10',   ico: '⚡', name: 'Arcade Addict',      test: () => state.stats.gamesPlayed >= 10 },
    { id: 'win50',   ico: '🔥', name: 'Fifty & Fierce',     test: () => state.stats.gamesPlayed >= 50 },
    { id: 'score1k', ico: '💎', name: 'Four-Figure Score',  test: () => score >= 1000 },
    { id: 'score10k',ico: '👑', name: 'High Roller',        test: () => score >= 10000 },
    { id: 'combo8',  ico: '🌀', name: 'Combo Starter',      test: () => (state.stats.bestCombo || 0) >= 8 },
    { id: 'master',  ico: '🎯', name: 'Game Master',        test: () => Object.keys(state.best).length >= 10 },
    { id: 'coins500',ico: '💰', name: 'Rich Kid',           test: () => state.coins >= 500 },
    // ==== ACHIEVEMENTS v8 (v7.15): repeatable badge goals — hardcore completion now has goals ====
    { id: 'win100',  ico: '⭐', name: 'Century Club',       test: () => state.stats.gamesPlayed >= 100 },
    { id: 'win500',  ico: '👟', name: 'Sneaker Legend',     test: () => state.stats.gamesPlayed >= 500 },
    { id: 'win1000', ico: '📿', name: 'Marathon Man',       test: () => state.stats.gamesPlayed >= 1000 },
    { id: 'score100k',ico: '🌋', name: 'Lifetime 100K',     test: () => (state.stats.totalScore || 0) >= 100000 },
    { id: 'score1m', ico: '🪐', name: 'Lifetime 1M',        test: () => (state.stats.totalScore || 0) >= 1000000 },
    { id: 'thirty',  ico: '🧩', name: 'Catalog Pro',        test: () => Object.keys(state.best).length >= 30 },
    { id: 'all70',   ico: '🎖️', name: 'Full Catalog',       test: () => Object.keys(state.best).length >= 70 },
    { id: 'rich5k',  ico: '💸', name: 'Tycoon',             test: () => state.coins >= 5000 },
    { id: 'rich50k', ico: '🏦', name: 'Coin Vault',         test: () => state.coins >= 50000 },
    { id: 'revive25',ico: '🐍', name: 'No Retreat',         test: () => (state.stats.revivesUsed || 0) >= 25 }
  ];
  const newlyUnlocked = ACH.filter(a => !state.achievements.includes(a.id) && a.test());
  newlyUnlocked.forEach(a => {
    state.achievements.push(a.id);
    state.coins += 100;
    setTimeout(() => toast(a.ico + ' ACHIEVEMENT: ' + a.name + ' (+100 🪙)'), 300);
    if (typeof window.hapticVibe === 'function') { try { window.hapticVibe('win'); } catch (e) {} }
  });

  // Daily missions (rotating, 3 per day) — game-specific "Nokia-era" goals
  if (!state.dailyQuest) state.dailyQuest = {};
  const today = new Date().toDateString();
  if (!state.dailyQuest.date || state.dailyQuest.date !== today) {
    // new day: pick 3 game-specific missions (1 play + 2 score, known-score games)
    const playPool = [
      { id: 'mp-tetris',   ico: '🧱', game: 'tetris-blitz',   desc: 'Play Tetris once',        target: 1, reward: 40, prog: 0 },
      { id: 'mp-sudoku',   ico: '🧩', game: 'sudoku',         desc: 'Play Sudoku once',        target: 1, reward: 45, prog: 0 },
      { id: 'mp-pinball',  ico: '🪩', game: 'pinball',  desc: 'Play Pinball once',       target: 1, reward: 40, prog: 0 },
      { id: 'mp-mines',    ico: '💣', game: 'mine-sweeper',   desc: 'Play Minesweeper once',   target: 1, reward: 45, prog: 0 },
      { id: 'mp-2048',     ico: '🔢', game: '2048',           desc: 'Play 2048 once',          target: 1, reward: 40, prog: 0 },
      { id: 'mp-ludo',     ico: '🎲', game: 'ludo-king',      desc: 'Play Ludo once',          target: 1, reward: 45, prog: 0 }
    ];
    const scorePool = [
      { id: 'ms-flappy50',  ico: '🐤', game: 'flappy-neon',    desc: 'Flappy: score 50',       target: 50,  reward: 60, prog: 0 },
      { id: 'ms-snake100',  ico: '🐍', game: 'snake-classic',  desc: 'Snake: eat 100',         target: 100, reward: 60, prog: 0 },
      { id: 'ms-dino300',   ico: '🦖', game: 'dino-run',       desc: 'Dino: run 300m',         target: 300, reward: 60, prog: 0 },
      { id: 'ms-pinball7',  ico: '🪩', game: 'pinball',  desc: 'Pinball: 7 pts',         target: 7,   reward: 55, prog: 0 },
      { id: 'ms-break60',   ico: '🧨', game: 'brick-breaker',  desc: 'Breakout: 60 pts',       target: 60,  reward: 55, prog: 0 },
      { id: 'ms-invaders20',ico: '👾', game: 'space-invaders', desc: 'Invaders: 20 kills',     target: 20,  reward: 60, prog: 0 },
      { id: 'ms-pac30',     ico: '👻', game: 'pac-runner',     desc: 'Pac: eat 30 dots',       target: 30,  reward: 60, prog: 0 },
      // ==== EXPANDED COVERAGE v7.14 (every category has a score mission) ====
      { id: 'ms-cycle600',  ico: '🏍️', game: 'light-cycle',    desc: 'Light Cycle: 600 travel', target: 600, reward: 65, prog: 0 },
      { id: 'ms-helix200',  ico: '🌀', game: 'helix-drop',     desc: 'Helix: drop 200m',        target: 200, reward: 65, prog: 0 },
      { id: 'ms-snake120',  ico: '🐍', game: 'neon-snake',     desc: 'Neon Snake: 120 pts',     target: 120, reward: 65, prog: 0 },
      { id: 'ms-shooter150',ico: '🚀', game: 'cyber-shooter',  desc: 'Shooter: 150 pts',        target: 150, reward: 65, prog: 0 },
      { id: 'ms-racer800',  ico: '🏎️', game: 'neon-racer',     desc: 'Racer: 800 pts',          target: 800, reward: 65, prog: 0 },
      { id: 'ms-temple500', ico: '🗿', game: 'temple-run',     desc: 'Temple: run 500m',        target: 500, reward: 70, prog: 0 },
      { id: 'ms-jumper150', ico: '🦘', game: 'neon-jumper',    desc: 'Jumper: 150 pts',         target: 150, reward: 65, prog: 0 },
      { id: 'ms-switch30',  ico: '🎯', game: 'color-switch',   desc: 'Color Switch: 30',        target: 30,  reward: 60, prog: 0 },
      { id: 'ms-crossy25',  ico: '🐔', game: 'crossy-neon',    desc: 'Crossy: 25 roads',        target: 25,  reward: 60, prog: 0 },
      { id: 'ms-tetris12',  ico: '🧱', game: 'tetris-blitz',   desc: 'Tetris: 12 lines',        target: 12,  reward: 65, prog: 0 },
      { id: 'ms-miner1000', ico: '🪨', game: 'space-miner',    desc: 'Miner: 1000 ore',         target: 1000,reward: 70, prog: 0 }
    ];
    shuffle(playPool); shuffle(scorePool);
    state.dailyQuest = { date: today, list: [playPool[0], scorePool[0], scorePool[1]], done: [] };
  }
  state.dailyQuest.list.forEach(q => {
    if (!q.game || gameState.id !== q.game) return; // only the specific game progresses it
    if (q.target === 1) q.prog = 1;                       // play missions: done by playing
    else q.prog = Math.min(q.target, Math.max(q.prog, score)); // score missions
    // claim if reached & not claimed
    if (q.prog >= q.target && !state.dailyQuest.done.includes(q.id)) {
      state.dailyQuest.done.push(q.id);
      state.coins += q.reward;
      setTimeout(() => toast(q.ico + ' MISSION: ' + q.desc + ' — +' + q.reward + ' 🪙'), 800);
      if (typeof window.hapticVibe === 'function') { try { window.hapticVibe('win'); } catch (e) {} }
    }
  });

  saveState(); updateCoinDisplay();

  // daily streak — first play of the day keeps the flame alive (v7.9)
  if (typeof window.updateStreak === 'function') { try { window.updateStreak(); } catch (e) {} }

  // sync to backend if logged in
  syncScore(gameState.id, score);

  // show overlay — REDESIGN v7.2: stars, new-best glow, level label
  const scoreEl = document.getElementById('overScore');

  // ==== COIN-CONTINUE (v7.14) — 2nd chance button ====
  const reviveBtn = document.getElementById('reviveBtn');
  if (reviveBtn) {
    const COST = 150;
    const can = !reviveUsed && state.coins >= COST;
    reviveBtn.style.display = can ? 'inline-flex' : 'none';
    if (can) reviveBtn.innerText = '🪙 CONTINUE (-' + COST + ' 🪙)';
  }
  const prevBestTxt = (state.best[gameState.id] || 0).toLocaleString();
  document.getElementById('overCoins').innerText = (coinsEarned + scoreCoins + (leveledUp ? newLevel * 50 : 0)).toLocaleString();
  document.getElementById('overBest').innerText = prevBestTxt;
  document.getElementById('overLevel').innerText = 'LVL ' + (state.profile ? state.profile.level : 1) + (leveledUp ? ' ⬆' : '') + ' · +' + xpGained + ' XP';
  // score count-up + label
  scoreEl.classList.toggle('newbest', isNewBest && score > 0);
  const finalScore = score;
  scoreEl.innerText = '0';
  let animStart = null;
  const dur = Math.min(1200, 500 + finalScore.toString().length * 90);
  function tick(ts) {
    if (!animStart) animStart = ts;
    const p = Math.min(1, (ts - animStart) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    scoreEl.innerText = Math.floor(finalScore * eased).toLocaleString();
    if (p < 1) requestAnimationFrame(tick);
    else scoreEl.innerText = finalScore.toLocaleString();
  }
  requestAnimationFrame(tick);
  // star rating: 1 star for beating score 0, 2 for 60% of target, 3 for beating target
  const t = GAME_TARGETS[gameState.id];
  const stars = finalScore <= 0 ? 0 : (!t ? (finalScore > 0 ? 1 : 0) : finalScore >= t ? 3 : finalScore >= t * 0.6 ? 2 : 1);
  const starEls = document.querySelectorAll('#overStars span');
  starEls.forEach((s, i) => {
    if (i < stars) {
      s.classList.add('on');
      setTimeout(() => { if (typeof window.popScore === 'function') window.popScore(innerWidth / 2 - 40 + i * 28, innerHeight / 2 - 40, '★'); }, 500 + i * 180);
    }
  });
  // spring score pop on the overlay
  const ov = document.getElementById('gameOverOverlay');
  if (typeof window.popScore === 'function') {
    const r = (ov || document.body).getBoundingClientRect();
    window.popScore(r.left + r.width / 2 - 40, r.top + r.height / 2 - 30, '+' + score.toLocaleString());
  }
  // refresh profile page if shown
  if (document.getElementById('page-profile') && document.getElementById('page-profile').classList.contains('active')) renderProfile();
  document.getElementById('gameOverOverlay').classList.add('show');

  // ==== RETRY FUEL (quality update #2): near-miss nudge — "only X more!" ====
  const nearEl = document.getElementById('overNearMiss');
  if (nearEl) {
    // Per-game "next milestone" targets (rounded, forgiving)
    const targets = GAME_TARGETS;
    const tgt = targets[gameState.id];
    let msg = '';
    if (tgt && score < tgt) {
      const left = tgt - score;
      const ratio = score / tgt;
      if (ratio >= 0.6) msg = '😤 JUST ' + left + ' MORE TO GO! ONE MORE TRY?';
      else if (ratio >= 0.35) msg = '🔥 GETTING THERE — ' + left + ' TO GO!';
    } else if (score > 0 && tgt) {
      msg = '🎉 TARGET CRUSHED!';
    } else if (score > 0 && !tgt) {
      msg = '💪 NICE RUN! BEAT YOUR BEST?';
    }
    nearEl.innerText = msg;
  }
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---- restart ----
// B1 FIX [014-015]: full cleanup before restart — no stale state/timers carry over
function restartGame() {
  if (!gameState.id) return;
  const id = gameState.id;
  // full cleanup (same as exitToHub minus go('arcade'))
  unbindGameTouch();
  stopTilt();
  lockGameScroll(false);
  if (currentGame) { try { currentGame.destroy(); } catch (e) {} }
  currentGame = null;
  currentEngine = null;
  gameState = { id: null, running: false, paused: false, over: false, score: 0, coinsEarned: 0, touches: {}, keys: {} };
  window.removeEventListener('keydown', keyDown);
  window.removeEventListener('keyup', keyUp);
  stopTouchKeySync();
  document.getElementById('gameOverOverlay').classList.remove('show');
  reviveUsed = false; // fresh run — continue allowed again
  // re-launch fresh
  launchGame(id);
}

// ---- coin continue (2nd chance, arcade revive) ----
function reviveGame() {
  if (!gameState.id || !gameState.over) return;
  if (reviveUsed) { toast('One continue per run!'); return; }
  const COST = 150;
  if (state.coins < COST) { toast('Need ' + COST + ' coins for continue!'); if (typeof window.hapticVibe === 'function') { try { window.hapticVibe('err'); } catch (e) {} } return; }
  state.coins -= COST;
  reviveUsed = true;
  pendingReviveFloor = gameState.score; // carry the run's score into the continue
  saveState(); updateCoinDisplay();
  if (typeof window.hapticVibe === 'function') { try { window.hapticVibe('win'); } catch (e) {} }
  if (typeof window.playSfx === 'function') { try { window.playSfx('continue'); } catch (e) {} }
  // same full cleanup as restart, but with the floor pre-set
  const id = gameState.id;
  unbindGameTouch();
  stopTilt();
  lockGameScroll(false);
  if (currentGame) { try { currentGame.destroy(); } catch (e) {} }
  currentGame = null;
  currentEngine = null;
  gameState = { id: null, running: false, paused: false, over: false, score: 0, coinsEarned: 0, touches: {}, keys: {} };
  window.removeEventListener('keydown', keyDown);
  window.removeEventListener('keyup', keyUp);
  stopTouchKeySync();
  document.getElementById('gameOverOverlay').classList.remove('show');
  launchGame(id);
}

// ---- exit to hub ----
function exitToHub() {
  unbindGameTouch();
  stopTilt(); // B1 [010]: clean up tilt listener
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
  document.body.classList.remove('landscape-game');
  const hint = document.getElementById('playAreaLabel');
  if (hint) hint.style.display = 'none';
  go('arcade');
  renderArcadeGrid('');
}

// ---- orientation: big-screen game experience (v7.7) ----
// Landscape CSS kicks in automatically via media query (HUD floats over
// fullscreen canvas). Portrait games have their own touch controls, so the
// rotate hint is unnecessary there — hidden entirely. Only used on TINY
// portrait phones as a one-time (3.5s) nudge; auto-dismisses permanently.
let rotateHintTimer = null;
function updateGameOrientation() {
  if (!gameState.id) { const h = document.getElementById('playAreaLabel'); if (h) h.style.display = 'none'; return; }
  const hint = document.getElementById('playAreaLabel');
  if (!hint) return;
  // only show on very small portrait phones, once per game boot
  const tinyPortrait = window.matchMedia('(orientation: portrait) and (max-width: 389px)').matches;
  if (!tinyPortrait) { hint.style.display = 'none'; return; }
  if (gameState.justStarted && !gameState.hintShown) {
    hint.style.display = 'flex';
    gameState.hintShown = true;
    clearTimeout(rotateHintTimer);
    rotateHintTimer = setTimeout(() => {
      hint.style.display = 'none';
      gameState.justStarted = false;
    }, 3500);
  }
}
// tapping the hint dismisses it instantly (and prevents future re-show this game)
document.addEventListener('click', (e) => {
  if (e.target && e.target.closest && e.target.closest('#playAreaLabel')) {
    const hint = document.getElementById('playAreaLabel');
    if (hint) hint.style.display = 'none';
    if (gameState) gameState.justStarted = false;
  }
});
// onChange for orientation + manual toggle when phone rotates while playing
window.addEventListener('orientationchange', () => { setTimeout(updateGameOrientation, 120); });
window.addEventListener('resize', () => { if (gameState.id) updateGameOrientation(); }, { passive: true });

// ---- pause / resume ----
// B1 FIX [008-009]: clear all input state on pause, restore on resume
function togglePause() {
  if (!gameState.id || gameState.over) return;
  if (gameState.paused) {
    gameState.paused = false;
    document.getElementById('pauseOverlay').classList.remove('show');
    if (currentGame) { try { currentGame.resume(); } catch (e) {} }
  } else {
    gameState.paused = true;
    // clear all held inputs so game doesn't "stuck" on resume
    gameState.touches = { up: false, down: false, left: false, right: false, action: false, boost: false, drift: false, gas: false, brake: false, power: false };
    gameState.keys = {};
    document.getElementById('pauseOverlay').classList.add('show');
    if (currentGame) { try { currentGame.pause(); } catch (e) {} }
  }
}

// ---- pause menu extras ----
// (sound toggle moved into unified SOUND manager — see toggleSound() there)
// engines call this to show/update lives HUD chip

// ================= SOUNDTRACK v7.15 (hub music) =================
// Procedural 8-bit loop via WebAudio — no audio files, no network.
// 4 tracks, per-page tempo, native mediaSession (lock-screen) controls.
// Start/stop are driven by page switches; state lives in window.AppMusic.
(function () {
  const MS = { C4:262, D4:294, E4:330, F4:349, G4:392, A4:440, B4:494, C5:523, D5:587, E5:659, G5:784, A5:880, R:null };
  const SEQ = {
    home:    [MS.C5,MS.E5,MS.G5,MS.E5, MS.A5,MS.G5,MS.E5,MS.D5, MS.E5,MS.D5,MS.C5,MS.D5, MS.E5,MS.G5,MS.E5,MS.R,
              MS.C5,MS.E5,MS.G5,MS.E5, MS.A5,MS.G5,MS.E5,MS.D5, MS.E5,MS.G5,MS.A5,MS.G5, MS.E5,MS.C5,MS.D5,MS.R],
    arcade:  [MS.G4,MS.A4,MS.C5,MS.A4, MS.G4,MS.E4,MS.D4,MS.R, MS.E4,MS.G4,MS.A4,MS.G4, MS.E4,MS.D4,MS.E4,MS.R,
              MS.G4,MS.A4,MS.C5,MS.A4, MS.G4,MS.E4,MS.D4,MS.R, MS.E4,MS.G4,MS.C5,MS.A4, MS.G4,MS.E4,MS.D4,MS.R],
    shop:    [MS.C5,MS.D5,MS.E5,MS.G5, MS.E5,MS.D5,MS.C5,MS.R, MS.A4,MS.C5,MS.D5,MS.E5, MS.D5,MS.C5,MS.A4,MS.R,
              MS.D5,MS.E5,MS.G5,MS.A5, MS.G5,MS.E5,MS.D5,MS.R, MS.C5,MS.D5,MS.E5,MS.G5, MS.A5,MS.G5,MS.E5,MS.R],
    board:   [MS.G4,MS.B4,MS.D5,MS.B4, MS.G4,MS.E4,MS.G4,MS.R, MS.A4,MS.C5,MS.E5,MS.C5, MS.A4,MS.G4,MS.A4,MS.R,
              MS.D5,MS.B4,MS.G4,MS.B4, MS.D5,MS.E5,MS.G5,MS.R, MS.E5,MS.D5,MS.B4,MS.G4, MS.A4,MS.G4,MS.E4,MS.R],
    profile: [MS.E4,MS.G4,MS.A4,MS.G4, MS.E4,MS.D4,MS.C4,MS.R, MS.D4,MS.E4,MS.G4,MS.A4, MS.G4,MS.E4,MS.D4,MS.R,
              MS.C4,MS.E4,MS.G4,MS.A4, MS.G4,MS.E4,MS.D4,MS.R, MS.E4,MS.D4,MS.C4,MS.D4, MS.E4,MS.G4,MS.A4,MS.R]
  };
  const TEMPO = { home: 132, arcade: 148, shop: 124, board: 138, profile: 118 };
  const BASS = 0.09, LEAD = 0.045; // gains (avoid ear-splitting square waves)
  function note(ctx, dest, f, t, dur, type, g) {
    if (!f || !isFinite(f)) return;
    const o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = type; o.frequency.value = f;
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(g, t + 0.01);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn); gn.connect(dest);
    o.start(t); o.stop(t + dur + 0.03);
  }
  let state = { on: false, page: null, step: 0, timer: null, nextT: 0, ctx: null, seq: null, tempo: 124 };
  function ensureCtx() {
    if (state.ctx) return state.ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      state.ctx = new AC();
      // gentle master gain + soft-clip (avoid harsh square clipping)
      const master = state.ctx.createGain();
      master.gain.value = 0.6;
      const comp = state.ctx.createDynamicsCompressor();
      master.connect(comp); comp.connect(state.ctx.destination);
      state.master = master; state.comp = comp;
    } catch (e) { state.ctx = null; }
    return state.ctx;
  }
  function stop() {
    state.on = false;
    if (state.timer) { clearTimeout(state.timer); state.timer = null; }
    state.page = null;
  }
  const step = () => {
    if (!state.on) return;
    const ctx = state.ctx;
    if (!ctx) return;
    const spb = 60 / state.tempo / 2; // eighth-note grid
    // schedule a small lookahead window of notes per tick
    while (state.nextT < ctx.currentTime + 0.12) {
      const i = state.step % state.seq.length;
      const f = state.seq[i];
      if (f) {
        note(ctx, state.master, f, state.nextT, spb * 1.8, 'square', LEAD);
        note(ctx, state.master, f / 2, state.nextT, spb * 1.8, 'triangle', BASS);
      }
      state.step++; state.nextT += spb;
    }
    state.timer = setTimeout(step, 80);
  };
  function start() {
    const ctx = ensureCtx();
    if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
    state.on = true;
    state.step = 0; state.nextT = ctx ? ctx.currentTime + 0.05 : 0;
    if (ctx) step();
    // native lock-screen / notification controls
    try {
      if (navigator.mediaSession) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: 'RETRO ARCADE', artist: 'CHIPTUNE RADIO', album: 'HUB SOUNDTRACK' });
        navigator.mediaSession.setActionHandler('play', () => { try { ctx && ctx.resume(); } catch (e) {} });
        navigator.mediaSession.setActionHandler('pause', start);
      }
    } catch (e) {}
  }
  function applyPage(p) {
    const seq = SEQ[p] || SEQ.home, tempo = TEMPO[p] || TEMPO.home;
    const ctx = ensureCtx();
    if (!seq || !ctx) return;
    state.seq = seq; state.tempo = tempo;
    if (state.on) { state.step = 0; state.nextT = ctx.currentTime + 0.05; }
  }
  // public api (also exposed as window.AppMusic for page-switch calls)
  const api = {
    start: start, stop: stop, applyPage: applyPage, isPlaying: () => state.on,
    setMuted(m) { if (m) stop(); else if (!state.on) start(); }
  };
  window.AppMusic = api;
  window.startMusic = start;
  window.stopMusic = stop;
  window.setMusicMuted = (m) => api.setMuted(m);
})();
window.setHUDLives = (n) => {
  const el = document.getElementById('hudLives');
  if (!el) return;
  if (typeof n === 'number' && n >= 0) {
    el.style.display = '';
    document.getElementById('hudLivesVal').innerText = n;
  } else {
    el.style.display = 'none';
  }
};
function toggleFullscreen() {
  if (document.fullscreenElement) {
    if (document.exitFullscreen) document.exitFullscreen();
  } else {
    const el = document.getElementById('gameCanvasWrap') || document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
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
// B4 FIX [016]: first back = pause (if running), second back = exit to hub
let backPressedAt = 0;
window.addEventListener('popstate', () => {
  if (!gameState.id) return;
  if (gameState.over) { exitToHub(); return; }
  if (!gameState.paused && gameState.running) {
    // first back: pause the game
    const now = Date.now();
    if (now - backPressedAt < 2500) { exitToHub(); return; } // double-back within 2.5s = exit
    backPressedAt = now;
    togglePause();
    if (typeof window.toast === 'function') { try { window.toast('Back again to exit'); } catch (e) {} }
    return;
  }
  exitToHub();
});
// push a history entry when entering a game so back works
function pushGameHistory() {
  try { history.pushState({ game: true }, ''); } catch (e) {}
}

// ---- share (v7.11: canvas score card + image sharing) ----
function generateShareCard() {
  const game = GAMES.find(g => g.id === gameState.id) || {};
  const score = gameState.score || 0;
  const color = game.color || '#00FFFF';
  const name = game.name || 'UNKNOWN';
  const icon = game.icon || '🎮';
  const best = state.best[gameState.id] || 0;
  const isNewBest = score > 0 && score >= best;
  const level = (state.profile && state.profile.level) || 1;

  // Star rating (same logic as endGame)
  const t = GAME_TARGETS[gameState.id];
  const stars = score <= 0 ? 0 : (!t ? (score > 0 ? 1 : 0) : score >= t ? 3 : score >= t * 0.6 ? 2 : 1);

  const W = 600, H = 400;
  const cvs = document.createElement('canvas');
  cvs.width = W; cvs.height = H;
  const ctx = cvs.getContext('2d');

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0A0E16');
  bg.addColorStop(0.5, '#0D1220');
  bg.addColorStop(1, '#0A0E16');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid lines
  ctx.strokeStyle = color + '12';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Glow circle behind score
  const glow = ctx.createRadialGradient(W/2, H/2 - 20, 10, W/2, H/2 - 20, 160);
  glow.addColorStop(0, color + '30');
  glow.addColorStop(0.5, color + '10');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Top accent line
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(60, 50);
  ctx.lineTo(W - 60, 50);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Game name
  ctx.font = "bold 28px 'Orbitron', 'Arial', sans-serif";
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText(icon + ' ' + name, W/2, 90);

  // "SCORE" label
  ctx.font = "12px 'Arial', sans-serif";
  ctx.fillStyle = '#8A93A6';
  ctx.letterSpacing = '4px';
  ctx.fillText('SCORE', W/2, 130);

  // Score value — big glowing number
  const scoreStr = score.toLocaleString();
  ctx.font = "bold 64px 'Orbitron', 'Arial', sans-serif";
  ctx.shadowColor = isNewBest ? '#FFE600' : color;
  ctx.shadowBlur = 30;
  ctx.fillStyle = isNewBest ? '#FFE600' : '#FFFFFF';
  ctx.fillText(scoreStr, W/2, 195);
  ctx.shadowBlur = 0;

  // New Best badge
  if (isNewBest) {
    ctx.font = "bold 14px 'Arial', sans-serif";
    ctx.fillStyle = '#FFE600';
    ctx.fillText('★ NEW BEST ★', W/2, 225);
  }

  // Stars
  const starY = 260;
  const starSize = 30;
  const starSpacing = 40;
  const starStartX = W/2 - (stars * starSpacing) / 2;
  for (let i = 0; i < 3; i++) {
    const sx = starStartX + i * starSpacing + starSpacing/2;
    ctx.font = `${starSize}px 'Arial'`;
    if (i < stars) {
      ctx.shadowColor = '#FFE600';
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#FFE600';
      ctx.fillText('★', sx, starY);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = '#333333';
      ctx.fillText('★', sx, starY);
    }
  }

  // Level + best score info
  ctx.font = "13px 'Arial', sans-serif";
  ctx.fillStyle = '#8A93A6';
  ctx.fillText('LVL ' + level + (isNewBest ? '  ·  ★ NEW BEST' : '  ·  BEST: ' + best.toLocaleString()), W/2, 295);

  // Bottom accent line
  ctx.strokeStyle = color + '50';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 320);
  ctx.lineTo(W - 60, 320);
  ctx.stroke();

  // Branding
  ctx.font = "bold 16px 'Orbitron', 'Arial', sans-serif";
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.fillStyle = color;
  ctx.fillText('RETRO ARCADE HUB', W/2, 355);
  ctx.shadowBlur = 0;

  ctx.font = "11px 'Arial', sans-serif";
  ctx.fillStyle = '#555555';
  ctx.fillText('70 games · XP · achievements · free to play', W/2, 375);

  return cvs;
}

async function shareGame() {
  const game = GAMES.find(g => g.id === gameState.id) || {};
  const score = gameState.score || 0;
  const name = game.name || 'a game';
  const url = location.origin + location.pathname;
  const text = `🎮 I scored ${score.toLocaleString()} on ${name}! 🏆\n\nCan you beat me? Play FREE at RETRO ARCADE HUB 👇`;

  try {
    // Generate share card image
    const cvs = generateShareCard();
    const blob = await new Promise(r => cvs.toBlob(r, 'image/png', 0.95));

    // Try native share with image
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], 'score.png', { type: 'image/png' })] })) {
      const file = new File([blob], 'score.png', { type: 'image/png' });
      await navigator.share({ title: 'RETRO ARCADE HUB', text, url, files: [file] }).catch(() => {});
      toast('Shared! 🎉');
      return;
    }

    // Fallback: try text-only share
    if (navigator.share) {
      await navigator.share({ title: 'RETRO ARCADE HUB', text: text + '\n' + url }).catch(() => {});
      toast('Shared! 🎉');
      return;
    }

    // Desktop fallback: download the image
    downloadShareCard();
  } catch (e) {
    downloadShareCard();
  }
}

function downloadShareCard() {
  try {
    const cvs = generateShareCard();
    const link = document.createElement('a');
    link.download = 'retro-arcade-score.png';
    link.href = cvs.toDataURL('image/png', 0.95);
    link.click();
    toast('Score card downloaded! 📸 Share it on WhatsApp!');
  } catch (e) {
    toast('Could not generate card');
  }
}

function copyScoreText() {
  const game = GAMES.find(g => g.id === gameState.id) || {};
  const score = gameState.score || 0;
  const stars = '⭐'.repeat((() => {
    const t = GAME_TARGETS[gameState.id];
    return t ? (score >= t ? 3 : score >= t * 0.6 ? 2 : 1) : 1;
  })());
  const text = `🎮 ${game.name}: ${score.toLocaleString()} ${stars}\nRETRO ARCADE HUB — 70 free games!`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => toast('Score copied! 📋')).catch(() => toast('Could not copy'));
  } else {
    toast('Could not copy');
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

// ---- SOUND v7.15: unified persisted audio manager ----
// One flag gates EVERYTHING (SFX synth, music, haptics). Persisted so a
// game restart / page reload no longer silently re-enables sound.
let muted = localStorage.getItem('rah_muted') === '1';
function isMuted() { return muted; }
function setMuted(m) {
  m = !!m;
  muted = m;
  try { localStorage.setItem('rah_muted', m ? '1' : '0'); } catch (e) {}
  // suspend/resume synth audio context
  try {
    if (sfxCtx) { if (m) sfxCtx.suspend(); else sfxCtx.resume(); }
  } catch (e) {}
  // stop any game audio objects
  try {
    document.querySelectorAll('audio, video').forEach(a => { if (m) a.pause(); });
  } catch (e) {}
  // mute/unmute the hub soundtrack too
  if (typeof window.setMusicMuted === 'function') { try { window.setMusicMuted(m); } catch (e) {} }
  // keep every sound button in sync
  const ic = document.getElementById('muteIcon');
  if (ic) ic.innerText = m ? '🔇' : '🔊';
  const btn = document.getElementById('pauseSoundBtn');
  if (btn) btn.innerHTML = m ? '<i class="fa-solid fa-volume-xmark"></i> MUTED' : '<i class="fa-solid fa-volume-high"></i> SOUND';
  const profSfx = document.getElementById('profSfxBtn');
  if (profSfx) profSfx.innerText = m ? 'SOUND FX: OFF' : 'SOUND FX: ON';
}
function toggleMute() { setMuted(!muted); toast(muted ? 'Sound OFF' : 'Sound ON'); }
// pause-menu toggle — now shares the SAME flag + persistence as the HUD button
function toggleSound() { setMuted(!muted); }

// ---- MUSIC toggle (independent of SFX; own flag, survives SFX mute) ----
let musicOn = false;
function toggleMusic() {
  musicOn = !musicOn;
  if (musicOn) {
    try { window.AppMusic.applyPage('home'); window.AppMusic.start(); } catch (e) {}
  } else {
    try { window.AppMusic.stop(); } catch (e) {}
  }
  const btn = document.getElementById('pauseMusicBtn');
  if (btn) btn.innerHTML = musicOn ? '<i class="fa-solid fa-music"></i> MUSIC' : '<i class="fa-solid fa-volume-xmark"></i> MUSIC OFF';
  const profMusic = document.getElementById('profMusicBtn');
  if (profMusic) profMusic.innerText = musicOn ? 'MUSIC: ON' : 'MUSIC: OFF';
  toast(musicOn ? 'Music ON' : 'Music OFF');
}

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
  reviveUsed = false;   // fresh pick from hub — a new continue is available
  launchGame(id);
}
