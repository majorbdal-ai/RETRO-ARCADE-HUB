function trafficRacer(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  let keys = {}, touches = {};
  let gameOverSent = false;
  const LANES = 3, LANE_W = W / LANES, LANE_CX = [LANE_W / 2, LANE_W + LANE_W / 2, LANE_W * 2 + LANE_W / 2];
  let playerLane = 1, playerX, playerY = H - 100, playerW = 50, playerH = 90;
  let targetLane = 1;
  let obstacles = [], fuelPacks = [], fuel = 100, roadOffset = 0;
  let scrollSpeed = 250, difficulty = 0, spawnTimer = 0, fuelTimer = 0;
  let difficultyMult = 1;   // v7.18 difficulty ramp: layered on built-in score difficulty

  // --- NEW: particles, effects, near-miss tracking ---
  let particles = [], speedLines = [], shakeTimer = 0;
  let nearMissFlash = 0, nearMissBonus = 0, levelDisplay = 1;
  let collectPopup = null; // floating "+25" text

  function vibrate(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {}
  }

  function reset() {
    over = false; gameOverSent = false; score = 0; coins = 0; fuel = 100;
    playerLane = 1; targetLane = 1;
    playerX = LANE_CX[1];
    obstacles = []; fuelPacks = []; particles = []; speedLines = [];
    scrollSpeed = 250; difficulty = 0; spawnTimer = 0; fuelTimer = 0; roadOffset = 0;
    shakeTimer = 0; nearMissFlash = 0; nearMissBonus = 0; levelDisplay = 1;
    collectPopup = null;
  }

  function spawnExplosion(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 180;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1, color,
        size: 2 + Math.random() * 4
      });
    }
  }

  function spawnCollectText(x, y, text, color) {
    collectPopup = { x, y, text, color, life: 1.0 };
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

    // --- Shake offset ---
    const shx = shakeTimer > 0 ? (Math.random() - 0.5) * 6 : 0;
    const shy = shakeTimer > 0 ? (Math.random() - 0.5) * 6 : 0;
    ctx.save();
    ctx.translate(shx, shy);

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

    // Edge lines with glow
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff0066';
    ctx.strokeStyle = '#ff0066';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(2, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W - 2, 0); ctx.lineTo(W - 2, H); ctx.stroke();
    ctx.shadowBlur = 0;

    // --- Speed lines when going fast ---
    if (scrollSpeed > 300) {
      ctx.globalAlpha = Math.min((scrollSpeed - 300) / 150, 0.5);
      for (const sl of speedLines) {
        ctx.strokeStyle = sl.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sl.x, sl.y);
        ctx.lineTo(sl.x, sl.y + sl.len);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Fuel packs
    for (const f of fuelPacks) {
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#00ff00';
      ctx.fillStyle = '#00ff00';
      ctx.font = '26px "Courier New"';
      ctx.fillText('\u26FD', f.x - 13, f.y + 8);
      ctx.shadowBlur = 0;
    }

    // Obstacles
    for (const o of obstacles) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = o.color;
      ctx.fillStyle = o.color;
      const cx = o.x, cy = o.y;
      // Car body
      ctx.fillRect(cx - o.w / 2, cy - o.h / 2, o.w, o.h);
      // Windshield
      ctx.fillStyle = '#001122';
      ctx.fillRect(cx - o.w / 2 + 5, cy - o.h / 2 + 10, o.w - 10, 20);
      // Headlights
      ctx.fillStyle = '#ffffcc';
      ctx.fillRect(cx - o.w / 2 + 4, cy + o.h / 2 - 5, 6, 5);
      ctx.fillRect(cx + o.w / 2 - 10, cy + o.h / 2 - 5, 6, 5);
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

    // --- Exhaust particles behind player ---
    if (running && !over && scrollSpeed > 260) {
      spawnExplosion(playerX + (Math.random() - 0.5) * 10, playerY + playerH / 2 + 5, '#00aaff', 1);
    }

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      ctx.shadowBlur = 6;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // --- Fuel bar with gradient ---
    ctx.fillStyle = '#222';
    ctx.fillRect(W - 130, H - 28, 110, 14);
    const fuelPct = Math.max(0, fuel) / 100;
    if (fuelPct > 0) {
      const grad = ctx.createLinearGradient(W - 130, 0, W - 130 + fuelPct * 110, 0);
      if (fuel > 30) {
        grad.addColorStop(0, '#00cc66');
        grad.addColorStop(1, '#00ff88');
      } else {
        grad.addColorStop(0, '#cc0033');
        grad.addColorStop(1, '#ff0044');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(W - 130, H - 28, fuelPct * 110, 14);
    }
    ctx.shadowBlur = 0;

    // --- Near-miss flash overlay ---
    if (nearMissFlash > 0) {
      ctx.globalAlpha = nearMissFlash * 0.15;
      ctx.fillStyle = '#ffff00';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    // --- Collect popup floating text ---
    if (collectPopup && collectPopup.life > 0) {
      ctx.globalAlpha = collectPopup.life;
      drawNeonText(collectPopup.text, collectPopup.x - 20, collectPopup.y - (1 - collectPopup.life) * 40, collectPopup.color, 16);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // --- HUD (outside shake) ---
    drawNeonText('TRAFFIC RACER', 10, 22, '#ff0066', 16);
    drawNeonText('[\u2190\u2192] Swipe Dodge | Collect \u26FD', 10, 40, '#666688', 10);
    drawNeonText('Score: ' + score, 10, 64, '#00ff88', 18);

    // Level indicator
    const lvl = Math.floor(difficulty * 10) + 1;
    drawNeonText('LV.' + lvl, W / 2 - 25, 24, '#ffaa00', 16);
    drawNeonText('Speed: ' + Math.floor(scrollSpeed), W / 2 - 35, 44, '#888899', 10);

    // Near-miss bonus indicator
    if (nearMissBonus > 0) {
      drawNeonText('NEAR MISS +' + nearMissBonus, 10, 84, '#ffff00', 14);
    }

    // Fuel label
    drawNeonText('FUEL', W - 130, H - 34, '#ffff00', 10);
  }

  function update(dt) {
    // Scroll
    roadOffset += scrollSpeed * dt;

    // Speed lines generation
    if (scrollSpeed > 280 && Math.random() < 0.3) {
      speedLines.push({
        x: Math.random() * W,
        y: -5,
        speed: scrollSpeed * 2,
        len: 15 + Math.random() * 30,
        color: Math.random() > 0.5 ? '#ffffff22' : '#00ffff11'
      });
    }
    for (let i = speedLines.length - 1; i >= 0; i--) {
      speedLines[i].y += speedLines[i].speed * dt;
      if (speedLines[i].y > H + 30) speedLines.splice(i, 1);
    }
    if (speedLines.length > 40) speedLines.splice(0, speedLines.length - 40);

    // Lane switching
    if (targetLane !== playerLane) {
      const targetX = LANE_CX[targetLane];
      playerX += (targetX - playerX) * 8 * dt;
      if (Math.abs(playerX - targetX) < 2) {
        playerX = targetX;
        playerLane = targetLane;
      }
    }

    // Input — hold-based lane switching
    if ((keys['ArrowLeft'] || touches.left) && targetLane > 0) {
      targetLane--;
      keys['ArrowLeft'] = false; touches.left = false;
      if (typeof window.playSfx === 'function') { try { window.playSfx('move'); } catch (e) {} }
    }
    if ((keys['ArrowRight'] || touches.right) && targetLane < LANES - 1) {
      targetLane++;
      keys['ArrowRight'] = false; touches.right = false;
      if (typeof window.playSfx === 'function') { try { window.playSfx('move'); } catch (e) {} }
    }

    // Fuel drain (scales with speed)
    fuel -= (6 + difficulty * 4) * dt;
    if (fuel <= 0) {
      fuel = 0;
      if (!gameOverSent) {
        gameOverSent = true;
        over = true;
        vibrate(200);
        spawnExplosion(playerX, playerY, '#ff0044', 30);
        if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
        if (typeof gameFX !== 'undefined') { try { var __r = canvas.getBoundingClientRect(); gameFX.burst(__r.left + (W/2) * __r.width / canvas.width, __r.top + (H/2) * __r.height / canvas.height, '#ff4444', 16); } catch(e){} gameFX.shake(5); }
      onGameOver(score, coins);
      }
      return;
    }

    // Score increases with distance
    score = Math.floor(roadOffset / 10);
    onScore(score);

    // Difficulty ramp
    difficulty = Math.min(score / 100, 1);
    scrollSpeed = (250 + difficulty * 200) * difficultyMult;
    levelDisplay = Math.floor(difficulty * 10) + 1;

    // Near-miss bonus timer decay
    if (nearMissFlash > 0) nearMissFlash -= dt * 3;
    if (nearMissBonus > 0) { nearMissBonus -= dt; if (nearMissBonus < 0) nearMissBonus = 0; }

    // Collect popup decay
    if (collectPopup) {
      collectPopup.life -= dt * 1.5;
      if (collectPopup.life <= 0) collectPopup = null;
    }

    // Spawn obstacles
    spawnTimer += dt;
    const spawnInterval = Math.max(0.4, 1.5 - difficulty * 1.1);
    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      const lane = Math.floor(Math.random() * LANES);
      const colors = ['#ff0044', '#ff6600', '#ff00ff', '#ffff00', '#ff3366', '#ff8800'];
      obstacles.push({
        x: LANE_CX[lane], y: -80,
        w: 45 + Math.random() * 10, h: 70 + Math.random() * 20,
        color: colors[Math.floor(Math.random() * colors.length)],
        speed: scrollSpeed * (0.2 + Math.random() * 0.3)
      });
    }

    // Spawn fuel
    fuelTimer += dt;
    if (fuelTimer >= Math.max(2.0, 3.5 - difficulty * 1.5)) {
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

    // Collision with obstacles (with near-miss detection)
    for (const o of obstacles) {
      const dx = Math.abs(playerX - o.x);
      const dy = Math.abs(playerY - o.y);
      const hitX = playerW / 2 + o.w / 2 - 8;
      const hitY = playerH / 2 + o.h / 2 - 8;
      if (dx < hitX && dy < hitY) {
        // Direct collision
        if (!gameOverSent) {
          gameOverSent = true;
          over = true;
          shakeTimer = 0.3;
          vibrate([50, 30, 100]);
          spawnExplosion(playerX, playerY, o.color, 35);
          spawnExplosion(o.x, o.y, '#ffaa00', 20);
          if (typeof window.playSfx === 'function') { try { window.playSfx('error'); } catch (e) {} }
          onGameOver(score, coins);
        }
        return;
      }
      // Near-miss detection (within 20px of collision)
      if (dx < hitX + 20 && dy < hitY && !o.nearMissed && o.y > playerY) {
        o.nearMissed = true;
        nearMissFlash = 1;
        nearMissBonus += 5;
        score += 5;
        vibrate(15);
        spawnExplosion((playerX + o.x) / 2, playerY - 20, '#ffff00', 6);
        spawnCollectText((playerX + o.x) / 2, playerY - 20, '+5 NEAR MISS', '#ffff00');
      }
    }

    // Collect fuel
    for (let i = fuelPacks.length - 1; i >= 0; i--) {
      const f = fuelPacks[i];
      const dx = Math.abs(playerX - f.x);
      const dy = Math.abs(playerY - f.y);
      if (dx < 35 && dy < 45) {
        fuel = Math.min(100, fuel + 25);
        coins += 5;
        vibrate(25);
        spawnExplosion(f.x, f.y, '#00ff88', 10);
        spawnCollectText(f.x, f.y, '+25 FUEL', '#00ff88');
        fuelPacks.splice(i, 1);
      }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 100 * dt;
      p.life -= dt * 2;
      if (p.life <= 0) particles.splice(i, 1);
    }
    if (particles.length > 200) particles.splice(0, particles.length - 200);

    // Shake decay
    if (shakeTimer > 0) shakeTimer -= dt;

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
    } else {
      // Final frame with explosion lingering
      draw();
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
    setInput: function(t, k) { touches = t || {}; keys = k || {}; },
    setDifficulty: function(level) {
      const m = [1.0, 1.15, 1.3, 1.5, 1.75, 2.0];
      const l = Math.max(0, Math.min(5, Math.floor(level) || 0));
      difficultyMult = m[l];
    }
  };
}
