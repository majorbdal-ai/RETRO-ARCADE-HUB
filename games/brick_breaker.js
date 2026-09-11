/* ============================================================
   Brick Breaker — Neon Brick Smasher
   Canvas 800x450, paddle + ball vs colored bricks
   Drag left/right or keys to move paddle
   Action button to serve ball. Coins drop 10% chance.
   Powerups: wider paddle (gold), multi-ball (pink).
   ============================================================ */
function brickBreaker(canvas, ctx, onScore, onGameOver, onCoins) {
  // ---- state ----
  const W = 800, H = 450;
  let raf = null, last = 0, running = false;
  let score = 0, coins = 0;
  let over = false;

  // paddle
  const PADDLE = {
    x: W / 2 - 50, y: H - 50, w: 100, h: 14,
    baseW: 100, speed: 400, color: '#00FFFF',
    wideTimer: 0
  };

  // balls
  let balls = [];
  let serving = true;

  // bricks: 8 columns x 5 rows
  const BRICK_COLS = 8;
  const BRICK_ROWS = 5;
  const BRICK_W = 85;
  const BRICK_H = 24;
  const BRICK_PAD = 6;
  const BRICK_OFFSET_X = (W - (BRICK_COLS * (BRICK_W + BRICK_PAD) - BRICK_PAD)) / 2;
  const BRICK_OFFSET_Y = 55;
  let bricks = [];

  // coin drops
  let drops = []; // {x, y, type, vy} type: 'coin', 'wide', 'multi'

  // particles
  let particles = [];

  // input
  let touches = { left: false, right: false, action: false };
  let keys = {};
  let difficultyMult = 1;   // v7.18 difficulty ramp

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

  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 300,
        vy: (Math.random() - 0.5) * 300,
        life: 0.3 + Math.random() * 0.3,
        color: color, size: 2 + Math.random() * 3
      });
    }
  }

  // brick row colors (top row worth most)
  const ROW_COLORS = ['#FF10F0', '#FF4444', '#FFE600', '#39FF88', '#00FFFF'];
  const ROW_POINTS = [50, 40, 30, 20, 10];

  function createBricks() {
    bricks = [];
    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        const x = BRICK_OFFSET_X + c * (BRICK_W + BRICK_PAD);
        const y = BRICK_OFFSET_Y + r * (BRICK_H + BRICK_PAD);
        let type = 'normal';
        if (Math.random() < 0.05) type = 'powerup_wide'; // 5% chance wide paddle powerup
        else if (Math.random() < 0.05) type = 'powerup_multi'; // 5% chance multi-ball
        bricks.push({
          x: x, y: y, w: BRICK_W, h: BRICK_H,
          color: ROW_COLORS[r],
          points: ROW_POINTS[r],
          hp: 1,
          type: type,
          alive: true
        });
      }
    }
  }

  function createBall(x, y, vx, vy) {
    return {
      x: x, y: y,
      r: 7,
      vx: vx || 0,
      vy: vy || 0,
      speed: Math.min(350 * difficultyMult, 560), // v7.18: cap so ball isn't too fast
      active: false // becomes active when served
    };
  }

  function serveBall() {
    if (balls.length === 0) {
      const b = createBall(PADDLE.x + PADDLE.w / 2, PADDLE.y - 10);
      balls.push(b);
    }
    for (const b of balls) {
      if (!b.active) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
        b.vx = Math.cos(angle) * b.speed;
        b.vy = Math.sin(angle) * b.speed;
        b.active = true;
      }
    }
    serving = false;
  }

  function reset() {
    score = 0; coins = 0; over = false;
    PADDLE.x = W / 2 - PADDLE.baseW / 2;
    PADDLE.w = PADDLE.baseW;
    PADDLE.wideTimer = 0;
    balls = [];
    drops = [];
    particles = [];
    createBricks();
    serving = true;
    difficultyMult = 1;
    // place initial ball on paddle
    const b = createBall(PADDLE.x + PADDLE.w / 2, PADDLE.y - 10);
    balls.push(b);
  }

  // ---- update ----
  function update(dt) {
    if (over || !running) return;

    // paddle movement
    let moveDir = 0;
    if (touches.left) moveDir -= 1;
    if (touches.right) moveDir += 1;
    if (keys.ArrowLeft || keys.KeyA) moveDir -= 1;
    if (keys.ArrowRight || keys.KeyD) moveDir += 1;
    PADDLE.x += moveDir * PADDLE.speed * dt;
    PADDLE.x = Math.max(10, Math.min(W - PADDLE.w - 10, PADDLE.x));

    // wide paddle timer
    if (PADDLE.wideTimer > 0) {
      PADDLE.wideTimer -= dt;
      if (PADDLE.wideTimer <= 0) {
        PADDLE.w = PADDLE.baseW;
      }
    }

    // serve ball
    if (serving && (touches.action || keys.Space || keys.Enter)) {
      serveBall();
    }

    // update balls
    for (let bi = balls.length - 1; bi >= 0; bi--) {
      const b = balls[bi];

      if (!b.active) {
        // sit on paddle
        b.x = PADDLE.x + PADDLE.w / 2;
        b.y = PADDLE.y - b.r - 2;
        continue;
      }

      // move
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // wall collisions
      if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); }
      if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
      if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); }

      // bottom = lose ball
      if (b.y - b.r > H) {
        balls.splice(bi, 1);
        continue;
      }

      // paddle collision
      if (b.vy > 0 && b.y + b.r >= PADDLE.y && b.y + b.r <= PADDLE.y + PADDLE.h + 8 &&
          b.x >= PADDLE.x - 4 && b.x <= PADDLE.x + PADDLE.w + 4) {
        b.y = PADDLE.y - b.r;
        // angle based on where ball hits paddle
        const hitPos = (b.x - PADDLE.x) / PADDLE.w; // 0-1
        const angle = -Math.PI / 2 + (hitPos - 0.5) * Math.PI * 0.7;
        const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        b.vx = Math.cos(angle) * speed;
        b.vy = Math.sin(angle) * speed;
        // ensure going up
        if (b.vy > -50) b.vy = -50;
        if (typeof window.playSfx === 'function') { try { window.playSfx('click'); } catch (e) {} } // v7.15 paddle tap
      }

      // brick collisions
      for (const br of bricks) {
        if (!br.alive) continue;
        if (b.x + b.r > br.x && b.x - b.r < br.x + br.w &&
            b.y + b.r > br.y && b.y - b.r < br.y + br.h) {
          // determine collision side
          const overlapLeft = (b.x + b.r) - br.x;
          const overlapRight = (br.x + br.w) - (b.x - b.r);
          const overlapTop = (b.y + b.r) - br.y;
          const overlapBottom = (br.y + br.h) - (b.y - b.r);
          const minOverlapX = Math.min(overlapLeft, overlapRight);
          const minOverlapY = Math.min(overlapTop, overlapBottom);

          if (minOverlapX < minOverlapY) {
            b.vx = -b.vx;
          } else {
            b.vy = -b.vy;
          }

          br.hp -= 1;
          if (br.hp <= 0) {
            br.alive = false;
            score += br.points;
            onScore(score);
            if (typeof window.playSfx === 'function') { try { window.playSfx('pop'); } catch (e) {} } // v7.15 brick break
            spawnParticles(br.x + br.w / 2, br.y + br.h / 2, br.color, 8);

            // coin drop: 10% chance
            if (Math.random() < 0.10) {
              drops.push({ x: br.x + br.w / 2, y: br.y + br.h / 2, type: 'coin', vy: 120 });
            }

            // powerup drops from special bricks
            if (br.type === 'powerup_wide') {
              drops.push({ x: br.x + br.w / 2, y: br.y + br.h / 2, type: 'wide', vy: 100 });
            } else if (br.type === 'powerup_multi') {
              drops.push({ x: br.x + br.w / 2, y: br.y + br.h / 2, type: 'multi', vy: 100 });
            }
          }
          break; // one collision per ball per frame
        }
      }
    }

    // check if all bricks destroyed
    if (bricks.every(b => !b.alive)) {
      // next level - regenerate with some speed increase
      createBricks();
      for (const b of balls) {
        b.speed += 20;
        const angle = Math.atan2(b.vy, b.vx);
        const sp = b.speed;
        b.vx = Math.cos(angle) * sp;
        b.vy = Math.sin(angle) * sp;
      }
    }

    // check if no balls left
    if (balls.length === 0) {
      gameOver();
      return;
    }

    // update drops
    for (let di = drops.length - 1; di >= 0; di--) {
      const d = drops[di];
      d.y += d.vy * dt;
      if (d.y > H + 20) {
        drops.splice(di, 1);
        continue;
      }
      // collision with paddle
      if (d.y + 10 >= PADDLE.y && d.y - 10 <= PADDLE.y + PADDLE.h &&
          d.x >= PADDLE.x && d.x <= PADDLE.x + PADDLE.w) {
        if (d.type === 'coin') {
          coins += 10;
          onCoins(10);
          score += 20;
          onScore(score);
          spawnParticles(d.x, d.y, '#FFE600', 6);
        } else if (d.type === 'wide') {
          PADDLE.w = Math.min(180, PADDLE.w + 40);
          PADDLE.wideTimer = 10;
          spawnParticles(d.x, d.y, '#FFE600', 8);
        } else if (d.type === 'multi') {
          // duplicate all active balls
          const newBalls = [];
          for (const b of balls) {
            if (b.active) {
              const nb = createBall(b.x, b.y, -b.vx, b.vy);
              nb.active = true;
              nb.speed = b.speed;
              newBalls.push(nb);
              const nb2 = createBall(b.x, b.y, b.vx * 0.7, -Math.abs(b.vy));
              nb2.active = true;
              nb2.speed = b.speed;
              newBalls.push(nb2);
            }
          }
          balls = balls.concat(newBalls);
          spawnParticles(d.x, d.y, '#FF10F0', 10);
        }
        drops.splice(di, 1);
      }
    }

    // update particles
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);
  }

  // ---- render ----
  function render() {
    // bg
    ctx.fillStyle = '#05070A';
    ctx.fillRect(0, 0, W, H);

    // bricks
    for (const br of bricks) {
      if (!br.alive) continue;
      let color = br.color;
      let glow = 10;
      if (br.type === 'powerup_wide') {
        color = '#FFE600';
        glow = 16;
      } else if (br.type === 'powerup_multi') {
        color = '#FF10F0';
        glow = 16;
      }
      rect(br.x, br.y, br.w, br.h, color, glow);
      // brick highlight
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(br.x + 2, br.y + 2, br.w - 4, br.h / 2 - 2);
      // powerup indicator
      if (br.type === 'powerup_wide') {
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('W', br.x + br.w / 2 - 5, br.y + br.h / 2 + 4);
      } else if (br.type === 'powerup_multi') {
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('M', br.x + br.w / 2 - 5, br.y + br.h / 2 + 4);
      }
    }

    // paddle
    const pColor = PADDLE.wideTimer > 0 ? '#FFE600' : '#00FFFF';
    rect(PADDLE.x, PADDLE.y, PADDLE.w, PADDLE.h, pColor, 14);
    // paddle highlight
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(PADDLE.x + 2, PADDLE.y + 2, PADDLE.w - 4, PADDLE.h / 2);

    // balls
    for (const b of balls) {
      circle(b.x, b.y, b.r, '#FFFFFF', 16);
      // glow trail
      ctx.fillStyle = 'rgba(0,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(b.x - b.vx * 0.02, b.y - b.vy * 0.02, b.r - 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // drops
    for (const d of drops) {
      if (d.type === 'coin') {
        circle(d.x, d.y, 8, '#FFE600', 14);
        ctx.fillStyle = '#AA8800';
        ctx.beginPath();
        ctx.arc(d.x, d.y, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.type === 'wide') {
        // gold star
        ctx.fillStyle = '#FFE600';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#FFE600';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('⬥', d.x - 6, d.y + 5);
        ctx.shadowBlur = 0;
      } else if (d.type === 'multi') {
        // pink diamond
        ctx.fillStyle = '#FF10F0';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#FF10F0';
        ctx.beginPath();
        ctx.moveTo(d.x, d.y - 8);
        ctx.lineTo(d.x + 7, d.y);
        ctx.lineTo(d.x, d.y + 8);
        ctx.lineTo(d.x - 7, d.y);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // particles
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / 0.4);
      circle(p.x, p.y, p.size, p.color, 6);
    }
    ctx.globalAlpha = 1;

    // HUD
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00FFFF';
    ctx.fillStyle = '#00FFFF';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('SCORE: ' + score, 14, 26);
    ctx.shadowColor = '#FFE600';
    ctx.fillStyle = '#FFE600';
    ctx.fillText('COINS: ' + coins, W - 150, 26);
    ctx.shadowBlur = 0;

    // wide paddle timer indicator
    if (PADDLE.wideTimer > 0) {
      ctx.shadowColor = '#FFE600';
      ctx.fillStyle = '#FFE600';
      ctx.font = '12px monospace';
      ctx.fillText('WIDE: ' + Math.ceil(PADDLE.wideTimer) + 's', W / 2 - 30, 26);
      ctx.shadowBlur = 0;
    }

    // serve prompt
    if (serving) {
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#FFE600';
      ctx.fillStyle = '#FFE600';
      ctx.font = '18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('TAP ACTION TO SERVE', W / 2, H / 2 + 60);
      ctx.textAlign = 'left';
      ctx.shadowBlur = 0;
    }

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
    if (typeof gameFX !== 'undefined') { try { var __r = canvas.getBoundingClientRect(); gameFX.burst(__r.left + (W/2) * __r.width / canvas.width, __r.top + (H/2) * __r.height / canvas.height, '#ff4444', 16); } catch(e){} gameFX.shake(5); }
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
    destroy() { running = false; if (raf) cancelAnimationFrame(raf); },
    resume() { if (over || running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); },
    destroy() { running = false; if (raf) cancelAnimationFrame(raf); },
    setInput(t, k) { touches = t || {}; keys = k || {}; },
    setDifficulty(level) {
      const m = [1.0, 1.15, 1.3, 1.5, 1.75, 2.0];
      const l = Math.max(0, Math.min(5, Math.floor(level) || 0));
      difficultyMult = m[l];
      // recolor live balls' speed (capped)
      for (const b of balls) {
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > 0) {
          const ns = Math.min(350 * difficultyMult, 560);
          b.vx = (b.vx / sp) * ns;
          b.vy = (b.vy / sp) * ns;
        }
      }
    },
    controls: { joystick: false, boost: false, action: true, drift: false }
  };
}
