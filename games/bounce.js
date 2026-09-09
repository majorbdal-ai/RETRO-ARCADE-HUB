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
  const PADDLE_Y_OFFSET = 40;
  const BRICK_COLS = 10;
  const BRICK_H = 22;
  const BRICK_PAD = 4;
  const BRICK_OFFSET_Y = 50;
  const MAX_LIVES = 3;
  const STAR_COUNT = 60;
  const SERVE_DELAY = 0.6;

  // Row colors from top to bottom — Nokia neon palette
  const ROW_COLORS = [
    '#FF1744', '#FF9100', '#FFEA00', '#00E676', '#00B0FF',
    '#7C4DFF', '#FF4081', '#18FFFF', '#EEFF41', '#F50057'
  ];
  const ROW_POINTS = [100, 80, 70, 60, 50, 40, 35, 30, 25, 20];

  // ── State ──
  let raf = null, lastTime = 0, running = false;
  let score, coins, lives, level, phase;
  let paddle, ball, bricks, particles, coinDrops, stars;
  let serveTimer, comboCount, comboTimer;
  let shakeTimer, shakeIntensity;
  let time;
  let prevAction = false; // for edge detection

  // ── Helpers ──
  function rand(a, b) { return Math.random() * (b - a) + a; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // Input helpers — read from input.touches / input.keys
  function isActionDown() {
    if (input.touches && input.touches.action) return true;
    if (input.keys && (input.keys['Enter'] || input.keys[' '])) return true;
    return false;
  }

  function actionPressed() {
    const down = isActionDown();
    const pressed = down && !prevAction;
    prevAction = down;
    return pressed;
  }

  function isLeftDown() {
    if (input.touches && input.touches.left) return true;
    if (input.keys && (input.keys['ArrowLeft'] || input.keys['a'] || input.keys['A'])) return true;
    return false;
  }

  function isRightDown() {
    if (input.touches && input.touches.right) return true;
    if (input.keys && (input.keys['ArrowRight'] || input.keys['d'] || input.keys['D'])) return true;
    return false;
  }

  function isTapDown() {
    // Touch x coordinate on canvas (for paddle follow)
    return (input.x !== undefined && input.x !== null) ? input.x : null;
  }

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

  function txt(str, x, y, color, size, align) {
    ctx.shadowBlur = 6;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.font = 'bold ' + (size || 16) + 'px "Courier New", monospace';
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
        const hp = (levelNum > 3 && r === 0) ? 2 : 1;
        bricks.push({
          x, y, w: brickW, h: BRICK_H,
          color: ROW_COLORS[colorIdx],
          points: ROW_POINTS[colorIdx] || 20,
          hp, maxHp: hp,
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
    prevAction = false;

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
    if (ball.vy < 0) return false;
    const bLeft = ball.x - ball.radius;
    const bRight = ball.x + ball.radius;
    const bBottom = ball.y + ball.radius;

    if (bBottom >= paddle.y &&
        bBottom <= paddle.y + paddle.h + 4 &&
        bRight >= paddle.x &&
        bLeft <= paddle.x + paddle.w) {
      const hitPos = (ball.x - paddle.x) / paddle.w;
      const angle = lerp(-2.4, -0.74, hitPos);
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

    const cx = clamp(bx, brick.x, brick.x + brick.w);
    const cy = clamp(by, brick.y, brick.y + brick.h);
    const dx = bx - cx;
    const dy = by - cy;
    const distSq = dx * dx + dy * dy;

    if (distSq <= br * br) {
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
        if (Math.random() < 0.12) {
          spawnCoinDrop(brick.x + brick.w / 2, brick.y + brick.h / 2);
        }
      } else {
        spawnParticles(cx, cy, brick.color, 3);
      }

      ball.speed = Math.min(ball.speed + 2, 550);
      return true;
    }
    return false;
  }

  function checkLevelComplete() {
    return bricks.every(function(b) { return !b.alive; });
  }

  // ── Update ──
  function update(dt) {
    time += dt;
    dt = Math.min(dt, 1 / 30);

    // Stars
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      s.x -= s.speed * dt;
      if (s.x < -2) { s.x = W + 2; s.y = rand(0, H); }
    }

    // ── Title ──
    if (phase === 'title') {
      if (actionPressed()) {
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
      if (actionPressed()) {
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
      if (actionPressed()) {
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

    // Combo timer
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) comboCount = 0;
    }

    // ── Paddle movement ──
    var touchX = isTapDown();
    if (touchX !== null) {
      // Move paddle toward touch/mouse x
      var targetX = clamp(touchX - paddle.w / 2, 0, W - paddle.w);
      var diff = targetX - paddle.x;
      var move = Math.sign(diff) * Math.min(Math.abs(diff), PADDLE_SPEED * dt * 2.5);
      paddle.x += move;
    } else if (isLeftDown()) {
      paddle.x -= PADDLE_SPEED * dt;
    } else if (isRightDown()) {
      paddle.x += PADDLE_SPEED * dt;
    }

    paddle.x = clamp(paddle.x, 0, W - paddle.w);
    paddle.glow = Math.max(0, paddle.glow - dt * 4);

    // ── Ball stuck to paddle ──
    if (ball.stuck) {
      ball.x = paddle.x + paddle.w / 2;
      ball.y = paddle.y - ball.radius - 2;
      if (actionPressed()) {
        serveBall();
      }
      updateParticles(dt);
      updateCoinDrops(dt);
      return;
    }

    // ── Ball trail ──
    ball.trail.push({ x: ball.x, y: ball.y, alpha: 1 });
    if (ball.trail.length > 8) ball.trail.shift();
    for (let i = 0; i < ball.trail.length; i++) ball.trail[i].alpha *= 0.85;

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
    for (let i = 0; i < bricks.length; i++) {
      if (ballHitsBrick(bricks[i])) {
        if (checkLevelComplete()) {
          phase = 'levelComplete';
          score += level * 500;
          var colors = ['#FF3B3B', '#00FF88', '#FFFF00', '#00B0FF', '#FF4081'];
          for (let j = 0; j < 40; j++) {
            spawnParticles(W / 2, H / 2, colors[Math.floor(rand(0, 5))], 1);
          }
        }
        break;
      }
    }

    // Particles
    updateParticles(dt);
    // Coin drops
    updateCoinDrops(dt);

    // Brick hit flash decay
    for (let i = 0; i < bricks.length; i++) {
      if (bricks[i].hitFlash > 0) bricks[i].hitFlash -= dt;
    }

    // Screen shake
    if (shakeTimer > 0) shakeTimer -= dt;

    // Speed normalization
    var speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (speed > 0 && speed < ball.speed * 0.7) {
      var scale = (ball.speed * 0.8) / speed;
      ball.vx *= scale;
      ball.vy *= scale;
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
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
      var c = coinDrops[i];
      c.y += c.vy * dt;
      c.bobPhase += dt * 5;
      c.life -= dt;
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
      var sx = (Math.random() - 0.5) * shakeIntensity * 2;
      var sy = (Math.random() - 0.5) * shakeIntensity * 2;
      ctx.translate(sx, sy);
    }

    // ── Stars ──
    for (let i = 0; i < stars.length; i++) {
      var s = stars[i];
      ctx.globalAlpha = s.alpha * (0.6 + 0.4 * Math.sin(time * 2 + s.x * 0.01));
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;

    // ── Border glow ──
    var borderGrad = ctx.createLinearGradient(0, 0, 0, H);
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

    return { score: score, coins: coins, best: (state && state.best && state.best.bounce) || 0 };
  }

  function drawTitle() {
    var pulse = 0.7 + 0.3 * Math.sin(time * 3);

    // Title ball bouncing animation
    var titleBallY = H / 2 - 40 + Math.sin(time * 4) * 15;
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
    var previewW = 300;
    var previewCols = 6;
    var previewBrickW = (previewW - (previewCols - 1) * 4) / previewCols;
    var previewStartX = (W - previewW) / 2;
    var previewRows = 4;
    for (let r = 0; r < previewRows; r++) {
      for (let c = 0; c < previewCols; c++) {
        var bx = previewStartX + c * (previewBrickW + 4);
        var by = H / 2 - 30 + r * 26;
        var alpha = 0.4 + 0.6 * Math.sin(time * 2 + r * 0.5 + c * 0.3);
        ctx.globalAlpha = alpha;
        rect(bx, by, previewBrickW, 20, ROW_COLORS[r % ROW_COLORS.length], 4);
      }
    }
    ctx.globalAlpha = 1;

    // Paddle preview
    rect(W / 2 - 50, H / 2 + 80, 100, 12, '#00FF88', 10);

    // Instructions
    if (Math.sin(time * 4) > 0) {
      txt('TAP TO START', W / 2, H / 2 + 120, '#FFFFFF', 18);
    }
    txt('← → MOVE PADDLE', W / 2, H / 2 + 150, '#666666', 12);
    txt('ACTION TO SERVE', W / 2, H / 2 + 168, '#666666', 12);
  }

  function drawGame() {
    // ── Bricks ──
    for (let i = 0; i < bricks.length; i++) {
      var b = bricks[i];
      if (!b.alive) continue;

      var glowAmt = b.hitFlash > 0 ? 20 : 6;
      var brickAlpha = b.maxHp > 1 ? (b.hp / b.maxHp * 0.5 + 0.5) : 1;
      ctx.globalAlpha = brickAlpha;
      rect(b.x, b.y, b.w, b.h, b.color, glowAmt);

      // Shine highlight
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, b.h / 3);

      // HP indicator for multi-hit bricks
      if (b.maxHp > 1 && b.hp > 1) {
        txt(String(b.hp), b.x + b.w / 2, b.y + b.h / 2, '#FFFFFF', 11);
      }
      ctx.globalAlpha = 1;
    }

    // ── Coin drops ──
    for (let i = 0; i < coinDrops.length; i++) {
      var c = coinDrops[i];
      var bob = Math.sin(c.bobPhase) * 3;
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#FFD700';
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(c.x, c.y + bob, c.size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      txt('$', c.x, c.y + bob, '#8B6914', 10);
    }

    // ── Ball trail ──
    for (let i = 0; i < ball.trail.length; i++) {
      var t = ball.trail[i];
      if (t.alpha < 0.1) continue;
      ctx.globalAlpha = t.alpha * 0.4;
      circle(t.x, t.y, ball.radius * 0.7, '#FF3B3B');
    }
    ctx.globalAlpha = 1;

    // ── Ball ──
    if (ball.stuck || ball.active) {
      circle(ball.x, ball.y, ball.radius + 3, 'rgba(255,59,59,0.2)');
      circle(ball.x, ball.y, ball.radius, '#FF3B3B', 18);
      circle(ball.x - 2, ball.y - 2, ball.radius * 0.35, 'rgba(255,255,255,0.5)');
    }

    // ── Paddle ──
    var paddleGlow = 8 + paddle.glow * 20;
    ctx.shadowBlur = paddleGlow;
    ctx.shadowColor = paddle.color;
    ctx.fillStyle = paddle.color;
    // Rounded paddle
    var pr = paddle.h / 2;
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
    for (let i = 0; i < particles.length; i++) {
      var p = particles[i];
      var pAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = pAlpha;
      ctx.shadowBlur = 4;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * pAlpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // ── Combo indicator ──
    if (comboCount >= 5 && comboTimer > 0) {
      var comboAlpha = clamp(comboTimer, 0, 1);
      ctx.globalAlpha = comboAlpha;
      var comboSize = 20 + Math.min(comboCount, 20) * 0.5;
      txt(comboCount + 'x COMBO!', W / 2, H / 2 + 40, '#FFEA00', comboSize);
      ctx.globalAlpha = 1;
    }

    // ── Serve prompt ──
    if (ball.stuck && phase === 'play') {
      if (Math.sin(time * 5) > 0) {
        txt('TAP TO SERVE', W / 2, paddle.y - 40, 'rgba(255,255,255,0.7)', 14);
      }
    }

    // ── Level indicator ──
    txt('LEVEL ' + level, W - 60, H - 20, 'rgba(255,255,255,0.3)', 11, 'right');
  }

  function drawHUD() {
    // Score
    txt('SCORE', 80, 18, '#888', 10);
    txt(String(score), 80, 34, '#FFFFFF', 18);

    // Coins
    txt('COINS', W / 2, 18, '#888', 10);
    txt(String(coins), W / 2, 34, '#FFD700', 18);

    // Lives
    txt('LIVES', W - 80, 18, '#888', 10);
    for (let i = 0; i < MAX_LIVES; i++) {
      var lx = W - 95 + i * 22;
      var ly = 34;
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
    ctx.fillStyle = 'rgba(6,6,14,0.75)';
    ctx.fillRect(0, 0, W, H);

    var boxW = 320, boxH = 200;
    var bx = (W - boxW) / 2, by = (H - boxH) / 2;
    ctx.fillStyle = 'rgba(20,20,40,0.95)';
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = '#FF3B3B';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, boxW, boxH);

    txt('GAME OVER', W / 2, by + 40, '#FF3B3B', 30);
    txt('SCORE: ' + score, W / 2, by + 80, '#FFFFFF', 20);
    txt('COINS: ' + coins, W / 2, by + 105, '#FFD700', 16);
    txt('LEVEL: ' + level, W / 2, by + 130, '#00FF88', 14);

    if (Math.sin(time * 4) > 0) {
      txt('TAP TO RETRY', W / 2, by + 170, '#888888', 14);
    }
  }

  function drawLevelComplete() {
    ctx.fillStyle = 'rgba(6,6,14,0.7)';
    ctx.fillRect(0, 0, W, H);

    var pulse = 0.7 + 0.3 * Math.sin(time * 3);
    ctx.globalAlpha = pulse;
    txt('LEVEL ' + level + ' CLEAR!', W / 2, H / 2 - 40, '#00FF88', 32);
    ctx.globalAlpha = 1;
    txt('BONUS: ' + (level * 500), W / 2, H / 2 + 10, '#FFD700', 20);
    txt('SCORE: ' + score, W / 2, H / 2 + 40, '#FFFFFF', 18);

    if (Math.sin(time * 4) > 0) {
      txt('TAP FOR NEXT LEVEL', W / 2, H / 2 + 80, '#888888', 14);
    }
  }

  // ── Animation loop ──
  function animate(ts) {
    if (!running) return;
    var dt = Math.min((ts - lastTime) / 1000, 0.1);
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
  return { start: start, update: update, draw: draw, pause: pause, resume: resume };
};

// core.js compatibility: expose as window.bounce
if (window.engines && window.engines.bounce) window.bounce = window.engines.bounce;
