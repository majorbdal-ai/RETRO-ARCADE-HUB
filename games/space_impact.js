window.engines = window.engines || {};
window.engines.space_impact = function(canvas, ctx, W, H, input, state) {
  'use strict';

  // ── Constants ──
  const PLAYER_SPEED = 280;
let diffMul = 1;  // v7.20 difficulty ramp
  let raf = null, lastT = 0, running = false;
  const BULLET_SPEED = 520;
  const ENEMY_BULLET_SPEED = 220;
  const SHOOT_COOLDOWN = 0.18;
  const STAR_COUNT = 120;
  const MAX_LIVES = 3;
  const STARFIELD_LAYERS = 3;

  // ── Alien definitions ──
  const ALIEN_TYPES = {
    small:  { w: 24, h: 18, hp: 1, speed: 120, shootRate: 0.008, color: '#0f0',   coin: 10,  pts: 10  },
    medium: { w: 32, h: 24, hp: 2, speed: 80,  shootRate: 0.012, color: '#ff0',   coin: 25,  pts: 25  },
    large:  { w: 42, h: 32, hp: 4, speed: 50,  shootRate: 0.006, color: '#f00',   coin: 50,  pts: 50  },
    boss:   { w: 80, h: 60, hp: 20, speed: 30,  shootRate: 0.025, color: '#f0f',   coin: 200, pts: 200 }
  };

  // ── State ──
  let stars = [];
  let player, bullets, enemyBullets, enemies, particles, pickups;
  let wave, waveNum, waveDelay, waveSpawnTimer, waveSpawnCount;
  let score, coins, lives, shootTimer;
  let gameOver, paused, bossActive;
  let gameTime;
  let phase; // 'title' | 'play' | 'waveIntro' | 'dead' | 'gameOver'

  // ── Helpers ──
  function rand(a, b) { return Math.random() * (b - a) + a; }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function dist(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function initStars() {
    stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      const layer = i < STAR_COUNT * 0.5 ? 0 : i < STAR_COUNT * 0.8 ? 1 : 2;
      stars.push({
        x: rand(0, W), y: rand(0, H),
        speed: [30, 60, 100][layer],
        size: [0.5, 1, 1.5][layer],
        alpha: [0.3, 0.5, 0.9][layer]
      });
    }
  }

  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const spd = rand(40, 200);
      particles.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: rand(0.3, 0.8),
        maxLife: 0.8,
        size: rand(1, 4),
        color
      });
    }
  }

  function spawnPickup(x, y, coinValue) {
    pickups.push({
      x, y, vx: -40, value: coinValue,
      life: 6, size: 10, bobPhase: rand(0, Math.PI * 2)
    });
  }

  // ── Wave system ──
  function getWaveConfig(waveNum) {
    const isBoss = waveNum % 5 === 0;
    if (isBoss) {
      return {
        aliens: [{ type: 'boss', count: 1 }],
        total: 1,
        spawnInterval: 0,
        isBoss: true
      };
    }
    const baseSmall = 4 + waveNum * 2;
    const baseMedium = Math.floor(waveNum * 1.2);
    const baseLarge = Math.max(0, Math.floor((waveNum - 2) * 0.8));
    return {
      aliens: [
        { type: 'small',  count: baseSmall },
        { type: 'medium', count: baseMedium },
        { type: 'large',  count: baseLarge }
      ],
      total: baseSmall + baseMedium + baseLarge,
      spawnInterval: Math.max(0.3, 1.2 - waveNum * 0.06),
      isBoss: false
    };
  }

  function startWave() {
    wave = getWaveConfig(waveNum);
    waveSpawnCount = 0;
    waveSpawnTimer = 0;
    bossActive = wave.isBoss;
    phase = 'waveIntro';
    waveDelay = 1.5;
  }

  function spawnEnemy(type) {
    const cfg = ALIEN_TYPES[type];
    const yPad = cfg.h + 10;
    enemies.push({
      x: W + 10,
      y: rand(yPad, H - yPad - 30),
      w: cfg.w, h: cfg.h,
      hp: cfg.hp, maxHp: cfg.hp,
      speed: cfg.speed * (1 + waveNum * 0.04),
      shootRate: cfg.shootRate * (1 + waveNum * 0.08),
      color: cfg.color,
      coin: cfg.coin,
      type: cfg.w > 60 ? 'boss' : type,
      shootTimer: rand(0, 2),
      // boss movement
      bossPhase: 0,
      bossDir: -1
    });
  }

  // ── Drawing helpers ──
  function drawShip(x, y, w, h) {
    // Main body
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.moveTo(x, y + h / 2);
    ctx.lineTo(x + w * 0.3, y);
    ctx.lineTo(x + w, y + h * 0.25);
    ctx.lineTo(x + w * 0.9, y + h / 2);
    ctx.lineTo(x + w, y + h * 0.75);
    ctx.lineTo(x + w * 0.3, y + h);
    ctx.closePath();
    ctx.fill();
    // Cockpit
    ctx.fillStyle = '#80f0ff';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.35, y + h / 2, w * 0.1, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Engine glow
    ctx.fillStyle = '#ff6600';
    ctx.globalAlpha = 0.5 + Math.sin(gameTime * 20) * 0.3;
    ctx.beginPath();
    ctx.ellipse(x - 2, y + h / 2, 6 + Math.sin(gameTime * 30) * 3, h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawAlien(e) {
    ctx.fillStyle = e.color;
    if (e.type === 'boss') {
      // Boss: multi-segment ship
      ctx.globalAlpha = 0.3;
      ctx.fillRect(e.x + 5, e.y + 5, e.w - 10, e.h - 10);
      ctx.globalAlpha = 1;
      // Body
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y + e.h / 2);
      ctx.lineTo(e.x + e.w * 0.3, e.y);
      ctx.lineTo(e.x + e.w, e.y + e.h * 0.15);
      ctx.lineTo(e.x + e.w * 0.85, e.y + e.h / 2);
      ctx.lineTo(e.x + e.w, e.y + e.h * 0.85);
      ctx.lineTo(e.x + e.w * 0.3, e.y + e.h);
      ctx.closePath();
      ctx.fill();
      // Eye / core
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(e.x + e.w * 0.45, e.y + e.h / 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x + e.w * 0.45, e.y + e.h / 2, 3, 0, Math.PI * 2);
      ctx.fill();
      // HP bar
      const barW = e.w;
      ctx.fillStyle = '#333';
      ctx.fillRect(e.x, e.y - 8, barW, 4);
      ctx.fillStyle = '#f0f';
      ctx.fillRect(e.x, e.y - 8, barW * (e.hp / e.maxHp), 4);
    } else if (e.type === 'large') {
      ctx.beginPath();
      ctx.moveTo(e.x + e.w / 2, e.y);
      ctx.lineTo(e.x + e.w, e.y + e.h * 0.4);
      ctx.lineTo(e.x + e.w * 0.8, e.y + e.h);
      ctx.lineTo(e.x + e.w * 0.2, e.y + e.h);
      ctx.lineTo(e.x, e.y + e.h * 0.4);
      ctx.closePath();
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.fillRect(e.x + 8, e.y + 10, 4, 4);
      ctx.fillRect(e.x + e.w - 12, e.y + 10, 4, 4);
      // HP bar for large
      ctx.fillStyle = '#333';
      ctx.fillRect(e.x, e.y - 6, e.w, 3);
      ctx.fillStyle = '#f44';
      ctx.fillRect(e.x, e.y - 6, e.w * (e.hp / e.maxHp), 3);
    } else if (e.type === 'medium') {
      ctx.beginPath();
      ctx.moveTo(e.x, e.y + e.h / 2);
      ctx.lineTo(e.x + e.w * 0.4, e.y);
      ctx.lineTo(e.x + e.w, e.y + e.h * 0.3);
      ctx.lineTo(e.x + e.w, e.y + e.h * 0.7);
      ctx.lineTo(e.x + e.w * 0.4, e.y + e.h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(e.x + e.w * 0.55, e.y + e.h * 0.3, 3, 3);
    } else {
      // Small: diamond
      ctx.beginPath();
      ctx.moveTo(e.x, e.y + e.h / 2);
      ctx.lineTo(e.x + e.w / 2, e.y);
      ctx.lineTo(e.x + e.w, e.y + e.h / 2);
      ctx.lineTo(e.x + e.w / 2, e.y + e.h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(e.x + e.w * 0.55, e.y + e.h * 0.4, 2, 2);
    }
    // Neon glow
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(e.x + 2, e.y + 2, e.w - 4, e.h - 4);
    ctx.shadowBlur = 0;
  }

  function drawBullet(b, isEnemy) {
    ctx.fillStyle = isEnemy ? '#ff3333' : '#00e5ff';
    ctx.shadowColor = isEnemy ? '#ff3333' : '#00e5ff';
    ctx.shadowBlur = 6;
    if (isEnemy) {
      ctx.beginPath();
      ctx.arc(b.x + 3, b.y + 2, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(b.x, b.y, 10, 3);
    }
    ctx.shadowBlur = 0;
  }

  function drawParticles() {
    for (const p of particles) {
      const a = p.life / p.maxLife;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPickups() {
    for (const pk of pickups) {
      const bob = Math.sin(pk.bobPhase + gameTime * 4) * 3;
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(pk.x + pk.size / 2, pk.y + pk.size / 2 + bob, pk.size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#aa8800';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('¢', pk.x + pk.size / 2, pk.y + pk.size / 2 + bob + 3);
    }
    ctx.textAlign = 'left';
  }

  function drawStars() {
    for (const s of stars) {
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = '#fff';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    // Score
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('SCORE: ' + score, W - 12, 24);

    // Coins
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'right';
    ctx.fillText('COINS: ' + coins, W - 12, 44);

    // Wave
    ctx.fillStyle = '#888';
    ctx.font = '12px monospace';
    ctx.fillText('WAVE ' + waveNum, W - 12, 62);

    // Lives as hearts
    ctx.textAlign = 'left';
    ctx.font = '20px sans-serif';
    for (let i = 0; i < MAX_LIVES; i++) {
      ctx.fillStyle = i < lives ? '#ff3366' : '#333';
      ctx.fillText('♥', 12 + i * 28, 28);
    }

    // Lives label
    ctx.fillStyle = '#aaa';
    ctx.font = '11px monospace';
    ctx.fillText('LIVES', 12, 44);
    ctx.textAlign = 'left';
  }

  function drawTitle() {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#00e5ff';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 20;
    ctx.font = 'bold 48px monospace';
    ctx.fillText('SPACE IMPACT', W / 2, H / 2 - 60);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ff3366';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('Nokia Classic Tribute', W / 2, H / 2 - 20);

    ctx.fillStyle = '#aaa';
    ctx.font = '14px monospace';
    ctx.fillText('D-PAD / ARROWS to move', W / 2, H / 2 + 30);
    ctx.fillText('Auto-shoot enabled', W / 2, H / 2 + 52);

    // Blinking start text
    if (Math.sin(gameTime * 4) > 0) {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('TAP / PRESS ENTER TO START', W / 2, H / 2 + 100);
    }

    ctx.textAlign = 'left';
  }

  function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff3366';
    ctx.shadowColor = '#ff3366';
    ctx.shadowBlur = 20;
    ctx.font = 'bold 42px monospace';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 40);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff';
    ctx.font = '18px monospace';
    ctx.fillText('SCORE: ' + score, W / 2, H / 2 + 10);
    ctx.fillText('COINS: ' + coins, W / 2, H / 2 + 36);
    ctx.fillText('WAVE REACHED: ' + waveNum, W / 2, H / 2 + 62);

    if (Math.sin(gameTime * 4) > 0) {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('TAP / PRESS ENTER TO RESTART', W / 2, H / 2 + 110);
    }

    ctx.textAlign = 'left';
  }

  function drawWaveIntro() {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.fillStyle = wave.isBoss ? '#f0f' : '#00e5ff';
    ctx.shadowColor = wave.isBoss ? '#f0f' : '#00e5ff';
    ctx.shadowBlur = 15;
    ctx.font = 'bold 32px monospace';
    if (wave.isBoss) {
      ctx.fillText('BOSS WAVE ' + waveNum, W / 2, H / 2);
    } else {
      ctx.fillText('WAVE ' + waveNum, W / 2, H / 2);
    }
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#aaa';
    ctx.font = '14px monospace';
    ctx.fillText(wave.total + ' aliens incoming', W / 2, H / 2 + 30);
    ctx.textAlign = 'left';
  }

  function drawDead() {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff3366';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('DESTROYED!', W / 2, H / 2 - 10);

    ctx.fillStyle = '#aaa';
    ctx.font = '14px monospace';
    ctx.fillText('Respawning...', W / 2, H / 2 + 20);
    ctx.textAlign = 'left';
  }

  // ── Explosion effect on player death ──
  function playerExplosion() {
    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#00e5ff', 30);
    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#ff6600', 20);
    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#fff', 10);
  }

  // ── Core engine ──
  function resetGame() {
    player = {
      x: 80, y: H / 2 - 18,
      w: 48, h: 36,
      invTimer: 0
    };
    bullets = [];
    enemyBullets = [];
    enemies = [];
    particles = [];
    pickups = [];
    wave = null;
    waveNum = 1;
    waveDelay = 0;
    waveSpawnTimer = 0;
    waveSpawnCount = 0;
    score = 0;
    coins = 0;
    lives = MAX_LIVES;
    shootTimer = 0;
    gameOver = false;
    bossActive = false;
    gameTime = 0;
    phase = 'title';
  }

  function start() {
    initStars();
    resetGame();
    running = true;
    lastT = performance.now();
    if (raf) cancelAnimationFrame(raf);
    const loop = (ts) => {
      if (!running) return;
      const dt = Math.min(0.05, (ts - lastT) / 1000 || 0.016);
      lastT = ts;
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }

  function update(dt) {
    if (paused) return;
    gameTime += dt;

    // ── Update starfield ──
    for (const s of stars) {
      s.x -= s.speed * dt;
      if (s.x < -5) {
        s.x = W + 5;
        s.y = rand(0, H);
      }
    }

    // ── Title screen ──
    if (phase === 'title') {
      if (input.pressed('enter') || input.pressed(' ') || input.pressed('tap')) {
        phase = 'play';
        startWave();
      }
      updateParticles(dt);
      return;
    }

    // ── Game Over ──
    if (phase === 'gameOver') {
      updateParticles(dt);
      if (input.pressed('enter') || input.pressed(' ') || input.pressed('tap')) {
        resetGame();
        phase = 'play';
        startWave();
      }
      return;
    }

    // ── Dead / respawn ──
    if (phase === 'dead') {
      updateParticles(dt);
      waveDelay -= dt;
      if (waveDelay <= 0) {
        lives--;
        if (typeof gameFX !== 'undefined') { try { var __r = canvas.getBoundingClientRect(); gameFX.burst(__r.left + (W/2) * __r.width / canvas.width, __r.top + (H/2) * __r.height / canvas.height, '#ff4444', 16); } catch(e){} gameFX.shake(5); }
        if (typeof window.playSfx === 'function') { try { window.playSfx('error'); } catch (e) {} }
        if (lives <= 0) {
          phase = 'gameOver';
          if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
          // report score to the hub (coins/XP/best) — this legacy engine self-reports
          if (typeof state.onGameOver === 'function') { try { state.onGameOver(score || 0, coins || 0); } catch (e) {} }
          return;
        }
        player.x = 80;
        player.y = H / 2 - player.h / 2;
        player.invTimer = 2;
        phase = 'play';
      }
      return;
    }

    // ── Wave intro ──
    if (phase === 'waveIntro') {
      updateParticles(dt);
      waveDelay -= dt;
      if (waveDelay <= 0) {
        phase = 'play';
      }
      // Still allow movement during intro
    }

    // ── Player movement ──
    if (phase === 'play' || phase === 'waveIntro') {
      let dx = 0, dy = 0;
      if (input.down('left') || input.down('a'))  dx -= 1;
      if (input.down('right') || input.down('d')) dx += 1;
      if (input.down('up') || input.down('w'))    dy -= 1;
      if (input.down('down') || input.down('s'))  dy += 1;

      // Normalize diagonal
      if (dx !== 0 && dy !== 0) {
        dx *= 0.7071;
        dy *= 0.7071;
      }

      player.x += dx * PLAYER_SPEED * dt;
      player.y += dy * PLAYER_SPEED * dt;

      // Clamp to play area
      player.x = clamp(player.x, 4, W * 0.7);
      player.y = clamp(player.y, 4, H - player.h - 30);

      // Invincibility timer
      if (player.invTimer > 0) player.invTimer -= dt;

      // ── Auto-shoot ──
      shootTimer -= dt;
      if (shootTimer <= 0) {
        bullets.push({
          x: player.x + player.w,
          y: player.y + player.h / 2 - 1.5,
          w: 10, h: 3
        });
        shootTimer = SHOOT_COOLDOWN / diffMul;
        // every other shot: compact laser blip (anti-spam, low gain)
        if (typeof window.sfxTone === 'function' && Math.floor(performance.now() / 360) % 2 === 0) {
          try { window.sfxTone(880 + Math.random() * 120, 0.05, 'square', 0.045); } catch (e) {}
        }
      }
    }

    // ── Wave spawning ──
    if (phase === 'play' && wave) {
      const allSpawned = waveSpawnCount >= wave.total;
      if (!allSpawned) {
        waveSpawnTimer -= dt;
        if (waveSpawnTimer <= 0) {
          // Determine which type to spawn next
          let spawned = false;
          for (const group of wave.aliens) {
            if (group.count > 0) {
              spawnEnemy(group.type);
              group.count--;
              waveSpawnCount++;
              spawned = true;
              break;
            }
          }
          waveSpawnTimer = wave.isBoss ? 0 : wave.spawnInterval;
        }
      }

      // Check wave complete
      if (allSpawned && enemies.length === 0) {
        waveNum++;
        startWave();
        if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
      }
    }

    // ── Update bullets ──
    for (let i = bullets.length - 1; i >= 0; i--) {
      bullets[i].x += BULLET_SPEED * dt;
      if (bullets[i].x > W + 20) bullets.splice(i, 1);
    }

    // ── Update enemy bullets ──
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      b.x += (b.vx || -ENEMY_BULLET_SPEED) * dt;
      b.y += (b.vy || 0) * dt;
      if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
        enemyBullets.splice(i, 1);
      }
    }

    // ── Update enemies ──
    for (const e of enemies) {
      // Movement
      if (e.type === 'boss') {
        // Boss: slow left approach, then bob vertically
        e.bossPhase += dt * 2;
        if (e.x > W - e.w - 20) {
          e.x -= e.speed * dt;
        } else {
          e.y += Math.sin(e.bossPhase) * 60 * dt;
          // Occasional dart forward
          if (Math.sin(e.bossPhase * 0.3) > 0.8) {
            e.x -= 30 * dt;
          }
        }
        e.y = clamp(e.y, 10, H - e.h - 30);
      } else {
        e.x -= e.speed * dt;
        // Slight vertical drift
        e.y += Math.sin(gameTime * 2 + e.x * 0.02) * 20 * dt;
      }

      // Shooting
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && e.x < W && e.x > 0) {
        e.shootTimer = 1 / (e.shootRate * 60);
        if (e.type === 'boss') {
          // Boss: triple spread
          for (let a = -0.3; a <= 0.3; a += 0.3) {
            enemyBullets.push({
              x: e.x - 4,
              y: e.y + e.h / 2 - 2,
              w: 6, h: 4,
              vx: -ENEMY_BULLET_SPEED * Math.cos(a),
              vy: ENEMY_BULLET_SPEED * Math.sin(a)
            });
          }
        } else {
          enemyBullets.push({
            x: e.x - 4,
            y: e.y + e.h / 2 - 2,
            w: 6, h: 4
          });
        }
      }

      // Off-screen removal (non-boss)
      if (e.type !== 'boss' && e.x + e.w < -20) {
        e.hp = 0;
      }
    }

    // Remove dead enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      if (enemies[i].hp <= 0) {
        const e = enemies[i];
        spawnParticles(e.x + e.w / 2, e.y + e.h / 2, e.color, 15);
        score += ALIEN_TYPES[e.type] ? ALIEN_TYPES[e.type].pts : 10;
        spawnPickup(e.x, e.y, ALIEN_TYPES[e.type] ? ALIEN_TYPES[e.type].coin : 10);
        if (typeof window.playSfx === 'function') { try { window.playSfx('pop'); } catch (e) {} }
        enemies.splice(i, 1);
      }
    }

    // ── Bullet vs Enemy collision ──
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        if (rectsOverlap(b, e)) {
          e.hp--;
          bullets.splice(bi, 1);
          spawnParticles(b.x, b.y, '#fff', 4);
          if (typeof window.playSfx === 'function') { try { window.playSfx('click'); } catch (e) {} }
          break;
        }
      }
    }

    // ── Enemy bullet vs Player ──
    if (player.invTimer <= 0) {
      for (let bi = enemyBullets.length - 1; bi >= 0; bi--) {
        const b = enemyBullets[bi];
        if (rectsOverlap(b, player)) {
          enemyBullets.splice(bi, 1);
          playerExplosion();
          phase = 'dead';
          waveDelay = 1.5;
          break;
        }
      }
      // Enemy body vs player
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        if (rectsOverlap(e, player)) {
          playerExplosion();
          phase = 'dead';
          waveDelay = 1.5;
          break;
        }
      }
    }

    // ── Update pickups ──
    for (let i = pickups.length - 1; i >= 0; i--) {
      const pk = pickups[i];
      pk.x += pk.vx * dt;
      pk.life -= dt;
      if (pk.life <= 0 || pk.x < -20) {
        pickups.splice(i, 1);
        continue;
      }
      // Collect
      if (rectsOverlap(pk, player)) {
        coins += pk.value;
        score += pk.value;
        if (typeof window.playSfx === 'function') { try { window.playSfx('coin'); } catch (e) {} }
        pickups.splice(i, 1);
      }
    }

    // ── Update particles ──
    updateParticles(dt);
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function draw() {
    // Clear
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, W, H);

    // Starfield
    drawStars();

    // Pickups (behind everything else)
    drawPickups();

    // Enemy bullets
    for (const b of enemyBullets) drawBullet(b, true);

    // Player bullets
    for (const b of bullets) drawBullet(b, false);

    // Enemies
    for (const e of enemies) drawAlien(e);

    // Player
    if (phase === 'play' || phase === 'waveIntro') {
      if (player.invTimer > 0 && Math.sin(gameTime * 30) > 0) {
        // Blink when invincible
      } else {
        drawShip(player.x, player.y, player.w, player.h);
      }
    }

    // Particles (on top)
    drawParticles();

    // HUD (always)
    if (phase !== 'title') drawHUD();

    // Overlays
    if (phase === 'title') drawTitle();
    else if (phase === 'gameOver') drawGameOver();
    else if (phase === 'waveIntro') drawWaveIntro();
    else if (phase === 'dead') drawDead();
  }

  // ── Public API ──
    function pauseGame() { paused = true; }
  function resumeGame() { paused = false; if (raf) { cancelAnimationFrame(raf); } lastT = performance.now(); if (running) { raf = requestAnimationFrame(function loop(ts){ if(!running) return; const dt = Math.min(0.05,(ts-lastT)/1000||0.016); lastT = ts; update(dt); draw(); raf = requestAnimationFrame(loop); }); } }
  function destroyGame() { running = false; if (raf) { cancelAnimationFrame(raf); raf = null; } }
  return { start, update, draw, pause: pauseGame, resume: resumeGame, destroy: destroyGame, setDifficulty: function(lvl){ diffMul = [1,1.15,1.3,1.5,1.75,2][Math.min(5,Math.floor(lvl)||0)]||1; } };
};

// core.js compatibility: expose as window.spaceImpact
if (window.engines && window.engines.spaceImpact) window.spaceImpact = window.engines.spaceImpact;
