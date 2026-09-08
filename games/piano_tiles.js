function pianoTiles(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, overSent = false;
  let score = 0, coins = 0, keys = {}, touches = {};
  let tiles = [], tileSpeed = 200, spawnTimer = 0, spawnInterval = 1.2;
  const LANES = 4, LANE_W = W / LANES, TILE_H = 90, GAP = 120;
  const HIT_LINE = H - 70;      // visual hit zone near bottom
  let particles = [], shakeT = 0, flashT = 0, time = 0;
  let combo = 0, maxCombo = 0, perfectCount = 0;
  let missFlash = 0;

  function reset() {
    over = false; overSent = false; score = 0; coins = 0;
    tiles = []; tileSpeed = 200; spawnTimer = 0; spawnInterval = 1.2;
    particles = []; shakeT = 0; flashT = 0; time = 0;
    combo = 0; maxCombo = 0; perfectCount = 0; missFlash = 0;
    // Spawn initial tiles
    for (let i = 0; i < 5; i++) {
      spawnTile(-i * GAP);
    }
  }

  function vibrate(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {}
  }

  function levelOf() { return Math.floor(score / 10) + 1; }

  function spawnTile(y) {
    // avoid immediately repeating the same lane (fairer)
    let lane = Math.floor(Math.random() * LANES);
    const lastTile = tiles[tiles.length - 1];
    if (lastTile && lastTile.lane === lane && Math.random() < 0.6) {
      lane = (lane + 1 + Math.floor(Math.random() * (LANES - 1))) % LANES;
    }
    tiles.push({ lane: lane, y: y !== undefined ? y : -TILE_H, w: LANE_W - 10, h: TILE_H, hit: false });
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 90 + Math.random() * 160;
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60,
        life: 0.45 + Math.random() * 0.3,
        maxLife: 0.75,
        color: color,
        size: 2 + Math.random() * 3
      });
    }
  }

  function drawNeonText(text, x, y, color, size) {
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.font = (size || 16) + 'px "Courier New", monospace';
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
  }

  function tapLane(lane) {
    // Find the lowest (closest to bottom) un-hit tile in this lane
    let best = null;
    for (const t of tiles) {
      if (t.lane === lane && !t.hit && t.y + t.h > H * 0.3 && t.y < H + 20) {
        if (!best || t.y > best.y) best = t;
      }
    }
    if (best) {
      best.hit = true;
      score += 1;
      coins += 1;
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      if (typeof onScore === 'function') onScore(score);
      if (typeof onCoins === 'function') onCoins(coins);
      // hit feedback — burst at tile bottom near hit line
      const tx = best.lane * LANE_W + best.w / 2;
      const ty = Math.min(best.y + best.h, HIT_LINE);
      burst(tx, ty, '#ff00ff', 10);
      // perfect if close to hit line
      const distToLine = Math.abs(best.y + best.h - HIT_LINE);
      if (distToLine < 40) perfectCount++;
      vibrate(10);
      missFlash = 0;
      // Difficulty ramp
      const lv = levelOf();
      tileSpeed = Math.min(520, 200 + score * 6 + (lv - 1) * 40);
      spawnInterval = Math.max(0.24, 1.2 - score * 0.022 - (lv - 1) * 0.04);
      // Level-up celebration
      if (score > 0 && score % 10 === 0) {
        burst(tx, HIT_LINE, '#ffd93b', 22);
        vibrate([30, 40, 30]);
      }
    } else {
      // tapped empty lane — small penalty: reset combo
      combo = 0;
      vibrate(15);
    }
  }

  function update(dt) {
    if (over) return;
    time = time + dt;
    if (shakeT > 0) shakeT = shakeT - dt;
    if (flashT > 0) flashT = flashT - dt;
    if (missFlash > 0) missFlash = missFlash - dt;

    // Spawn tiles
    spawnTimer += dt;
    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      spawnTile();
      // at higher levels occasionally double-spawn
      if (score >= 15 && Math.random() < 0.18) spawnTile();
    }

    // Move tiles
    for (const t of tiles) {
      t.y += tileSpeed * dt;
    }

    // Check tiles that went off screen without being hit
    for (const t of tiles) {
      if (!t.hit && t.y > H + 20) {
        if (!overSent) {
          overSent = true;
          over = true;
          burst(t.lane * LANE_W + LANE_W / 2, t.y - TILE_H / 2, '#ff4d5e', 18);
          vibrate([80, 40, 120]);
          shakeT = 0.28;
          if (typeof onScore === 'function') onScore(score);
          if (typeof onGameOver === 'function') onGameOver(score, coins);
        }
      }
    }

    // Remove off-screen tiles
    tiles = tiles.filter(t => t.y < H + 50);

    // Handle input - determine lane from keys/touches
    if (keys['ArrowLeft'] || touches.left) {
      keys['ArrowLeft'] = false; touches.left = false;
      tapLane(0);
    }
    if (keys['ArrowDown'] || touches.down) {
      keys['ArrowDown'] = false; touches.down = false;
      tapLane(1);
    }
    if (keys['ArrowUp'] || touches.up) {
      keys['ArrowUp'] = false; touches.up = false;
      tapLane(2);
    }
    if (keys['ArrowRight'] || touches.right) {
      keys['ArrowRight'] = false; touches.right = false;
      tapLane(3);
    }
    if (keys['Space'] || touches.action) {
      keys['Space'] = false; touches.action = false;
      // Tap the lane of the lowest tile
      let best = null;
      for (const t of tiles) {
        if (!t.hit && t.y + t.h > H * 0.3 && t.y < H + 20) {
          if (!best || t.y > best.y) best = t;
        }
      }
      if (best) tapLane(best.lane);
    }

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 260 * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    if (particles.length > 160) particles.splice(0, particles.length - 160);
  }

  function draw() {
    const ox = shakeT > 0 ? (Math.random() - 0.5) * 8 : 0;
    const oy = shakeT > 0 ? (Math.random() - 0.5) * 6 : 0;
    ctx.save();
    ctx.translate(ox, oy);

    // Dark background with subtle gradient
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    // Lane lines
    ctx.strokeStyle = '#222244';
    ctx.lineWidth = 1;
    for (let i = 1; i < LANES; i++) {
      ctx.beginPath();
      ctx.moveTo(i * LANE_W, 0);
      ctx.lineTo(i * LANE_W, H);
      ctx.stroke();
    }

    // hit line indicator
    ctx.strokeStyle = 'rgba(0,255,136,0.25)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.moveTo(0, HIT_LINE); ctx.lineTo(W, HIT_LINE); ctx.stroke();
    ctx.setLineDash([]);

    // Tiles
    for (const t of tiles) {
      if (t.hit) {
        // fading hit tile
        ctx.globalAlpha = 0.35;
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#ff00ff';
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(t.lane * LANE_W + 5, t.y, t.w, t.h);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      } else {
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#00ffff';
        ctx.fillStyle = '#001122';
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.fillRect(t.lane * LANE_W + 5, t.y, t.w, t.h);
        ctx.strokeRect(t.lane * LANE_W + 5, t.y, t.w, t.h);
        ctx.shadowBlur = 0;
      }
    }

    // particles
    for (const p of particles) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // miss flash
    if (missFlash > 0) {
      ctx.fillStyle = 'rgba(255,77,94,' + (missFlash * 1.5).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    // UI
    const lv = levelOf();
    drawNeonText('PIANO TILES', 10, 22, '#ff00ff', 18);
    ctx.fillStyle = '#888888';
    ctx.font = '11px "Courier New", monospace';
    ctx.fillText('Tap black tiles! [←→↑↓] or swipe', 10, 40);
    ctx.fillText('HIT LINE: press when a tile crosses it', 10, 55);
    ctx.textAlign = 'right';
    drawNeonText('Score: ' + score, W - 10, 22, '#00ff88', 16);
    drawNeonText('LV ' + lv, W - 10, 42, '#ffd93b', 13);
    if (combo >= 5) {
      drawNeonText('COMBO x' + combo, W - 10, 60, '#ff00ff', 14);
    }
    ctx.textAlign = 'left';

    // game over canvas overlay
    if (over) {
      ctx.fillStyle = 'rgba(4,4,10,0.74)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff4d5e';
      ctx.font = 'bold 42px "Courier New", monospace';
      ctx.shadowColor = '#ff4d5e'; ctx.shadowBlur = 14;
      ctx.fillText('MISSED!', W / 2, 185);
      ctx.fillStyle = '#ffd93b';
      ctx.font = 'bold 22px "Courier New", monospace';
      ctx.fillText('SCORE ' + score, W / 2, 228);
      ctx.fillStyle = '#3bff8f';
      ctx.font = '14px "Courier New", monospace';
      ctx.fillText('COINS +' + coins + '   BEST COMBO x' + maxCombo, W / 2, 258);
      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
    }

    ctx.restore();
  }

  function loop(ts) {
    if (!running) return;
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    if (!over) {
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    } else {
      draw(); // one final frame with game-over overlay
    }
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
  function resume() {
    if (!over && !running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }
  function destroy() { running = false; cancelAnimationFrame(raf); }

  return {
    start: start,
    pause: pause,
    resume: resume,
    destroy: destroy,
    setInput: function(t, k) { touches = t || {}; keys = k || {}; }
  };
}