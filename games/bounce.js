/* ============================================================
   Bounce — Nokia Classic Ball & Paddle
   Canvas 800x450, red ball bouncing off paddle & bricks
   Swipe/drag or Arrow keys to move paddle
   Action button to serve ball. Coins drop 12% chance on brick.
   Levels add more brick rows. lives=3, score, coins.
   ============================================================ */
window.engines = window.engines || {};
window.engines.bounce = function(canvas, ctx, W, H, input, state) {
  'use strict';

  // ── Constants ──
  const BALL_RADIUS = 8;
  const BALL_BASE_SPEED = 340;
  const PADDLE_W = 100;
  const PADDLE_H = 14;
  const PADDLE_SPEED = 420;
  const PADDLE_Y_OFFSET = 40; // distance from bottom
  const BRICK_COLS = 10;
  const BRICK_H = 22;
  const BRICK_PAD = 4;
  const BRICK_OFFSET_Y = 50;
  const MAX_LIVES = 3;
  const STAR_COUNT = 60;
  const SERVE_DELAY = 0.6;

  // Row colors from top to bottom — Nokia neon palette
  const ROW_COLORS = [
    '#FF1744', // red
    '#FF9100', // orange
    '#FFEA00', // yellow
    '#00E676', // green
    '#00B0FF', // light blue
    '#7C4DFF', // purple
    '#FF4081', // pink
    '#18FFFF', // cyan
    '#EEFF41', // lime
    '#F50057', // hot pink
  ];
  const ROW_POINTS = [100, 80, 70, 60, 50, 40, 35, 30, 25, 20];

  // ── State ──
  let raf = null, lastTime = 0, running = false;
  let score, coins, lives, level, phase;
  let paddle, ball, bricks, particles, coinDrops, stars;
  let serveTimer, comboCount, comboTimer;
  let shakeTimer, shakeIntensity;
  let time; // total elapsed game time for animations

  // ── Helpers ──
  function rand(a, b) { return Math.random() * (b - a) + a; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function rect(x, y, w, h, color, glow) {
    ctx.shadowBlur = glow || 0;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
  }

  function circle(x, y, r, color, glow) {
    ctx.shadowBlur = glow || 0;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function text(str, x, y, color, size, align) {
    ctx.shadowBlur = 6;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.font = (size || 16) + 'px "Courier New", monospace';
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
    ctx.shadowBlur = 0;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  // ── Particles ──
  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const spd = rand(40, 220);
      particles.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: rand(0.2, 0.6),
        maxLife: 0.6,
        size: rand(1.5, 4),
        color
      });
    }
  }

  function spawnCoinDrop(x, y) {
    coinDrops.push({
      x, y, vy: 120,
      size: 10, life: 8, bobPhase: rand(0, Math.PI * 2)
    });
  }

  function spawnBrickParticles(x, y, w, h, color) {
    // Brick shatter effect
    for (let i = 0; i < 8; i++) {
      const px = x + rand(0, w);
      const py = y + rand(0, h);
      const angle = rand(0, Math.PI * 2);
      const spd = rand(60, 200);
      particles.push({
        x: px, y: py,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: rand(0.3, 0.7),
        maxLife: 0.7,
        size: rand(2, 5),
        color
      });
    }
  }

  // ── Level generation ──
  function createBricks(levelNum) {
    bricks = [];
    const rows = Math.min(3 + levelNum, ROW_COLORS.length);
    const totalW = W - 40;
    const brickW = (totalW - (BRICK_COLS - 1) * BRICK_PAD) / BRICK_COLS;
    const startX = (W - totalW) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        const x = startX + c * (brickW + BRICK_PAD);
        const y = BRICK_OFFSET_Y + r * (BRICK_H + BRICK_PAD);
        const colorIdx = r % ROW_COLORS.length;
        bricks.push({
          x, y, w: brickW, h: BRICK_H,
          color: ROW_COLORS[colorIdx],
          points: ROW_POINTS[colorIdx] || 20,
          hp: levelNum > 3 && r === 0 ? 2 : 1, // top row 2HP after level 3
          maxHp: levelNum > 3 && r === 0 ? 2 : 1,
          alive: true,
          hitFlash: 0
        });
      }
    }
  }

  function resetBall() {
    ball = {
      x: paddle.x + paddle.w / 2,
      y: paddle.y - BALL_RADIUS - 2,
      vx: 0, vy: 0,
      speed: BALL_BASE_SPEED + level * 12,
      radius: BALL_RADIUS,
      trail: [],
      active: false,
      stuck: true
    };
    serveTimer = 0;
  }

  function serveBall() {
    if (ball.active) return;
    const angle = -Math.PI / 2 + rand(-0.5, 0.5);
    ball.vx = Math.cos(angle) * ball.speed;
    ball.vy = Math.sin(angle) * ball.speed;
    ball.active = true;
    ball.stuck = false;
  }

  function initLevel(lvl) {
    level = lvl;
    paddle = {
      x: W / 2 - PADDLE_W / 2,
      y: H - PADDLE_Y_OFFSET,
      w: PADDLE_W,
      h: PADDLE_H,
      baseW: PADDLE_W,
      color: '#00FF88',
      glow: 0
    };
    createBricks(lvl);
    resetBall();
    particles = [];
    coinDrops = [];
    comboCount = 0;
    comboTimer = 0;
  }

  function resetGame() {
    score = 0;
    coins = 0;
    lives = MAX_LIVES;
    level = 1;
    phase = 'title';
    time = 0;
    shakeTimer = 0;
    shakeIntensity = 0;

    // Stars background
    stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      const layer = i < STAR_COUNT * 0.4 ? 0 : i < STAR_COUNT * 0.75 ? 1 : 2;
      stars.push({
        x: rand(0, W), y: rand(0, H),
        speed: [15, 30, 55][layer],
        size: [0.4, 0.8, 1.3][layer],
        alpha: [0.25, 0.45, 0.8][layer]
      });
    }

    initLevel(1);
  }

  // ── Collision helpers ──
  function ballHitsPaddle() {
    if (ball.vy < 0) return false; // only when moving down
    const bLeft = ball.x - ball.radius;
    const bRight = ball.x + ball.radius;
    const bBottom = ball.y + ball.radius;

    if (bBottom >= paddle.y &&
        bBottom <= paddle.y + paddle.h + 4 &&
        bRight >= paddle.x &&
        bLeft <= paddle.x + paddle.w) {
      // Calculate angle based on where ball hits paddle
      const hitPos = (ball.x - paddle.x) / paddle.w; // 0..1
      const angle = lerp(-2.4, -0.74, hitPos); // map to ~-137° to ~-42°
      ball.vy = Math.sin(angle) * ball.speed;
      ball.vx = Math.cos(angle) * ball.speed;
      ball.y = paddle.y - ball.radius - 1;
      paddle.glow = 1;
      spawnParticles(ball.x, ball.y, '#00FF88', 4);
      return true;
    }
    return false;
  }

  function ballHitsBrick(brick) {
    if (!brick.alive) return false;
    const bx = ball.x, by = ball.y, br = ball.radius;

    // Closest point on brick to ball center
    const cx = clamp(bx, brick.x, brick.x + brick.w);
    const cy = clamp(by, brick.y, brick.y + brick.h);
    const dx = bx - cx;
    const dy = by - cy;
    const distSq = dx * dx + dy * dy;

    if (distSq <= br * br) {
      // Determine bounce direction
      const overlapX = br - Math.abs(dx);
      const overlapY = br - Math.abs(dy);

      if (overlapX < overlapY) {
        ball.vx = -ball.vx;
        ball.x += dx > 0 ? overlapX : -overlapX;
      } else {
        ball.vy = -ball.vy;
        ball.y += dy > 0 ? overlapY : -overlapY;
      }

      brick.hp--;
      brick.hitFlash = 0.15;
      shakeTimer = 0.1;
      shakeIntensity = 2;

      if (brick.hp <= 0) {
        brick.alive = false;
        const pts = brick.points * (1 + Math.floor(comboCount / 5));
        score += pts;
        comboCount++;
        comboTimer = 2;
        spawnBrickParticles(brick.x, brick.y, brick.w, brick.h, brick.color);

        // Coin drop chance
        if (Math.random() < 0.12) {
          spawnCoinDrop(brick.x + brick.w / 2, brick.y + brick.h / 2);
        }
      } else {
        spawnParticles(cx, cy, brick.color, 3);
      }

      // Speed up slightly
      ball.speed = Math.min(ball.speed + 2, 550);

      return true;
    }
    return false;
  }

  function checkLevelComplete() {
    return bricks.every(b => !b.alive);
  }

  // ── Update ──
  function update(dt) {
    time += dt;

    // Clamp dt to prevent physics explosion
    dt = Math.min(dt, 1 / 30);

    // ── Stars ──
    for (const s of stars) {
      s.x -= s.speed * dt;
      if (s.x < -2) { s.x = W + 2; s.y = rand(0, H); }
    }

    // ── Title ──
    if (phase === 'title') {
      if (input.pressed('enter') || input.pressed(' ') || input.pressed('tap')) {
        phase = 'play';
        resetBall();
        ball.stuck = true;
        ball.active = false;
      }
      updateParticles(dt);
      return;
    }

    // ── Game Over ──
    if (phase === 'gameOver') {
      updateParticles(dt);
      if (input.pressed('enter') || input.pressed(' ') || input.pressed('tap')) {
        resetGame();
        phase = 'play';
        resetBall();
        ball.stuck = true;
      }
      return;
    }

    // ── Level Complete ──
    if (phase === 'levelComplete') {
      updateParticles(dt);
      if (input.pressed('enter') || input.pressed(' ') || input.pressed('tap')) {
        initLevel(level + 1);
        phase = 'play';
        resetBall();
        ball.stuck = true;
      }
      return;
    }

    // ── Dead (lost a life) ──
    if (phase === 'dead') {
      updateParticles(dt);
      serveTimer -= dt;
      if (serveTimer <= 0) {
        if (lives <= 0) {
          phase = 'gameOver';
          // Notify framework
          if (typeof window.endGame === 'function') {
            window.endGame(score, coins);
          }
        } else {
          resetBall();
          ball.stuck = true;
          phase = 'play';
        }
      }
      return;
    }

    // ── PLAYING ──
    if (phase !== 'play') return;

    // ── Combo timer ──
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) comboCount = 0;
    }

    // ── Paddle movement ──
    let paddleTarget = null;

    // Touch/drag: move paddle to touch x
    if (input.touches && input.touches.left) {
      paddleTarget = input.touches.left;
    }
    if (input.touches && input.touches.right) {
      paddleTarget = input.touches.right;
    }

    // Also support raw x from input
    if (input.x !== undefined && input.x !== null) {
      paddleTarget = input.x;
    }

    // Keyboard
    let kLeft = false, kRight = false;
    if (input.keys) {
      kLeft = input.keys['ArrowLeft'] || input.keys['a'] || input.keys['A'];
      kRight = input.keys['ArrowRight'] || input.keys['d'] || input.keys['D'];
    }
    // Also support touch zone buttons
    if (input.touches) {
      if (input.touches.left) kLeft = true;
      if (input.touches.right) kRight = true;
    }

    if (paddleTarget !== null && paddleTarget !== undefined) {
      // Move paddle toward touch/mouse position
      const targetX = clamp(paddleTarget - paddle.w / 2, 0, W - paddle.w);
      const diff = targetX - paddle.x;
      const move = Math.sign(diff) * Math.min(Math.abs(diff), PADDLE_SPEED * dt * 2.5);
      paddle.x += move;
    } else if (kLeft || kRight) {
      if (kLeft) paddle.x -= PADDLE_SPEED * dt;
      if (kRight) paddle.x += PADDLE_SPEED * dt;
    }

    paddle.x = clamp(paddle.x, 0, W - paddle.w);
    paddle.glow = Math.max(0, paddle.glow - dt * 4);

    // ── Ball stuck to paddle ──
    if (ball.stuck) {
      ball.x = paddle.x + paddle.w / 2;
      ball.y = paddle.y - ball.radius - 2;

      // Serve on action
      if (input.pressed('action') || input.pressed('enter') || input.pressed(' ') || input.pressed('tap')) {
        serveBall();
      }
      updateParticles(dt);
      updateCoinDrops(dt);
      return;
    }

    // ── Ball trail ──
    ball.trail.push({ x: ball.x, y: ball.y, alpha: 1 });
    if (ball.trail.length > 8) ball.trail.shift();
    for (const t of ball.trail) t.alpha *= 0.85;

    // ── Ball movement ──
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Wall bouncing
    if (ball.x - ball.radius < 0) {
      ball.x = ball.radius;
      ball.vx = Math.abs(ball.vx);
      spawnParticles(ball.x, ball.y, '#FFFFFF', 3);
    }
    if (ball.x + ball.radius > W) {
      ball.x = W - ball.radius;
      ball.vx = -Math.abs(ball.vx);
      spawnParticles(ball.x, ball.y, '#FFFFFF', 3);
    }
    if (ball.y - ball.radius < 0) {
      ball.y = ball.radius;
      ball.vy = Math.abs(ball.vy);
      spawnParticles(ball.x, ball.y, '#FFFFFF', 3);
    }

    // ── Ball fell off bottom ──
    if (ball.y - ball.radius > H + 20) {
      lives--;
      phase = 'dead';
      serveTimer = SERVE_DELAY;
      shakeTimer = 0.3;
      shakeIntensity = 6;
      spawnParticles(ball.x, H, '#FF3B3B', 15);
      return;
    }

    // ── Paddle collision ──
    ballHitsPaddle();

    // ── Brick collisions ──
    for (const brick of bricks) {
      if (ballHitsBrick(brick)) {
        if (checkLevelComplete()) {
          phase = 'levelComplete';
          score += level * 500; // level clear bonus
          // Celebration particles
          for (let i = 0; i < 40; i++) {
            const colors = ['#FF3B3B', '#00FF88', '#FFFF00', '#00B0FF', '#FF4081'];
            spawnParticles(W / 2, H / 2, colors[Math.floor(rand(0, 5))], 1);
          }
        }
        break; // one brick per frame max
      }
    }

    // ── Particles ──
    updateParticles(dt);

    // ── Coin drops ──
    updateCoinDrops(dt);

    // ── Brick hit flash decay ──
    for (const b of bricks) {
      if (b.hitFlash > 0) b.hitFlash -= dt;
    }

    // ── Screen shake ──
    if (shakeTimer > 0) shakeTimer -= dt;

    // ── Speed normalization (prevent getting too slow) ──
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (speed > 0 && speed < ball.speed * 0.7) {
      const scale = (ball.speed * 0.8) / speed;
      ball.vx *= scale;
      ball.vy *= scale;
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function updateCoinDrops(dt) {
    for (let i = coinDrops.length - 1; i >= 0; i--) {
      const c = coinDrops[i];
      c.y += c.vy * dt;
      c.bobPhase += dt * 5;
      c.life -= dt;
      // Collect if touching paddle
      if (c.y + c.size >= paddle.y && c.y - c.size <= paddle.y + paddle.h &&
          c.x + c.size >= paddle.x && c.x - c.size <= paddle.x + paddle.w) {
        coins += 5;
        score += 25;
        spawnParticles(c.x, c.y, '#FFD700', 8);
        coinDrops.splice(i, 1);
        continue;
      }
      if (c.life <= 0 || c.y > H + 20) {
        coinDrops.splice(i, 1);
      }
    }
  }

  // ── Draw ──
  function draw() {
    // Clear
    ctx.fillStyle = '#06060E';
    ctx.fillRect(0, 0, W, H);

    // Apply screen shake
    ctx.save();
    if (shakeTimer > 0) {
      const sx = (Math.random() - 0.5) * shakeIntensity * 2;
      const sy = (Math.random() - 0.5) * shakeIntensity * 2;
      ctx.translate(sx, sy);
    }

    // ── Stars ──
    for (const s of stars) {
      ctx.globalAlpha = s.alpha * (0.6 + 0.4 * Math.sin(time * 2 + s.x * 0.01));
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;

    // ── Border glow ──
    const borderGrad = ctx.createLinearGradient(0, 0, 0, H);
    borderGrad.addColorStop(0, 'rgba(255,255,255,0.06)');
    borderGrad.addColorStop(1, 'rgba(0,255,136,0.04)');
    ctx.fillStyle = borderGrad;
    ctx.fillRect(0, 0, W, 3);
    ctx.fillRect(0, H - 3, W, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, 0, 3, H);
    ctx.fillRect(W - 3, 0, 3, H);

    if (phase === 'title') {
      drawTitle();
    } else if (phase === 'gameOver') {
      drawGame();
      drawGameOver();
    } else if (phase === 'levelComplete') {
      drawGame();
      drawLevelComplete();
    } else {
      drawGame();
    }

    ctx.restore();

    // ── HUD (always) ──
    drawHUD();

    return { score, coins, best: (state && state.best && state.best.bounce) || 0 };
  }

  function drawTitle() {
    // Animated title
    const pulse = 0.7 + 0.3 * Math.sin(time * 3);

    // Title ball bouncing animation
    const titleBallY = H / 2 - 40 + Math.sin(time * 4) * 15;
    circle(W / 2, titleBallY, 12, '#FF3B3B', 20);

    // "BOUNCE" text
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#FF3B3B';
    ctx.font = 'bold 56px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FF3B3B';
    ctx.fillText('BOUNCE', W / 2, H / 2 - 90);

    // Subtitle
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00FF88';
    ctx.font = '14px "Courier New", monospace';
    ctx.fillStyle = '#00FF88';
    ctx.fillText('NOKIA CLASSIC', W / 2, H / 2 - 55);

    ctx.shadowBlur = 0;

    // Brick preview
    const previewW = 300;
    const previewCols = 6;
    const previewBrickW = (previewW - (previewCols - 1) * 4) / previewCols;
    const previewStartX = (W - previewW) / 2;
    const previewRows = 4;
    for (let r = 0; r < previewRows; r++) {
      for (let c = 0; c < previewCols; c++) {
        const bx = previewStartX + c * (previewBrickW + 4);
        const by = H / 2 - 30 + r * 26;
        const alpha = 0.4 + 0.6 * Math.sin(time * 2 + r * 0.5 + c * 0.3);
        ctx.globalAlpha = alpha;
        rect(bx, by, previewBrickW, 20, ROW_COLORS[r % ROW_COLORS.length], 4);
      }
    }
    ctx.globalAlpha = 1;

    // Paddle preview
    rect(W / 2 - 50, H / 2 + 80, 100, 12, '#00FF88', 10);

    // Instructions
    const blink = Math.sin(time * 4) > 0;
    if (blink) {
      text('TAP TO START', W / 2, H / 2 + 120, '#FFFFFF', 18);
    }

    text('← → MOVE PADDLE', W / 2, H / 2 + 150, '#666666', 12);
    text('ACTION TO SERVE', W / 2, H / 2 + 168, '#666666', 12);
  }

  function drawGame() {
    // ── Bricks ──
    for (const b of bricks) {
      if (!b.alive) continue;

      // Brick body
      const glowAmt = b.hitFlash > 0 ? 20 : 6;
      const alpha = b.maxHp > 1 ? (b.hp / b.maxHp * 0.5 + 0.5) : 1;
      ctx.globalAlpha = alpha;
      rect(b.x, b.y, b.w, b.h, b.color, glowAmt);

      // Shine highlight
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, b.h / 3);

      // HP indicator for multi-hit bricks
      if (b.maxHp > 1 && b.hp > 1) {
        text(b.hp.toString(), b.x + b.w / 2, b.y + b.h / 2, '#FFFFFF', 11);
      }
      ctx.globalAlpha = 1;
    }

    // ── Coin drops ──
    for (const c of coinDrops) {
      const bob = Math.sin(c.bobPhase) * 3;
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#FFD700';
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(c.x, c.y + bob, c.size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      text('$', c.x, c.y + bob, '#8B6914', 10);
    }

    // ── Ball trail ──
    for (const t of ball.trail) {
      if (t.alpha < 0.1) continue;
      ctx.globalAlpha = t.alpha * 0.4;
      circle(t.x, t.y, ball.radius * 0.7, '#FF3B3B');
    }
    ctx.globalAlpha = 1;

    // ── Ball ──
    if (ball.stuck || ball.active) {
      // Outer glow
      circle(ball.x, ball.y, ball.radius + 3, 'rgba(255,59,59,0.2)');
      // Main ball
      circle(ball.x, ball.y, ball.radius, '#FF3B3B', 18);
      // Inner shine
      circle(ball.x - 2, ball.y - 2, ball.radius * 0.35, 'rgba(255,255,255,0.5)');
    }

    // ── Paddle ──
    const glowAmt = 8 + paddle.glow * 20;
    // Glow
    ctx.shadowBlur = glowAmt;
    ctx.shadowColor = paddle.color;
    ctx.fillStyle = paddle.color;
    // Rounded paddle
    const pr = paddle.h / 2;
    ctx.beginPath();
    ctx.moveTo(paddle.x + pr, paddle.y);
    ctx.lineTo(paddle.x + paddle.w - pr, paddle.y);
    ctx.arc(paddle.x + paddle.w - pr, paddle.y + pr, pr, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(paddle.x + pr, paddle.y + paddle.h);
    ctx.arc(paddle.x + pr, paddle.y + pr, pr, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Paddle shine
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(paddle.x + 4, paddle.y + 1, paddle.w - 8, 3);

    // ── Particles ──
    for (const p of particles) {
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 4;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // ── Combo indicator ──
    if (comboCount >= 5 && comboTimer > 0) {
      const alpha = clamp(comboTimer, 0, 1);
      ctx.globalAlpha = alpha;
      const comboText = comboCount + 'x COMBO!';
      const comboSize = 20 + Math.min(comboCount, 20) * 0.5;
      text(comboText, W / 2, H / 2 + 40, '#FFEA00', comboSize);
      ctx.globalAlpha = 1;
    }

    // ── Serve prompt ──
    if (ball.stuck && phase === 'play') {
      const blink = Math.sin(time * 5) > 0;
      if (blink) {
        text('TAP TO SERVE', W / 2, paddle.y - 40, 'rgba(255,255,255,0.7)', 14);
      }
    }

    // ── Level indicator ──
    text('LEVEL ' + level, W - 60, H - 20, 'rgba(255,255,255,0.3)', 11, 'right');
  }

  function drawHUD() {
    // Score
    text('SCORE', 80, 18, '#888', 10);
    text(score.toString(), 80, 34, '#FFFFFF', 18);

    // Coins
    text('COINS', W / 2, 18, '#888', 10);
    text(coins.toString(), W / 2, 34, '#FFD700', 18);

    // Lives
    text('LIVES', W - 80, 18, '#888', 10);
    for (let i = 0; i < MAX_LIVES; i++) {
      const lx = W - 95 + i * 22;
      const ly = 34;
      if (i < lives) {
        circle(lx, ly, 6, '#FF3B3B', 8);
        circle(lx - 1, ly - 1, 2, 'rgba(255,255,255,0.4)');
      } else {
        ctx.globalAlpha = 0.25;
        circle(lx, ly, 6, '#FF3B3B');
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawGameOver() {
    // Darken
    ctx.fillStyle = 'rgba(6,6,14,0.75)';
    ctx.fillRect(0, 0, W, H);

    // Game Over box
    const boxW = 320, boxH = 200;
    const bx = (W - boxW) / 2, by = (H - boxH) / 2;
    ctx.fillStyle = 'rgba(20,20,40,0.95)';
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = '#FF3B3B';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, boxW, boxH);

    text('GAME OVER', W / 2, by + 40, '#FF3B3B', 30);
    text('SCORE: ' + score, W / 2, by + 80, '#FFFFFF', 20);
    text('COINS: ' + coins, W / 2, by + 105, '#FFD700', 16);
    text('LEVEL: ' + level, W / 2, by + 130, '#00FF88', 14);

    const blink = Math.sin(time * 4) > 0;
    if (blink) {
      text('TAP TO RETRY', W / 2, by + 170, '#888888', 14);
    }
  }

  function drawLevelComplete() {
    // Darken
    ctx.fillStyle = 'rgba(6,6,14,0.7)';
    ctx.fillRect(0, 0, W, H);

    const pulse = 0.7 + 0.3 * Math.sin(time * 3);

    // Celebration text
    ctx.globalAlpha = pulse;
    text('LEVEL ' + level + ' CLEAR!', W / 2, H / 2 - 40, '#00FF88', 32);
    ctx.globalAlpha = 1;

    text('BONUS: ' + (level * 500), W / 2, H / 2 + 10, '#FFD700', 20);
    text('SCORE: ' + score, W / 2, H / 2 + 40, '#FFFFFF', 18);

    const blink = Math.sin(time * 4) > 0;
    if (blink) {
      text('TAP FOR NEXT LEVEL', W / 2, H / 2 + 80, '#888888', 14);
    }
  }

  // ── Animation loop ──
  function animate(ts) {
    if (!running) return;
    const dt = Math.min((ts - lastTime) / 1000, 0.1);
    lastTime = ts;
    update(dt);
    draw();
    raf = requestAnimationFrame(animate);
  }

  function start() {
    resetGame();
    running = true;
    lastTime = performance.now();
    raf = requestAnimationFrame(animate);
  }

  function pause() {
    running = false;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  function resume() {
    if (!running) {
      running = true;
      lastTime = performance.now();
      raf = requestAnimationFrame(animate);
    }
  }

  // ── Public API ──
  return { start, update, draw, pause, resume };
};
