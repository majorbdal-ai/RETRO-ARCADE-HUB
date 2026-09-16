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
  '2048': 'game2048',
  'neon-flap': 'gameNeonFlap',
  'fruit-fury': 'gameFruitFury',
  'neon-snake': 'gameSnake',
};

// true when the game's engine file is available (all 70 are; lazy-loaded on launch)
function engineReady(id) {
  return !!GAME_ENGINE[id];
}

// ---- game runtime state ----
let currentGame = null;   // engine instance
let currentEngine = null; // function
let gameState = { id: null, running: false, paused: false, over: false, score: 0, coinsEarned: 0, touches: {}, keys: {} };
let runBestBeaten = false;         // v7.49: live mid-run NEW BEST celebration fired once per run
let reviveUsed = false;            // one coin-continue per session (arcade rule)
let pendingRevenge = false;        // v7.36 REVENGE MODE: +50% score on next run, bought at game-over
let pendingReviveFloor = 0;        // score floor carried into the revived run
// 70 games — per-game star/retry/mission targets (single source of truth)
// 70 games — per-game star/retry/mission targets
// 1★ = play & score something · 2★ = 60% · 3★ = beat target (realistic per-game goals)
const GAME_TARGETS = {
  '2048': 512,
  'neon-flap': 30,
  'fruit-fury': 120, 
};
// per-game touch/pointer binding (gesture-driven engines use canvas swipes)
let canvasSwipe = { startX: 0, startY: 0, started: false };
let swipeBinding = null; // { el, handlers } or null

const CTRL_BTN_LABELS = {
  boost:  { icon: 'gauge-high',  text: 'BOOST' },
  action: { icon: 'bolt',        text: 'ACTION' },
  drift:  { icon: 'wind',        text: 'DRIFT' }
};

// ---- per-game canvas touch binding (gesture-driven engines) ----
// Game engines exposing pointerDown/pointerMove/pointerUp or swipe/onSwipe
// get their touch events wired to the canvas automatically.
// B1: canvas CSS → logical coordinate scaling + pointerId multi-touch tracking + touchcancel.
// remove the per-game DPR resize hook (registered inside bootGame)
function clearDPRResize() {
  if (window.__dprResize) {
    window.removeEventListener('resize', window.__dprResize);
    window.__dprResize = null;
  }
}
let tapBinding = null; // universal canvas tap → touches.lastTapX/Y + action (tap-board engines)

