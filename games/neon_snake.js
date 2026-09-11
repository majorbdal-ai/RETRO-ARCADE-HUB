/* ============================================================
   Neon Snake — Classic grid snake (v2: particles, popups, levels, death FX)
   Canvas 800x450, 20x15 grid, arrow/swipe controls
   ============================================================ */
function neonSnake(canvas, ctx, onScore, onGameOver, onCoins) {
  // ---- state ----
  const W = 800, H = 450;
let diffMul = 1;  // v7.20 difficulty ramp
  let raf = null, last = 0, running = false;
  let score = 0, coins = 0;
  let over = false, deathTimer = 0;

  // grid
  const COLS = 20, ROWS = 15;
  const CELL = Math.floor(W / COLS); // 40
  const OFFSET_X = Math.floor((W - CELL * COLS) / 2); // center
  const OFFSET_Y = Math.floor((H - CELL * ROWS) / 2) + 20; // center + HUD space

  // snake
  let snake = [];
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let food = { x: 0, y: 0, type: 'normal', pulse: 0 };
  let moveTimer = 0;
  let baseSpeed = 0.14; // seconds per cell
  let speed = baseSpeed;
  let ate = false;

  // difficulty / level
  let level = 1;
  let levelUpTimer = 0;
  const LEVEL_THRESHOLDS = [5, 12, 20, 30, 42, 55, 70, 85, 100];

  // particles & FX
  let particles = [];
  let scorePopups = [];
  let shakeTimer = 0;
  let flashTimer = 0;
  let trailParticles = [];

  // input
  let touches = { left: false, right: false, boost: false };
  let keys = {};

  // ---- helpers ----
  function vibrate(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {}
  }

  function reset() {
    score = 0; coins = 0; over = false; deathTimer = 0;
    const startX = 4, startY = Math.floor(ROWS / 2);
    snake = [];
    for (let i = 3; i >= 0; i--) {
      snake.push({ x: startX - i, y: startY });
    }
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    speed = baseSpeed;
    moveTimer = 0;
    level = 1;
    levelUpTimer = 0;
    particles = [];
    scorePopups = [];
    shakeTimer = 0;
    flashTimer = 0;
    trailParticles = [];
    spawnFood();
  }

  function spawnFood() {
    let pos;
    do {
      pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (snake.some(s => s.x === pos.x && s.y === pos.y));
    // 15% chance of bonus food at higher levels
    const isBonus = level >= 3 && Math.random() < 0.15;
    food = { x: pos.x, y: pos.y, type: isBonus ? 'bonus' : 'normal', pulse: 0 };
  }

  function cellRect(cx, cy) {
    return { x: OFFSET_X + cx * CELL, y: OFFSET_Y + cy * CELL, w: CELL, h: CELL };
  }

  function spawnParticles(x, y, color, count, spread) {
    spread = spread || 120;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 30 + Math.random() * spread;
      particles.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 0.4 + Math.random() * 0.5,
        maxLife: 0.9,
        color,
        size: 1 + Math.random() * 3
      });
    }
  }

  function spawnScorePopup(x, y, text, color) {
    scorePopups.push({ x, y, text, color, life: 1.0, vy: -50 });
  }

  function spawnTrail(x, y, color) {
    trailParticles.push({
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 6,
      life: 0.3 + Math.random() * 0.2,
      color,
      size: 1.5 + Math.random() * 2
    });
  }

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

  function setDir(nx, ny) {
    // prevent 180-degree turn
    if (dir.x === -nx && dir.y === -ny) return;
    nextDir = { x: nx, y: ny };
  }

  function updateLevel() {
    const newLevel = LEVEL_THRESHOLDS.findIndex(t => score < t) + 1 || LEVEL_THRESHOLDS.length + 1;
    if (newLevel > level) {
      level = newLevel;
      levelUpTimer = 2.0;
      spawnScorePopup(W / 2, H / 2 - 40, 'LEVEL ' + level + '!', '#00ffff');
      if (typeof window.playSfx === 'function') { try { window.playSfx('win'); } catch (e) {} } // v7.15
      vibrate([30, 20, 30, 20, 60]);
    }
  }

  // ---- update ----
  function update(dt) {
    if (over) {
      deathTimer += dt;
      // death particles
      if (deathTimer < 0.8 && Math.random() < 0.5) {
        const head = snake.length > 0 ? snake[snake.length - 1] : { x: 10, y: 7 };
        const r = cellRect(head.x, head.y);
        spawnParticles(r.x + r.w / 2, r.y + r.h / 2, '#ff3333', 3, 80);
      }
      updateParticles(dt);
      updatePopups(dt);
      updateTrail(dt);
      if (deathTimer > 0.5 && (touches.action || keys.Space || keys.ArrowUp || keys.ArrowDown)) {
        return; // let core.js handle restart
      }
      return;
    }
    if (!running) return;

    // input: keys / touches
    if (keys.ArrowUp || keys.KeyW) setDir(0, -1);
    if (keys.ArrowDown || keys.KeyS) setDir(0, 1);
    if (keys.ArrowLeft || keys.KeyA) setDir(-1, 0);
    if (keys.ArrowRight || keys.KeyD) setDir(1, 0);

    moveTimer += dt;
    if (moveTimer < speed) {
      // still animate FX while waiting
      updateParticles(dt);
      updatePopups(dt);
      updateTrail(dt);
      food.pulse += dt * 6;
      if (levelUpTimer > 0) levelUpTimer -= dt;
      if (shakeTimer > 0) shakeTimer -= dt;
      if (flashTimer > 0) flashTimer -= dt;
      return;
    }
    moveTimer -= speed;

    dir = { x: nextDir.x, y: nextDir.y };

    // trail behind head
    const head = snake.length > 0 ? snake[snake.length - 1] : null;
    if (head) {
      const hr = cellRect(head.x, head.y);
      spawnTrail(hr.x + hr.w / 2, hr.y + hr.h / 2, 'rgba(57,255,136,0.4)');
    }

    // new head
    const headNow = snake[snake.length - 1];
    const nx = headNow.x + dir.x;
    const ny = headNow.y + dir.y;

    // wall collision
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
      die(headNow);
      return;
    }

    // self collision
    for (let i = 0; i < snake.length; i++) {
      if (snake[i].x === nx && snake[i].y === ny) {
        die(headNow);
        return;
      }
    }

    snake.push({ x: nx, y: ny });

    // food collision
    if (nx === food.x && ny === food.y) {
      const r = cellRect(food.x, food.y);
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;

      if (food.type === 'bonus') {
        score = snake.length + 3;
        coins += 3;
        onScore(score);
        onCoins(3);
        spawnParticles(cx, cy, '#ff00ff', 25, 160);
        spawnScorePopup(cx, cy, '+3 BONUS!', '#ff00ff');
        if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} } // v7.15
        vibrate([30, 15, 30, 15, 50]);
      } else {
        score = snake.length;
        coins += 1;
        onScore(score);
        onCoins(1);
        spawnParticles(cx, cy, '#FFE600', 12, 100);
        spawnScorePopup(cx, cy, '+' + snake.length, '#FFE600');
        if (typeof window.playSfx === 'function') { try { window.playSfx('pop'); } catch (e) {} } // v7.15
        vibrate(20);
      }

      // speed up
      speed = Math.max(0.03, speed - 0.003) / diffMul;
      updateLevel();
      spawnFood();
    } else {
      snake.shift();
    }

    // update FX
    updateParticles(dt);
    updatePopups(dt);
    updateTrail(dt);
    food.pulse += dt * 6;
    if (levelUpTimer > 0) levelUpTimer -= dt;
    if (shakeTimer > 0) shakeTimer -= dt;
    if (flashTimer > 0) flashTimer -= dt;
  }

  function die(headNow) {
    over = true;
    if (typeof gameFX !== 'undefined') { try { var __r = canvas.getBoundingClientRect(); gameFX.burst(__r.left + (W/2) * __r.width / canvas.width, __r.top + (H/2) * __r.height / canvas.height, '#ff4444', 16); } catch(e){} gameFX.shake(5); }
    deathTimer = 0;
    running = false;
    shakeTimer = 0.4;
    flashTimer = 0.3;
    if (navigator.vibrate) { try { navigator.vibrate([100, 50, 100]); } catch (e) {} }
    // burst from collision point
    if (headNow) {
      const r = cellRect(headNow.x, headNow.y);
      spawnParticles(r.x + r.w / 2, r.y + r.h / 2, '#ff3333', 30, 180);
      spawnParticles(r.x + r.w / 2, r.y + r.h / 2, '#ff8800', 15, 120);
    }
    if (raf) cancelAnimationFrame(raf);
    // Brief delay before allowing core.js game-over to fire
    setTimeout(() => onGameOver(Math.floor(score), coins), 400);
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.life -= dt * 2;
      if (p.life <= 0) particles.splice(i, 1);
    }
    if (particles.length > 200) particles.splice(0, particles.length - 200);
  }

  function updatePopups(dt) {
    for (let i = scorePopups.length - 1; i >= 0; i--) {
      const p = scorePopups[i];
      p.y += p.vy * dt;
      p.life -= dt * 1.4;
      if (p.life <= 0) scorePopups.splice(i, 1);
    }
  }

  function updateTrail(dt) {
    for (let i = trailParticles.length - 1; i >= 0; i--) {
      const t = trailParticles[i];
      t.life -= dt * 3;
      if (t.life <= 0) trailParticles.splice(i, 1);
    }
    if (trailParticles.length > 80) trailParticles.splice(0, trailParticles.length - 80);
  }

  // ---- render ----
  function render() {
    // screen shake
    const shx = shakeTimer > 0 ? (Math.random() - 0.5) * 6 * Math.min(1, shakeTimer * 5) : 0;
    const shy = shakeTimer > 0 ? (Math.random() - 0.5) * 6 * Math.min(1, shakeTimer * 5) : 0;

    ctx.save();
    ctx.translate(shx, shy);

    // bg
    ctx.fillStyle = '#05070A';
    ctx.fillRect(0, 0, W, H);

    // grid border
    ctx.strokeStyle = 'rgba(57,255,136,0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(OFFSET_X - 2, OFFSET_Y - 2, CELL * COLS + 4, CELL * ROWS + 4);

    // faint grid lines
    ctx.strokeStyle = 'rgba(57,255,136,0.06)';
    ctx.lineWidth = 1;
    for (let c = 1; c < COLS; c++) {
      const x = OFFSET_X + c * CELL;
      ctx.beginPath(); ctx.moveTo(x, OFFSET_Y); ctx.lineTo(x, OFFSET_Y + ROWS * CELL); ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      const y = OFFSET_Y + r * CELL;
      ctx.beginPath(); ctx.moveTo(OFFSET_X, y); ctx.lineTo(OFFSET_X + COLS * CELL, y); ctx.stroke();
    }

    // trail behind snake
    for (const t of trailParticles) {
      ctx.globalAlpha = t.life * 0.6;
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.size * t.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // food (glowing dot with pulse)
    const fPos = cellRect(food.x, food.y);
    const fcx = fPos.x + fPos.w / 2, fcy = fPos.y + fPos.h / 2;
    const foodPulse = 1 + Math.sin(food.pulse) * 0.15;
    const foodR = CELL * 0.3 * foodPulse;
    if (food.type === 'bonus') {
      // bonus food: pulsing magenta diamond
      ctx.save();
      ctx.translate(fcx, fcy);
      ctx.rotate(food.pulse * 0.5);
      ctx.shadowBlur = 22;
      ctx.shadowColor = '#ff00ff';
      ctx.fillStyle = '#ff00ff';
      ctx.beginPath();
      ctx.moveTo(0, -foodR * 1.2);
      ctx.lineTo(foodR * 1.2, 0);
      ctx.lineTo(0, foodR * 1.2);
      ctx.lineTo(-foodR * 1.2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    } else {
      circle(fcx, fcy, foodR, '#FFE600', 18);
    }

    // snake body
    for (let i = 0; i < snake.length; i++) {
      const s = snake[i];
      const r = cellRect(s.x, s.y);
      const isHead = i === snake.length - 1;
      const ratio = i / Math.max(1, snake.length - 1);
      const alpha = 0.45 + ratio * 0.55;
      const color = isHead ? '#39FF88' : `rgba(57,255,136,${alpha})`;
      const glow = isHead ? 22 : Math.round(8 + ratio * 10);
      const pad = 1;
      ctx.shadowBlur = glow;
      ctx.shadowColor = '#39FF88';
      ctx.fillStyle = color;
      // round corners for head
      if (isHead) {
        const rad = 6;
        ctx.beginPath();
        ctx.roundRect(r.x + pad, r.y + pad, r.w - pad * 2, r.h - pad * 2, rad);
        ctx.fill();
      } else {
        ctx.fillRect(r.x + pad, r.y + pad, r.w - pad * 2, r.h - pad * 2);
      }
      ctx.shadowBlur = 0;
    }

    // eyes on head
    if (snake.length > 0) {
      const head = snake[snake.length - 1];
      const hr = cellRect(head.x, head.y);
      const cx = hr.x + hr.w / 2, cy = hr.y + hr.h / 2;
      const ex = dir.x * 7, ey = dir.y * 7;
      ctx.fillStyle = '#05070A';
      ctx.beginPath(); ctx.arc(cx - 5 + ex * 0.5, cy - 4 + ey * 0.5, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 5 + ex * 0.5, cy + 4 + ey * 0.5, 3.5, 0, Math.PI * 2); ctx.fill();
      // pupil glint
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx - 4 + ex * 0.6, cy - 5 + ey * 0.6, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 6 + ex * 0.6, cy + 3 + ey * 0.6, 1.2, 0, Math.PI * 2); ctx.fill();
    }

    // particles
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.shadowBlur = 6;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * Math.max(0, p.life / p.maxLife), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // score popups
    for (const p of scorePopups) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.color;
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
      ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    ctx.restore(); // end shake

    // === HUD (outside shake) ===

    // level-up flash
    if (levelUpTimer > 0) {
      const la = Math.min(1, levelUpTimer);
      ctx.globalAlpha = la * 0.15;
      ctx.fillStyle = '#00ffff';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    // death flash
    if (flashTimer > 0) {
      ctx.globalAlpha = flashTimer * 0.6;
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    // title
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#39FF88';
    ctx.fillStyle = '#39FF88';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('NEON SNAKE', OFFSET_X, 22);

    // score
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#FFE600';
    ctx.fillStyle = '#FFE600';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SCORE ' + score, W / 2, 22);

    // level + speed tier
    ctx.shadowColor = '#00ffff';
    ctx.fillStyle = '#00ffff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('LV.' + level + '  x' + snake.length, OFFSET_X + CELL * COLS, 22);

    // level progress bar
    const barX = OFFSET_X;
    const barY = 30;
    const barW = CELL * COLS;
    const barH = 4;
    ctx.fillStyle = 'rgba(57,255,136,0.15)';
    ctx.fillRect(barX, barY, barW, barH);
    const currentThreshold = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.findIndex(t => score < t)] || score + 20;
    const prevThreshold = LEVEL_THRESHOLDS[Math.max(0, LEVEL_THRESHOLDS.findIndex(t => score < t) - 1)] || 0;
    const progress = Math.min(1, (score - prevThreshold) / Math.max(1, currentThreshold - prevThreshold));
    ctx.fillStyle = '#39FF88';
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#39FF88';
    ctx.fillRect(barX, barY, barW * progress, barH);
    ctx.shadowBlur = 0;

    // control hint (first 4 seconds)
    if (deathTimer < 0.1 && score === 0) {
      // Only show at very start — we track this via a local flag
    }
    ctx.fillStyle = 'rgba(57,255,136,0.4)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ARROW KEYS / SWIPE TO STEER  •  TAP TO START', W / 2, H - 8);
    ctx.textAlign = 'left';

    ctx.shadowBlur = 0;
  }

  function loop(ts) {
    if (!running && !over) return;
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    update(dt);
    render();
    raf = requestAnimationFrame(loop);
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
    controls: { joystick: false, boost: false, action: false, drift: false },
    setDifficulty: function(lvl){ diffMul = [1,1.15,1.3,1.5,1.75,2][Math.min(5,Math.floor(lvl)||0)]||1; }
  };
}
