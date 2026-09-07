function helixDrop(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  let keys = {}, touches = {};

  const RINGS = 12;
  const RING_H = H / RINGS;
  const CENTER_X = W / 2;
  const BALL_OFFSET = 120;      // ball rides a fixed radius around center
  const TOWER_R = 112;
  const RING_W = 24;
  const BALL_R = 16;

  let rings = [];
  let ball = { x: CENTER_X + BALL_OFFSET, y: 50, vy: 0, angle: 0 };
  let rotationSpeed = 0;
  let fallSpeed = 1;
  let targetFallSpeed = 1;
  let level = 1;
  let shake = 0;
  let passedCount = 0;
  let pulse = 0;

  const COLORS = ['#ff3366', '#33ccff', '#ffcc00', '#66ff66', '#cc66ff', '#ff9933', '#00ffcc', '#ff33aa'];

  function reset() {
    rings = [];
    for (let i = 0; i < RINGS; i++) {
      const segments = 6 + (i % 3);
      const gapCount = 1 + Math.floor(Math.random() * 2);
      const gaps = [];
      const used = new Set();
      for (let g = 0; g < gapCount; g++) {
        let gi;
        do { gi = Math.floor(Math.random() * segments); } while (used.has(gi));
        used.add(gi);
        gaps.push(gi);
      }
      rings.push({
        y: H - 9 - (RINGS - 1 - i) * RING_H,
        radius: TOWER_R,
        segments,
        gaps,
        color: COLORS[i % COLORS.length],
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.35,
        passed: false
      });
    }
    ball.x = CENTER_X + BALL_OFFSET;
    ball.y = 40;
    ball.vy = 0;
    ball.angle = 0;
    rotationSpeed = 0;
    fallSpeed = 1;
    targetFallSpeed = 1;
    level = 1;
    score = 0;
    coins = 0;
    shake = 0;
    passedCount = 0;
    pulse = 0;
    over = false;
    onScore(score);
  }

  function update(dt) {
    if (shake > 0) shake -= dt;
    pulse += dt;

    const turn = (keys.ArrowLeft || keys.KeyA || touches.left ? -1 : 0) +
                 (keys.ArrowRight || keys.KeyD || touches.right ? 1 : 0);
    rotationSpeed += turn * 6 * dt;
    rotationSpeed *= 0.94;
    const rot = rotationSpeed * dt;
    for (const ring of rings) {
      ring.rotation += rot + ring.spin * dt;
    }

    if (keys.Space || keys.ArrowDown || keys.KeyS || touches.gas) targetFallSpeed = 8;
    else targetFallSpeed = 1;
    fallSpeed += (targetFallSpeed - fallSpeed) * 10 * dt;

    ball.vy += 900 * dt * fallSpeed;
    ball.y += ball.vy * dt;
    ball.x = CENTER_X + BALL_OFFSET * Math.cos(ball.angle);
    ball.angle -= rot * 0.6;

    const bandTop = ball.y - BALL_R;
    const bandBot = ball.y + BALL_R;

    for (let i = 0; i < rings.length; i++) {
      const ring = rings[i];
      const rb = ring.radius;
      const band = [ring.y - RING_W / 2, ring.y + RING_W / 2];
      const overlaps = bandBot > band[0] && bandTop < band[1];
      if (!overlaps) {
        if (!ring.passed && ball.y > band[1]) {
          ring.passed = true;
          passedCount++;
          score += 10 * level;
          if (passedCount % 4 === 0) coins++;
          onScore(score);
          if (passedCount >= rings.length) { levelClear(); return; }
        }
        continue;
      }

      const dx = ball.x - CENTER_X;
      const dy = ball.y - ring.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const inWall = dist > rb - BALL_R && dist < rb + RING_W + BALL_R;
      if (inWall) {
        const segAngle = (Math.PI * 2) / ring.segments;
        const ballAng = Math.atan2(dy, dx);
        const rel = (ballAng - ring.rotation) % (Math.PI * 2);
        const norm = rel < 0 ? rel + Math.PI * 2 : rel;
        const seg = Math.floor(norm / segAngle);
        const isGap = ring.gaps.indexOf(seg) !== -1;
        if (!isGap) {
          gameOver();
          return;
        }
      }
    }
  }

  function levelClear() {
    level++;
    score += 50;
    coins += 2;
    onScore(score);
    shake = 0.35;
    for (const ring of rings) {
      ring.passed = false;
      ring.gaps = [];
      const used = new Set();
      const gapCount = 1 + Math.floor(Math.random() * 2);
      for (let g = 0; g < gapCount; g++) {
        let gi;
        do { gi = Math.floor(Math.random() * ring.segments); } while (used.has(gi));
        used.add(gi);
        ring.gaps.push(gi);
      }
      ring.spin = (Math.random() - 0.5) * (0.35 + level * 0.15);
    }
    passedCount = 0;
    ball.y = 40;
    ball.vy = 0;
    fallSpeed = 1;
  }

  function gameOver() {
    if (over) return;
    over = true;
    running = false;
    cancelAnimationFrame(raf);
    onGameOver(score, coins);
  }

  function draw() {
    ctx.fillStyle = '#050515';
    ctx.fillRect(0, 0, W, H);

    // starfield
    for (let i = 0; i < 60; i++) {
      const x = (i * 137 + pulse * 8) % W;
      const y = (i * 89 + Math.sin(pulse * 0.8 + i) * 4) % H;
      ctx.fillStyle = `rgba(255,255,255,${0.08 + 0.25 * (0.5 + 0.5 * Math.sin(pulse * 2 + i))})`;
      ctx.fillRect(x, y, 1.5, 1.5);
    }

    // trail column
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(CENTER_X + BALL_OFFSET - BALL_R, 0, BALL_R * 2, ball.y - 40);
    ctx.restore();

    for (const ring of rings) drawRing(ctx, ring);

    drawBall(ctx);

    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 22 * shake, (Math.random() - 0.5) * 22 * shake);
    ctx.font = 'bold 18px Orbitron, monospace';
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 10;
    ctx.fillText('HELIX DROP', 12, 28);
    ctx.shadowBlur = 0;
    ctx.font = '12px monospace';
    ctx.fillStyle = '#8888aa';
    ctx.fillText('◀/▶ Rotate  ▼/Space Fast fall', 12, 48);
    ctx.fillText(`Score: ${score}  Coins: ${coins}  Level: ${level}`, W - 220, 28);
    ctx.restore();
  }

  function drawRing(ctx, ring) {
    const segAngle = (Math.PI * 2) / ring.segments;
    for (let s = 0; s < ring.segments; s++) {
      if (ring.gaps.indexOf(s) !== -1) continue;
      const a0 = ring.rotation + s * segAngle;
      const a1 = a0 + segAngle;
      ctx.beginPath();
      ctx.arc(CENTER_X, ring.y, ring.radius + RING_W / 2, a0, a1);
      ctx.arc(CENTER_X, ring.y, ring.radius - RING_W / 2, a1, a0, true);
      ctx.closePath();
      const grad = ctx.createRadialGradient(CENTER_X, ring.y, ring.radius - RING_W / 2, CENTER_X, ring.y, ring.radius + RING_W / 2);
      grad.addColorStop(0, ring.color);
      grad.addColorStop(1, '#111133');
      ctx.fillStyle = grad;
      ctx.shadowColor = ring.color;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    // gap glow marker
    for (const g of ring.gaps) {
      const mid = ring.rotation + (g + 0.5) * segAngle;
      ctx.save();
      ctx.strokeStyle = '#00ffcc';
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(pulse * 4 + g);
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00ffcc';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(CENTER_X, ring.y, ring.radius, mid - 0.08, mid + 0.08);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBall(ctx) {
    ctx.save();
    ctx.translate(ball.x, ball.y);
    const grad = ctx.createRadialGradient(-BALL_R * 0.3, -BALL_R * 0.3, 0, 0, 0, BALL_R);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, '#ffcc00');
    grad.addColorStop(1, '#cc8800');
    ctx.fillStyle = grad;
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(-BALL_R * 0.3, -BALL_R * 0.3, BALL_R * 0.3, 0, Math.PI * 2);
    ctx.fill();
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
    if (!running) { running = true; last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
  }
  function pause() { running = false; cancelAnimationFrame(raf); }
  function resume() { if (!over && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); } }
  function destroy() { running = false; cancelAnimationFrame(raf); }
  return { start, pause, resume, destroy, setInput: (t, k) => { touches = t; keys = k; } };
}