// Universal canvas tap tracker:
// Engines that run on BOARD TAPS (tap-cell engines)
// ludo, mine-sweeper, water-sort, …) read touches.lastTapX/lastTapY + touches.action.
// core.js previously NEVER set those for button-controlled games, so those games
// were unplayable (tap did nothing). This binds on the canvas for EVERY game and
// feeds both the coordinate AND a short action pulse.
function bindTapTracker(canvas) {
  unbindTapTracker();
  if (!canvas) return;
  let holdTimer = null;
  const clearHold = () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } };
  // long-press → X-mark toggle (300ms hold on grid cells)
  // grid: offsetX=160, offsetY=60, cellSize=30
  const startHold = (x, y) => {
    clearHold();
    holdTimer = setTimeout(() => {
      holdTimer = null;
      if (gameState.touches) {
        gameState.touches.toggleR = Math.floor((y - 60) / 30);
        gameState.touches.toggleC = Math.floor((x - 160) / 30);
        gameState.touches.holdEnd = true;
        gameState.touches.hold = true;
      }
    }, 300);
  };
  const setTap = (clientX, clientY) => {
    const { x, y } = canvasXY(clientX, clientY);
    gameState.touches.lastTapX = x;
    gameState.touches.lastTapY = y;
    // engines that read touches.x/touches.y for tap position (tap-grid
    // engines using pointer-readback get the same coordinates
    gameState.touches.x = x;
    gameState.touches.y = y;
    // engines reading their own tap-props read clickX/clickY,
    // engines read pointerX/pointerY+pointerJustTap or mx/my from touches
    gameState.touches.clickX = x;
    gameState.touches.clickY = y;
    gameState.touches.pointerX = x;
    gameState.touches.pointerY = y;
    gameState.touches.pointerJustTap = true;
    gameState.touches.mx = x;
    gameState.touches.my = y;
    // action pulse so engines that poll touches.action also react
    gameState.touches.action = true;
    startHold(x, y);
    setTimeout(() => { if (gameState.touches) gameState.touches.action = false; }, 90);
  };
  const endTap = () => {
    clearHold();
    if (gameState.touches) {
      gameState.touches.holdEnd = false;
      gameState.touches.hold = false;
    }
  };
  const down = (e) => { e.preventDefault(); const t = e.touches ? e.touches[0] : e; setTap(t.clientX, t.clientY); };
  const mouseDown = (e) => { e.preventDefault(); setTap(e.clientX, e.clientY); };
  canvas.addEventListener('touchstart', down, { passive: false });
  canvas.addEventListener('touchend', endTap, { passive: false });
  canvas.addEventListener('mousedown', mouseDown, { passive: false });
  canvas.addEventListener('mouseup', endTap, { passive: false });
  tapBinding = { el: canvas, handlers: { down, mouseDown, endTap } };
}
function unbindTapTracker() {
  if (tapBinding) {
    const { el, handlers } = tapBinding;
    el.removeEventListener('touchstart', handlers.down);
    el.removeEventListener('mousedown', handlers.mouseDown);
    tapBinding = null;
  }
}
function canvasScale() {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return { sx: 1, sy: 1 };
  const r = canvas.getBoundingClientRect();
  // DPR-aware: canvas buffer is W*DPR wide, but engines use logical W (800).
  // So the input→logical scale is (LOGICAL W) / r.width, NOT canvas.width / r.width.
  // We read the logical size from the same const the engines use (800×450),
  // but fall back to attribute/ratio generically if we can't derive it.
  let lw = 800, lh = 450;
  // If an engine ever switches to dynamic logical size, respect the attribute:
  const logicalMult = (canvas.width && canvas.height) ? (canvas.width / lw) : 1;
  if (logicalMult > 0 && Math.abs(logicalMult - 1) > 0.01) {
    lw = canvas.width; lh = canvas.height;   // attribute already logical (no DPR scaling applied)
  }
  return {
    sx: (lw && r.width) ? (lw / r.width) : 1,
    sy: (lh && r.height) ? (lh / r.height) : 1
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
  // v7.31: BUTTON-CONTROLLED games do NOT bind canvas touch/swipe at all —
  // the user controls them purely with the on-screen buttons (dpad/joystick/
  // TAP/etc). Only screen-gesture games (canvas/swipe/swipe-zone/drag types)
  // dual-mode engines (tilt + swipe) get canvas
  // touch binding here. Layout type lives in CONTROL_LAYOUT.
  const layout = (typeof CONTROL_LAYOUT !== 'undefined' && CONTROL_LAYOUT[gameState.id]) || null;
  const cType = layout ? layout.type : null;
  const gestureTypes = ['canvas', 'swipe', 'swipe-zone', 'drag', 'tilt', 'swipe+drag', 'swipe+action'];
  if (cType && gestureTypes.indexOf(cType) === -1) {
    // button-controlled — no canvas gestures; tap-tracker for board-tap games
    bindTapTracker(canvas);
    return;
  }
  // track active pointers per pointerId (multi-touch safe)
  const pointers = new Map();
  // pointer-drag style engines use the pointer canvas branch
  if (typeof engine.pointerDown === 'function') {
    // engines read touches.pointerDown/touches.action/touches.mx/my for
    // crosshair + fire; drag-aim engines read touches.pointerDown.
    // All pointer-drag engines need the coordinates mirrored into touches
    // so their update loops (which poll touches.*, not the x/y args) react.
    const mirrorTouches = (x, y) => {
      if (!gameState.touches) return;
      gameState.touches.pointerDown = { x, y };
      gameState.touches.x = x; gameState.touches.y = y;
      gameState.touches.mx = x; gameState.touches.my = y;
      gameState.touches.pointerX = x; gameState.touches.pointerY = y;
    };
    const down = (e) => { e.preventDefault(); const { x, y } = canvasXY(e.clientX, e.clientY); mirrorTouches(x, y); engine.pointerDown(x, y); };
    const move = (e) => { e.preventDefault(); const { x, y } = canvasXY(e.clientX, e.clientY); mirrorTouches(x, y); engine.pointerMove(x, y); };
    const up = (e) => { e.preventDefault(); if (gameState.touches) { gameState.touches.pointerDown = null; gameState.touches.mx = undefined; gameState.touches.my = undefined; } engine.pointerUp(); };
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
  // generic swipe fallback → touches
  if (typeof engine.swipe !== 'function' && typeof engine.onSwipe !== 'function' && typeof engine.pointerDown !== 'function') {
    let swipeDirTimer = null;
    let activePointer = null;
    // v7.42: canvas press feeds coords + down for drag-aim games, but ONLY an
    // action pulse for hold-to-act canvas engines
    // swipe+action engines (swipe direction + tap action)
    // swipe+action engines must NOT get a canvas action pulse — it would falsely
    // trigger their ACTION (jump/confirm/drop) on every touchstart.
    const layoutG = (typeof CONTROL_LAYOUT !== 'undefined' && CONTROL_LAYOUT[gameState.id]) || {};
    const cTypeG = layoutG.type || '';
    // v7.42: drag/hold canvas games need coords + down + action fed from canvas
    // touches (hold/pull engines were UNPLAYABLE on
    // mobile — nothing set touches.action/down for canvas layouts). Swipe-type
    // pure-swipe engines keep the swipe path —
    // a global touches.down would falsely slide dino / steer on touchstart.
    const feedCoords = cTypeG === 'canvas';
    // Hold/tap-fire games that poll touches.action directly from canvas:
    // hold-pull engines (pull to aim, hold to wind, tap to fire at
    // crosshair, hold aim + release drop) read
    // only touches.down + x/y (feedCoords covers it); air_strike uses the
    // HOLD ACTION button (buttons.action).
    const holdAction = feedCoords && (gameState.id && window.GAME_ENGINE && window.GAME_ENGINE[gameState.id] && (window.GAME_ENGINE[gameState.id].gesture || '').includes('hold'));
    const clearDir = () => { gameState.touches.left = gameState.touches.right = gameState.touches.up = gameState.touches.down = false; };
    const start = (e) => {
      const t = e.touches ? e.touches[0] : e;
      if (e.touches) activePointer = e.touches[0].identifier;
      canvasSwipe.startX = t.clientX; canvasSwipe.startY = t.clientY; canvasSwipe.started = true;
      if (feedCoords) {
        const { x, y } = canvasXY(t.clientX, t.clientY);
        gameState.touches.down = true;
        gameState.touches.x = x; gameState.touches.y = y;
        gameState.touches.mouseX = x; gameState.touches.mouseY = y;
        gameState.touches.mx = x; gameState.touches.my = y; // crosshair engines
        gameState.touches.mouseDown = true;
        if (holdAction) gameState.touches.action = true;
      }
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
        // keep feeding live drag coords + down state (drag-aim engines)
        if (feedCoords) {
          const { x, y } = canvasXY(t.clientX, t.clientY);
          gameState.touches.x = x; gameState.touches.y = y;
          gameState.touches.mouseX = x; gameState.touches.mouseY = y;
          gameState.touches.mx = x; gameState.touches.my = y; // crosshair engines
          gameState.touches.down = true;
          if (holdAction) gameState.touches.action = true;
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
      // v7.42: release → action/down off so hold-to-act engines fire on release
      if (feedCoords) {
        gameState.touches.down = false;
        gameState.touches.mouseDown = false;
        if (holdAction) gameState.touches.action = false;
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
  // swipe-style engines feed coords
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
  unbindTapTracker();
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
// keyboard for arrow-driven engines (arrows already global; route to engine too)
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
  slice()  { sfxTone(720, 0.07, 'square', 0.045); setTimeout(() => sfxTone(980, 0.1, 'square', 0.035), 50); },
  over()   { sfxTone(392, 0.18, 'sawtooth', 0.05, 130); setTimeout(() => sfxTone(196, 0.28, 'sawtooth', 0.05, 60), 160); },
  launch() { sfxTone(440, 0.1, 'square', 0.045, 880); },
  win()    { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => sfxTone(f, 0.12, 'square', 0.045), i * 90)); },
  // v7.15.1 signature sounds
  flap()   { sfxTone(640, 0.07, 'square', 0.04, 320); },
  shoot()  { sfxTone(880, 0.05, 'sawtooth', 0.03, 220); setTimeout(() => sfxTone(440, 0.08, 'sawtooth', 0.03, 110), 60); },
  boost()  { sfxTone(140, 0.35, 'sawtooth', 0.04, 880); },
  win2()   { [784, 988, 1175, 1568].forEach((f, i) => setTimeout(() => sfxTone(f, 0.14, 'triangle', 0.05), i * 100)); },
  continue(){ [392, 523, 659].forEach((f, i) => setTimeout(() => sfxTone(f, 0.15, 'square', 0.05), i * 110)); },
  error()  { sfxTone(200, 0.2, 'sawtooth', 0.04, 90); },
  move()   { sfxTone(420, 0.04, 'square', 0.02); },
  slide()  { sfxTone(300, 0.12, 'sawtooth', 0.03, 150); }
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
  // Canvas-based games: most draw their own aiming; but games that poll
  // touches.action (hold-to-pull arcade engines need
  // an on-screen hold button on mobile when the engine asks — the
  // canvas swipe path alone never sets touches.action (v7.42 P1 fix).
  if (type === 'canvas') {
    const holdGames = []; // empty hub — HOLD button list populated when games return
    if (holdGames.indexOf(gameId) !== -1) {
      html += `<div class="ctrl-spacer"></div>`;
      html += `<div class="ctrl-group"><button class="ctrl-btn ctrl-btn-action" id="btn_action" ontouchstart="pressed('action',true,event)" ontouchend="pressed('action',false,event)" ontouchcancel="pressed('action',false,event)" onmousedown="pressed('action',true,event)" onmouseup="pressed('action',false,event)" onmouseleave="pressed('action',false,event)" style="min-width:120px;padding:14px 22px;font-size:13px;border-radius:16px;background:linear-gradient(135deg,#ff3355,#ff8800);color:#fff;font-weight:900;box-shadow:0 4px 0 #a01020"><i class="fa-solid fa-hand-pointer"></i> HOLD&nbsp;·&nbsp;RELEASE</button></div>`;
    } else {
      html += `<div class="ctrl-spacer"></div>`;
    }
  }
  // Swipe + rotate button (swipe-move + tap-rotate engines)
  else if (type === 'swipe+drag') {
    html += `<div class="ctrl-group"><button class="ctrl-btn" id="btn_action" ontouchstart="pressed('action',true,event)" ontouchend="pressed('action',false,event)" ontouchcancel="pressed('action',false,event)" onmousedown="pressed('action',true,event)" onmouseup="pressed('action',false,event)" onmouseleave="pressed('action',false,event)"><i class="fa-solid fa-rotate"></i>ROTATE</button></div>`;
  }
  // Swipe-only
  else if (type === 'swipe') {
    html += `<div class="ctrl-swipe-zone" id="swipeZone"><i class="fa-solid fa-arrows-up-down-left-right"></i><span>SWIPE</span></div>`;
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
  // Dual joystick (move + aim axes)
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
  // Swipe + ACTION button (swipe-to-move + tap-to-act engines)
  // directional swipe + confirm/drop/jump action button)
  else if (type === 'swipe+action') {
    html += `<div class="ctrl-swipe-zone" id="swipeZone"><i class="fa-solid fa-arrows-up-down-left-right"></i><span>SWIPE</span></div>`;
    html += `<div class="ctrl-group"><button class="ctrl-btn" id="btn_action" ontouchstart="pressed('action',true,event)" ontouchend="pressed('action',false,event)" ontouchcancel="pressed('action',false,event)" onmousedown="pressed('action',true,event)" onmouseup="pressed('action',false,event)" onmouseleave="pressed('action',false,event)"><i class="fa-solid fa-hand-pointer"></i>ACTION</button></div>`;
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
  // Touch-split (left gas / right brake)
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
  const file =
    (fname === 'pin_ball' ? 'games/pin_ball.js' : 'games/' + fname + '.js');
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
    // combo active — show the HUD chip
    if (typeof window.updateComboHUD === 'function') { try { window.updateComboHUD(); } catch (e) {} }
    // milestone rewards at exact counts (5/10/15/20)
    if (typeof window.applyComboMilestone === 'function') { try { window.applyComboMilestone(state.combo.count); } catch (e) {} }
    // gameFX: combo glow
    if (window.gameFX) { try { window.gameFX.comboFlash(state.combo.count); } catch(e) {} }
  } else {
    // new session — save previous combo's best if it was higher
    if (state.combo.count > (state.combo.bestSession || 0)) {
      state.combo.bestSession = state.combo.count;
    }
    state.combo.count = 1;
    if (typeof window.updateComboHUD === 'function') { try { window.updateComboHUD(); } catch (e) {} }
  }
  state.combo.lastTime = now;
  if (state.combo.count > (state.stats.bestCombo || 0)) {
    state.stats.bestCombo = state.combo.count;
  }
  saveState();

  // ORIGINAL 2048 (zip) — hosted 100% untouched in an iframe; hub adds the coin box.
  if (id === '2048') { launchOrig2048(); return; }
  if (id === 'neon-flap') { launchOrigNeonFlap(); return; }
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
// plus touches/keys objects, plus x/y pointer coords
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
// v7.35: SHOP EFFECTS — equipped effect tints hub FX particles:
// fx-fire → warm embers, fx-rainbow → random colorful, fx-stars → cool sparkle
window.gameFX = {
  effColor(def) {
    const id = (typeof window.equippedId === 'function') ? window.equippedId('effect') : null;
    if (id === 'fx-fire') return '#FF6B3D';
    if (id === 'fx-stars') return '#A5D8FF';
    if (id === 'fx-rainbow') return ['#FF3B6B', '#FFE600', '#39FF88', '#00FFFF', '#C77DFF'][Math.floor(Math.random() * 5)];
    return def;
  },
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
    color = this.effColor(color);
    count = Math.min(20, Math.max(0, count | 0)); // [MASTER] perf: hard cap 20 dom particles
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
    this.burst(x || innerWidth / 2 + (Math.random() - .5) * 60, y || innerHeight / 3, this.effColor('#FFD700'), 6);
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
  // AUTO-FULLSCREEN (v7.29): game start → fullscreen immediately, no button needed.
  // Inside the user-gesture window (called from tap) so it works on Android/desktop;
  // iOS Safari has no fullscreen API on divs — silently skip (PWA standalone is app-like).
  if (document.fullscreenEnabled && !document.fullscreenElement) {
    try {
      const p = document.documentElement.requestFullscreen();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }
  // v7.31: NO AUTO-LANDSCAPE — screen rotation lock REMOVED (user: "rotate বন্ধ").
  // Games stay in whatever orientation the device is in; canvas CSS handles fit.
  // v7.31: tutorial toast — show the control hint briefly at game start
  showTutorialToast(g, id);
  document.getElementById('hudGameTitle').innerText = g.name;
  document.getElementById('hudScore').innerText = '0';
  document.getElementById('hudCoins').innerText = '0';
  // hide lives chip until an engine reports lives
  const hudLivesEl = document.getElementById('hudLives');
  if (hudLivesEl) hudLivesEl.style.display = 'none';
  // hide combo chip until combo active
  const hudComboEl = document.getElementById('hudCombo');
  if (hudComboEl) hudComboEl.style.display = 'none';
  // REVENGE MODE (v7.36): show the charged chip during the boosted run
  const hudRevengeEl = document.getElementById('hudRevenge');
  if (hudRevengeEl) hudRevengeEl.style.display = pendingRevenge ? 'inline-flex' : 'none';

  // lock page scroll during gameplay (mobile)
  lockGameScroll(true);

  // reset game state
  gameState = { id, running: false, paused: false, over: false, score: 0, coinsEarned: 0, touches: {}, keys: {} };
  runBestBeaten = false;   // v7.49: live NEW BEST celebration re-arms for every fresh run
  const hs = document.getElementById('hudScore'); if (hs) { try { hs.classList.remove('run-best'); } catch(e) {} }

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // DPR (devicePixelRatio) — sharp rendering on high-DPI phones
  // (audit item #2). The canvas BUFFER becomes logicalW*dpr, but the
  // engines keep drawing in their logical 800×450 space. We restore a
  // setTransform scaling so ctx ops land at CSS-pixel scale; crispness
  // comes from the bigger backing store. All input scaling (canvasScale)
  // now reads logical dims, so touch coordinates stay correct.
  function setupDPR() {
    const dpr = (typeof window.devicePixelRatio === 'number' && window.devicePixelRatio > 0)
      ? Math.min(3, window.devicePixelRatio) : 1;
    // preserve the engine's logical dimensions — NEVER let attribute scale
    // affect engine coordinate space (they hardcode 800×450)
    const lw = 800, lh = 450;
    canvas.width = Math.round(lw * dpr);
    canvas.height = Math.round(lh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  setupDPR();
  window.__dprResize = () => { setupDPR(); };
  window.addEventListener('resize', window.__dprResize);

  // BOOT-NEW-FRAMEWORK: bootGame-তে iframe stage hide — যাতে যেকোনো native canvas game
  // (Fruit Fury বা ভবিষ্যৎ native) চালু হলে অন্য iframe stage/Stats overlay দেখায় না।
  ['orig2048Stage','orig2048Stats','neonflapStage','neonflapStats'].forEach(el => {
    const x = document.getElementById(el);
    if (x) x.style.display = 'none';
  });

  // create engine instance
  currentEngine = engine;
  let reviveFloor = pendingReviveFloor; pendingReviveFloor = 0;   // consumed once
  const onScoreCb = (s) => {
    const shown = s + reviveFloor;    // revive: add carried floor to the live score
    document.getElementById('hudScore').innerText = shown;
    // v7.49 LIVE NEW BEST: the moment the run crosses the player's own best,
    // celebrate INSTANTLY (gold burst + trophy pop + win SFX + haptic) — once
    // per run. Retry-compulsion: the streak moment lands mid-run, not buried
    // in the game-over panel. The HUD chip also glows gold via .run-best.
    if (!runBestBeaten && shown > 0 && state.best && shown > (state.best[gameState.id] || 0)) {
      runBestBeaten = true;
      const scoreEl = document.getElementById('hudScore');
      if (window.gameFX) { try { window.gameFX.burst(innerWidth/2, innerHeight/2 - 60, '#FFE600', 18); } catch(e) {} }
      if (typeof window.popScore === 'function') { try { window.popScore(innerWidth/2 - 60, innerHeight/2 - 90, '🏆 NEW BEST!'); } catch(e) {} }
      if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch(e) {} }
      if (navigator.vibrate) { try { navigator.vibrate([60,40,120]); } catch(e) {} }
      if (scoreEl) { try { scoreEl.classList.add('run-best'); } catch(e) {} }
    }
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

  // bind canvas touch (all canvas-driven engines)
  bindGameTouch(currentGame);

  // hide game over overlay
  document.getElementById('gameOverOverlay').classList.remove('show');

  // start
  gameState.running = true;
  if (typeof currentGame.setInput === 'function') currentGame.setInput(gameState.touches, gameState.keys);
  currentGame.start();

  // ---- v7.35 SLOW MOTION booster: delay the difficulty ramp (engine speed stays low longer) ----
  const rampMs = shopBoosterOn('slow') ? 22000 : 15000;
  clearInterval(window._diffTimer);
  window._diffLevel = 0;
  window._diffTimer = setInterval(() => {
    if (!gameState.running || gameState.paused || gameState.over) return;
    window._diffLevel = Math.min(5, window._diffLevel + 1);
    if (typeof currentGame.setDifficulty === 'function') {
      try { currentGame.setDifficulty(window._diffLevel); } catch (e) {}
      // subtle ramp feedback: haptic pulse on each level-up
      if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) {} }
    }
  }, rampMs);

  // wire keyboard
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);

  // touch → key sync for keyboard-driven engines
  startTouchKeySync();
  // big-screen orientation state (rotate hint removed v7.29.1 — auto-landscape handles it)
}

// ---- end game ---- (spring score pop + theme accent on overlay)
// ==== SHOP BOOSTER RUNTIME (v7.35) — makes the store real ====
// Engines read window.shopBooster('2x'|'shield'|'slow') ONCE (consumes 2x/slow),
// shield stays armed until endGame. Boosters live per-run, never persist to storage.
let runBoosters = { x2: false, shield: false, slow: false, shieldUsed: false };
function getEquipped() {
  return (typeof window.getEquippedState === 'function')
    ? window.getEquippedState()
    : { skin: null, vehicle: null, effect: null };
}
function shopBooster(key) {
  const eq = getEquipped();
  const slot = (key === '2x' || key === 'shield' || key === 'slow') ? 'booster' : null;
  const armed = !!eq && !!slot && typeof eq[slot] === 'string' && eq[slot] === 'boost-' + key;
  if (key === 'shield') return armed && !runBoosters.shieldUsed;
  if (!armed || runBoosters[key]) return false;
  runBoosters[key] = true;   // 2x/slow are single-consume per run
  // consumer booster is used up: unequip it so it cannot fire again next run
  if (typeof window.unequipBooster === 'function') { try { window.unequipBooster(); } catch (e) {} }
  return true;
}
function equippedId(type) {
  return getEquipped()[type] || null;
}
function consumeShield() {
  if (!runBoosters.shieldUsed && shopBoosterOn('shield')) runBoosters.shieldUsed = true;
}
// persistent armed check for per-frame engines (non-consuming — safe in update loops)
function shopBoosterOn(key) {
  const eq = getEquipped();
  const slot = (key === '2x' || key === 'shield' || key === 'slow') ? 'booster' : null;
  if (!eq || !slot || typeof eq[slot] !== 'string' || eq[slot] !== 'boost-' + key) return false;
  if (key === 'shield') return !runBoosters.shieldUsed;
  return true; // x2/slow stay armed for the whole run
}

function endGame(score, coinsEarned) {
  // [MASTER] double-submit guard: an engine calling onGameOver twice must not double-award
  if (gameState.over) return;
  gameState.over = true;
  gameState.running = false;
  // SHIELD booster (equipped 'boost-shield'): 1 free auto-continue per run — same
  // flow as the coin revive but free, consuming the shield instead. No awards here;
  // the continued run books its own score+coins at its own game-over.
  if (shopBoosterOn('shield')) {
    runBoosters.shieldUsed = true;
    if (typeof window.playSfx === 'function') { try { window.playSfx('continue'); } catch (e) {} }
    if (typeof window.hapticVibe === 'function') { try { window.hapticVibe('win'); } catch (e) {} }
    setTimeout(() => toast('🛡️ SHIELD SAVED YOU!'), 250);
    pendingReviveFloor = Math.max(0, Math.floor(Number(score) || 0)); // carry the run's score
    const sid = gameState.id;
    unbindGameTouch();
    stopTilt();
    lockGameScroll(false);
    if (currentGame) { try { currentGame.destroy(); } catch (e) {} }
    currentGame = null;
    currentEngine = null;
    gameState = { id: null, running: false, paused: false, over: false, score: 0, coinsEarned: 0, touches: {}, keys: {} };
    clearDPRResize();
    window.removeEventListener('keydown', keyDown);
    window.removeEventListener('keyup', keyUp);
    stopTouchKeySync();
    document.getElementById('gameOverOverlay').classList.remove('show');
    launchGame(sid);
    return; // shield consumed — skip all normal game-over processing
  }
  clearInterval(window._diffTimer);   // stop difficulty ramp on game end
  stopTilt(); // B1 [010]: clean up tilt on game over
  // [P1 fix] sanitize score — NaN/Infinity/negative/string must never reach storage [046-050]
  score = Math.max(0, Math.floor(Number(score) || 0));
  coinsEarned = Math.max(0, Math.floor(Number(coinsEarned) || 0));
  // TODAY'S CHALLENGE id (v7.39): resolved once per run so the bonus pays only
  // when the banner's game is the one actually played. Offline-safe: the app
  // side liveChallenge() falls back to a deterministic daily pick when
  // live_state.json is unreachable.
  const challId = (typeof window.liveChallenge === 'function') ? (window.liveChallenge() || null) : null;
  // REVENGE MODE (v7.36): +50% score boost bought at the previous near-miss
  // game-over. Applied BEFORE the 2x booster so a vengeful boosted run stacks
  // predictably (score ×1.5 ×2 = ×3 total).
  if (pendingRevenge) {
    pendingRevenge = false; // consumed on this run's booking
    score = Math.floor(score * 1.5);
    if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
  }
  // 2X SCORE booster (equipped 'boost-2x'): double the score that endGame books
  if (shopBooster('2x')) {
    score = Math.floor(score * 2);
    if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
  }
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

  // ==== MASTERY STARS (v7.32) ==== keep max earned per game ★ rating
  if (typeof state.stars !== 'object' || state.stars === null) state.stars = {};
  let earnedStars = 0;
  if (score > 0) {
    const tgt = GAME_TARGETS[gameState.id];
    earnedStars = !tgt ? 1 : score >= tgt ? 3 : score >= tgt * 0.6 ? 2 : 1;
    const prev = state.stars[gameState.id] || 0;
    if (earnedStars > prev) {
      state.stars[gameState.id] = earnedStars;
      if (typeof window.saveState === 'function') { try { window.saveState(); } catch (e) {} }
      if (earnedStars === 3 && typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e2) {} }
      if (earnedStars === 3 && typeof window.hapticVibe === 'function') { try { window.hapticVibe('win'); } catch (e3) {} }
    }
  }

  // ==== SESSION COMBO (v8.0) payoff: combine score coins + pickups with multiplier ====
  // combo live if a game was played within the window; multiplier applies to the
  // score-based coins. Combo expires after the window — reset to 1 so the next
  // play starts a fresh chain.
  if (!state.combo) state.combo = { count: 0, lastTime: 0, bestSession: 0 };
  if (state.combo.lastTime && (Date.now() - state.combo.lastTime) > COMBO_WINDOW_MS) {
    // combo expired — reset chain
    if (state.combo.count > (state.combo.bestSession || 0)) state.combo.bestSession = state.combo.count;
    state.combo.count = 0;
  }
  const comboMult = getComboMultiplier(state.combo.count || 0);
  if (comboMult > 1) {
    const scoreCoins = Math.floor(score * 0.1);
    const comboBonus = Math.floor((scoreCoins + coinsEarned) * (comboMult - 1));
    if (comboBonus > 0) state.coins += comboBonus;
  }
  if (typeof window.updateComboHUD === 'function') { try { window.updateComboHUD(); } catch (e) {} }

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

  // ==== TODAY'S CHALLENGE (v7.39) — the home banner promises "+bonus coins";
  // now it ACTUALLY pays: beat your best on the daily challenge game for a
  // flat +40 🪙 bonus, once per day (localStorage gate). Retry-compulsion:
  // the player knows a real reward waits on one more (better) run.
  let challBonus = 0;
  if (challId && challId === gameState.id && isNewBest && score > 0) {
    const challKey = 'rah_chall_' + new Date().toDateString();
    try {
      if (localStorage.getItem(challKey) !== 'done') {
        localStorage.setItem(challKey, 'done');
        challBonus = 40;
        state.coins += challBonus;
        if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
        if (typeof window.hapticVibe === 'function') { try { window.hapticVibe('win'); } catch (e) {} }
        setTimeout(() => toast('🏆 CHALLENGE BONUS: +' + challBonus + ' 🪙'), 900);
      }
    } catch (e) {}
  }

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
      { id: 'mp-play',     ico: '🎮', game: '',       desc: 'Play any game once',        target: 1, reward: 40, prog: 0 }
    ];
    const scorePool = [
      { id: 'ms-1k',       ico: '💎', game: '', desc: 'Score 1,000 in one run',  target: 1000, reward: 65, prog: 0 },
      { id: 'ms-5k',       ico: '💎', game: '', desc: 'Score 5,000 in one run',  target: 5000, reward: 75, prog: 0 }
    ];
    shuffle(playPool); shuffle(scorePool);
    // v7.41: persist the day's pools so rerollDailyMissions() re-draws fresh picks
    state.dailyQuest = { date: today, list: [playPool[0], scorePool[0], scorePool[1]], done: [], pools: { play: playPool, score: scorePool } };
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

  // ==== NEXT-STAR PROGRESS BAR (v7.37): concrete distance to the next ★ ====
  // Retry-compulsion: a numeric "X more to ★" goal beats a vague nudge. Uses the
  // same GAME_TARGETS thresholds as the star rating + retry fuel, so 60%/100% of
  // target = the 2★/3★ boundaries exactly (never contradicts the stars shown).
  const spEl = document.getElementById('overStarProg');
  if (spEl) {
    const tgt = GAME_TARGETS[gameState.id];
    const step = tgt ? tgt * 0.6 : 0;              // width of 1 star tier
    let pct = 0, label = '';
    if (tgt && score > 0 && score < tgt) {         // below the 3★ target: show climb
      const into = score - Math.floor(score / step) * step; // progress within current tier
      pct = Math.max(4, Math.min(100, Math.round((into / step) * 100)));
      const left = tgt - score;
      label = '⭐ ' + left.toLocaleString() + ' MORE TO THE NEXT STAR';
    } else if (tgt && score >= tgt) {              // 3★ reached: full bar
      pct = 100;
      label = '⭐⭐⭐ ALL STARS!';
    }
    const fill = document.getElementById('overStarProgFill');
    const lbl = document.getElementById('overStarProgLabel');
    if (fill && pct > 0) {
      spEl.style.display = '';
      fill.style.width = pct + '%';
      if (lbl) lbl.innerText = label;
    } else {
      spEl.style.display = 'none';
    }
  }

  // ==== REVENGE MODE (v7.36): near-miss (score < 60% of target) — buy +50% next run ====
  // User priority #1 is retry-compulsion — a bad run becomes a reason to continue
  // with a real advantage. OPT-IN (player spends coins) keeps the economy fair:
  // 50 coins ≈ what a near-miss run pays out, so the loop is sustainable.
  const revengeBtn = document.getElementById('revengeBtn');
  if (revengeBtn) {
    const tg = GAME_TARGETS[gameState.id];
    const nv = score > 0 && tg && score < tg * 0.6 && !pendingRevenge && state.coins >= 50;
    revengeBtn.style.display = nv ? 'inline-flex' : 'none';
    if (nv) revengeBtn.innerText = '🔥 REVENGE ×1.5 (50 🪙)';
  }
}
// legacy engines self-report via window.endGame — expose the funnel
window.endGame = endGame;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---- daily missions reroll (v7.41) ----
// Retry-compulsion + coin-sink: spend 50 coins to re-pick today's 3 missions.
// Keeps completed claims (done[]), re-draws from the persisted day pools.
function rerollDailyMissions() {
  const COST = 50;
  if (!state.dailyQuest || !state.dailyQuest.date) return;
  if (!state.dailyQuest.list || !state.dailyQuest.list.length) return;
  if ((state.dailyQuest.done || []).length >= state.dailyQuest.list.length) { toast('All missions done — nothing to reroll!'); if (typeof window.hapticVibe === 'function') { try { window.hapticVibe('err'); } catch (e) {} } return; }
  if (state.coins < COST) { toast('Need ' + COST + ' coins to reroll!'); if (typeof window.hapticVibe === 'function') { try { window.hapticVibe('err'); } catch (e) {} } return; }
  state.coins -= COST;
  // re-draw fresh picks from the day's pools (keeps completed claims)
  const pools = state.dailyQuest.pools;
  const playPool = (pools && pools.play) ? pools.play.slice() : [];
  const scorePool = (pools && pools.score) ? pools.score.slice() : [];
  const done = state.dailyQuest.done || [];
  let fresh = [];
  for (let attempt = 0; attempt < 5 && fresh.length < 3; attempt++) {
    shuffle(playPool); shuffle(scorePool);
    const cand = [playPool[0], scorePool[0], scorePool[1]].filter(Boolean);
    fresh = cand.filter(q => !done.includes(q.id));
  }
  // absolute fallback: if somehow still short (all missions done), keep old list
  const newList = fresh.length >= 3 ? fresh.slice(0, 3) : state.dailyQuest.list.slice();
  state.dailyQuest.list = newList;
  state.dailyQuest.list.forEach(q => { q.prog = 0; }); // fresh progress for the new picks
  saveState(); updateCoinDisplay();
  if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
  if (typeof window.hapticVibe === 'function') { try { window.hapticVibe('win'); } catch (e) {} }
  toast('🎲 MISSIONS REROLLED!');
  const pr = document.getElementById('page-profile');
  if (pr && pr.classList.contains('active')) renderProfile();
}

// ---- ORIGINAL (ZIP) GAMES — moved to games/iframe_games.js ----
// 2048 + Neon Flap host code (launchOrig2048 / settleOrig2048 / restartOrig2048,
// launchOrigNeonFlap / settleOrigNeonFlap / restartOrigNeonFlap) lives in its own
// file so every game's host is isolated and nothing mixes.
// Load order: games/core.js then games/iframe_games.js (see index.html).

// ---- restart ----
// B1 FIX [014-015]: full cleanup before restart — no stale state/timers carry over
function restartGame() {
  if (!gameState.id) return;
  const id = gameState.id;
  if (id === '2048') { restartOrig2048(); return; }
  if (id === 'neon-flap') { restartOrigNeonFlap(); return; }
  // full cleanup (same as exitToHub minus go('arcade'))
  unbindGameTouch();
  stopTilt();
  lockGameScroll(false);
  if (currentGame) { try { currentGame.destroy(); } catch (e) {} }
  currentGame = null;
  currentEngine = null;
  gameState = { id: null, running: false, paused: false, over: false, score: 0, coinsEarned: 0, touches: {}, keys: {} };
  clearDPRResize();
  window.removeEventListener('keydown', keyDown);
  window.removeEventListener('keyup', keyUp);
  stopTouchKeySync();
  document.getElementById('gameOverOverlay').classList.remove('show');
  reviveUsed = false;
  launchGame(id);
}

// ---- coin continue (2nd chance, arcade revive) ----
function reviveGame() {
  if (!gameState.id || !gameState.over) return;
  if (gameState.id === '2048') { toast('2048 has its own continue!'); return; }
  if (gameState.id === 'neon-flap') { restartOrigNeonFlap(); return; }
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
  clearDPRResize();
  window.removeEventListener('keydown', keyDown);
  window.removeEventListener('keyup', keyUp);
  stopTouchKeySync();
  document.getElementById('gameOverOverlay').classList.remove('show');
  launchGame(id);
}

// ---- revenge mode (v7.36): buy +50% next-run score at a near-miss game-over ----
// Distinct from coin-continue: continue REUSES the run (same score, no boost);
// revenge RESTARTS the game with a ×1.5 score advantage. Both feed the
// retry-compulsion loop the user wants — miss, spend, try again harder.
function revengeGame() {
  if (!gameState.id || !gameState.over) return;
  if (pendingRevenge) { toast('Revenge already charged!'); return; }
  const COST = 50;
  if (state.coins < COST) { toast('Need ' + COST + ' coins for revenge!'); return; }
  state.coins -= COST;
  pendingRevenge = true;
  saveState(); updateCoinDisplay();
  if (typeof window.hapticVibe === 'function') { try { window.hapticVibe('win'); } catch (e) {} }
  if (typeof window.playSfx === 'function') { try { window.playSfx('boost'); } catch (e) {} }
  toast('🔥 REVENGE CHARGED — next run ×1.5 SCORE!');
  // same full cleanup as restart — fresh run, boost applied at next endGame booking
  const id = gameState.id;
  unbindGameTouch();
  stopTilt();
  lockGameScroll(false);
  if (currentGame) { try { currentGame.destroy(); } catch (e) {} }
  currentGame = null;
  currentEngine = null;
  gameState = { id: null, running: false, paused: false, over: false, score: 0, coinsEarned: 0, touches: {}, keys: {} };
  clearDPRResize();
  window.removeEventListener('keydown', keyDown);
  window.removeEventListener('keyup', keyUp);
  stopTouchKeySync();
  document.getElementById('gameOverOverlay').classList.remove('show');
  launchGame(id);
}

// ---- exit to hub ----
function exitToHub() {
  if (gameState.id === '2048') { settleOrig2048(); }
  if (gameState.id === 'neon-flap') { settleOrigNeonFlap(); }
  clearInterval(window._diffTimer);   // stop difficulty ramp timer on exit
  unbindGameTouch();
  stopTilt(); // B1 [010]: clean up tilt listener
  lockGameScroll(false);
  // AUTO-FULLSCREEN (v7.29): leaving a game → leave fullscreen back to the hub
  if (document.fullscreenElement) {
    try { const p = document.exitFullscreen(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  }
  // restore the user's global theme when leaving a game (skin-by-game off)
  if (typeof window.applyTheme === 'function' && typeof window.globalTheme === 'string') {
    try { window.applyTheme(window.globalTheme, true); } catch (e) {}
  }
  if (currentGame) { try { currentGame.destroy(); } catch (e) {} }
  currentGame = null;
  gameState = { id: null, running: false, paused: false, over: false, score: 0, coinsEarned: 0, touches: {}, keys: {} };
  clearDPRResize();
  window.removeEventListener('keydown', keyDown);
  window.removeEventListener('keyup', keyUp);
  stopTouchKeySync();
  const tcWrap = document.getElementById('touchControls');
  if (tcWrap) tcWrap.classList.remove('show');
  document.body.classList.remove('landscape-game');
  go('arcade');
  renderArcadeGrid('');
}

// ---- orientation ----
// v7.31: screen rotation lock REMOVED (user: "rotate বন্ধ") — no device
// orientation locking, no fullscreenchange retry, no unlock-on-exit.
// CSS media queries (portrait/landscape) refit the canvas automatically;
// no engine listens for resize.

// ---- pause / resume ----
// B1 FIX [008-009]: clear all input state on pause, restore on resume
function togglePause() {
  if (!gameState.id || gameState.over) return;
  // original 2048 iframe: pausing the original app is not supported — the
  // overlay just sits above it (resume leaves the original untouched)
  if (gameState.id === '2048') {
    if (gameState.paused) {
      gameState.paused = false;
      document.getElementById('pauseOverlay').classList.remove('show');
      const tc = document.getElementById('touchControls');
      if (tc && gameState._tcShown) { tc.classList.add('show'); }
    } else {
      gameState.paused = true;
      document.getElementById('pauseOverlay').classList.add('show');
      const tc = document.getElementById('touchControls');
      gameState._tcShown = !!(tc && tc.classList.contains('show'));
      if (tc) { tc.classList.remove('show'); }
    }
    return;
  }
  // neon-flap iframe: same overlay-only pause (original app keeps running)
  if (gameState.id === 'neon-flap') {
    if (gameState.paused) {
      gameState.paused = false;
      document.getElementById('pauseOverlay').classList.remove('show');
      const tc = document.getElementById('touchControls');
      if (tc && gameState._tcShown) { tc.classList.add('show'); }
    } else {
      gameState.paused = true;
      document.getElementById('pauseOverlay').classList.add('show');
      const tc = document.getElementById('touchControls');
      gameState._tcShown = !!(tc && tc.classList.contains('show'));
      if (tc) { tc.classList.remove('show'); }
    }
    return;
  }
  if (gameState.paused) {
    gameState.paused = false;
    document.getElementById('pauseOverlay').classList.remove('show');
    const tc = document.getElementById('touchControls');
    if (tc && gameState._tcShown) { tc.classList.add('show'); }
    if (currentGame) { try { currentGame.resume(); } catch (e) {} }
  } else {
    gameState.paused = true;
    // clear all held inputs so game doesn't "stuck" on resume
    gameState.touches = { up: false, down: false, left: false, right: false, action: false, boost: false, drift: false, gas: false, brake: false, power: false };
    gameState.keys = {};
    document.getElementById('pauseOverlay').classList.add('show');
    const tc = document.getElementById('touchControls');
    gameState._tcShown = !!(tc && tc.classList.contains('show'));
    if (tc) { tc.classList.remove('show'); }
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
  window.setMusicMuted = (m) => api.setMuted(m);
})();

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
  ctx.fillText('ARCADE HUB · XP · achievements · free to play', W/2, 375);

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
  const text = `🎮 ${game.name}: ${score.toLocaleString()} ${stars}\nRETRO ARCADE HUB`;
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

// ---- TUTORIAL TOAST (v7.31): auto-show hint at game start ----
// Brief overlay showing "HOW TO PLAY" + per-game hint, auto-hides after ~3s.
// Dismissible by tap or by any touch on the game canvas.
function showTutorialToast(g, id) {
  const el = document.getElementById('tutorialToast');
  if (!el || !g) return;
  const layout = (typeof CONTROL_LAYOUT !== 'undefined' && CONTROL_LAYOUT[id]) || {};
  const hint = layout.hint || 'Tap to play';
  const type  = layout.type || '';
  // Icon/category label
  const cat = type.includes('swipe') || type.includes('drag') || type === 'canvas'
    ? '👆 SWIPE / DRAG' : type.includes('action') || type === 'tap' || type === 'hold' || type === 'dpad' || type === 'joystick' || type === 'simon' || type === 'radial' || type === 'wheel'
    ? '🔘 USE ON-SCREEN CONTROLS' : '🎮 PLAY';
  el.innerHTML = `<div style="font-size:10px;color:var(--cyan,#0FF);letter-spacing:1px;margin-bottom:4px">HOW TO PLAY — ${g.name}</div>` +
    `<div style="font-size:11px;color:var(--cyan,#0FF);margin-bottom:5px">${cat}</div>` +
    `<div>${hint}</div>`;
  el.classList.remove('show');
  // force reflow for re-trigger animation
  void el.offsetWidth;
  el.classList.add('show');
  const hide = () => { el.classList.remove('show'); el.removeEventListener('touchstart', hide); };
  el.addEventListener('touchstart', hide, { once: true, passive: true });
  setTimeout(hide, 3000);
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
  const profCrt = document.getElementById('profCrtBtn');
  if (profCrt) profCrt.innerText = 'CRT: ' + (on ? 'ON' : 'OFF');
  toast(on ? 'CRT ON' : 'CRT OFF');
}
function initCRT() {
  const el = document.getElementById('crtOverlay');
  if (el && localStorage.getItem('rah_crt') === '1') el.classList.add('on');
  const profCrt = document.getElementById('profCrtBtn');
  if (profCrt) profCrt.innerText = 'CRT: ' + (localStorage.getItem('rah_crt') === '1' ? 'ON' : 'OFF');
}

// ---- wire card clicks to launch (replaces comingSoon) ----
function playGame(id, e) {
  if (e) e.stopPropagation();
  reviveUsed = false;   // fresh pick from hub — a new continue is available
  pendingRevenge = false; // v7.36: revenge charge is per-game, cleared on any fresh hub pick
  runBoosters = { x2: false, shield: false, slow: false, shieldUsed: false }; // v7.35: fresh per-run boosters
  launchGame(id);
}
