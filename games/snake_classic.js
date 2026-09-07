/* ============================================================
   Snake Classic — Nokia 1100 Style (Neon HD)
   Canvas 800x450, keypad arrows + swipe, old beep + vibration,
   nostalgia mode: original Nokia logic, neon glow
   ============================================================ */
function snakeClassic(canvas, ctx, onScore, onGameOver, onCoins) {
  // ---- state ----
  const W = 800, H = 450;
  let raf = null, last = 0, running = false;
  let score = 0, coins = 0;
  let over = false;

  // grid 24 x 15 cells (~30px)
  const CELL = 28;
  const COLS = Math.floor(W / CELL) - 2; // 26
  const ROWS = Math.floor(H / CELL) - 1; // 15
  const OX = (W - COLS * CELL) / 2;
  const OY = (H - ROWS * CELL) / 2;

  let snake = []; // [{x,y}]
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let food = null;
  let growTimer = 0; // pending growth
  let stepTimer = 0;
  let stepInterval = 0.18; // seconds per step
  let paused = false;

  // Nokia beep (WebAudio)
  let audioCtx = null;
  function beep(freq, dur) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      g.gain.value = 0.04;
      o.connect(g); g.connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + dur);
      if (navigator.vibrate) { try { navigator.vibrate(30); } catch (e) {} }
    } catch (e) {}
  }

  // ---- helpers ----
  function cellRect(x, y, color, glow) {
    ctx.shadowBlur = glow || 8;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.fillRect(OX + x * CELL + 1, OY + y * CELL + 1, CELL - 2, CELL - 2);
    ctx.shadowBlur = 0;
  }

  function reset() {
    snake = [
      { x: 8, y: Math.floor(ROWS / 2) },
      { x: 7, y: Math.floor(ROWS / 2) },
      { x: 6, y: Math.floor(ROWS / 2) }
    ];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    score = 0; coins = 0; over = false;
    growTimer = 0;
    stepTimer = 0;
    stepInterval = 0.18;
    spawnFood();
  }

  function spawnFood() {
    let p;
    do {
      p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (snake.some(s => s.x === p.x && s.y === p.y));
    food = p;
  }

  // ---- input ----
  function turn(dx, dy) {
    if (over || !running) return;
    // prevent reversing
    if (dx === -dir.x && dy === -dir.y) return;
    nextDir = { x: dx, y: dy };
  }
  function onKey(code) {
    if (code === 'ArrowUp' || code === 'KeyW') turn(0, -1);
    else if (code === 'ArrowDown' || code === 'KeyS') turn(0, 1);
    else if (code === 'ArrowLeft' || code === 'KeyA') turn(-1, 0);
    else if (code === 'ArrowRight' || code === 'KeyD') turn(1, 0);
  }
  function onSwipe(vx, vy) {
    if (Math.abs(vx) > Math.abs(vy)) turn(vx > 0 ? 1 : -1, 0);
    else turn(0, vy > 0 ? 1 : -1);
  }

  // ---- update ----
  function step() {
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    // wall = game over (Nokia classic — no wrap)
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      beep(120, 0.4);
      gameOver();
      return;
    }
    // self collision
    if (snake.some(s => s.x === head.x && s.y === head.y)) {
      beep(120, 0.4);
      gameOver();
      return;
    }
    snake.unshift(head);
    // food?
    if (food && head.x === food.x && head.y === food.y) {
      score += 10;
      onScore(score);
      coins += 5;
      onCoins(5);
      beep(880, 0.08);
      growTimer += 1;
      stepInterval = Math.max(0.07, stepInterval - 0.003);
      spawnFood();
    }
    // tail
    if (growTimer > 0) growTimer--;
    else snake.pop();
  }

  function update(dt) {
    if (over || !running || paused) return;
    stepTimer += dt;
    while (stepTimer >= stepInterval) {
      stepTimer -= stepInterval;
      step();
      if (over) return;
    }
  }

  // ---- render ----
  function render() {
    ctx.fillStyle = '#05070A';
    ctx.fillRect(0, 0, W, H);

    // subtle grid
    ctx.strokeStyle = 'rgba(0,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= COLS; i++) {
      ctx.beginPath(); ctx.moveTo(OX + i * CELL, OY); ctx.lineTo(OX + i * CELL, OY + ROWS * CELL); ctx.stroke();
    }
    for (let j = 0; j <= ROWS; j++) {
      ctx.beginPath(); ctx.moveTo(OX, OY + j * CELL); ctx.lineTo(OX + COLS * CELL, OY + j * CELL); ctx.stroke();
    }
    // border
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#00FFFF';
    ctx.strokeRect(OX, OY, COLS * CELL, ROWS * CELL);
    ctx.shadowBlur = 0;

    // snake
    for (let i = snake.length - 1; i >= 0; i--) {
      const s = snake[i];
      const isHead = i === 0;
      const col = isHead ? '#00FFFF' : (i % 2 === 0 ? '#00E5FF' : '#00B3CC');
      cellRect(s.x, s.y, col, isHead ? 14 : 6);
      // head eyes
      if (isHead) {
        ctx.fillStyle = '#05070A';
        const ex = OX + s.x * CELL + CELL / 2 + dir.x * 4;
        const ey = OY + s.y * CELL + CELL / 2 + dir.y * 4;
        ctx.beginPath();
        ctx.arc(ex - 3, ey - 3, 2.4, 0, Math.PI * 2);
        ctx.arc(ex + 3, ey + 3, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // food (apple with glow)
    const fx = OX + food.x * CELL + CELL / 2;
    const fy = OY + food.y * CELL + CELL / 2;
    ctx.shadowBlur = 18; ctx.shadowColor = '#FF2D2D';
    ctx.fillStyle = '#FF2D2D';
    ctx.beginPath(); ctx.arc(fx, fy, CELL * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FFE600';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('♥', fx, fy + 3);

    // HUD
    ctx.shadowBlur = 12; ctx.shadowColor = '#00FFFF';
    ctx.fillStyle = '#00FFFF'; ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SNAKE', 14, 28);
    ctx.fillStyle = '#FFF';
    ctx.fillText('SCORE: ' + score, 14, 52);
    ctx.fillStyle = '#FFE600'; ctx.shadowColor = '#FFE600';
    ctx.fillText('🪙 ' + coins, W - 90, 28);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '12px monospace';
    ctx.fillText('NOKIA 1100 · NEON HD', W - 90, 52);

    // game over
    if (over) {
      ctx.fillStyle = 'rgba(5,7,10,0.88)';
      ctx.fillRect(0, 0, W, H);
      ctx.shadowBlur = 20; ctx.shadowColor = '#FF10F0';
      ctx.fillStyle = '#FF10F0'; ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 30);
      ctx.shadowColor = '#00FFFF'; ctx.fillStyle = '#00FFFF';
      ctx.font = '18px monospace';
      ctx.fillText('SCORE: ' + score, W / 2, H / 2 + 10);
      ctx.fillText('COINS: ' + coins, W / 2, H / 2 + 36);
      ctx.textAlign = 'left'; ctx.shadowBlur = 0;
    }
  }

  function loop(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    update(dt);
    render();
    raf = requestAnimationFrame(loop);
  }

  function gameOver() {
    over = true; running = false;
    if (raf) cancelAnimationFrame(raf);
    onGameOver(Math.floor(score), coins);
  }

  // ---- public API ----
  return {
    start() {
      reset();
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    update() {/* handled internally */},
    render() { render(); },
    pause() { running = false; if (raf) cancelAnimationFrame(raf); },
    resume() { if (over || running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); },
    destroy() { running = false; if (raf) cancelAnimationFrame(raf); },
    setInput(t, k) { touches = t || {}; keys = k || {}; },
    // keypad arrows/swipe — no buttons needed (arrows on keyboard)
    controls: { joystick: false, boost: false, action: false, drift: false },
    onKey, onSwipe
  };
}