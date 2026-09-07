/* ============================================================
   Neon Snake — Classic grid snake
   Canvas 800x450, 20x15 grid, arrow/swipe controls
   ============================================================ */
function neonSnake(canvas, ctx, onScore, onGameOver, onCoins) {
  // ---- state ----
  const W = 800, H = 450;
  let raf = null, last = 0, running = false;
  let score = 0, coins = 0;
  let over = false;

  // grid
  const COLS = 20, ROWS = 15;
  const CELL = Math.floor(W / COLS); // 40
  const OFFSET_X = Math.floor((W - CELL * COLS) / 2); // center
  const OFFSET_Y = Math.floor((H - CELL * ROWS) / 2); // center

  // snake
  let snake = [];
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let food = { x: 0, y: 0 };
  let moveTimer = 0;
  let baseSpeed = 0.14; // seconds per cell
  let speed = baseSpeed;
  let ate = false;

  // input
  let touches = { left: false, right: false, boost: false };
  let keys = {};

  // ---- helpers ----
  function reset() {
    score = 0; coins = 0; over = false;
    const startX = 4, startY = Math.floor(ROWS / 2);
    snake = [];
    for (let i = 3; i >= 0; i--) {
      snake.push({ x: startX - i, y: startY });
    }
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    speed = baseSpeed;
    moveTimer = 0;
    spawnFood();
  }

  function spawnFood() {
    let pos;
    do {
      pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (snake.some(s => s.x === pos.x && s.y === pos.y));
    food = pos;
  }

  function cellRect(cx, cy) {
    return { x: OFFSET_X + cx * CELL, y: OFFSET_Y + cy * CELL, w: CELL, h: CELL };
  }

  function rect(x, y, w, h, color, glow) {
    ctx.shadowBlur = glow || 12;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
  }

  function circle(x, y, r, color, glow) {
    ctx.shadowBlur = glow || 14;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function setDir(nx, ny) {
    // prevent 180-degree turn
    if (dir.x === -nx && dir.y === -ny) return;
    nextDir = { x: nx, y: ny };
  }

  // ---- update ----
  function update(dt) {
    if (over || !running) return;

    // input: keys / touches
    if (keys.ArrowUp || keys.KeyW) setDir(0, -1);
    if (keys.ArrowDown || keys.KeyS) setDir(0, 1);
    if (keys.ArrowLeft || keys.KeyA) setDir(-1, 0);
    if (keys.ArrowRight || keys.KeyD) setDir(1, 0);

    moveTimer += dt;
    if (moveTimer < speed) return;
    moveTimer -= speed;

    dir = { x: nextDir.x, y: nextDir.y };

    // new head
    const head = snake[snake.length - 1];
    const nx = head.x + dir.x;
    const ny = head.y + dir.y;

    // wall collision
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
      gameOver();
      return;
    }

    // self collision (skip tail if not growing, but we check after potential grow)
    for (let i = 0; i < snake.length; i++) {
      if (snake[i].x === nx && snake[i].y === ny) {
        gameOver();
        return;
      }
    }

    snake.push({ x: nx, y: ny });

    // food collision
    if (nx === food.x && ny === food.y) {
      score = snake.length;
      coins += 1;
      onScore(score);
      onCoins(1);
      // speed up
      speed = Math.max(0.05, speed - 0.003);
      spawnFood();
    } else {
      snake.shift();
    }
  }

  // ---- render ----
  function render() {
    // bg
    ctx.fillStyle = '#05070A';
    ctx.fillRect(0, 0, W, H);

    // grid border
    ctx.strokeStyle = 'rgba(57,255,136,0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(OFFSET_X - 2, OFFSET_Y - 2, CELL * COLS + 4, CELL * ROWS + 4);

    // faint grid lines
    ctx.strokeStyle = 'rgba(57,255,136,0.06)';
    ctx.lineWidth = 1;
    for (let c = 1; c < COLS; c++) {
      const x = OFFSET_X + c * CELL;
      ctx.beginPath(); ctx.moveTo(x, OFFSET_Y); ctx.lineTo(x, OFFSET_Y + ROWS * CELL); ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      const y = OFFSET_Y + r * CELL;
      ctx.beginPath(); ctx.moveTo(OFFSET_X, y); ctx.lineTo(OFFSET_X + COLS * CELL, y); ctx.stroke();
    }

    // food (glowing dot)
    const fPos = cellRect(food.x, food.y);
    const fcx = fPos.x + fPos.w / 2, fcy = fPos.y + fPos.h / 2;
    circle(fcx, fcy, CELL * 0.3, '#FFE600', 18);

    // snake body
    for (let i = 0; i < snake.length; i++) {
      const s = snake[i];
      const r = cellRect(s.x, s.y);
      const isHead = i === snake.length - 1;
      const color = isHead ? '#39FF88' : '#39FF88';
      const glow = isHead ? 20 : 10;
      const pad = 1;
      ctx.shadowBlur = glow;
      ctx.shadowColor = color;
      ctx.fillStyle = isHead ? '#39FF88' : 'rgba(57,255,136,0.85)';
      ctx.fillRect(r.x + pad, r.y + pad, r.w - pad * 2, r.h - pad * 2);
      ctx.shadowBlur = 0;
    }

    // eyes on head
    if (snake.length > 0) {
      const head = snake[snake.length - 1];
      const hr = cellRect(head.x, head.y);
      const cx = hr.x + hr.w / 2, cy = hr.y + hr.h / 2;
      const ex = dir.x * 6, ey = dir.y * 6;
      ctx.fillStyle = '#05070A';
      ctx.beginPath(); ctx.arc(cx - 5 + ex * 0.5, cy - 4 + ey * 0.5, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 5 + ex * 0.5, cy + 4 + ey * 0.5, 3, 0, Math.PI * 2); ctx.fill();
    }

    // score display
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#39FF88';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE: ' + score, OFFSET_X, OFFSET_Y - 10);
    ctx.textAlign = 'right';
    ctx.fillText('LENGTH: ' + snake.length, OFFSET_X + CELL * COLS, OFFSET_Y - 10);
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
    over = true;
    running = false;
    if (raf) cancelAnimationFrame(raf);
    if (navigator.vibrate) { try { navigator.vibrate(200); } catch (e) {} }
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
    controls: { joystick: false, boost: false, action: false, drift: false }
  };
}
