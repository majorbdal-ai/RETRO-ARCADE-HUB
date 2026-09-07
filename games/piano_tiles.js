function pianoTiles(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  let keys = {}, touches = {};
  let tiles = [], tileSpeed = 200, spawnTimer = 0, spawnInterval = 1.2;
  const LANES = 4, LANE_W = W / LANES, TILE_H = 90, GAP = 120;
  let gameOverSent = false;

  function reset() {
    over = false; gameOverSent = false; score = 0; coins = 0;
    tiles = []; tileSpeed = 200; spawnTimer = 0; spawnInterval = 1.2;
    // Spawn initial tiles
    for (let i = 0; i < 5; i++) {
      spawnTile(-i * GAP);
    }
  }

  function spawnTile(y) {
    const lane = Math.floor(Math.random() * LANES);
    tiles.push({ lane: lane, y: y !== undefined ? y : -TILE_H, w: LANE_W - 10, h: TILE_H, hit: false });
  }

  function drawNeonText(text, x, y, color, size) {
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.font = (size || 16) + 'px "Courier New", monospace';
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
  }

  function draw() {
    // Dark background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    // Lane lines
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#333355';
    ctx.strokeStyle = '#222244';
    ctx.lineWidth = 1;
    for (let i = 1; i < LANES; i++) {
      ctx.beginPath();
      ctx.moveTo(i * LANE_W, 0);
      ctx.lineTo(i * LANE_W, H);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Tiles
    for (const t of tiles) {
      if (t.hit) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ff00ff';
        ctx.fillStyle = 'rgba(255,0,255,0.4)';
        ctx.fillRect(t.lane * LANE_W + 5, t.y, t.w, t.h);
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

    // UI
    drawNeonText('PIANO TILES', 10, 20, '#ff00ff', 18);
    drawNeText('Tap black tiles! [←→↑↓] or swipe', 10, 40, '#888888', 11);
    drawNeonText('Score: ' + score, W - 150, 20, '#00ff88', 16);
    drawNeonText('Coins: ' + coins, W - 150, 40, '#ffff00', 14);
  }

  function drawNeText(t, x, y, c, s) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = c || '#888';
    ctx.font = (s || 11) + 'px "Courier New", monospace';
    ctx.fillText(t, x, y);
  }

  function tapLane(lane) {
    // Find the lowest (closest to bottom) un-hit tile in this lane
    let best = null;
    for (const t of tiles) {
      if (t.lane === lane && !t.hit && t.y + t.h > H * 0.4 && t.y < H + 20) {
        if (!best || t.y > best.y) best = t;
      }
    }
    if (best) {
      best.hit = true;
      score += 1;
      coins += 1;
      onScore(score);
      // Speed up
      tileSpeed = 200 + score * 5;
      spawnInterval = Math.max(0.4, 1.2 - score * 0.02);
    } else {
      // Missed tap or tapped empty lane - no penalty unless no tile at all
    }
  }

  function update(dt) {
    // Spawn tiles
    spawnTimer += dt;
    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      spawnTile();
    }

    // Move tiles
    for (const t of tiles) {
      t.y += tileSpeed * dt;
    }

    // Check tiles that went off screen without being hit
    for (const t of tiles) {
      if (!t.hit && t.y > H + 20) {
        // Missed - game over
        if (!gameOverSent) {
          gameOverSent = true;
          over = true;
          onGameOver(score, coins);
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
        if (!t.hit && t.y + t.h > H * 0.4 && t.y < H + 20) {
          if (!best || t.y > best.y) best = t;
        }
      }
      if (best) tapLane(best.lane);
    }
  }

  function loop(ts) {
    if (!running) return;
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    if (!over) {
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
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
