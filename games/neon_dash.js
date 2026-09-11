function neonDash(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, overSent = false;
  let score = 0, coins = 0, keys = {}, touches = {};
  let player = { x: 100, y: 300, w: 30, h: 30, vy: 0, onGround: true };
  let obstacles = [];
  let scrollSpeed = 300;
  let spawnTimer = 0;
  let gameSpeed = 1;
  let difficultyMult = 1;   // v7.18 difficulty ramp
  let particles = [], dust = [], flashT = 0, shakeT = 0, time = 0;
  let speedLines = [];
  const GROUND = 330;

  function reset() {
    player = { x: 100, y: GROUND - 30, w: 30, h: 30, vy: 0, onGround: true };
    obstacles = [];
    scrollSpeed = 300;
    spawnTimer = 0;
    gameSpeed = 1;
    score = 0;
    coins = 0;
    over = false;
    overSent = false;
    particles = [];
    dust = [];
    flashT = 0;
    shakeT = 0;
    time = 0;
    speedLines = [];
    if (typeof onScore === 'function') onScore(0);
  }

  function vibrate(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {}
  }

  function burst(x, y, color, n, spd, life) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (spd || 160) * (0.4 + Math.random() * 0.8);
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40,
        life: (life || 0.5) * (0.6 + Math.random() * 0.7),
        maxLife: life || 0.5,
        color: color, size: 2 + Math.random() * 3
      });
    }
  }

  function spawnObstacle() {
    const type = Math.random() < 0.5 ? 'block' : 'spike';
    // taller blocks spawn more often at higher speed → harder jumps
    const h = type === 'block' ? (50 + Math.random() * 70) + Math.min(60, score * 0.3) : 40;
    obstacles.push({
      x: W + 50,
      y: GROUND - h,
      w: 40,
      h: h,
      type: type,
      passed: false
    });
  }

  function addDust() {
    dust.push({ x: player.x + player.w / 2 + (Math.random() - 0.5) * 10, y: GROUND, vx: -60 - Math.random() * 40, vy: -20 - Math.random() * 40, life: 0.4, maxLife: 0.4, size: 2 + Math.random() * 2.5 });
    if (dust.length > 40) dust.splice(0, dust.length - 40);
  }

  function levelOf() { return Math.floor(score / 150) + 1; }

  function update(dt) {
    if (over) return;
    time = time + dt;
    if (flashT > 0) flashT = flashT - dt;
    if (shakeT > 0) shakeT = shakeT - dt;

    const anyJump = keys.ArrowUp || keys.KeyW || keys.Space || touches.up || touches.gas || touches.action;
    const jumpPressed = anyJump;

    if (jumpPressed && player.onGround) {
      player.vy = -550;
      player.onGround = false;
      burst(player.x + player.w / 2, GROUND, '#3bc9ff', 12, 150, 0.45);
      vibrate(8);
    }

    player.vy += 1400 * dt;
    player.y += player.vy * dt;

    if (player.y >= GROUND - player.h) {
      if (!player.onGround) { addDust(); burst(player.x + player.w / 2, GROUND, '#4dff88', 8, 120, 0.4); }
      player.y = GROUND - player.h;
      player.vy = 0;
      player.onGround = true;
    }

    spawnTimer -= dt * gameSpeed;
    if (spawnTimer <= 0) {
      spawnObstacle();
      spawnTimer = Math.max(0.55, (1.2 + Math.random() * 1.0) / gameSpeed);
    }

    // speed lines at higher speed
    if (gameSpeed > 1.3 && Math.random() < (gameSpeed - 1.2) * 0.5) {
      speedLines.push({ x: W + 20, y: Math.random() * H, len: 30 + Math.random() * 60, life: 0.3, maxLife: 0.3 });
      if (speedLines.length > 40) speedLines.splice(0, speedLines.length - 40);
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.x -= scrollSpeed * dt * gameSpeed;

      if (!obs.passed && obs.x + obs.w < player.x) {
        obs.passed = true;
        score += 10;
        if (typeof onScore === 'function') onScore(score);
        if (typeof window.playSfx === 'function') { try { window.playSfx('click'); } catch (e) {} }
        if (score % 100 === 0) {
          coins += 1;
          if (typeof onCoins === 'function') onCoins(coins);
        }
        // level-up burst
        const lv = levelOf();
        if (score % 150 === 0) {
          burst(player.x + player.w / 2, player.y + player.h / 2, '#ffd93b', 24, 260, 0.7);
          vibrate([40, 30, 40]);
          if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
        }
        gameSpeed = (1 + score * 0.002) * difficultyMult;
      }

      if (player.x < obs.x + obs.w &&
          player.x + player.w > obs.x &&
          player.y < obs.y + obs.h &&
          player.y + player.h > obs.y) {
        burst(player.x + player.w / 2, player.y + player.h / 2, '#ff4d5e', 26, 280, 0.6);
        shakeT = 0.3;
        vibrate(120);
        if (typeof window.playSfx === 'function') { try { window.playSfx('error'); } catch (e) {} }
        over = true;
        callGameOver();
        return;
      }

      if (obs.x + obs.w < 0) {
        obstacles.splice(i, 1);
      }
    }

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 300 * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = dust.length - 1; i >= 0; i--) {
      const d = dust[i];
      d.x += d.vx * dt; d.y += d.vy * dt;
      d.life -= dt;
      if (d.life <= 0) dust.splice(i, 1);
    }
    for (let i = speedLines.length - 1; i >= 0; i--) {
      const s = speedLines[i];
      s.x -= scrollSpeed * dt * gameSpeed;
      s.life -= dt;
      if (s.life <= 0) speedLines.splice(i, 1);
    }
  }

  function callGameOver() {
    if (overSent) return;
    overSent = true;
    if (typeof onScore === 'function') onScore(score);
    if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
    if (typeof onGameOver === 'function') onGameOver(score, coins);
  }

  function draw() {
    const ox = shakeT > 0 ? (Math.random() - 0.5) * 10 : 0;
    const oy = shakeT > 0 ? (Math.random() - 0.5) * 8 : 0;
    ctx.save();
    ctx.translate(ox, oy);

    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, W, H);

    // ground
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, GROUND);
    ctx.lineTo(W, GROUND);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // speed lines
    for (const s of speedLines) {
      const a = (s.life / s.maxLife) * 0.5;
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#7df9ff';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + s.len, s.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // player (neon, with glow pulse)
    const pulse = 1 + Math.sin(time * 10) * 0.15;
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 15 * pulse;
    ctx.fillRect(player.x, player.y, player.w, player.h);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(player.x + 5, player.y + 5, player.w - 10, 4);
    ctx.shadowBlur = 0;

    for (const obs of obstacles) {
      if (obs.type === 'block') {
        ctx.fillStyle = '#ff00ff';
        ctx.shadowColor = '#ff00ff';
        ctx.shadowBlur = 12;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        // danger stripes on block
        ctx.fillStyle = 'rgba(10,10,18,0.6)';
        for (let yy = obs.y + 8; yy < obs.y + obs.h; yy += 16) ctx.fillRect(obs.x, yy, obs.w, 5);
        ctx.shadowBlur = 0;
      } else {
        // spike
        ctx.fillStyle = '#ffff00';
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y + obs.h);
        ctx.lineTo(obs.x + obs.w / 2, obs.y);
        ctx.lineTo(obs.x + obs.w, obs.y + obs.h);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // dust
    for (const d of dust) {
      const a = (d.life / d.maxLife) * 0.5;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#4dff88';
      ctx.fillRect(d.x, d.y, d.size, d.size);
    }
    ctx.globalAlpha = 1;

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

    // flash on hit
    if (flashT > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (flashT * 1.5) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    // HUD
    const lv = levelOf();
    ctx.fillStyle = '#00ffff';
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 5;
    ctx.fillText('NEON DASH', 10, 20);
    ctx.shadowBlur = 0;
    ctx.font = '10px "Courier New", monospace';
    ctx.fillStyle = '#8a93b8';
    ctx.fillText('HOLD [SPACE/UP] TO JUMP — DODGE THE OBSTACLES', 10, 36);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd93b';
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.shadowColor = '#ffd93b'; ctx.shadowBlur = 6;
    ctx.fillText('SCORE ' + score, W - 10, 20);
    ctx.fillStyle = '#3bff8f';
    ctx.fillText('LV ' + lv, W - 10, 38);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';

    // speed meter
    const spFrac = Math.min(1, gameSpeed / 3);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(10, H - 14, 120, 6);
    ctx.fillStyle = spFrac > 0.75 ? '#ff4d5e' : spFrac > 0.5 ? '#ffd93b' : '#3bc9ff';
    ctx.fillRect(10, H - 14, 120 * spFrac, 6);

    // game over canvas overlay (screen flash + text before core overlay appears)
    if (over) {
      ctx.fillStyle = 'rgba(4,4,10,0.72)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff4d5e';
      ctx.font = 'bold 42px "Courier New", monospace';
      ctx.shadowColor = '#ff4d5e'; ctx.shadowBlur = 14;
      ctx.fillText('CRASHED!', W / 2, 190);
      ctx.fillStyle = '#ffd93b';
      ctx.font = 'bold 20px "Courier New", monospace';
      ctx.fillText('SCORE ' + score, W / 2, 230);
      ctx.fillStyle = '#3bff8f';
      ctx.font = '14px "Courier New", monospace';
      ctx.fillText('COINS +' + coins, W / 2, 258);
      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
    }

    ctx.restore();
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

  function pause() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function resume() {
    if (!over && !running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }

  function destroy() {
    running = false;
    over = true;
    cancelAnimationFrame(raf);
  }

  return {
    start: start,
    pause: pause,
    resume: resume,
    destroy: destroy,
    setInput: (t, k) => { touches = t || {}; keys = k || {}; },
    setDifficulty(level) {
      const m = [1.0, 1.15, 1.3, 1.5, 1.75, 2.0];
      const l = Math.max(0, Math.min(5, Math.floor(level) || 0));
      difficultyMult = m[l];
    }
  };
}