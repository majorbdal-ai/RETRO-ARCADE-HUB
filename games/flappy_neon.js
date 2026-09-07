/* ============================================================
   Flappy Neon — Neon Flappy Bird Arcade Game
   Canvas 800x450, tap/action to flap, pipes from right
   Gravity, neon trail, coin drops between pipes
   ============================================================ */
function flappyNeon(canvas, ctx, onScore, onGameOver, onCoins) {
  // ---- state ----
  const W = 800, H = 450;
  let raf = null, last = 0, running = false;
  let score = 0, coins = 0;
  let over = false;

  // bird
  const BIRD = { x: 160, y: H / 2, w: 32, h: 24, vy: 0 };
  const GRAVITY = 600;
  const FLAP_FORCE = -260;
  const MAX_VY = 500;

  // pipes
  let pipes = [];
  let pipeTimer = 0;
  let pipeInterval = 1.8; // seconds between pipes
  let pipeGap = 130; // vertical gap
  const PIPE_W = 56;
  const PIPE_SPEED = 160;

  // coins between pipes
  let coinDrops = [];

  // ground
  let groundY = H - 40;
  let groundOffset = 0;

  // trail (neon glow behind bird)
  let trail = [];

  // difficulty
  let pipesPassed = 0;
  let speedMul = 1;
  let startDelay = 1.0; // delay before pipes start

  // input
  let touches = { left: false, right: false, boost: false, action: false, drift: false };
  let keys = {};

  // ---- helpers ----
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

  function reset() {
    score = 0; coins = 0; over = false;
    BIRD.y = H / 2;
    BIRD.vy = 0;
    pipes = [];
    coinDrops = [];
    pipeTimer = 0;
    pipeInterval = 1.8;
    pipeGap = 130;
    trail = [];
    pipesPassed = 0;
    speedMul = 1;
    startDelay = 1.0;
    groundOffset = 0;
  }

  function flap() {
    if (over || !running) return;
    BIRD.vy = FLAP_FORCE;
  }

  function spawnPipe() {
    const minTop = 60;
    const maxTop = groundY - pipeGap - 60;
    const topH = minTop + Math.random() * (maxTop - minTop);
    pipes.push({
      x: W + 10,
      topH: topH,
      bottomY: topH + pipeGap,
      passed: false
    });
    // coin between pipe
    if (Math.random() < 0.5) {
      coinDrops.push({
        x: W + 10 + PIPE_W / 2,
        y: topH + pipeGap / 2,
        r: 10,
        taken: false
      });
    }
  }

  // ---- update ----
  function update(dt) {
    if (over || !running) return;

    // start delay
    if (startDelay > 0) {
      startDelay -= dt;
      // still apply gravity during delay
      BIRD.vy += GRAVITY * dt;
      BIRD.vy = Math.min(BIRD.vy, MAX_VY);
      BIRD.y += BIRD.vy * dt;
      // clamp to top
      if (BIRD.y < 0) { BIRD.y = 0; BIRD.vy = 0; }
      return;
    }

    // flap input
    if (touches.action || keys.Space || keys.ArrowUp) {
      flap();
      touches.action = false;
      keys.Space = false;
      keys.ArrowUp = false;
    }

    // gravity
    BIRD.vy += GRAVITY * dt;
    BIRD.vy = Math.min(BIRD.vy, MAX_VY);
    BIRD.y += BIRD.vy * dt;

    // trail
    trail.push({ x: BIRD.x + BIRD.w / 2, y: BIRD.y + BIRD.h / 2, life: 0.4, maxLife: 0.4 });
    for (let i = trail.length - 1; i >= 0; i--) {
      trail[i].life -= dt;
      if (trail[i].life <= 0) trail.splice(i, 1);
    }

    // pipe spawning
    pipeTimer -= dt;
    if (pipeTimer <= 0) {
      spawnPipe();
      pipeTimer = pipeInterval;
      // difficulty scaling
      pipesPassed++;
      if (pipesPassed % 5 === 0) {
        pipeGap = Math.max(95, pipeGap - 3);
        pipeInterval = Math.max(1.0, pipeInterval - 0.03);
        speedMul += 0.05;
      }
    }

    // move pipes
    const spd = PIPE_SPEED * speedMul;
    for (const p of pipes) {
      p.x -= spd * dt;
    }

    // move coin drops with pipes
    for (const c of coinDrops) {
      c.x -= spd * dt;
    }

    // pipe scoring
    for (const p of pipes) {
      if (!p.passed && p.x + PIPE_W < BIRD.x) {
        p.passed = true;
        score++;
        onScore(score);
      }
    }

    // remove off-screen pipes
    pipes = pipes.filter(p => p.x > -PIPE_W - 10);
    coinDrops = coinDrops.filter(c => c.x > -20 && !c.taken);

    // bird-pipe collision
    for (const p of pipes) {
      const bx = BIRD.x, by = BIRD.y, bw = BIRD.w, bh = BIRD.h;
      // top pipe
      if (bx + bw > p.x && bx < p.x + PIPE_W && by < p.topH) {
        gameOver();
        return;
      }
      // bottom pipe
      if (bx + bw > p.x && bx < p.x + PIPE_W && by + bh > p.bottomY) {
        gameOver();
        return;
      }
    }

    // coin pickup
    for (const c of coinDrops) {
      if (c.taken) continue;
      const dx = (BIRD.x + BIRD.w / 2) - c.x;
      const dy = (BIRD.y + BIRD.h / 2) - c.y;
      if (Math.sqrt(dx * dx + dy * dy) < c.r + 12) {
        c.taken = true;
        coins += 25;
        onCoins(25);
      }
    }

    // ground/ceiling collision
    if (BIRD.y + BIRD.h >= groundY) {
      BIRD.y = groundY - BIRD.h;
      gameOver();
      return;
    }
    if (BIRD.y < 0) {
      BIRD.y = 0;
      BIRD.vy = 0;
    }

    // scroll ground
    groundOffset = (groundOffset + spd * dt) % 40;
  }

  // ---- render ----
  function render() {
    // bg
    ctx.fillStyle = '#05070A';
    ctx.fillRect(0, 0, W, H);

    // background stars
    ctx.fillStyle = 'rgba(0,255,255,0.15)';
    for (let i = 0; i < 30; i++) {
      const sx = (i * 97 + 20) % W;
      const sy = (i * 53 + 10) % (H - 80);
      ctx.fillRect(sx, sy, 2, 2);
    }

    // neon trail
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      const alpha = (t.life / t.maxLife) * 0.5;
      const radius = 8 * (t.life / t.maxLife);
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#FF10F0';
      ctx.fillStyle = 'rgba(255,16,240,' + alpha + ')';
      ctx.beginPath();
      ctx.arc(t.x - (BIRD.x + BIRD.w / 2 - t.x) * 0.1, t.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // pipes
    for (const p of pipes) {
      // top pipe
      rect(p.x, 0, PIPE_W, p.topH, '#39FF88', 10);
      // top pipe cap
      rect(p.x - 4, p.topH - 20, PIPE_W + 8, 20, '#39FF88', 14);
      // bottom pipe
      rect(p.x, p.bottomY, PIPE_W, groundY - p.bottomY, '#39FF88', 10);
      // bottom pipe cap
      rect(p.x - 4, p.bottomY, PIPE_W + 8, 20, '#39FF88', 14);
      // pipe inner glow
      ctx.fillStyle = 'rgba(0,255,255,0.1)';
      ctx.fillRect(p.x + 4, 0, PIPE_W - 8, p.topH - 20);
      ctx.fillRect(p.x + 4, p.bottomY + 20, PIPE_W - 8, groundY - p.bottomY - 20);
    }

    // coin drops
    for (const c of coinDrops) {
      if (c.taken) continue;
      circle(c.x, c.y, c.r, '#FFE600', 16);
      // inner detail
      ctx.fillStyle = '#AA8800';
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // bird (neon style)
    const birdCx = BIRD.x + BIRD.w / 2;
    const birdCy = BIRD.y + BIRD.h / 2;

    // bird body
    ctx.shadowBlur = 16;
    ctx.shadowColor = '#00FFFF';
    ctx.fillStyle = '#00E5FF';
    ctx.beginPath();
    ctx.ellipse(birdCx, birdCy, BIRD.w / 2, BIRD.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // wing
    const wingFlap = Math.sin(performance.now() * 0.012) * 4;
    ctx.fillStyle = '#FF10F0';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#FF10F0';
    ctx.beginPath();
    ctx.ellipse(birdCx - 2, birdCy + wingFlap, 10, 6, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // eye
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(birdCx + 8, birdCy - 3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#05070A';
    ctx.beginPath();
    ctx.arc(birdCx + 9, birdCy - 3, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // beak
    ctx.fillStyle = '#FFE600';
    ctx.beginPath();
    ctx.moveTo(birdCx + 12, birdCy - 1);
    ctx.lineTo(birdCx + 22, birdCy + 2);
    ctx.lineTo(birdCx + 12, birdCy + 5);
    ctx.closePath();
    ctx.fill();

    // ground
    ctx.fillStyle = '#0B0F1A';
    ctx.fillRect(0, groundY, W, H - groundY);
    // ground neon line
    rect(0, groundY, W, 3, '#FF10F0', 10);
    // ground texture
    ctx.strokeStyle = 'rgba(255,16,240,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -groundOffset; x < W + 40; x += 40) {
      ctx.moveTo(x, groundY + 8);
      ctx.lineTo(x + 20, groundY + 8);
    }
    ctx.stroke();

    // HUD - score
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#00FFFF';
    ctx.fillStyle = '#00FFFF';
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('' + score, W / 2, 55);
    ctx.shadowBlur = 0;

    // coins HUD
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#FFE600';
    ctx.fillStyle = '#FFE600';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('COINS: ' + coins, 16, 28);
    ctx.shadowBlur = 0;

    // game over overlay
    if (over) {
      ctx.fillStyle = 'rgba(5,7,10,0.85)';
      ctx.fillRect(0, 0, W, H);
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#FF10F0';
      ctx.fillStyle = '#FF10F0';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 30);
      ctx.shadowColor = '#00FFFF';
      ctx.fillStyle = '#00FFFF';
      ctx.font = '18px monospace';
      ctx.fillText('SCORE: ' + score, W / 2, H / 2 + 10);
      ctx.fillText('COINS: ' + coins, W / 2, H / 2 + 38);
      ctx.textAlign = 'left';
      ctx.shadowBlur = 0;
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
    // which controls this game needs
    controls: { joystick: false, boost: false, action: true, drift: false }
  };
}
