function stackDrop(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  let keys = {}, touches = {};
  let blocks = [], movingBlock = null, stackBase = 20, stackTop = H;
  let combo = 0, totalScore = 0, speed = 120, dir = 1;
  let particles = [], shakeTimer = 0, perfectCount = 0;
  const BLOCK_H = 25;
  const BLOCK_W = 120;
  const BASE_X = 160;
  const TOLERANCE = 6;

  function reset() {
    blocks = [];
    particles = [];
    combo = 0;
    totalScore = 0;
    score = 0;
    coins = 0;
    over = false;
    speed = 120;
    perfectCount = 0;
    shakeTimer = 0;
    stackTop = H;
    spawnBlock();
    onScore(0);
  }

  function spawnBlock() {
    const w = Math.max(30, BLOCK_W - combo * 2);
    const startX = dir > 0 ? -w : W + w;
    movingBlock = { x: startX, y: stackTop - BLOCK_H - 4, w: w, h: BLOCK_H, speed: speed, dir: dir, dropped: false };
  }

  function dropBlock() {
    if (!movingBlock || movingBlock.dropped || over) return;
    movingBlock.dropped = true;
    const b = movingBlock;

    let placed = false;
    if (blocks.length === 0) {
      const aligned = Math.abs(b.x - BASE_X) < TOLERANCE;
      if (aligned) b.x = BASE_X;
      blocks.push({ x: b.x, y: b.y, w: b.w, h: b.h, perfect: true });
      stackTop = b.y;
      combo = 0;
      totalScore += 10;
      score = totalScore;
      coins += 1;
      perfectCount++;
      spawnParticles(b.x + b.w / 2, b.y, '#00ffff', 15);
      onScore(score);
      placed = true;
    } else {
      const top = blocks[blocks.length - 1];
      const overlap = Math.min(b.x + b.w, top.x + top.w) - Math.max(b.x, top.x);

      if (overlap <= 0) {
        over = true;
        onGameOver(score, coins);
        return;
      }

      if (overlap >= top.w - TOLERANCE) {
        b.x = top.x;
        b.w = top.w;
        b.perfect = true;
        combo++;
        const pts = 10 * (combo + 1);
        totalScore += pts;
        coins += 2;
        perfectCount++;
        shakeTimer = 0.15;
        spawnParticles(b.x + b.w / 2, b.y, '#00ff00', 20);
      } else {
        b.perfect = false;
        combo = 0;
        const sliceX = Math.min(b.x + b.w, top.x + top.w) - Math.max(b.x, top.x);
        const newX = Math.max(b.x, top.x);
        b.x = newX;
        b.w = Math.max(15, sliceX);
        totalScore += 10;
        coins += 1;
        spawnParticles(b.x + b.w / 2, b.y, '#ff6600', 8);
      }
      score = totalScore;
      stackTop = b.y;
      onScore(score);
      blocks.push({ x: b.x, y: b.y, w: b.w, h: b.h, perfect: b.perfect });
      if (blocks.length > 15) blocks.shift();
    }

    speed = Math.min(300, 120 + blocks.length * 8);
    dir = Math.random() > 0.5 ? 1 : -1;
    movingBlock = null;
    shakeTimer = 0.1;
    setTimeout(() => spawnBlock(), 400);

    if (stackTop < H / 2) {
      over = true;
      onGameOver(score, coins);
    }
  }

  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 200 - 50,
        life: 1,
        color,
        size: 2 + Math.random() * 3
      });
    }
  }

  function update(dt) {
    if (over) return;

    if ((touches.action || keys.Space || keys.KeyW) && movingBlock && !movingBlock.dropped) {
      dropBlock();
    }

    if (movingBlock && !movingBlock.dropped) {
      movingBlock.x += movingBlock.speed * movingBlock.dir * dt;
      if (movingBlock.x > W + 20) { movingBlock.dir = -1; }
      if (movingBlock.x + movingBlock.w < -20) { movingBlock.dir = 1; }
    }

    if (shakeTimer > 0) shakeTimer -= dt;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
      p.life -= dt * 2;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function draw() {
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, W, H);

    const shx = shakeTimer > 0 ? (Math.random() - 0.5) * 4 : 0;
    const shy = shakeTimer > 0 ? (Math.random() - 0.5) * 4 : 0;
    ctx.save();
    ctx.translate(shx, shy);

    ctx.strokeStyle = '#111122';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    const neonColors = ['#ff00ff', '#00ffff', '#ff6600', '#00ff88', '#ffff00', '#ff0088', '#8800ff'];

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const colorIdx = i % neonColors.length;
      const color = neonColors[colorIdx];
      const glow = b.perfect && i === blocks.length - 1 ? '#ffffff' : color;

      ctx.shadowBlur = b.perfect ? 15 : 8;
      ctx.shadowColor = glow;
      ctx.fillStyle = color;
      ctx.fillRect(b.x, b.y, b.w, b.h);

      ctx.strokeStyle = '#ffffff33';
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x, b.y, b.w, b.h);

      if (b.perfect && i === blocks.length - 1) {
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#00ffff';
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
      }
      ctx.shadowBlur = 0;
    }

    if (movingBlock && !movingBlock.dropped) {
      const color = '#00ffcc';
      ctx.shadowBlur = 12;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(performance.now() / 100);
      ctx.fillRect(movingBlock.x, movingBlock.y, movingBlock.w, movingBlock.h);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

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

    ctx.restore();

    ctx.font = 'bold 18px Orbitron, monospace';
    ctx.fillStyle = '#ff00ff';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff00ff';
    ctx.fillText('STACK DROP', 16, 28);
    ctx.font = '12px Orbitron, monospace';
    ctx.fillStyle = '#ff88ff';
    ctx.fillText('SPACE/TAP Drop  |  Perfect align = 2× score  |  Don\'t miss!', 16, 46);
    ctx.shadowBlur = 0;

    ctx.font = 'bold 20px Orbitron, monospace';
    ctx.fillStyle = '#ffff00';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffff00';
    ctx.fillText('SCORE: ' + score, W - 180, 36);

    if (combo > 1) {
      ctx.font = 'bold 16px Orbitron, monospace';
      ctx.fillStyle = '#00ff88';
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 12;
      ctx.fillText('COMBO x' + combo, W - 180, 58);
    }
    ctx.shadowBlur = 0;
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

  function pause() { running = false; cancelAnimationFrame(raf); }
  function resume() { if (!over && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); } }
  function destroy() { running = false; cancelAnimationFrame(raf); }

  return { start, pause, resume, destroy, setInput: (t, k) => { touches = t; keys = k; } };
}