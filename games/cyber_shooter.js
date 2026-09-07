/* ============================================================
   Cyber Shooter — Space Shooter Arcade Game
   Canvas 800x450, vertical scrolling shooter
   Auto-fire, wave-based enemies, boss waves, 3 lives
   ============================================================ */
function cyberShooter(canvas, ctx, onScore, onGameOver, onCoins) {
  // ---- state ----
  const W = 800, H = 450;
  let raf = null, last = 0, running = false;
  let score = 0, coins = 0;
  let over = false;

  // player
  const P = { x: W / 2 - 20, y: H - 70, w: 40, h: 44, speed: 320 };
  let lives = 3;
  let fireTimer = 0;
  const FIRE_INTERVAL = 0.2; // 200ms

  // bullets
  let bullets = [];
  let enemyBullets = [];

  // enemies
  let enemies = [];
  let wave = 0;
  let enemiesPerWave = 10;
  let enemiesSpawned = 0;
  let waveActive = false;
  let waveDelay = 0;

  // boss
  let boss = null;
  let bossActive = false;

  // pickups (coins + powerups)
  let pickups = [];

  // stars (background)
  let stars = [];
  for (let i = 0; i < 80; i++) {
    stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 2 + 0.5, sp: Math.random() * 60 + 20 });
  }

  // spawn timer
  let spawnTimer = 0;

  // difficulty scaling
  let enemySpeed = 120;
  let enemyFireRate = 2.5; // seconds between enemy shots

  // input (set by core)
  let touches = { left: false, right: false, up: false, down: false, action: false, boost: false, drift: false };
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
    lives = 3;
    fireTimer = 0;
    bullets = [];
    enemyBullets = [];
    enemies = [];
    wave = 0;
    enemiesSpawned = 0;
    waveActive = false;
    waveDelay = 1.5;
    boss = null;
    bossActive = false;
    pickups = [];
    spawnTimer = 0;
    enemySpeed = 120;
    enemyFireRate = 2.5;
    P.x = W / 2 - 20;
    P.y = H - 70;
  }

  // ---- spawn ----
  function spawnEnemy() {
    const w = 36 + Math.random() * 12;
    const h = 36 + Math.random() * 12;
    const x = Math.random() * (W - w - 40) + 20;
    const colors = ['#FF10F0', '#FFE600', '#39FF88', '#FF4444', '#AA88FF'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    enemies.push({
      x: x, y: -h, w: w, h: h,
      color: color,
      hp: 1,
      speed: enemySpeed * (0.8 + Math.random() * 0.4),
      fireTimer: Math.random() * enemyFireRate,
      movePattern: Math.floor(Math.random() * 3) // 0=straight, 1=sine, 2=zigzag
    });
  }

  function spawnBoss() {
    bossActive = true;
    boss = {
      x: W / 2 - 50, y: -80, w: 100, h: 70,
      hp: 15 + wave * 5,
      maxHp: 15 + wave * 5,
      speed: 60 + wave * 10,
      fireTimer: 0,
      targetY: 50,
      moveDir: 1
    };
  }

  function spawnPickup(x, y) {
    const isPowerup = Math.random() < 0.25;
    pickups.push({
      x: x, y: y, w: 18, h: 18,
      type: isPowerup ? 'powerup' : 'coin',
      speed: 80
    });
  }

  function startWave() {
    wave++;
    enemiesSpawned = 0;
    enemiesPerWave = 10 + Math.floor(wave * 1.5);
    waveActive = true;
    spawnTimer = 0;
    // increase difficulty each wave
    enemySpeed = 120 + wave * 15;
    enemyFireRate = Math.max(0.8, 2.5 - wave * 0.12);
    // boss waves
    if (wave % 5 === 0) {
      spawnBoss();
    }
  }

  // ---- update ----
  function update(dt) {
    if (over || !running) return;

    // wave management
    if (!waveActive && !bossActive) {
      waveDelay -= dt;
      if (waveDelay <= 0) {
        startWave();
      }
    }

    // player movement
    if (touches.left || keys.ArrowLeft || keys.KeyA) {
      P.x -= P.speed * dt;
    }
    if (touches.right || keys.ArrowRight || keys.KeyD) {
      P.x += P.speed * dt;
    }
    if (touches.up || keys.ArrowUp || keys.KeyW) {
      P.y -= P.speed * dt * 0.6;
    }
    if (touches.down || keys.ArrowDown || keys.KeyS) {
      P.y += P.speed * dt * 0.6;
    }
    // clamp player
    P.x = Math.max(10, Math.min(W - P.w - 10, P.x));
    P.y = Math.max(H * 0.3, Math.min(H - P.h - 10, P.y));

    // auto-fire bullets
    fireTimer -= dt;
    if (fireTimer <= 0) {
      bullets.push({ x: P.x + P.w / 2 - 3, y: P.y - 10, w: 6, h: 14, speed: 600 });
      // double shot if powerup
      if (pickups.some(p => p.type === 'powerup' && p.active)) {
        bullets.push({ x: P.x - 4, y: P.y + 5, w: 6, h: 14, speed: 600 });
        bullets.push({ x: P.x + P.w - 2, y: P.y + 5, w: 6, h: 14, speed: 600 });
      }
      fireTimer = FIRE_INTERVAL;
    }

    // move bullets
    for (const b of bullets) b.y -= b.speed * dt;
    bullets = bullets.filter(b => b.y > -20);

    // move enemy bullets
    for (const b of enemyBullets) b.y += b.speed * dt;
    enemyBullets = enemyBullets.filter(b => b.y < H + 20);

    // spawn wave enemies
    if (waveActive && enemiesSpawned < enemiesPerWave) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnEnemy();
        enemiesSpawned++;
        spawnTimer = Math.max(0.2, 0.8 - wave * 0.04);
      }
    }

    // check if wave cleared
    if (waveActive && enemiesSpawned >= enemiesPerWave && enemies.length === 0 && !bossActive) {
      waveActive = false;
      waveDelay = 2.0;
    }

    // move enemies
    for (const e of enemies) {
      e.y += e.speed * dt;
      // sine movement
      if (e.movePattern === 1) {
        e.x += Math.sin(e.y * 0.02) * 80 * dt;
      } else if (e.movePattern === 2) {
        e.x += (Math.sin(e.y * 0.015) > 0 ? 1 : -1) * 100 * dt;
      }
      e.x = Math.max(5, Math.min(W - e.w - 5, e.x));
      // enemy fires
      e.fireTimer -= dt;
      if (e.fireTimer <= 0 && e.y > 0) {
        enemyBullets.push({ x: e.x + e.w / 2 - 3, y: e.y + e.h, w: 6, h: 10, speed: 250 + wave * 10 });
        e.fireTimer = enemyFireRate * (0.8 + Math.random() * 0.4);
      }
    }
    enemies = enemies.filter(e => e.y < H + 60);

    // boss movement + fire
    if (bossActive && boss) {
      if (boss.y < boss.targetY) {
        boss.y += 100 * dt;
      } else {
        boss.x += boss.speed * boss.moveDir * dt;
        if (boss.x <= 20) boss.moveDir = 1;
        if (boss.x >= W - boss.w - 20) boss.moveDir = -1;
      }
      // boss fires pattern
      boss.fireTimer -= dt;
      if (boss.fireTimer <= 0 && boss.y >= boss.targetY - 5) {
        // spread shot
        for (let i = -2; i <= 2; i++) {
          enemyBullets.push({
            x: boss.x + boss.w / 2 - 3,
            y: boss.y + boss.h,
            w: 6, h: 10,
            speed: 200 + wave * 8,
            vx: i * 40
          });
        }
        boss.fireTimer = Math.max(0.4, 1.2 - wave * 0.04);
      }
    }
    // move boss bullets with vx
    for (const b of enemyBullets) {
      if (b.vx) b.x += b.vx * dt;
    }

    // bullet-enemy collisions
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      for (let ei = enemies.length - 1; ei >= 0; ei--) {
        const e = enemies[ei];
        if (b.x < e.x + e.w && b.x + b.w > e.x && b.y < e.y + e.h && b.y + b.h > e.y) {
          e.hp -= 1;
          bullets.splice(bi, 1);
          if (e.hp <= 0) {
            score += 100;
            onScore(score);
            enemies.splice(ei, 1);
            spawnPickup(e.x + e.w / 2, e.y + e.h / 2);
          }
          break;
        }
      }
    }

    // bullet-boss collisions
    if (bossActive && boss) {
      for (let bi = bullets.length - 1; bi >= 0; bi--) {
        const b = bullets[bi];
        if (b.x < boss.x + boss.w && b.x + b.w > boss.x && b.y < boss.y + boss.h && b.y + b.h > boss.y) {
          boss.hp -= 1;
          bullets.splice(bi, 1);
          if (boss.hp <= 0) {
            score += 1000;
            onScore(score);
            // drop multiple coins
            for (let c = 0; c < 5; c++) {
              spawnPickup(boss.x + boss.w / 2 + (c - 2) * 15, boss.y + boss.h / 2);
            }
            boss = null;
            bossActive = false;
            waveActive = false;
            waveDelay = 3.0;
          }
        }
      }
    }

    // enemy bullet-player collision
    for (let bi = enemyBullets.length - 1; bi >= 0; bi--) {
      const b = enemyBullets[bi];
      if (b.x < P.x + P.w && b.x + b.w > P.x && b.y < P.y + P.h && b.y + b.h > P.y) {
        enemyBullets.splice(bi, 1);
        lives--;
        if (navigator.vibrate) { try { navigator.vibrate(150); } catch (e) {} }
        if (lives <= 0) {
          gameOver();
          return;
        }
      }
    }

    // enemy-player collision
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      if (P.x < e.x + e.w && P.x + P.w > e.x && P.y < e.y + e.h && P.y + P.h > e.y) {
        enemies.splice(ei, 1);
        score += 100;
        onScore(score);
        lives--;
        if (navigator.vibrate) { try { navigator.vibrate(200); } catch (e) {} }
        if (lives <= 0) {
          gameOver();
          return;
        }
      }
    }

    // boss-player collision
    if (bossActive && boss) {
      if (P.x < boss.x + boss.w && P.x + P.w > boss.x && P.y < boss.y + boss.h && P.y + P.h > boss.y) {
        lives = 0;
        gameOver();
        return;
      }
    }

    // pickups
    for (let pi = pickups.length - 1; pi >= 0; pi--) {
      const p = pickups[pi];
      p.y += p.speed * dt;
      if (p.y > H + 30) {
        pickups.splice(pi, 1);
        continue;
      }
      // player pickup collision
      if (P.x < p.x + p.w && P.x + P.w > p.x && P.y < p.y + p.h && P.y + P.h > p.y) {
        if (p.type === 'coin') {
          coins += 10;
          onCoins(10);
        } else {
          // powerup: mark active for 5 seconds
          p.active = true;
          p.activeTimer = 5;
        }
        pickups.splice(pi, 1);
      }
    }

    // remove expired powerups from the tracking
    pickups = pickups.filter(p => !p.active || (p.activeTimer > 0));

    // scroll stars
    for (const s of stars) {
      s.y += s.sp * dt;
      if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
    }
  }

  // ---- render ----
  function render() {
    // bg
    ctx.fillStyle = '#05070A';
    ctx.fillRect(0, 0, W, H);

    // stars
    for (const s of stars) {
      ctx.fillStyle = 'rgba(0,255,255,0.6)';
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }

    // HUD - lives
    for (let i = 0; i < lives; i++) {
      const lx = 16 + i * 24;
      // small triangle ship icon
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00FFFF';
      ctx.fillStyle = '#00FFFF';
      ctx.beginPath();
      ctx.moveTo(lx, 12);
      ctx.lineTo(lx + 10, 28);
      ctx.lineTo(lx - 10, 28);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // wave indicator
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#FF10F0';
    ctx.fillStyle = '#FF10F0';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('WAVE ' + wave, W / 2 - 36, 22);
    ctx.shadowBlur = 0;

    // bullets
    for (const b of bullets) {
      rect(b.x, b.y, b.w, b.h, '#00FFFF', 10);
      // bullet trail
      ctx.fillStyle = 'rgba(0,255,255,0.3)';
      ctx.fillRect(b.x + 1, b.y + b.h, b.w - 2, 8);
    }

    // enemy bullets
    for (const b of enemyBullets) {
      rect(b.x, b.y, b.w, b.h, '#FF10F0', 10);
    }

    // enemies
    for (const e of enemies) {
      // enemy body
      ctx.shadowBlur = 12;
      ctx.shadowColor = e.color;
      ctx.fillStyle = e.color;
      // diamond/angular shape
      ctx.beginPath();
      ctx.moveTo(e.x + e.w / 2, e.y);
      ctx.lineTo(e.x + e.w, e.y + e.h / 2);
      ctx.lineTo(e.x + e.w / 2, e.y + e.h);
      ctx.lineTo(e.x, e.y + e.h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // boss
    if (bossActive && boss) {
      // boss body
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#FF10F0';
      ctx.fillStyle = '#CC20FF';
      ctx.beginPath();
      ctx.moveTo(boss.x + boss.w / 2, boss.y);
      ctx.lineTo(boss.x + boss.w, boss.y + boss.h * 0.4);
      ctx.lineTo(boss.x + boss.w - 10, boss.y + boss.h);
      ctx.lineTo(boss.x + 10, boss.y + boss.h);
      ctx.lineTo(boss.x, boss.y + boss.h * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      // boss eye
      ctx.fillStyle = '#FFE600';
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#FFE600';
      ctx.beginPath();
      ctx.arc(boss.x + boss.w / 2, boss.y + boss.h * 0.35, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // health bar
      const barW = boss.w + 20;
      const barH = 6;
      const barX = boss.x + boss.w / 2 - barW / 2;
      const barY = boss.y - 14;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(barX, barY, barW, barH);
      const hpRatio = boss.hp / boss.maxHp;
      const hpColor = hpRatio > 0.5 ? '#39FF88' : hpRatio > 0.25 ? '#FFE600' : '#FF4444';
      ctx.fillStyle = hpColor;
      ctx.shadowBlur = 8;
      ctx.shadowColor = hpColor;
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
      ctx.shadowBlur = 0;
    }

    // pickups
    for (const p of pickups) {
      if (p.type === 'coin') {
        circle(p.x + p.w / 2, p.y + p.h / 2, p.w / 2, '#FFE600', 14);
        // inner detail
        ctx.fillStyle = '#AA8800';
        ctx.beginPath();
        ctx.arc(p.x + p.w / 2, p.y + p.h / 2, p.w / 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // powerup - glowing green square
        rect(p.x, p.y, p.w, p.h, '#39FF88', 18);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('P', p.x + 4, p.y + 13);
      }
    }

    // player ship
    const glowColor = '#00FFFF';
    ctx.shadowBlur = 16;
    ctx.shadowColor = glowColor;
    ctx.fillStyle = '#00E5FF';
    // ship body - triangle pointing up
    ctx.beginPath();
    ctx.moveTo(P.x + P.w / 2, P.y);
    ctx.lineTo(P.x + P.w, P.y + P.h);
    ctx.lineTo(P.x + P.w / 2, P.y + P.h - 8);
    ctx.lineTo(P.x, P.y + P.h);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    // cockpit
    ctx.fillStyle = '#FFE600';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#FFE600';
    ctx.beginPath();
    ctx.arc(P.x + P.w / 2, P.y + P.h * 0.45, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // engine flame
    ctx.fillStyle = '#FF10F0';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#FF10F0';
    const flameH = 10 + Math.sin(performance.now() * 0.01) * 6;
    ctx.beginPath();
    ctx.moveTo(P.x + P.w / 2 - 6, P.y + P.h);
    ctx.lineTo(P.x + P.w / 2, P.y + P.h + flameH);
    ctx.lineTo(P.x + P.w / 2 + 6, P.y + P.h);
    ctx.closePath();
    ctx.fill();
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
    controls: { joystick: true, boost: false, action: false, drift: false }
  };
}
