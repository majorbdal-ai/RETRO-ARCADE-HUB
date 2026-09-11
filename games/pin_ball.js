function pinBall(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  const GRAVITY = 900, BALL_R = 8, FLIPPER_LEN = 60, FLIPPER_W = 10;
  let raf = null, last = 0, running = false, over = false, overSent = false;
  let score = 0, coins = 0, keys = {}, touches = {};
  let ball = null, flippers = [], bumpers = [], walls = [], targets = [];
  let time = 0, ballsLeft = 3, launching = false, launchPower = 0;
  let leftFlipperAngle = 0, rightFlipperAngle = 0;
  let leftFlipperTarget = 0, rightFlipperTarget = 0;
  let comboTimer = 0, combo = 0, flashEffects = [];
  let state = 'play';

  function key(n) { return !!keys[n]; }
  function t(n) { return !!touches[n]; }

  function reset() {
    over = false; overSent = false;
    score = 0; coins = 0; time = 0; combo = 0; comboTimer = 0;
    ballsLeft = 3; launching = false; launchPower = 0; state = 'play';
    flashEffects = [];

    flippers = [
      { x: W / 2 - 70, y: H - 60, angle: 0.4, side: 'left' },
      { x: W / 2 + 70, y: H - 60, angle: Math.PI - 0.4, side: 'right' }
    ];

    bumpers = [
      { x: W / 2, y: 120, r: 22, points: 100, color: '#ff3b6b', hit: 0 },
      { x: W / 2 - 100, y: 170, r: 18, points: 75, color: '#ffd93b', hit: 0 },
      { x: W / 2 + 100, y: 170, r: 18, points: 75, color: '#3bff8f', hit: 0 },
      { x: W / 2 - 55, y: 250, r: 16, points: 50, color: '#3bc9ff', hit: 0 },
      { x: W / 2 + 55, y: 250, r: 16, points: 50, color: '#3bc9ff', hit: 0 },
      { x: W / 2, y: 310, r: 14, points: 50, color: '#c084fc', hit: 0 }
    ];

    targets = [
      { x: 60, y: 100, w: 30, h: 10, lit: false, points: 200, color: '#ff3b6b' },
      { x: 60, y: 140, w: 30, h: 10, lit: false, points: 200, color: '#ffd93b' },
      { x: 60, y: 180, w: 30, h: 10, lit: false, points: 200, color: '#3bff8f' },
      { x: W - 90, y: 100, w: 30, h: 10, lit: false, points: 200, color: '#ff3b6b' },
      { x: W - 90, y: 140, w: 30, h: 10, lit: false, points: 200, color: '#ffd93b' },
      { x: W - 90, y: 180, w: 30, h: 10, lit: false, points: 200, color: '#3bff8f' }
    ];

    walls = [
      { x1: 30, y1: 50, x2: 30, y2: H - 80 },
      { x1: W - 30, y1: 50, x2: W - 30, y2: H - 80 },
      { x1: 30, y1: 50, x2: W / 2 - 20, y2: 30 },
      { x1: W / 2 + 20, y1: 30, x2: W - 30, y2: 50 },
      { x1: 30, y1: H - 80, x2: W / 2 - 90, y2: H - 40 },
      { x1: W / 2 + 90, y1: H - 40, x2: W - 30, y2: H - 80 }
    ];

    spawnBall();
  }

  function spawnBall() {
    ball = { x: W - 20, y: H - 100, vx: 0, vy: 0, launched: false };
    launching = true;
    launchPower = 0;
  }

  function callScore() { if (typeof onScore === 'function') onScore(score); }
  function callCoins() { if (typeof onCoins === 'function') onCoins(coins); }

  function die() {
    if (overSent) return;
    ballsLeft--;
    if (typeof window.playSfx === 'function') { try { window.playSfx('error'); } catch (e) {} }
    if (ballsLeft <= 0) {
      overSent = true; over = true; state = 'over';
      callScore();
      if (typeof onGameOver === 'function') onGameOver(score, coins);
    } else {
      spawnBall();
    }
  }

  function addFlash(x, y, color) {
    flashEffects.push({ x: x, y: y, t: 0.3, color: color });
  }

  function update(dt) {
    time = time + dt;
    if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }

    for (let i = flashEffects.length - 1; i >= 0; i--) {
      flashEffects[i].t -= dt;
      if (flashEffects[i].t <= 0) flashEffects.splice(i, 1);
    }

    for (let i = 0; i < bumpers.length; i++) {
      if (bumpers[i].hit > 0) bumpers[i].hit -= dt;
    }

    // Flipper controls
    const leftPressed = t('left') || key('ArrowLeft') || key('KeyA') || key('Space');
    const rightPressed = t('right') || key('ArrowRight') || key('KeyD') || key('ShiftRight') || key('ShiftLeft');
    leftFlipperTarget = leftPressed ? -0.5 : 0.4;
    rightFlipperTarget = rightPressed ? Math.PI + 0.5 : Math.PI - 0.4;
    leftFlipperAngle += (leftFlipperTarget - leftFlipperAngle) * Math.min(1, dt * 25);
    rightFlipperAngle += (rightFlipperTarget - rightFlipperAngle) * Math.min(1, dt * 25);
    flippers[0].angle = leftFlipperAngle;
    flippers[1].angle = rightFlipperAngle;

    // Launching
    if (launching) {
      const launchHeld = t('action') || t('gas') || key('Space') || key('ArrowUp');
      if (launchHeld) {
        launchPower = Math.min(launchPower + dt * 2.2, 1);
      } else if (launchPower > 0.05) {
        ball.vy = -(400 + launchPower * 600);
        ball.vx = -80 - Math.random() * 60;
        ball.launched = true;
        launching = false;
        launchPower = 0;
        if (typeof window.playSfx === 'function') { try { window.playSfx('shoot'); } catch (e) {} }
      } else {
        launchPower = 0;
      }
    }

    // Ball physics
    if (!launching && ball) {
      ball.vy += GRAVITY * dt;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // Wall bounce
      if (ball.x - BALL_R < 30) { ball.x = 30 + BALL_R; ball.vx = Math.abs(ball.vx) * 0.85; }
      if (ball.x + BALL_R > W - 30) { ball.x = W - 30 - BALL_R; ball.vx = -Math.abs(ball.vx) * 0.85; }
      if (ball.y - BALL_R < 30) { ball.y = 30 + BALL_R; ball.vy = Math.abs(ball.vy) * 0.85; }

      // Bottom drain
      if (ball.y > H + 20) {
        die();
        return;
      }

      // Bumper collision
      for (let i = 0; i < bumpers.length; i++) {
        const b = bumpers[i];
        const dx = ball.x - b.x, dy = ball.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < BALL_R + b.r) {
          const nx = dx / dist, ny = dy / dist;
          ball.x = b.x + nx * (BALL_R + b.r + 1);
          ball.y = b.y + ny * (BALL_R + b.r + 1);
          const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
          const newSpeed = Math.max(speed, 350);
          ball.vx = nx * newSpeed * 1.1;
          ball.vy = ny * newSpeed * 1.1;
          combo++; comboTimer = 1.5;
          const pts = b.points * Math.max(1, Math.floor(combo / 3));
          score += pts; callScore();
          b.hit = 0.2;
          addFlash(b.x, b.y, b.color);
          coins++; callCoins();
          if (typeof window.playSfx === 'function') { try { window.playSfx(combo >= 3 ? 'win2' : 'pop'); } catch (e) {} }
          if (navigator.vibrate) { try { navigator.vibrate(Math.min(15 + combo * 5, 40)); } catch (e) {} }
        }
      }

      // Target collision
      for (let i = 0; i < targets.length; i++) {
        const tg = targets[i];
        if (!tg.lit && ball.x > tg.x && ball.x < tg.x + tg.w && ball.y > tg.y && ball.y < tg.y + tg.h) {
          tg.lit = true;
          score += tg.points; callScore();
          addFlash(tg.x + tg.w / 2, tg.y, tg.color);
          coins += 2; callCoins();
          ball.vy = -Math.abs(ball.vy) * 0.9;
          if (typeof window.playSfx === 'function') { try { window.playSfx('click'); } catch (e) {} }
          // Check if all targets lit
          if (targets.every(t => t.lit)) {
            score += 1000; callScore();
            coins += 10; callCoins();
            targets.forEach(t => t.lit = false);
            addFlash(W / 2, H / 2, '#ffd93b');
            if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
          }
        }
      }

      // Flipper collision
      for (let i = 0; i < flippers.length; i++) {
        const f = flippers[i];
        const cosA = Math.cos(f.angle), sinA = Math.sin(f.angle);
        const ex = f.x + cosA * FLIPPER_LEN, ey = f.y + sinA * FLIPPER_LEN;
        // Point-line segment distance
        const ldx = ex - f.x, ldy = ey - f.y;
        const len2 = ldx * ldx + ldy * ldy;
        let t_param = ((ball.x - f.x) * ldx + (ball.y - f.y) * ldy) / len2;
        t_param = Math.max(0, Math.min(1, t_param));
        const closestX = f.x + t_param * ldx;
        const closestY = f.y + t_param * ldy;
        const dx = ball.x - closestX, dy = ball.y - closestY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < BALL_R + FLIPPER_W / 2) {
          const nx = dx / dist, ny = dy / dist;
          ball.x = closestX + nx * (BALL_R + FLIPPER_W / 2 + 1);
          ball.y = closestY + ny * (BALL_R + FLIPPER_W / 2 + 1);
          const flipperSpeed = (f.side === 'left' ? (leftFlipperTarget - leftFlipperAngle) : (rightFlipperTarget - rightFlipperAngle));
          const power = Math.abs(flipperSpeed) > 0.3 ? 550 : 200;
          ball.vx = nx * power + (f.side === 'left' ? 60 : -60);
          ball.vy = Math.min(ny * power, -180);
          if (typeof window.playSfx === 'function') { try { window.playSfx('click'); } catch (e) {} }
        }
      }

      // Guide walls (angled)
      // Left guide: (30, H-80) -> (W/2-90, H-40)
      wallBounce(30, H - 80, W / 2 - 90, H - 40);
      // Right guide: (W/2+90, H-40) -> (W-30, H-80)
      wallBounce(W / 2 + 90, H - 40, W - 30, H - 80);
    }

    render();
  }

  function wallBounce(x1, y1, x2, y2) {
    if (!ball) return;
    const ldx = x2 - x1, ldy = y2 - y1;
    const len2 = ldx * ldx + ldy * ldy;
    let t_param = ((ball.x - x1) * ldx + (ball.y - y1) * ldy) / len2;
    t_param = Math.max(0, Math.min(1, t_param));
    const closestX = x1 + t_param * ldx;
    const closestY = y1 + t_param * ldy;
    const dx = ball.x - closestX, dy = ball.y - closestY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < BALL_R + 4) {
      const nx = dx / dist, ny = dy / dist;
      ball.x = closestX + nx * (BALL_R + 5);
      ball.y = closestY + ny * (BALL_R + 5);
      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx -= 2 * dot * nx * 0.8;
      ball.vy -= 2 * dot * ny * 0.8;
    }
  }

  function neonText(txt, x, y, size, color) {
    ctx.font = 'bold ' + size + 'px "Courier New", monospace';
    ctx.fillStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.fillText(txt, x, y);
    ctx.shadowBlur = 0;
  }

  function render() {
    ctx.fillStyle = '#0a0612';
    ctx.fillRect(0, 0, W, H);

    // Table border
    ctx.strokeStyle = '#3bc9ff';
    ctx.shadowColor = '#3bc9ff'; ctx.shadowBlur = 14;
    ctx.lineWidth = 3;
    ctx.strokeRect(28, 28, W - 56, H - 56);
    ctx.shadowBlur = 0;

    // Guide walls
    ctx.strokeStyle = '#c084fc';
    ctx.shadowColor = '#c084fc'; ctx.shadowBlur = 10;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(30, H - 80); ctx.lineTo(W / 2 - 90, H - 40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W / 2 + 90, H - 40); ctx.lineTo(W - 30, H - 80); ctx.stroke();
    ctx.shadowBlur = 0;

    // Flash effects
    for (let i = 0; i < flashEffects.length; i++) {
      const f = flashEffects[i];
      const alpha = f.t / 0.3;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 30 * (1 - alpha) + 10, 0, Math.PI * 2);
      ctx.fillStyle = f.color;
      ctx.globalAlpha = alpha * 0.6;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Bumpers
    for (let i = 0; i < bumpers.length; i++) {
      const b = bumpers[i];
      const scale = b.hit > 0 ? 1.3 : 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * scale, 0, Math.PI * 2);
      ctx.fillStyle = b.hit > 0 ? '#ffffff' : b.color + '88';
      ctx.strokeStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = b.hit > 0 ? 25 : 12;
      ctx.lineWidth = 3;
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      neonText(String(b.points), b.x - 10, b.y + 4, 11, '#ffffff');
    }

    // Targets
    for (let i = 0; i < targets.length; i++) {
      const tg = targets[i];
      ctx.fillStyle = tg.lit ? tg.color : tg.color + '33';
      ctx.shadowColor = tg.color;
      ctx.shadowBlur = tg.lit ? 16 : 4;
      ctx.fillRect(tg.x, tg.y, tg.w, tg.h);
      ctx.shadowBlur = 0;
    }

    // Flippers
    for (let i = 0; i < flippers.length; i++) {
      const f = flippers[i];
      const cosA = Math.cos(f.angle), sinA = Math.sin(f.angle);
      const ex = f.x + cosA * FLIPPER_LEN, ey = f.y + sinA * FLIPPER_LEN;
      ctx.strokeStyle = '#ffd93b';
      ctx.shadowColor = '#ffd93b';
      ctx.shadowBlur = 14;
      ctx.lineWidth = FLIPPER_W;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Ball
    if (ball && !launching) {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Launch zone
    if (launching) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffd93b';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(W - 20, H - 100, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Power bar
      const barH = 80 * launchPower;
      ctx.fillStyle = launchPower > 0.7 ? '#ff3b6b' : '#3bff8f';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.fillRect(W - 12, H - 100 - barH, 8, barH);
      ctx.shadowBlur = 0;
    }

    // HUD
    neonText('NEON PINBALL', 42, 65, 13, '#7df9ff');
    neonText('FLIP: ← → / A D / SPACE', 42, 82, 9, '#8a93b8');
    ctx.textAlign = 'right';
    neonText('SCORE ' + score, W - 42, 65, 16, '#ffd93b');
    neonText('BALLS ' + ballsLeft, W - 42, 82, 12, '#ff3b6b');
    ctx.textAlign = 'left';

    // Combo
    if (combo >= 3) {
      ctx.textAlign = 'center';
      neonText('COMBO x' + combo, W / 2, H - 14, 14, '#ffd93b');
      ctx.textAlign = 'left';
    }

    if (state === 'over') {
      ctx.fillStyle = 'rgba(4,4,10,0.78)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      neonText('GAME OVER', W / 2, 170, 44, '#ff4d5e');
      neonText('SCORE ' + score, W / 2, 222, 24, '#ffd93b');
      neonText('COINS +' + coins, W / 2, 258, 16, '#3bff8f');
      ctx.textAlign = 'left';
    }
  }

  function loop(ts) {
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    if (running && !over) update(dt);
    if (!over) raf = requestAnimationFrame(loop);
  }

  function start() {
    reset();
    if (!running) {
      running = true;
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    }
  }

  function pause() { running = false; cancelAnimationFrame(raf); }
  function resume() { if (!over && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); } }
  function destroy() { running = false; over = true; cancelAnimationFrame(raf); }
  function setInput(ts, ks) { touches = ts || {}; keys = ks || {}; }

  return { start: start, pause: pause, resume: resume, destroy: destroy, setInput: setInput };
}