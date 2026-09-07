/* ============================================================
   Neon Racer — Game Engine (Template for all arcade games)
   Canvas 800x450, top-down endless racer
   Custom controls: steer left/right + BOOST button
   ============================================================ */
function neonRacer(canvas, ctx, onScore, onGameOver, onCoins) {
  // ---- state ----
  const W = 800, H = 450;
  let raf = null, last = 0, running = false;
  let score = 0, coins = 0, best = 0;
  let over = false;

  // road
  const LANES = 4;
  const laneW = 140;
  const roadLeft = (W - laneW * LANES) / 2;
  let roadSpeed = 300; // px/s
  let laneOffsets = [0, 0, 0, 0]; // for lane line scroll

  // player car
  const P = { w: 46, h: 80, lane: 1, x: 0, y: H - 110, boost: 0, boostTime: 0 };

  // enemies + coins
  let enemies = [];
  let pickups = [];
  let spawnTimer = 0;

  // input (set by core)
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
  function reset() {
    score = 0; coins = 0; over = false;
    roadSpeed = 300;
    enemies = []; pickups = [];
    P.lane = 1; P.x = roadLeft + laneW * 1.5 - P.w / 2;
    P.boost = 0; P.boostTime = 0;
    spawnTimer = 0;
    laneOffsets = [0, 0, 0, 0];
  }

  // ---- spawn ----
  function spawnEnemy() {
    const lane = Math.floor(Math.random() * LANES);
    // avoid spawning on top of another enemy in same lane near top
    if (enemies.some(e => e.lane === lane && e.y < 120)) return;
    const color = ['#FF10F0', '#FFE600', '#39FF88', '#F97316'][Math.floor(Math.random() * 4)];
    enemies.push({ lane, y: -100, w: 44, h: 76, color, speed: roadSpeed * (0.9 + Math.random() * 0.6) });
  }
  function spawnPickup() {
    const lane = Math.floor(Math.random() * LANES);
    pickups.push({ lane, y: -30, r: 12, taken: false });
  }

  // ---- update ----
  function update(dt) {
    if (over || !running) return;
    const speedMul = P.boostTime > 0 ? 2 : 1;
    const spd = roadSpeed * speedMul;

    // steer
    if (touches.left || keys.ArrowLeft || keys.KeyA) {
      P.lane = Math.max(0, P.lane - (P.lane === Math.floor(P.lane) ? 1 : 0));
      // smooth-ish lane movement handled by target x
    }
    if (touches.right || keys.ArrowRight || keys.KeyD) {
      P.lane = Math.min(LANES - 1, P.lane + (P.lane === Math.floor(P.lane) ? 1 : 0));
    }
    // smooth move toward target lane center
    const targetX = roadLeft + P.lane * laneW + laneW / 2 - P.w / 2;
    P.x += (targetX - P.x) * Math.min(1, dt * 10);

    // boost
    if (touches.boost || keys.KeyB || keys.Space) {
      if (P.boostTime <= 0) P.boostTime = 0; // just started
      P.boostTime = Math.max(0, P.boostTime - dt);
    } else {
      P.boostTime = 0;
    }
    // re-enable boost if boostTime refreshed
    P.boost = P.boostTime > 0;

    // though boost consumed by input; simpler: if boost held, keep time
    if (touches.boost || keys.KeyB || keys.Space) P.boostTime = 3;
    P.boostTime = Math.max(0, P.boostTime - dt);

    // scoring (distance)
    score += dt * spd * 0.05;
    onScore(Math.floor(score));

    // scroll road lines
    for (let i = 0; i < LANES; i++) {
      laneOffsets[i] = (laneOffsets[i] + spd * dt) % 40;
    }

    // spawn
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      if (Math.random() < 0.7) spawnEnemy();
      if (Math.random() < 0.4) spawnPickup();
      spawnTimer = Math.max(0.3, 1.1 - score / 20000);
    }

    // move enemies
    for (const e of enemies) {
      e.y += e.speed * dt;
    }
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
      }
    }
    pickups = pickups.filter(p => !p.taken);
  }

  // ---- render ----
  function render() {
    // bg
    ctx.fillStyle = '#05070A';
    ctx.fillRect(0, 0, W, H);

    // road
    ctx.fillStyle = '#0B0F1A';
    ctx.fillRect(roadLeft, 0, laneW * LANES, H);
    // road borders (neon)
    rect(roadLeft - 4, 0, 4, H, '#00FFFF', 10);
    rect(roadLeft + laneW * LANES, 0, 4, H, '#00FFFF', 10);

    // lane lines (dashed scroll)
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

    // pickups (coins)
    for (const p of pickups) {
      const px = roadLeft + p.lane * laneW + laneW / 2;
      circle(px, p.y, p.r, '#FFE600', 16);
    }

    // enemies
    for (const e of enemies) {
      const ex = roadLeft + e.lane * laneW + laneW / 2 - e.w / 2;
      rect(ex, e.y, e.w, e.h, e.color, 12);
      // windshield
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
    // player windshield
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(P.x + 4, P.y + 14, P.w - 8, 14);
    // boost flame
    if (P.boost) {
      ctx.fillStyle = '#FF10F0';
      ctx.beginPath();
      ctx.moveTo(P.x + P.w / 2 - 8, P.y + P.h);
      ctx.lineTo(P.x + P.w / 2, P.y + P.h + 26);
      ctx.lineTo(P.x + P.w / 2 + 8, P.y + P.h);
      ctx.closePath();
      ctx.fill();
    }

    // road speed lines (sense of speed)
    if (P.boost) {
      ctx.strokeStyle = 'rgba(0,255,255,0.5)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const x = (i * 130 + (performance.now() / 30 % 130)) % W;
        ctx.beginPath(); ctx.moveTo(x, H - 40); ctx.lineTo(x + 30, H - 80); ctx.stroke();
      }
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
    controls: { joystick: false, boost: true, action: false, drift: false }
  };
}
