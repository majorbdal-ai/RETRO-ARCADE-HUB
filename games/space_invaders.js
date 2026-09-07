/* ============================================================
   Space Invaders — Neon Space Invaders Arcade Game
   Canvas 800x450, player auto-shoots, joystick move
   5x8 alien grid, shields, boss every 5 waves
   ============================================================ */
function spaceInvaders(canvas, ctx, onScore, onGameOver, onCoins) {
  // ---- state ----
  const W = 800, H = 450;
  let raf = null, last = 0, running = false;
  let score = 0, coins = 0;
  let over = false;

  // player
  const P = { x: W / 2 - 20, y: H - 60, w: 40, h: 36, speed: 300, hp: 3, maxHp: 3, fireTimer: 0 };

  // bullets
  let bullets = [];
  let enemyBullets = [];
  const BULLET_INTERVAL = 0.3;

  // aliens
  const ALIEN_ROWS = 5;
  const ALIEN_COLS = 8;
  let aliens = [];
  let alienDir = 1; // 1 = right, -1 = left
  let alienMoveTimer = 0;
  let alienMoveInterval = 0.6; // seconds between moves
  let alienDropDist = 18;

  // alien fire
  let alienFireTimer = 0;
  let alienFireRate = 1.5;

  // boss
  let boss = null;
  let bossActive = false;
  let bossMoveTimer = 0;

  // shields
  let shields = [];

  // coins
  let coinDrops = [];

  // waves
  let wave = 0;
  let waveDelay = 1.5;

  // difficulty
  let alienSpeedMul = 1;

  // stars background
  let stars = [];
  for (let i = 0; i < 60; i++) {
    stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 2 + 0.5, sp: Math.random() * 40 + 10 });
  }

  // explosion effects
  let explosions = [];

  // input
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
    P.x = W / 2 - 20;
    P.y = H - 60;
    P.hp = P.maxHp;
    P.fireTimer = 0;
    bullets = [];
    enemyBullets = [];
    aliens = [];
    alienDir = 1;
    alienMoveTimer = 0;
    alienMoveInterval = 0.6;
    alienFireTimer = 0;
    alienFireRate = 1.5;
    boss = null;
    bossActive = false;
    coinDrops = [];
    explosions = [];
    wave = 0;
    waveDelay = 1.5;
    alienSpeedMul = 1;
    initShields();
  }

  function initShields() {
    shields = [];
    const shieldCount = 4;
    const shieldW = 60;
    const shieldH = 40;
    const spacing = (W - shieldCount * shieldW) / (shieldCount + 1);
    for (let i = 0; i < shieldCount; i++) {
      const sx = spacing + i * (shieldW + spacing);
      const sy = H - 130;
      // build shield from small blocks
      const blocks = [];
      const bw = 6, bh = 6;
      for (let r = 0; r < Math.floor(shieldH / bh); r++) {
        for (let c = 0; c < Math.floor(shieldW / bw); c++) {
          // cut arch in middle-bottom
          const bx = sx + c * bw;
          const by = sy + r * bh;
          const cx2 = sx + shieldW / 2;
          const cy2 = sy + shieldH;
          const dx = bx + bw / 2 - cx2;
          const dy = by + bh / 2 - cy2;
          // arch shape
          if (r >= shieldH / bh - 3 && Math.abs(c - Math.floor(shieldW / bw) / 2) < 2.5) continue;
          if (r < 2 && (c === 0 || c === Math.floor(shieldW / bw) - 1)) continue;
          blocks.push({ x: bx, y: by, alive: true });
        }
      }
      shields.push({ x: sx, y: sy, blocks: blocks });
    }
  }

  function spawnAliens() {
    aliens = [];
    const alienW = 30;
    const alienH = 24;
    const startX = (W - ALIEN_COLS * (alienW + 10)) / 2;
    const colors = ['#FF10F0', '#FFE600', '#39FF88', '#00FFFF', '#FF8800'];
    for (let r = 0; r < ALIEN_ROWS; r++) {
      for (let c = 0; c < ALIEN_COLS; c++) {
        const rowScore = (ALIEN_ROWS - r) * 10; // bottom=10, top=50
        aliens.push({
          x: startX + c * (alienW + 10),
          y: 60 + r * (alienH + 10),
          w: alienW,
          h: alienH,
          color: colors[r % colors.length],
          score: rowScore,
          alive: true
        });
      }
    }
  }

  function spawnBoss() {
    bossActive = true;
    const bossHp = 20 + wave * 8;
    boss = {
      x: W / 2 - 50,
      y: -70,
      w: 100,
      h: 50,
      hp: bossHp,
      maxHp: bossHp,
      speed: 80 + wave * 15,
      fireTimer: 0,
      fireRate: 0.6,
      targetY: 40,
      moveDir: 1,
      color: '#FF10F0'
    };
  }

  function startWave() {
    wave++;
    if (wave % 5 === 0) {
      // boss wave: spawn boss, no regular aliens
      spawnBoss();
      alienFireRate = Math.max(0.4, 1.5 - wave * 0.05);
    } else {
      spawnAliens();
      alienDir = 1;
      alienMoveTimer = 0;
      // difficulty scaling
      alienMoveInterval = Math.max(0.15, 0.6 - wave * 0.04);
      alienFireRate = Math.max(0.4, 1.5 - wave * 0.05);
      alienSpeedMul = 1 + wave * 0.1;
    }
  }

  function spawnExplosion(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 / 8) * i;
      explosions.push({
        x: x, y: y,
        vx: Math.cos(angle) * (60 + Math.random() * 40),
        vy: Math.sin(angle) * (60 + Math.random() * 40),
        life: 0.3,
        maxLife: 0.3,
        color: color,
        r: 3
      });
    }
  }

  // ---- update ----
  function update(dt) {
    if (over || !running) return;

    // wave management
    if (!bossActive && aliens.length === 0 && waveDelay > 0) {
      waveDelay -= dt;
      if (waveDelay <= 0) {
        startWave();
        waveDelay = 0;
      }
      if (waveDelay <= 0 && wave === 0) {
        startWave();
      }
    }

    // player movement (joystick/left/right)
    if (touches.left || keys.ArrowLeft || keys.KeyA) {
      P.x -= P.speed * dt;
    }
    if (touches.right || keys.ArrowRight || keys.KeyD) {
      P.x += P.speed * dt;
    }
    P.x = Math.max(10, Math.min(W - P.w - 10, P.x));

    // auto-fire
    P.fireTimer -= dt;
    if (P.fireTimer <= 0) {
      bullets.push({ x: P.x + P.w / 2 - 3, y: P.y - 8, w: 6, h: 14, speed: 500 });
      P.fireTimer = BULLET_INTERVAL;
    }

    // move player bullets
    for (const b of bullets) b.y -= b.speed * dt;
    bullets = bullets.filter(b => b.y > -20);

    // move enemy bullets
    for (const b of enemyBullets) {
      b.y += b.speed * dt;
      if (b.vx) b.x += b.vx * dt;
    }
    enemyBullets = enemyBullets.filter(b => b.y < H + 20 && b.x > -20 && b.x < W + 20);

    // alien grid movement
    if (aliens.length > 0 && !bossActive) {
      alienMoveTimer += dt;
      if (alienMoveTimer >= alienMoveInterval) {
        alienMoveTimer = 0;
        // check if any alien hit the edge
        let hitEdge = false;
        for (const a of aliens) {
          if (!a.alive) continue;
          if ((alienDir > 0 && a.x + a.w + 10 * alienSpeedMul >= W - 10) ||
              (alienDir < 0 && a.x - 10 * alienSpeedMul <= 10)) {
            hitEdge = true;
            break;
          }
        }
        if (hitEdge) {
          alienDir *= -1;
          // move down
          for (const a of aliens) {
            if (a.alive) a.y += alienDropDist;
          }
          // check if aliens reached the bottom
          for (const a of aliens) {
            if (a.alive && a.y + a.h >= P.y) {
              gameOver();
              return;
            }
          }
        } else {
          // move horizontally
          const moveX = 10 * alienSpeedMul * alienDir;
          for (const a of aliens) {
            if (a.alive) a.x += moveX;
          }
        }
      }
    }

    // alien fire
    alienFireTimer += dt;
    if (alienFireTimer >= alienFireRate && aliens.length > 0 && !bossActive) {
      alienFireTimer = 0;
      // pick random alive alien from bottom rows
      const aliveAliens = aliens.filter(a => a.alive);
      if (aliveAliens.length > 0) {
        // prefer bottom aliens
        aliveAliens.sort((a, b) => b.y - a.y);
        const shooterIdx = Math.floor(Math.random() * Math.min(5, aliveAliens.length));
        const shooter = aliveAliens[shooterIdx];
        enemyBullets.push({
          x: shooter.x + shooter.w / 2 - 3,
          y: shooter.y + shooter.h,
          w: 6, h: 10,
          speed: 200 + wave * 5
        });
      }
    }

    // boss movement + fire
    if (bossActive && boss) {
      if (boss.y < boss.targetY) {
        boss.y += 100 * dt;
      } else {
        boss.x += boss.speed * boss.moveDir * dt;
        if (boss.x <= 20) boss.moveDir = 1;
        if (boss.x >= W - boss.w - 20) boss.moveDir = -1;
      }
      // boss fires
      boss.fireTimer += dt;
      if (boss.fireTimer >= boss.fireRate && boss.y >= boss.targetY - 5) {
        boss.fireTimer = 0;
        // spread shot
        for (let i = -2; i <= 2; i++) {
          enemyBullets.push({
            x: boss.x + boss.w / 2 - 3,
            y: boss.y + boss.h,
            w: 6, h: 10,
            speed: 180 + wave * 5,
            vx: i * 50
          });
        }
      }
    }

    // bullet-alien collision
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      for (let ai = aliens.length - 1; ai >= 0; ai--) {
        const a = aliens[ai];
        if (!a.alive) continue;
        if (b.x < a.x + a.w && b.x + b.w > a.x && b.y < a.y + a.h && b.y + b.h > a.y) {
          a.alive = false;
          bullets.splice(bi, 1);
          score += a.score;
          onScore(score);
          spawnExplosion(a.x + a.w / 2, a.y + a.h / 2, a.color);
          // coin drop
          if (Math.random() < 0.15) {
            coinDrops.push({ x: a.x + a.w / 2, y: a.y + a.h / 2, r: 8, speed: 100 });
          }
          break;
        }
      }
    }
    aliens = aliens.filter(a => a.alive);

    // check if wave cleared
    if (!bossActive && aliens.length === 0 && wave > 0 && waveDelay <= 0) {
      waveDelay = 2.0;
    }

    // bullet-boss collision
    if (bossActive && boss) {
      for (let bi = bullets.length - 1; bi >= 0; bi--) {
        const b = bullets[bi];
        if (b.x < boss.x + boss.w && b.x + b.w > boss.x && b.y < boss.y + boss.h && b.y + b.h > boss.y) {
          boss.hp -= 1;
          bullets.splice(bi, 1);
          spawnExplosion(b.x, b.y, '#FFE600');
          if (boss.hp <= 0) {
            score += 500;
            onScore(score);
            coins += 50;
            onCoins(50);
            // drop multiple coins
            for (let c = 0; c < 5; c++) {
              coinDrops.push({
                x: boss.x + boss.w / 2 + (c - 2) * 20,
                y: boss.y + boss.h / 2,
                r: 8, speed: 100
              });
            }
            spawnExplosion(boss.x + boss.w / 2, boss.y + boss.h / 2, '#FF10F0');
            boss = null;
            bossActive = false;
            waveDelay = 3.0;
          }
        }
      }
    }

    // enemy bullet-shield collision
    for (let bi = enemyBullets.length - 1; bi >= 0; bi--) {
      const b = enemyBullets[bi];
      let hit = false;
      for (const shield of shields) {
        for (const block of shield.blocks) {
          if (!block.alive) continue;
          if (b.x < block.x + 6 && b.x + b.w > block.x && b.y < block.y + 6 && b.y + b.h > block.y) {
            block.alive = false;
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
      if (hit) { enemyBullets.splice(bi, 1); continue; }
    }

    // player bullet-shield collision
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      let hit = false;
      for (const shield of shields) {
        for (const block of shield.blocks) {
          if (!block.alive) continue;
          if (b.x < block.x + 6 && b.x + b.w > block.x && b.y < block.y + 6 && b.y + b.h > block.y) {
            block.alive = false;
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
      if (hit) { bullets.splice(bi, 1); continue; }
    }

    // enemy bullet-player collision
    for (let bi = enemyBullets.length - 1; bi >= 0; bi--) {
      const b = enemyBullets[bi];
      if (b.x < P.x + P.w && b.x + b.w > P.x && b.y < P.y + P.h && b.y + b.h > P.y) {
        enemyBullets.splice(bi, 1);
        P.hp--;
        if (navigator.vibrate) { try { navigator.vibrate(150); } catch (e) {} }
        if (P.hp <= 0) {
          gameOver();
          return;
        }
      }
    }

    // boss-player collision
    if (bossActive && boss) {
      if (P.x < boss.x + boss.w && P.x + P.w > boss.x && P.y < boss.y + boss.h && P.y + P.h > boss.y) {
        P.hp = 0;
        gameOver();
        return;
      }
    }

    // coin drops
    for (let ci = coinDrops.length - 1; ci >= 0; ci--) {
      const c = coinDrops[ci];
      c.y += c.speed * dt;
      if (c.y > H + 20) {
        coinDrops.splice(ci, 1);
        continue;
      }
      // player pickup
      const dx = (P.x + P.w / 2) - c.x;
      const dy = (P.y + P.h / 2) - c.y;
      if (Math.sqrt(dx * dx + dy * dy) < c.r + 20) {
        coins += 25;
        onCoins(25);
        spawnExplosion(c.x, c.y, '#FFE600');
        coinDrops.splice(ci, 1);
      }
    }

    // update explosions
    for (let ei = explosions.length - 1; ei >= 0; ei--) {
      const e = explosions[ei];
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.life -= dt;
      if (e.life <= 0) explosions.splice(ei, 1);
    }

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
      ctx.fillStyle = 'rgba(0,255,255,0.5)';
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }

    // shields
    for (const shield of shields) {
      for (const block of shield.blocks) {
        if (!block.alive) continue;
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#39FF88';
        ctx.fillStyle = '#39FF88';
        ctx.fillRect(block.x, block.y, 6, 6);
        ctx.shadowBlur = 0;
      }
    }

    // player bullets
    for (const b of bullets) {
      rect(b.x, b.y, b.w, b.h, '#00FFFF', 10);
      ctx.fillStyle = 'rgba(0,255,255,0.3)';
      ctx.fillRect(b.x + 1, b.y + b.h, b.w - 2, 6);
    }

    // enemy bullets
    for (const b of enemyBullets) {
      rect(b.x, b.y, b.w, b.h, '#FF10F0', 10);
    }

    // aliens
    for (const a of aliens) {
      if (!a.alive) continue;
      // alien body - classic invaders shape
      ctx.shadowBlur = 10;
      ctx.shadowColor = a.color;
      ctx.fillStyle = a.color;
      // top bar
      ctx.fillRect(a.x + 4, a.y, a.w - 8, 4);
      // middle
      ctx.fillRect(a.x, a.y + 4, a.w, a.h - 8);
      // bottom bar
      ctx.fillRect(a.x + 2, a.y + a.h - 6, a.w - 4, 6);
      // legs
      ctx.fillRect(a.x, a.y + a.h - 4, 4, 4);
      ctx.fillRect(a.x + a.w - 4, a.y + a.h - 4, 4, 4);
      ctx.shadowBlur = 0;
      // eyes
      ctx.fillStyle = '#05070A';
      ctx.fillRect(a.x + 8, a.y + 8, 5, 5);
      ctx.fillRect(a.x + a.w - 13, a.y + 8, 5, 5);
    }

    // boss
    if (bossActive && boss) {
      // boss body
      ctx.shadowBlur = 20;
      ctx.shadowColor = boss.color;
      ctx.fillStyle = boss.color;
      ctx.beginPath();
      ctx.moveTo(boss.x + boss.w / 2, boss.y);
      ctx.lineTo(boss.x + boss.w, boss.y + boss.h * 0.5);
      ctx.lineTo(boss.x + boss.w - 10, boss.y + boss.h);
      ctx.lineTo(boss.x + 10, boss.y + boss.h);
      ctx.lineTo(boss.x, boss.y + boss.h * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      // boss eyes
      ctx.fillStyle = '#FFE600';
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#FFE600';
      ctx.beginPath();
      ctx.arc(boss.x + boss.w * 0.35, boss.y + boss.h * 0.38, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(boss.x + boss.w * 0.65, boss.y + boss.h * 0.38, 7, 0, Math.PI * 2);
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

    // coin drops
    for (const c of coinDrops) {
      circle(c.x, c.y, c.r, '#FFE600', 14);
      ctx.fillStyle = '#AA8800';
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // explosions
    for (const e of explosions) {
      const alpha = e.life / e.maxLife;
      ctx.shadowBlur = 6;
      ctx.shadowColor = e.color;
      ctx.fillStyle = e.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * (1 + (1 - alpha) * 2), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // player ship
    const glowColor = '#00FFFF';
    ctx.shadowBlur = 14;
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
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#FFE600';
    ctx.beginPath();
    ctx.arc(P.x + P.w / 2, P.y + P.h * 0.45, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // engine flame
    ctx.fillStyle = '#FF10F0';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#FF10F0';
    const flameH = 8 + Math.sin(performance.now() * 0.01) * 4;
    ctx.beginPath();
    ctx.moveTo(P.x + P.w / 2 - 5, P.y + P.h);
    ctx.lineTo(P.x + P.w / 2, P.y + P.h + flameH);
    ctx.lineTo(P.x + P.w / 2 + 5, P.y + P.h);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // HUD - player HP
    for (let i = 0; i < P.hp; i++) {
      const lx = 16 + i * 24;
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#00FFFF';
      ctx.fillStyle = '#00FFFF';
      ctx.beginPath();
      ctx.moveTo(lx, 12);
      ctx.lineTo(lx + 10, 26);
      ctx.lineTo(lx - 10, 26);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // wave indicator
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#FF10F0';
    ctx.fillStyle = '#FF10F0';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('WAVE ' + wave, W / 2 - 40, 22);
    ctx.shadowBlur = 0;

    // score
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00FFFF';
    ctx.fillStyle = '#00FFFF';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('SCORE: ' + score, W - 16, 22);
    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;

    // coins
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#FFE600';
    ctx.fillStyle = '#FFE600';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('COINS: ' + coins, 16, 50);
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
      ctx.fillText('WAVE: ' + wave, W / 2, H / 2 + 10);
      ctx.fillText('SCORE: ' + score, W / 2, H / 2 + 38);
      ctx.fillText('COINS: ' + coins, W / 2, H / 2 + 66);
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
