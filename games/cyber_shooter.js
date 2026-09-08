/* ============================================================
   Cyber Shooter — Professional Space Shooter
   Canvas 800x450, vertical scrolling, auto-fire, waves + bosses
   Controls: JOYSTICK move (4-dir), AUTO FIRE
   Features: Level/wave progression, powerups, boss battles, canvas HUD
   ============================================================ */
function cyberShooter(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false;
  let score = 0, coins = 0;
  let over = false;

  const P = { x: W / 2 - 20, y: H - 70, w: 40, h: 44, speed: 320 };
  let lives = 3;
  let fireTimer = 0;
  const FIRE_INTERVAL = 0.15;

  let bullets = [];
  let enemyBullets = [];
  let enemies = [];
  let wave = 0;
  let enemiesPerWave = 10;
  let enemiesSpawned = 0;
  let waveActive = false;
  let waveDelay = 0;
  let boss = null;
  let bossActive = false;
  let pickups = [];

  let stars = [];
  for (let i = 0; i < 100; i++) {
    stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 2 + 0.5, sp: Math.random() * 80 + 30 });
  }

  let enemySpeed = 100;
  let enemyFireRate = 2.0;

  let touches = { left: false, right: false, up: false, down: false };
  let keys = {};

  // particles: explosions, trails, hit sparks
  let particles = [];

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
  function drawText(text, x, y, size = 14, color = '#00FFFF', align = 'left') {
    ctx.font = `bold ${size}px 'Space Grotesk', sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.shadowBlur = 8;
    ctx.shadowColor = color;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
  }

  function reset() {
    score = 0; coins = 0; over = false;
    lives = 3;
    fireTimer = 0;
    bullets = []; enemyBullets = []; enemies = [];
    wave = 0; enemiesSpawned = 0; waveActive = false; waveDelay = 1.5;
    boss = null; bossActive = false;
    pickups = [];
    enemySpeed = 100; enemyFireRate = 2.0;
    P.x = W / 2 - 20; P.y = H - 70;
    particles = [];
  }

  function spawnEnemy() {
    const w = 36 + Math.random() * 12;
    const h = 36 + Math.random() * 12;
    const x = Math.random() * (W - w - 40) + 20;
    const colors = ['#FF10F0', '#FFE600', '#39FF88', '#FF4444', '#AA88FF', '#00FFFF'];
    enemies.push({
      x, y: -h, w, h,
      color: colors[Math.floor(Math.random() * colors.length)],
      hp: 1 + Math.floor(wave / 3),
      speed: enemySpeed * (0.8 + Math.random() * 0.5),
      fireTimer: Math.random() * enemyFireRate,
      movePattern: Math.floor(Math.random() * 4)
    });
  }

  function spawnBoss() {
    bossActive = true;
    boss = {
      x: W / 2 - 60, y: -100, w: 120, h: 80,
      hp: 20 + wave * 8, maxHp: 20 + wave * 8,
      speed: 50 + wave * 8,
      fireTimer: 0, targetY: 60, moveDir: 1,
      phase: 1
    };
  }

  function spawnPickup(x, y) {
    const isPowerup = Math.random() < 0.2;
    pickups.push({ x, y, w: 18, h: 18, type: isPowerup ? 'powerup' : 'coin', speed: 80 });
  }

  function startWave() {
    wave++;
    enemiesSpawned = 0;
    enemiesPerWave = 8 + Math.floor(wave * 1.2);
    waveActive = true;
    spawnTimer = 0;
    enemySpeed = Math.min(350, 100 + wave * 18);
    enemyFireRate = Math.max(0.6, 2.0 - wave * 0.1);
    if (wave % 4 === 0) spawnBoss();
  }

  function spawnExplosion(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 150 + Math.random() * 300;
      particles.push({
        x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        r: 2 + Math.random() * 4, color: color || ['#FF10F0', '#00FFFF', '#FFE600'][Math.floor(Math.random() * 3)],
        life: 0.4 + Math.random() * 0.4, maxLife: 0.8, fade: true
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }
  function renderParticles() {
    for (const p of particles) {
      ctx.globalAlpha = p.fade ? (p.life / p.maxLife) : 1;
      circle(p.x, p.y, p.r, p.color, 16);
    }
    ctx.globalAlpha = 1;
  }

  function update(dt) {
    if (over || !running) return;

    if (!waveActive && !bossActive) {
      waveDelay -= dt;
      if (waveDelay <= 0) startWave();
    }

    // player movement (joystick 4-dir)
    if (touches.left || keys.ArrowLeft || keys.KeyA) P.x -= P.speed * dt;
    if (touches.right || keys.ArrowRight || keys.KeyD) P.x += P.speed * dt;
    if (touches.up || keys.ArrowUp || keys.KeyW) P.y -= P.speed * dt * 0.7;
    if (touches.down || keys.ArrowDown || keys.KeyS) P.y += P.speed * dt * 0.7;
    P.x = Math.max(10, Math.min(W - P.w - 10, P.x));
    P.y = Math.max(H * 0.25, Math.min(H - P.h - 10, P.y));

    // auto-fire
    fireTimer -= dt;
    if (fireTimer <= 0) {
      bullets.push({ x: P.x + P.w / 2 - 3, y: P.y - 10, w: 6, h: 14, speed: 700 });
      fireTimer = FIRE_INTERVAL;
    }

    for (const b of bullets) b.y -= b.speed * dt;
    bullets = bullets.filter(b => b.y > -20);

    for (const b of enemyBullets) { b.y += b.speed * dt; if (b.vx) b.x += b.vx * dt; }
    enemyBullets = enemyBullets.filter(b => b.y < H + 20 && b.x > -20 && b.x < W + 20);

    if (waveActive && enemiesSpawned < enemiesPerWave) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) { spawnEnemy(); enemiesSpawned++; spawnTimer = Math.max(0.15, 0.7 - wave * 0.03); }
    }
    if (waveActive && enemiesSpawned >= enemiesPerWave && enemies.length === 0 && !bossActive) {
      waveActive = false; waveDelay = 1.5;
    }

    // enemies
    for (const e of enemies) {
      e.y += e.speed * dt;
      if (e.movePattern === 1) e.x += Math.sin(e.y * 0.02) * 100 * dt;
      else if (e.movePattern === 2) e.x += (Math.sin(e.y * 0.015) > 0 ? 1 : -1) * 120 * dt;
      else if (e.movePattern === 3) { e.x += Math.cos(e.y * 0.01) * 80 * dt; }
      e.x = Math.max(5, Math.min(W - e.w - 5, e.x));
      e.fireTimer -= dt;
      if (e.fireTimer <= 0 && e.y > 0) {
        enemyBullets.push({ x: e.x + e.w / 2 - 3, y: e.y + e.h, w: 6, h: 10, speed: 250 + wave * 12 });
        e.fireTimer = enemyFireRate * (0.7 + Math.random() * 0.5);
      }
    }
    enemies = enemies.filter(e => e.y < H + 60);

    // boss
    if (bossActive && boss) {
      if (boss.y < boss.targetY) boss.y += 120 * dt;
      else {
        boss.x += boss.speed * boss.moveDir * dt;
        if (boss.x <= 30) boss.moveDir = 1;
        if (boss.x >= W - boss.w - 30) boss.moveDir = -1;
      }
      boss.fireTimer -= dt;
      if (boss.fireTimer <= 0 && boss.y >= boss.targetY - 10) {
        // multi-phase attack patterns
        if (boss.phase === 1) {
          for (let i = -3; i <= 3; i++) enemyBullets.push({ x: boss.x + boss.w / 2 - 3, y: boss.y + boss.h, w: 6, h: 10, speed: 220, vx: i * 35 });
        } else if (boss.phase === 2) {
          for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2;
            enemyBullets.push({ x: boss.x + boss.w / 2, y: boss.y + boss.h, w: 8, h: 8, speed: 180, vx: Math.cos(ang) * 80, vy: Math.sin(ang) * 80 });
          }
          boss.phase = 3;
        } else {
          enemyBullets.push({ x: boss.x + boss.w / 2 - 3, y: boss.y + boss.h, w: 10, h: 18, speed: 200 });
          boss.phase = 1;
        }
        boss.fireTimer = Math.max(0.5, 1.5 - wave * 0.05);
      }
    }
    for (const b of enemyBullets) if (b.vx) b.x += b.vx * dt;

    // bullet-enemy collisions
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      for (let ei = enemies.length - 1; ei >= 0; ei--) {
        const e = enemies[ei];
        if (b.x < e.x + e.w && b.x + b.w > e.x && b.y < e.y + e.h && b.y + b.h > e.y) {
          e.hp -= 1; bullets.splice(bi, 1);
          if (e.hp <= 0) {
            score += 100 * wave; onScore(score);
            spawnExplosion(e.x + e.w / 2, e.y + e.h / 2, e.color, 10);
            enemies.splice(ei, 1); spawnPickup(e.x + e.w / 2, e.y + e.h / 2);
          }
          break;
        }
      }
    }
    if (bossActive && boss) {
      for (let bi = bullets.length - 1; bi >= 0; bi--) {
        const b = bullets[bi];
        if (b.x < boss.x + boss.w && b.x + b.w > boss.x && b.y < boss.y + boss.h && b.y + b.h > boss.y) {
          boss.hp -= 1; bullets.splice(bi, 1);
          if (boss.hp <= 0) {
            score += 2000 * wave; onScore(score);
            spawnExplosion(boss.x + boss.w / 2, boss.y + boss.h / 2, '#FF10F0', 40);
            for (let c = 0; c < 8; c++) spawnPickup(boss.x + boss.w / 2 + (c - 3.5) * 20, boss.y + boss.h / 2);
            boss = null; bossActive = false; waveActive = false; waveDelay = 2.0;
          }
        }
      }
    }

    // enemy bullet / enemy collision
    for (let bi = enemyBullets.length - 1; bi >= 0; bi--) {
      const b = enemyBullets[bi];
      if (b.x < P.x + P.w && b.x + b.w > P.x && b.y < P.y + P.h && b.y + b.h > P.y) {
        enemyBullets.splice(bi, 1); lives--;
        spawnExplosion(P.x + P.w / 2, P.y + P.h / 2, '#FF4444', 8);
        if (navigator.vibrate) navigator.vibrate(80);
        if (lives <= 0) { gameOver(); return; }
      }
    }
    // enemy collision
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      if (P.x < e.x + e.w && P.x + P.w > e.x && P.y < e.y + e.h && P.y + P.h > e.y) {
        enemies.splice(ei, 1); score += 50 * wave; onScore(score);
        spawnExplosion(e.x + e.w / 2, e.y + e.h / 2, '#FF4444', 12);
        lives--; if (navigator.vibrate) navigator.vibrate(120);
        if (lives <= 0) { gameOver(); return; }
      }
    }
    if (bossActive && boss && P.x < boss.x + boss.w && P.x + P.w > boss.x && P.y < boss.y + boss.h && P.y + P.h > boss.y) { gameOver(); return; }

    // pickups
    for (let pi = pickups.length - 1; pi >= 0; pi--) {
      const p = pickups[pi];
      p.y += p.speed * dt;
      if (p.y > H + 30) { pickups.splice(pi, 1); continue; }
      if (P.x < p.x + p.w && P.x + P.w > p.x && P.y < p.y + p.h && P.y + P.h > p.y) {
        if (p.type === 'coin') { coins += 15; onCoins(15); }
        else { p.active = true; p.activeTimer = 5; }
        pickups.splice(pi, 1);
      }
    }
    pickups = pickups.filter(p => !p.active || (p.activeTimer && p.activeTimer > 0));

    // stars
    for (const s of stars) { s.y += s.sp * dt; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } }
    updateParticles(dt);
  }

  function render() {
    ctx.fillStyle = '#05070A'; ctx.fillRect(0, 0, W, H);
    for (const s of stars) { ctx.fillStyle = `rgba(0,255,255,${0.4 + 0.3 * Math.sin(performance.now()*0.001 + s.x)})`; ctx.fillRect(s.x, s.y, s.s, s.s); }

    // HUD on canvas
    drawText('CYBER SHOOTER', 12, 28, 18, '#FF10F0');
    drawText(`WAVE ${wave}`, 12, 52, 14, '#FFE600');
    drawText(`LIVES ${lives}`, W - 12, 28, 14, '#FF4444', 'right');
    drawText(`${Math.floor(score).toLocaleString()}`, W - 12, 52, 14, '#FFFFFF', 'right');

    for (const b of bullets) { rect(b.x, b.y, b.w, b.h, '#00FFFF', 12); ctx.fillStyle = 'rgba(0,255,255,0.3)'; ctx.fillRect(b.x + 1, b.y + b.h, b.w - 2, 10); }
    for (const b of enemyBullets) rect(b.x, b.y, b.w, b.h, '#FF10F0', 10);

    for (const e of enemies) {
      ctx.shadowBlur = 12; ctx.shadowColor = e.color; ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(e.x + e.w / 2, e.y);
      ctx.lineTo(e.x + e.w, e.y + e.h / 2);
      ctx.lineTo(e.x + e.w / 2, e.y + e.h);
      ctx.lineTo(e.x, e.y + e.h / 2);
      ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    }

    if (bossActive && boss) {
      ctx.shadowBlur = 20; ctx.shadowColor = '#FF10F0'; ctx.fillStyle = '#CC20FF';
      ctx.beginPath();
      ctx.moveTo(boss.x + boss.w / 2, boss.y);
      ctx.lineTo(boss.x + boss.w, boss.y + boss.h * 0.4);
      ctx.lineTo(boss.x + boss.w - 10, boss.y + boss.h);
      ctx.lineTo(boss.x + 10, boss.y + boss.h);
      ctx.lineTo(boss.x, boss.y + boss.h * 0.4);
      ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
      // eye
      ctx.fillStyle = '#FFE600'; ctx.shadowBlur = 14; ctx.shadowColor = '#FFE600';
      ctx.beginPath(); ctx.arc(boss.x + boss.w / 2, boss.y + boss.h * 0.35, 14, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      // health bar
      const hpRatio = boss.hp / boss.maxHp;
      const barW = boss.w + 30, barH = 8, barX = boss.x + boss.w / 2 - barW / 2, barY = boss.y - 18;
      ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = hpRatio > 0.5 ? '#39FF88' : hpRatio > 0.25 ? '#FFE600' : '#FF4444';
      ctx.shadowBlur = 8; ctx.shadowColor = ctx.fillStyle; ctx.fillRect(barX, barY, barW * hpRatio, barH); ctx.shadowBlur = 0;
    }

    for (const p of pickups) {
      if (p.type === 'coin') { circle(p.x + p.w / 2, p.y + p.h / 2, p.w / 2, '#FFE600', 14); }
      else { rect(p.x, p.y, p.w, p.h, '#39FF88', 18); ctx.fillStyle = '#FFF'; ctx.font = 'bold 10px monospace'; ctx.fillText('P', p.x + 4, p.y + 13); }
    }

    // player ship
    ctx.shadowBlur = 16; ctx.shadowColor = '#00FFFF'; ctx.fillStyle = '#00E5FF';
    ctx.beginPath();
    ctx.moveTo(P.x + P.w / 2, P.y);
    ctx.lineTo(P.x + P.w, P.y + P.h);
    ctx.lineTo(P.x + P.w / 2, P.y + P.h - 8);
    ctx.lineTo(P.x, P.y + P.h); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#FFE600'; ctx.shadowBlur = 8; ctx.shadowColor = '#FFE600';
    ctx.beginPath(); ctx.arc(P.x + P.w / 2, P.y + P.h * 0.45, 6, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#FF10F0'; ctx.shadowBlur = 12; ctx.shadowColor = '#FF10F0';
    const flameH = 12 + Math.sin(performance.now() * 0.012) * 8;
    ctx.beginPath(); ctx.moveTo(P.x + P.w / 2 - 8, P.y + P.h); ctx.lineTo(P.x + P.w / 2, P.y + P.h + flameH); ctx.lineTo(P.x + P.w / 2 + 8, P.y + P.h); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;

    renderParticles();
  }

  function loop(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts; update(dt); render(); raf = requestAnimationFrame(loop);
  }

  function gameOver() {
    over = true; running = false; if (raf) cancelAnimationFrame(raf);
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    onGameOver(Math.floor(score), coins);
  }

  return {
    start() { reset(); running = true; last = performance.now(); raf = requestAnimationFrame(loop); },
    pause() { running = false; if (raf) cancelAnimationFrame(raf); },
    resume() { if (over || running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); },
    destroy() { running = false; if (raf) cancelAnimationFrame(raf); },
    setInput(t, k) { touches = t || {}; keys = k || {}; },
    controls: { joystick: true, boost: false, action: false, drift: false }
  };
}