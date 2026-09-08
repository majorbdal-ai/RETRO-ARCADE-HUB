/* ============================================================
   Neon Racer — Professional Arcade Racer
   Canvas 800x450, top-down endless neon racer
   Controls: TILT/LEFT-RIGHT steer, BOOST button
   Features: Level progression, speed scaling, canvas hints, particles
   ============================================================ */
function neonRacer(canvas, ctx, onScore, onGameOver, onCoins) {
  // ---- state ----
  const W = 800, H = 450;
  let raf = null, last = 0, running = false;
  let score = 0, coins = 0;
  let over = false;

  // road
  const LANES = 4;
  const laneW = 140;
  const roadLeft = (W - laneW * LANES) / 2;
  let roadSpeed = 300; // base px/s
  let laneOffsets = [0, 0, 0, 0];

  // player car
  const P = { w: 46, h: 80, lane: 1, x: 0, y: H - 110, boost: 0, boostTime: 0 };

  // enemies + coins
  let enemies = [];
  let pickups = [];
  let spawnTimer = 0;

  // progression
  let level = 1;
  let nextLevelScore = 1000;

  // particles (crash sparks, boost trail)
  let particles = [];

  // input
  let touches = { left: false, right: false, boost: false };
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
    roadSpeed = 300;
    level = 1;
    nextLevelScore = 1000;
    enemies = []; pickups = [];
    P.lane = 1; P.x = roadLeft + laneW * 1.5 - P.w / 2;
    P.boost = 0; P.boostTime = 0;
    spawnTimer = 0;
    laneOffsets = [0, 0, 0, 0];
    particles = [];
  }

  // ---- spawn ----
  function spawnEnemy() {
    const lane = Math.floor(Math.random() * LANES);
    if (enemies.some(e => e.lane === lane && e.y < 120)) return;
    const color = ['#FF10F0', '#FFE600', '#39FF88', '#F97316'][Math.floor(Math.random() * 4)];
    enemies.push({ lane, y: -100, w: 44, h: 76, color, speed: roadSpeed * (0.9 + Math.random() * 0.6) });
  }
  function spawnPickup() {
    const lane = Math.floor(Math.random() * LANES);
    pickups.push({ lane, y: -30, r: 12, taken: false });
  }

  // ---- progression ----
  function checkLevelUp() {
    if (score >= nextLevelScore) {
      level++;
      roadSpeed = Math.min(800, 300 + level * 60); // cap at 800
      nextLevelScore = level * 1000;
      // visual level-up flash
      particles.push({ x: W/2, y: H/2, type: 'levelup', life: 1.5 });
      if (navigator.vibrate) navigator.vibrate(50);
    }
  }

  // ---- particles ----
  function spawnCrashParticles(x, y) {
    for (let i = 0; i < 18; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 200 + Math.random() * 400;
      particles.push({
        x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        r: 4 + Math.random() * 4, color: ['#00FFFF', '#FF10F0', '#FFE600'][Math.floor(Math.random() * 3)],
        life: 0.6 + Math.random() * 0.4, maxLife: 1
      });
    }
  }
  function spawnBoostTrail() {
    const cx = P.x + P.w/2, cy = P.y + P.h;
    particles.push({
      x: cx + (Math.random()-0.5)*P.w*0.6, y: cy + (Math.random()-0.5)*20,
      vx: (Math.random()-0.5)*50, vy: 100 + Math.random()*150,
      r: 3 + Math.random()*3, color: Math.random() < 0.5 ? '#FF10F0' : '#FFE600',
      life: 0.3, maxLife: 0.3, fade: true
    });
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }
  function renderParticles() {
    for (const p of particles) {
      const alpha = p.fade ? (p.life / p.maxLife) : 1;
      ctx.globalAlpha = alpha;
      circle(p.x, p.y, p.r, p.color, 16);
    }
    ctx.globalAlpha = 1;
  }

  // ---- update ----
  function update(dt) {
    if (over || !running) return;
    const speedMul = P.boost ? 2 : 1;
    const spd = roadSpeed * speedMul;

    // steer (smooth lane change)
    if (touches.left || keys.ArrowLeft || keys.KeyA) {
      P.lane = Math.max(0, P.lane - (P.lane === Math.floor(P.lane) ? 1 : 0));
    }
    if (touches.right || keys.ArrowRight || keys.KeyD) {
      P.lane = Math.min(LANES - 1, P.lane + (P.lane === Math.floor(P.lane) ? 1 : 0));
    }
    const targetX = roadLeft + P.lane * laneW + laneW / 2 - P.w / 2;
    P.x += (targetX - P.x) * Math.min(1, dt * 12);

    // boost handling
    if (touches.boost || keys.KeyB || keys.Space) {
      P.boostTime = 3; // hold for 3s boost
    } else {
      P.boostTime = Math.max(0, P.boostTime - dt);
    }
    P.boost = P.boostTime > 0;

    // scoring (distance + level bonus)
    score += dt * spd * 0.05 * level;
    onScore(Math.floor(score));
    checkLevelUp();

    // road scroll
    for (let i = 0; i < LANES; i++) {
      laneOffsets[i] = (laneOffsets[i] + spd * dt) % 40;
    }

    // spawn (rate increases with level)
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      if (Math.random() < 0.65 + level * 0.03) spawnEnemy();
      if (Math.random() < 0.35 + level * 0.02) spawnPickup();
      spawnTimer = Math.max(0.25, 1.0 - level * 0.08 - score / 25000);
    }

    // move enemies
    for (const e of enemies) e.y += e.speed * dt;
    enemies = enemies.filter(e => e.y < H + 120);

    // move pickups
    for (const p of pickups) p.y += spd * dt;
    pickups = pickups.filter(p => p.y < H + 40);

    // collisions
    const bounds = { x: P.x, y: P.y, w: P.w, h: P.h };
    for (const e of enemies) {
      const eb = { x: roadLeft + e.lane * laneW + laneW / 2 - e.w / 2, y: e.y, w: e.w, h: e.h };
      if (bounds.x < eb.x + eb.w && bounds.x + bounds.w > eb.x &&
          bounds.y < eb.y + eb.h && bounds.y + bounds.h > eb.y) {
        spawnCrashParticles(roadLeft + e.lane * laneW + laneW / 2, e.y + e.h / 2);
        gameOver();
        return;
      }
    }
    for (const p of pickups) {
      if (p.taken) continue;
      const px = roadLeft + p.lane * laneW + laneW / 2;
      if (Math.abs(P.x + P.w / 2 - px) < 50 && Math.abs(P.y + P.h / 2 - p.y) < 50) {
        p.taken = true;
        coins += 10;
        onCoins(10);
        particles.push({ x: px, y: p.y, type: 'coin', life: 0.5 });
      }
    }
    pickups = pickups.filter(p => !p.taken);

    // boost trail particles
    if (P.boost && Math.random() < 0.4) spawnBoostTrail();

    updateParticles(dt);
  }

  // ---- render ----
  function render() {
    // bg
    ctx.fillStyle = '#05070A';
    ctx.fillRect(0, 0, W, H);

    // road
    ctx.fillStyle = '#0B0F1A';
    ctx.fillRect(roadLeft, 0, laneW * LANES, H);
    rect(roadLeft - 4, 0, 4, H, '#00FFFF', 10);
    rect(roadLeft + laneW * LANES, 0, 4, H, '#00FFFF', 10);

    // lane lines
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    for (let i = 1; i < LANES; i++) {
      const x = roadLeft + i * laneW;
      ctx.beginPath();
      for (let y = -laneOffsets[i]; y < H; y += 40) {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 20);
      }
      ctx.stroke();
    }

    // pickups
    for (const p of pickups) {
      const px = roadLeft + p.lane * laneW + laneW / 2;
      circle(px, p.y, p.r, '#FFE600', 16);
    }

    // enemies
    for (const e of enemies) {
      const ex = roadLeft + e.lane * laneW + laneW / 2 - e.w / 2;
      rect(ex, e.y, e.w, e.h, e.color, 12);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(ex + 4, e.y + 12, e.w - 8, 12);
      ctx.fillRect(ex + 4, e.y + e.h - 24, e.w - 8, 12);
    }

    // player
    const glow = P.boost ? '#FFE600' : '#00FFFF';
    ctx.shadowBlur = P.boost ? 24 : 14;
    ctx.shadowColor = glow;
    ctx.fillStyle = P.boost ? '#BFFF00' : '#00E5FF';
    ctx.fillRect(P.x, P.y, P.w, P.h);
    ctx.shadowBlur = 0;
    // windshield
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(P.x + 4, P.y + 14, P.w - 8, 14);
    // boost flame
    if (P.boost) {
      ctx.fillStyle = '#FF10F0';
      ctx.beginPath();
      ctx.moveTo(P.x + P.w/2 - 8, P.y + P.h);
      ctx.lineTo(P.x + P.w/2, P.y + P.h + 26);
      ctx.lineTo(P.x + P.w/2 + 8, P.y + P.h);
      ctx.closePath();
      ctx.fill();
    }

    // speed lines
    if (P.boost) {
      ctx.strokeStyle = 'rgba(0,255,255,0.5)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const x = (i * 100 + (performance.now() / 20 % 100)) % W;
        ctx.beginPath(); ctx.moveTo(x, H - 30); ctx.lineTo(x + 40, H - 100); ctx.stroke();
      }
    }

    // particles
    renderParticles();

    // --- HUD on canvas: title, level, controls hint ---
    drawText('NEON RACER', 12, 28, 18, '#00FFFF');
    drawText(`LEVEL ${level}`, 12, 52, 14, '#FFE600');
    drawText('TILT/LEFT-RIGHT STEER  •  BOOST', W - 12, 28, 12, '#8888AA', 'right');
    drawText('SCORE ' + Math.floor(score).toLocaleString(), W - 12, 52, 14, '#FFFFFF', 'right');
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
    if (navigator.vibrate) { try { navigator.vibrate([100, 50, 100]); } catch (e) {} }
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
    pause() { running = false; if (raf) cancelAnimationFrame(raf); },
    resume() { if (over || running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); },
    destroy() { running = false; if (raf) cancelAnimationFrame(raf); },
    setInput(t, k) { touches = t || {}; keys = k || {}; },
    controls: { joystick: false, boost: true, action: false, drift: false }
  };
}