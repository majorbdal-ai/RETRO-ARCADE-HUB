function trafficRacer(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  let keys = {}, touches = {};
  let gameOverSent = false;
  const LANES = 3, LANE_W = W / LANES, LANE_CX = [LANE_W / 2, LANE_W + LANE_W / 2, LANE_W * 2 + LANE_W / 2];
  let playerLane = 1, playerX, playerY = H - 100, playerW = 50, playerH = 90;
  let laneTransition = 0, targetLane = 1;
  let obstacles = [], fuelPacks = [], fuel = 100, roadOffset = 0;
  let scrollSpeed = 250, difficulty = 0, spawnTimer = 0, fuelTimer = 0;

  function reset() {
    over = false; gameOverSent = false; score = 0; coins = 0; fuel = 100;
    playerLane = 1; targetLane = 1; laneTransition = 0;
    playerX = LANE_CX[1];
    obstacles = []; fuelPacks = []; scrollSpeed = 250; difficulty = 0;
    spawnTimer = 0; fuelTimer = 0; roadOffset = 0;
  }

  function drawNeonText(text, x, y, color, size) {
    ctx.shadowBlur = 12;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.font = (size || 14) + 'px "Courier New", monospace';
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
  }

  function draw() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    // Road
    ctx.fillStyle = '#111122';
    ctx.fillRect(0, 0, W, H);

    // Lane dividers (dashed)
    roadOffset = (roadOffset + scrollSpeed * 0.01) % 40;
    ctx.strokeStyle = '#333355';
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 20]);
    ctx.lineDashOffset = -roadOffset;
    for (let i = 1; i < LANES; i++) {
      ctx.beginPath();
      ctx.moveTo(i * LANE_W, 0);
      ctx.lineTo(i * LANE_W, H);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Edge lines
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#ff0066';
    ctx.strokeStyle = '#ff0066';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(2, 0); ctx.lineTo(2, H);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W - 2, 0); ctx.lineTo(W - 2, H);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Fuel packs
    for (const f of fuelPacks) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#00ff00';
      ctx.fillStyle = '#00ff00';
      ctx.font = '24px "Courier New"';
      ctx.fillText('⛽', f.x - 12, f.y + 8);
      ctx.shadowBlur = 0;
    }

    // Obstacles (enemy cars)
    for (const o of obstacles) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = o.color;
      ctx.fillStyle = o.color;
      // Simple car shape
      const cx = o.x, cy = o.y;
      ctx.fillRect(cx - o.w / 2, cy - o.h / 2, o.w, o.h);
      ctx.fillStyle = '#001122';
      ctx.fillRect(cx - o.w / 2 + 5, cy - o.h / 2 + 10, o.w - 10, 20);
      ctx.shadowBlur = 0;
    }

    // Player car
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00ffff';
    ctx.fillStyle = '#001133';
    ctx.fillRect(playerX - playerW / 2, playerY - playerH / 2, playerW, playerH);
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(playerX - playerW / 2, playerY - playerH / 2, playerW, playerH);
    // Windshield
    ctx.fillStyle = '#003355';
    ctx.fillRect(playerX - playerW / 2 + 6, playerY - playerH / 2 + 12, playerW - 12, 18);
    // Wheels
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(playerX - playerW / 2 - 3, playerY - 20, 6, 12);
    ctx.fillRect(playerX + playerW / 2 - 3, playerY - 20, 6, 12);
    ctx.fillRect(playerX - playerW / 2 - 3, playerY + 10, 6, 12);
    ctx.fillRect(playerX + playerW / 2 - 3, playerY + 10, 6, 12);
    ctx.shadowBlur = 0;

    // Fuel bar
    ctx.fillStyle = '#333';
    ctx.fillRect(W - 120, H - 25, 100, 12);
    ctx.shadowBlur = 8;
    ctx.shadowColor = fuel > 30 ? '#00ff88' : '#ff0044';
    ctx.fillStyle = fuel > 30 ? '#00ff88' : '#ff0044';
    ctx.fillRect(W - 120, H - 25, Math.max(0, fuel), 12);
    ctx.shadowBlur = 0;

    // UI
    drawNeonText('TRAFFIC RACER', 10, 20, '#ff0066', 16);
    drawNeonText('[←→] Dodge cars | Collect ⛽', 10, 38, '#666688', 10);
    drawNeonText('Score: ' + score, 10, 60, '#00ff88', 16);
    drawNeonText('Fuel', W - 120, H - 32, '#ffff00', 10);
  }

  function update(dt) {
    // Scroll
    roadOffset += scrollSpeed * dt;

    // Lane switching
    if (targetLane !== playerLane || laneTransition > 0) {
      if (laneTransition === 0) {
        playerLane = targetLane;
      }
      const targetX = LANE_CX[targetLane];
      playerX += (targetX - playerX) * 8 * dt;
    }

    // Input
    if (keys['ArrowLeft'] || touches.left) {
      keys['ArrowLeft'] = false; touches.left = false;
      if (targetLane > 0) targetLane--;
    }
    if (keys['ArrowRight'] || touches.right) {
      keys['ArrowRight'] = false; touches.right = false;
      if (targetLane < LANES - 1) targetLane++;
    }

    // Fuel drain
    fuel -= 8 * dt;
    if (fuel <= 0) {
      fuel = 0;
      if (!gameOverSent) {
        gameOverSent = true;
        over = true;
        onGameOver(score, coins);
      }
      return;
    }

    // Score increases with distance
    score = Math.floor(roadOffset / 10);
    onScore(score);

    // Difficulty ramp
    difficulty = Math.min(score / 100, 1);
    scrollSpeed = 250 + difficulty * 200;

    // Spawn obstacles
    spawnTimer += dt;
    const spawnInterval = Math.max(0.5, 1.5 - difficulty * 1.0);
    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      const lane = Math.floor(Math.random() * LANES);
      const colors = ['#ff0044', '#ff6600', '#ff00ff', '#ffff00', '#ff3366'];
      obstacles.push({
        x: LANE_CX[lane], y: -80,
        w: 45 + Math.random() * 10, h: 70 + Math.random() * 20,
        color: colors[Math.floor(Math.random() * colors.length)],
        speed: scrollSpeed * (0.3 + Math.random() * 0.3)
      });
    }

    // Spawn fuel
    fuelTimer += dt;
    if (fuelTimer >= 3.5 - difficulty * 1.5) {
      fuelTimer = 0;
      const lane = Math.floor(Math.random() * LANES);
      fuelPacks.push({ x: LANE_CX[lane], y: -30 });
    }

    // Move obstacles
    for (const o of obstacles) {
      o.y += (scrollSpeed + o.speed) * dt;
    }

    // Move fuel
    for (const f of fuelPacks) {
      f.y += scrollSpeed * dt;
    }

    // Collision with obstacles
    for (const o of obstacles) {
      const dx = Math.abs(playerX - o.x);
      const dy = Math.abs(playerY - o.y);
      if (dx < (playerW / 2 + o.w / 2) - 8 && dy < (playerH / 2 + o.h / 2) - 8) {
        if (!gameOverSent) {
          gameOverSent = true;
          over = true;
          onGameOver(score, coins);
        }
        return;
      }
    }

    // Collect fuel
    for (let i = fuelPacks.length - 1; i >= 0; i--) {
      const f = fuelPacks[i];
      const dx = Math.abs(playerX - f.x);
      const dy = Math.abs(playerY - f.y);
      if (dx < 30 && dy < 40) {
        fuel = Math.min(100, fuel + 25);
        coins += 5;
        onScore(score);
        fuelPacks.splice(i, 1);
      }
    }

    // Remove off-screen
    obstacles = obstacles.filter(o => o.y < H + 100);
    fuelPacks = fuelPacks.filter(f => f.y < H + 50);
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
