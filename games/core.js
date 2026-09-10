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
// Haptic patterns: tap=20ms, action=30ms, boom=80ms double, win=3 pulses
function haptic(pattern) {
  if (!navigator || !navigator.vibrate) return;
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

  // flag for the rotate hint: only show once per game boot
  gameState.justStarted = true;
  gameState.hintShown = false;

  // start
  gameState.running = true;
  currentGame.setInput(gameState.touches, gameState.keys);
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
  const isNewBest = score > prevBest;
  if (isNewBest) state.best[gameState.id] = score;

  // stats
  state.stats.gamesPlayed++;
  state.stats.totalScore += score;

  // coins = score * 10% (spec)
  const scoreCoins = Math.floor(score * 0.1);
  state.coins += scoreCoins;
  saveState(); updateCoinDisplay();

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
    { id: 'coins500',ico: '💰', name: 'Rich Kid',           test: () => state.coins >= 500 }
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
      { id: 'ms-neon100',   ico: '⚡', game: 'neon-dash',      desc: 'Neon Dash: 100 pts',     target: 100, reward: 55, prog: 0 }
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
  const TGT = { 'flappy-neon':50,'neon-dash':100,'neon-jumper':100,'snake-classic':100,'dino-run':300,'temple-run':500,'traffic-racer':500,'helix-drop':200,'cyber-shooter':100,'space-invaders':20,'pac-runner':30,'brick-breaker':60,'pinball':7,'2048':512,'tetris-blitz':4,'space-miner':1000,'neon-slam':500 };
  const t = TGT[gameState.id];
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
    const TARGETS = {
      'flappy-neon': 50, 'neon-dash': 100, 'neon-jumper': 100, 'snake-classic': 100,
      'dino-run': 300, 'temple-run': 500, 'traffic-racer': 500, 'helix-drop': 200,
      'cyber-shooter': 100, 'space-invaders': 20, 'pac-runner': 30, 'brick-breaker': 60,
      'pinball': 7, '2048': 512, 'tetris-blitz': 4, 'space-miner': 1000, 'neon-slam': 500
    };
    const tgt = TARGETS[gameState.id];
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

// ---- pause menu extras ----
let soundOn = true;
function toggleSound() {
  soundOn = !soundOn;
  const btn = document.getElementById('pauseSoundBtn');
  if (btn) btn.innerHTML = soundOn ? '<i class="fa-solid fa-volume-high"></i> SOUND' : '<i class="fa-solid fa-volume-xmark"></i> MUTED';
  if (typeof window.setMuted === 'function') { try { window.setMuted(!soundOn); } catch (e) {} }
}
// engines call this to show/update lives HUD chip
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
