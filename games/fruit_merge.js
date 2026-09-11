function fruitMerge(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
let diffMul = 1;  // v7.20 difficulty ramp
  let raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  let keys = {}, touches = {};
  let fruits = [], nextFruit = null, aimX = W / 2, aiming = false, lineTimer = 0, gameOverTimer = 0;
  const fruitTypes = [
    { r: 14, color: '#ff6b6b', glow: '#ff0000', value: 1 },
    { r: 20, color: '#ffa500', glow: '#ff8800', value: 2 },
    { r: 26, color: '#ffff00', glow: '#ffdd00', value: 3 },
    { r: 32, color: '#00ff88', glow: '#00bb66', value: 4 },
    { r: 38, color: '#00ffff', glow: '#0088ff', value: 5 },
    { r: 44, color: '#aa00ff', glow: '#8800cc', value: 6 },
    { r: 50, color: '#ff00ff', glow: '#cc00aa', value: 7 },
    { r: 56, color: '#ff0088', glow: '#aa0066', value: 8 },
    { r: 62, color: '#8800ff', glow: '#6600aa', value: 9 },
    { r: 68, color: '#ffffff', glow: '#ffffaa', value: 10 }
  ];
  const GRAVITY = 800, BOUNCE = 0.35, FRICTION = 0.98, WALL_RESTITUTION = 0.6;
  const FLOOR_Y = H - 40, CEILING_Y = 90, LEFT_WALL = 40, RIGHT_WALL = W - 40;

  function randomFruit() {
    const idx = Math.min(Math.floor(Math.random() * 4), 3);
    return { ...fruitTypes[idx], x: aimX, y: 50, vx: 0, vy: 0, settled: false, merging: false, popTimer: 0 };
  }

  function reset() {
    fruits = [];
    nextFruit = randomFruit();
    aimX = W / 2;
    aiming = false;
    lineTimer = 0;
    gameOverTimer = 0;
    score = 0;
    coins = 0;
    over = false;
    onScore(0);
  }

  function mergePass() {
    let merged = true;
    let guard = 0;
    while (merged && guard < 30) {
      merged = false;
      guard++;
      for (let i = 0; i < fruits.length; i++) {
        const a = fruits[i];
        if (a.merging || !a.settled) continue;
        for (let j = i + 1; j < fruits.length; j++) {
          const b = fruits[j];
          if (b.merging || !b.settled || a.value !== b.value || a.value >= 10) continue;
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < a.r + b.r) {
            a.merging = true;
            b.merging = true;
            const nt = fruitTypes[a.value];
            fruits.push({ ...nt, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, vx: 0, vy: -40, settled: false, merging: false, popTimer: 0.35 });
            score += nt.value * 10;
            coins += nt.value;
            onScore(score);
            if (typeof window.playSfx === 'function') { try { window.playSfx('pop'); } catch (e) {} }
            if (nt.value >= 5 && navigator.vibrate) { try { navigator.vibrate(40); } catch (e) {} }
            merged = true;
            break;
          }
        }
        if (merged) break;
      }
    }
    fruits = fruits.filter(f => !f.merging);
  }

  function resolveCollisions() {
    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < fruits.length; i++) {
        const a = fruits[i];
        if (a.merging || a.popTimer > 0) continue;
        for (let j = i + 1; j < fruits.length; j++) {
          const b = fruits[j];
          if (b.merging || b.popTimer > 0) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = a.r + b.r;
          if (dist >= minDist || dist < 0.001) continue;
          const nx = dx / dist, ny = dy / dist;
          const overlap = minDist - dist;
          const aMovable = !a.settled, bMovable = !b.settled;
          if (aMovable && bMovable) {
            a.x -= nx * overlap / 2; a.y -= ny * overlap / 2;
            b.x += nx * overlap / 2; b.y += ny * overlap / 2;
          } else if (bMovable) {
            b.x += nx * overlap; b.y += ny * overlap;
          } else if (aMovable) {
            a.x -= nx * overlap; a.y -= ny * overlap;
          }
          const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
          const rvn = rvx * nx + rvy * ny;
          if (rvn < 0) {
            const rest = (a.settled || b.settled) ? 0.1 : 0.5;
            const imp = -(1 + rest) * rvn * 0.5;
            if (aMovable) { a.vx -= imp * nx; a.vy -= imp * ny; }
            if (bMovable) { b.vx += imp * nx; b.vy += imp * ny; }
          }
        }
      }
    }
  }

  function settleCheck() {
    let anyMoving = false;
    for (const f of fruits) {
      if (f.merging || f.settled) continue;
      if (Math.abs(f.vx) < 8 && Math.abs(f.vy) < 8) {
        let supported = f.y >= FLOOR_Y - f.r - 2;
        if (!supported) {
          for (const s of fruits) {
            if (s === f || s.merging) continue;
            if (s.y > f.y && s.y - f.y < f.r + s.r + 6 && Math.abs(f.x - s.x) < (f.r + s.r) * 0.9) {
              supported = true;
              break;
            }
          }
        }
        if (supported) {
          f.settled = true;
          f.vx = 0;
          f.vy = 0;
          if (f.y + f.r > FLOOR_Y) f.y = FLOOR_Y - f.r;
          continue;
        }
      }
      anyMoving = true;
    }
    return !anyMoving;
  }

  function update(dt) {
    if (over) return;

    if (aiming) {
      if (touches.left || keys.ArrowLeft) aimX = Math.max(LEFT_WALL + nextFruit.r, aimX - 320 * dt);
      if (touches.right || keys.ArrowRight) aimX = Math.min(RIGHT_WALL - nextFruit.r, aimX + 320 * dt);
      nextFruit.x = aimX;
      lineTimer += dt;
      if (!(touches.action || keys.Space || keys.KeyW)) {
        const f = nextFruit;
        f.vy = 120;
        f.settled = false;
        fruits.push(f);
        nextFruit = randomFruit();
        nextFruit.x = aimX;
        aiming = false;
        lineTimer = 0;
        if (typeof window.playSfx === 'function') { try { window.playSfx('shoot'); } catch (e) {} }
      }
    } else if ((touches.action || keys.Space || keys.KeyW) && nextFruit) {
      aiming = true;
      lineTimer = 0;
    }

    for (const f of fruits) {
      if (f.merging || f.popTimer > 0) continue;
      f.vy += GRAVITY * diffMul * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vx *= FRICTION;
      if (f.x - f.r < LEFT_WALL) { f.x = LEFT_WALL + f.r; f.vx *= -WALL_RESTITUTION; }
      if (f.x + f.r > RIGHT_WALL) { f.x = RIGHT_WALL - f.r; f.vx *= -WALL_RESTITUTION; }
      if (f.y + f.r > FLOOR_Y) {
        f.y = FLOOR_Y - f.r;
        f.vy *= -BOUNCE;
        if (Math.abs(f.vy) < 25) f.vy = 0;
        f.vx *= 0.85;
      }
    }

    mergePass();
    resolveCollisions();
    const allSettled = settleCheck();

    for (const f of fruits) if (f.popTimer > 0) f.popTimer -= dt;

    if (allSettled) {
      let offending = false;
      for (const f of fruits) {
        if (f.settled && f.y - f.r < CEILING_Y) { offending = true; break; }
      }
      if (offending) gameOverTimer += dt;
      else gameOverTimer = 0;
      if (gameOverTimer > 1.2) {
        over = true;
        if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
        if (typeof gameFX !== 'undefined') { try { var __r = canvas.getBoundingClientRect(); gameFX.burst(__r.left + (W/2) * __r.width / canvas.width, __r.top + (H/2) * __r.height / canvas.height, '#ff4444', 16); } catch(e){} gameFX.shake(5); }
      onGameOver(score, coins);
      }
    } else {
      gameOverTimer = 0;
    }
  }

  function draw() {
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ffff';
    ctx.beginPath();
    ctx.moveTo(LEFT_WALL, CEILING_Y);
    ctx.lineTo(LEFT_WALL, FLOOR_Y);
    ctx.lineTo(RIGHT_WALL, FLOOR_Y);
    ctx.lineTo(RIGHT_WALL, CEILING_Y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (aiming) {
      ctx.setLineDash([8, 8]);
      ctx.lineDashOffset = -lineTimer * 40;
      ctx.strokeStyle = nextFruit.glow;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 8;
      ctx.shadowColor = nextFruit.glow;
      ctx.beginPath();
      ctx.moveTo(aimX, 60);
      ctx.lineTo(aimX, CEILING_Y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 120);
      ctx.globalAlpha = pulse;
      ctx.shadowBlur = 18;
      ctx.shadowColor = nextFruit.glow;
      const grad = ctx.createRadialGradient(aimX - nextFruit.r * 0.3, 50 - nextFruit.r * 0.3, 0, aimX, 50, nextFruit.r);
      grad.addColorStop(0, nextFruit.color);
      grad.addColorStop(1, nextFruit.glow);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(aimX, 50, nextFruit.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    for (const f of fruits) {
      const alpha = f.popTimer > 0 ? 0.5 + 0.5 * Math.sin(f.popTimer * 24) : 1;
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 20;
      ctx.shadowColor = f.glow;
      const grad = ctx.createRadialGradient(f.x - f.r * 0.3, f.y - f.r * 0.3, 0, f.x, f.y, f.r);
      grad.addColorStop(0, f.color);
      grad.addColorStop(1, f.glow);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    if (nextFruit && !aiming) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = nextFruit.glow;
      const grad = ctx.createRadialGradient(aimX - nextFruit.r * 0.3, 40 - nextFruit.r * 0.3, 0, aimX, 40, nextFruit.r);
      grad.addColorStop(0, nextFruit.color);
      grad.addColorStop(1, nextFruit.glow);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(aimX, 40, nextFruit.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.font = 'bold 18px Orbitron, monospace';
    ctx.fillStyle = '#00ffff';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00ffff';
    ctx.fillText('FRUIT MERGE', 16, 28);
    ctx.font = '12px Orbitron, monospace';
    ctx.fillStyle = '#88ffff';
    ctx.fillText('←/→ Aim  |  SPACE/TAP Drop  |  Merge same fruits', 16, 46);
    ctx.shadowBlur = 0;

    ctx.font = 'bold 20px Orbitron, monospace';
    ctx.fillStyle = '#ffff00';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffff00';
    ctx.fillText('SCORE: ' + score, W - 180, 36);
    ctx.shadowBlur = 0;
  }

  function loop(ts) {
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    update(dt);
    draw();
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
  function destroy() { running = false; cancelAnimationFrame(raf); }

  return { start, pause, resume, destroy, setDifficulty: function(lvl){ diffMul = [1,1.15,1.3,1.5,1.75,2][Math.min(5,Math.floor(lvl)||0)]||1; }, setInput: (t, k) => { touches = t; keys = k; } };
}