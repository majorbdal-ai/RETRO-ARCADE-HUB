function cricketSixer(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  let keys = {}, touches = {};

  const PITCH_X = W / 2;
  const PITCH_Y_TOP = 120;
  const PITCH_Y_BOTTOM = H - 60;
  const STUMP_Y = PITCH_Y_TOP + 30;
  const STUMP_W = 8;
  const STUMP_H = 40;
  const STUMP_GAP = 12;
  const STUMP_COLOR = '#ccaa66';
  const BALL_R = 12;
  const BAT_X = PITCH_X;
  const BAT_Y = PITCH_Y_BOTTOM - 40;
  const BAT_W = 60;
  const BAT_H = 12;

  let ball = { x: PITCH_X, y: PITCH_Y_TOP, vy: 0, active: false, speed: 0 };
  let batAngle = 0;
  let batTargetAngle = 0;
  let swingTime = 0;
  let swinging = false;
  let swingHit = false;
  let swingDir = 0;
  let wickets = 3;
  let ballsBowled = 0;
  let maxBalls = 30;
  let lastResult = '';
  let resultTimer = 0;
  let timingBar = 0;
  let timingSpeed = 2;
  let level = 1;
  let laneOffset = 0;
  let deliveries = [];
  let targetX = PITCH_X;

  const TIMING_MARKS = [
    { min: 0.42, max: 0.58, label: 'SIX', color: '#ff3366', points: 6 },
    { min: 0.35, max: 0.65, label: 'FOUR', color: '#ffcc00', points: 4 },
    { min: 0.28, max: 0.72, label: 'SINGLE', color: '#33ccff', points: 1 },
    { min: 0.0, max: 1.0, label: 'MISS', color: '#666666', points: 0 }
  ];

  function reset() {
    ball.active = false;
    ball.y = PITCH_Y_TOP;
    ball.vy = 0;
    batAngle = 0;
    batTargetAngle = 0;
    swinging = false;
    swingHit = false;
    swingTime = 0;
    wickets = 3;
    ballsBowled = 0;
    maxBalls = 30;
    lastResult = '';
    resultTimer = 0;
    timingBar = 0;
    timingSpeed = 1.5;
    level = 1;
    laneOffset = 0;
    score = 0;
    coins = 0;
    over = false;
    targetX = PITCH_X;
    onScore(score);
    setTimeout(deliverBall, 1000);
  }

  function deliverBall() {
    if (over || ballsBowled >= maxBalls) return;
    ballsBowled++;
    ball.active = true;
    ball.x = PITCH_X + (Math.random() - 0.5) * 100;
    ball.y = PITCH_Y_TOP;
    ball.speed = 180 + Math.random() * 120 + level * 20;
    ball.vy = ball.speed;
    swinging = false;
    swingHit = false;
    timingBar = 0;
    timingSpeed = 1.5 + level * 0.2 + Math.random() * 0.5;
  }

  function update(dt) {
    if (resultTimer > 0) resultTimer -= dt;

    if (keys.ArrowLeft || keys.KeyA || touches.left) {
      targetX = Math.max(BAT_X - 120, targetX - 250 * dt);
    }
    if (keys.ArrowRight || keys.KeyD || touches.right) {
      targetX = Math.min(BAT_X + 120, targetX + 250 * dt);
    }

    batX = batX + (targetX - batX) * 8 * dt;

    timingBar += timingSpeed * dt;
    if (timingBar > 1) timingBar -= 1;

    if (swinging) {
      swingTime += dt * 10;
      if (swingDir === 1) {
        batAngle = Math.min(0.8, batAngle + 12 * dt);
      } else {
        batAngle = Math.max(0, batAngle - 10 * dt);
      }
    }

    if (ball.active) {
      ball.y += ball.vy * dt;

      if (!swinging && (keys.Space || keys.KeyW || keys.ArrowUp || touches.action)) {
        swinging = true;
        swingDir = 1;
        swingTime = 0;
        const timing = getTimingResult();
        if (timing.label !== 'MISS') {
          swingHit = true;
          lastResult = timing.label;
          resultTimer = 1.5;
          score += timing.points;
          if (timing.points === 6) coins++;
          onScore(score);
        } else {
          lastResult = 'MISS';
          resultTimer = 1.5;
          wickets--;
          if (wickets <= 0) { gameOver(); return; }
        }
      }

      if (ball.y > BAT_Y - 5 && !swinging) {
        lastResult = 'OUT!';
        resultTimer = 1.5;
        wickets--;
        ball.active = false;
        swinging = false;
        if (wickets <= 0) { gameOver(); return; }
        setTimeout(deliverBall, 1500);
      }

      if (ball.y > BAT_Y && swinging && !swingHit && batAngle > 0.3) {
        const dx = ball.x - batX;
        if (Math.abs(dx) < BAT_W) {
          swingHit = true;
          const timing = getTimingResult();
          lastResult = timing.label;
          resultTimer = 1.5;
          score += timing.points;
          if (timing.points === 6) coins++;
          onScore(score);
        }
      }

      if (ball.y > H + 30) {
        ball.active = false;
        swinging = false;
        batAngle = 0;
        setTimeout(deliverBall, 1200);
      }
    }

    if (ballsBowled >= maxBalls && !ball.active) {
      gameOver();
    }

    if (score > 0 && score % 30 === 0 && ballsBowled > 0) {
      level = 1 + Math.floor(score / 30);
    }
  }

  let batX = BAT_X;

  function getTimingResult() {
    const t = timingBar;
    for (const mark of TIMING_MARKS) {
      if (t >= mark.min && t <= mark.max) return mark;
    }
    return TIMING_MARKS[TIMING_MARKS.length - 1];
  }

  function gameOver() {
    if (over) return;
    over = true;
    running = false;
    cancelAnimationFrame(raf);
    onGameOver(score, coins);
  }

  function draw() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#1a3322';
    ctx.fillRect(PITCH_X - 100, PITCH_Y_TOP - 20, 200, PITCH_Y_BOTTOM - PITCH_Y_TOP + 40);

    ctx.strokeStyle = '#335544';
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      const y = PITCH_Y_TOP + i * ((PITCH_Y_BOTTOM - PITCH_Y_TOP) / 10);
      ctx.beginPath();
      ctx.moveTo(PITCH_X - 100, y);
      ctx.lineTo(PITCH_X + 100, y);
      ctx.stroke();
    }

    drawStumps(ctx);

    drawBat(ctx);

    if (ball.active) drawBall(ctx);

    drawTimingBar(ctx);

    for (let i = 0; i < wickets; i++) {
      ctx.fillStyle = STUMP_COLOR;
      ctx.shadowColor = STUMP_COLOR;
      ctx.shadowBlur = 5;
      ctx.fillRect(W - 60 + i * 15, 12, 4, 20);
      ctx.shadowBlur = 0;
    }

    if (lastResult && resultTimer > 0) {
      const timing = TIMING_MARKS.find(m => m.label === lastResult);
      const color = timing ? timing.color : '#ff3333';
      ctx.save();
      ctx.font = 'bold 36px Orbitron, monospace';
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, resultTimer);
      ctx.fillText(lastResult, PITCH_X, H / 2);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    ctx.save();
    ctx.font = 'bold 18px Orbitron, monospace';
    ctx.fillStyle = '#00ffcc';
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur = 10;
    ctx.fillText('CRICKET SIXER', 12, 28);
    ctx.shadowBlur = 0;
    ctx.font = '12px monospace';
    ctx.fillStyle = '#8888aa';
    ctx.fillText('←/→ Move  Space/W Swing', 12, 48);
    ctx.fillText(`Score: ${score}  Wickets: ${wickets}  Balls: ${ballsBowled}/${maxBalls}`, 12, 68);
    ctx.fillText(`Coins: ${coins}`, W - 120, 68);
    ctx.restore();
  }

  function drawStumps(ctx) {
    for (let i = -1; i <= 1; i++) {
      ctx.fillStyle = STUMP_COLOR;
      ctx.shadowColor = STUMP_COLOR;
      ctx.shadowBlur = 5;
      ctx.fillRect(PITCH_X + i * STUMP_GAP - STUMP_W / 2, STUMP_Y, STUMP_W, STUMP_H);
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = STUMP_COLOR;
    ctx.fillRect(PITCH_X - 12, STUMP_Y - 3, 24, 3);
  }

  function drawBat(ctx) {
    ctx.save();
    ctx.translate(batX, BAT_Y);
    ctx.rotate(batAngle);
    const grad = ctx.createLinearGradient(0, 0, 0, -BAT_H - 20);
    grad.addColorStop(0, '#8B4513');
    grad.addColorStop(0.7, '#D2691E');
    grad.addColorStop(1, '#DEB887');
    ctx.fillStyle = grad;
    ctx.shadowColor = '#D2691E';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.roundRect(-BAT_W / 2, -BAT_H / 2, BAT_W, BAT_H + 20, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#654321';
    ctx.beginPath();
    ctx.arc(0, -BAT_H / 2 - 10, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBall(ctx) {
    ctx.save();
    const grad = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 0, ball.x, ball.y, BALL_R);
    grad.addColorStop(0, '#ff4444');
    grad.addColorStop(1, '#881111');
    ctx.fillStyle = grad;
    ctx.shadowColor = '#ff3333';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, -0.5, 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, Math.PI - 0.5, Math.PI + 0.5);
    ctx.stroke();
    ctx.restore();
  }

  function drawTimingBar(ctx) {
    const barX = 40;
    const barY = H - 40;
    const barW = W - 80;
    const barH = 16;

    ctx.fillStyle = '#111133';
    ctx.fillRect(barX, barY, barW, barH);

    for (const mark of TIMING_MARKS) {
      const x1 = barX + barW * mark.min;
      const x2 = barX + barW * mark.max;
      ctx.fillStyle = mark.color + '44';
      ctx.fillRect(x1, barY, x2 - x1, barH);
    }

    const markerX = barX + barW * timingBar;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.fillRect(markerX - 2, barY - 4, 4, barH + 8);
    ctx.shadowBlur = 0;

    ctx.font = '10px monospace';
    ctx.fillStyle = '#666688';
    ctx.textAlign = 'center';
    ctx.fillText('SIX', barX + barW * 0.5, barY - 6);
    ctx.fillText('FOUR', barX + barW * 0.3, barY - 6);
    ctx.fillText('FOUR', barX + barW * 0.7, barY - 6);
    ctx.textAlign = 'left';
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