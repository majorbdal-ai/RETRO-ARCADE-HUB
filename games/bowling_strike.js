function bowlingStrike(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  let keys = {}, touches = {};
  let pins = [], ball = null, phase = 'aim', frame = 1, roll = 1, frameScore = 0;
  let totalScore = 0, throwing = false, settleTimer = 0, throwTime = 0;
  let powerX = W / 2, powerDir = 1, powerSpeed = 240;
  let laneEndY = H - 60, pinStartY = 60, pinSpacing = 30;
  let sweepTimer = 0, messageTimer = 0, message = '';
  let pressed = false, pressEdge = false;
  const BALL_R = 14, LANE_L = 80, LANE_R = W - 80;

  function reset() {
    pins = [];
    ball = null;
    phase = 'aim';
    frame = 1;
    roll = 1;
    frameScore = 0;
    totalScore = 0;
    coins = 0;
    over = false;
    throwing = false;
    settleTimer = 0;
    throwTime = 0;
    powerX = W / 2;
    powerDir = 1;
    sweepTimer = 0;
    messageTimer = 0;
    message = '';
    pressed = false;
    pressEdge = false;
    score = 0;
    setupPins();
    onScore(0);
  }

  function setupPins() {
    pins = [];
    for (let i = 0; i < 4; i++) {
      const count = 4 - i;
      const startX = W / 2 - (count - 1) * pinSpacing / 2;
      for (let j = 0; j < count; j++) {
        pins.push({
          x: startX + j * pinSpacing,
          y: pinStartY + i * (pinSpacing * 0.8),
          vx: 0, vy: 0, standing: true, r: 10, settled: false
        });
      }
    }
  }

  function countPins() {
    let n = 0;
    for (const p of pins) if (p.standing) n++;
    return n;
  }

  function bowlBall() {
    if (over) return;
    const target = powerX;
    const curve = (target - W / 2) * 0.35;
    ball = { x: W / 2, y: laneEndY, vx: curve * 0.4, vy: -430, r: BALL_R, curve: curve * 0.5 };
    throwing = true;
    phase = 'roll';
    settleTimer = 0;
    throwTime = 0;
  }

  function resolveCollisions() {
    for (const p of pins) {
      if (!p.standing || !ball) continue;
      const dx = p.x - ball.x, dy = p.y - ball.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < p.r + ball.r) {
        p.standing = false;
        p.settled = false;
        const ang = Math.atan2(dy, dx);
        const force = 160 + Math.random() * 120;
        p.vx = Math.cos(ang) * force;
        p.vy = Math.sin(ang) * force;
        score += 1;
        onScore(totalScore + score);
      }
    }

    const fallen = pins.filter(p => !p.standing);
    for (let i = 0; i < fallen.length; i++) {
      for (let j = i + 1; j < fallen.length; j++) {
        const a = fallen[i], b = fallen[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= a.r + b.r || dist < 0.001) continue;
        const nx = dx / dist, ny = dy / dist;
        const overlap = a.r + b.r - dist;
        a.x -= nx * overlap / 2; a.y -= ny * overlap / 2;
        b.x += nx * overlap / 2; b.y += ny * overlap / 2;
        const rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rvn < 0) {
          const imp = -rvn * 0.6;
          a.vx -= imp * nx; a.vy -= imp * ny;
          b.vx += imp * nx; b.vy += imp * ny;
        }
      }
    }
  }

  function update(dt) {
    if (over) return;
    if (messageTimer > 0) messageTimer -= dt;

    const held = !!(touches.action || keys.Space || keys.KeyW);
    if (held && !pressed) pressEdge = true;
    else pressEdge = false;
    pressed = held;

    if (phase === 'aim') {
      powerX += powerDir * powerSpeed * dt;
      if (powerX > LANE_R - 30) { powerDir = -1; powerX = LANE_R - 30; }
      if (powerX < LANE_L + 30) { powerDir = 1; powerX = LANE_L + 30; }
      if (pressEdge) bowlBall();
    }

    if (phase === 'roll' && ball) {
      throwTime += dt;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      ball.vx += ball.curve * dt * 10;
      if (ball.x < LANE_L + BALL_R) { ball.x = LANE_L + BALL_R; ball.vx = Math.abs(ball.vx) * 0.5; }
      if (ball.x > LANE_R - BALL_R) { ball.x = LANE_R - BALL_R; ball.vx = -Math.abs(ball.vx) * 0.5; }

      resolveCollisions();

      for (const p of pins) {
        if (p.standing || p.settled) continue;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.93;
        p.vy *= 0.93;
        if (Math.abs(p.vx) < 2 && Math.abs(p.vy) < 2) p.settled = true;
        if (p.x < 30) { p.x = 30; p.vx *= -0.4; }
        if (p.x > W - 30) { p.x = W - 30; p.vx *= -0.4; }
        if (p.y < 10) { p.y = 10; p.vy *= -0.3; }
        if (p.y > H - 20) { p.y = H - 20; p.vy *= -0.4; }
      }

      if (throwTime > 1.8 || ball.y < 30 || ball.y > laneEndY + 60) {
        ball = null;
        phase = 'settle';
        settleTimer = 0;
      }
    }

    if (phase === 'settle') {
      settleTimer += dt;
      let allDone = true;
      for (const p of pins) if (!p.standing && !p.settled) { allDone = false; break; }
      if (settleTimer > 1.4 || allDone) endRoll();
    }

    if (phase === 'sweep') {
      sweepTimer += dt;
      if (sweepTimer > 0.8) {
        sweepTimer = 0;
        if (roll === 2) {
          phase = 'aim';
        } else {
          frameScore = 0;
          setupPins();
          ball = null;
          if (frame > 10) {
            over = true;
            onGameOver(score, coins);
          } else {
            phase = 'aim';
          }
        }
      }
    }
  }

  function endRoll() {
    const knocked = 10 - countPins();
    frameScore += knocked;

    if (roll === 1 && frameScore === 10) {
      message = 'STRIKE!';
      messageTimer = 1.5;
      totalScore += 30;
      coins += 10;
      frame++;
      roll = 1;
      phase = 'sweep';
      sweepTimer = 0;
    } else if (roll === 1) {
      roll = 2;
      phase = 'sweep';
      sweepTimer = 0;
    } else {
      if (frameScore === 10) {
        message = 'SPARE!';
        messageTimer = 1.5;
        totalScore += 20;
        coins += 5;
      } else {
        message = 'Frame: ' + frameScore;
        messageTimer = 1.5;
        totalScore += frameScore;
        coins += Math.max(1, frameScore);
      }
      frame++;
      roll = 1;
      phase = 'sweep';
      sweepTimer = 0;
    }

    score = totalScore;
    onScore(score);

    if (frame > 10) {
      over = true;
      onGameOver(score, coins);
    }
  }

  function draw() {
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#14140c';
    ctx.fillRect(LANE_L - 10, 0, LANE_R - LANE_L + 20, laneEndY + 20);

    ctx.strokeStyle = '#2a2a18';
    ctx.lineWidth = 1;
    for (let y = 0; y < laneEndY; y += 18) {
      ctx.beginPath(); ctx.moveTo(LANE_L, y); ctx.lineTo(LANE_R, y); ctx.stroke();
    }

    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff660088';
    ctx.strokeRect(LANE_L - 10, 0, LANE_R - LANE_L + 20, laneEndY + 20);
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ffff';
    ctx.beginPath();
    ctx.moveTo(LANE_L + 20, laneEndY);
    ctx.lineTo(LANE_R - 20, laneEndY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    for (const p of pins) {
      const color = p.standing ? '#ffffff' : '#3a3a3a';
      ctx.shadowBlur = p.standing ? 14 : 2;
      ctx.shadowColor = p.standing ? '#ffffaa' : '#000000';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      if (p.standing) {
        ctx.strokeStyle = '#ffff88';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    if (ball) {
      ctx.shadowBlur = 22;
      ctx.shadowColor = '#ff00ff';
      const grad = ctx.createRadialGradient(ball.x - 3, ball.y - 3, 0, ball.x, ball.y, ball.r);
      grad.addColorStop(0, '#ff77ff');
      grad.addColorStop(1, '#aa00aa');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    if (phase === 'aim') {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 160);
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#00ffff';
      ctx.fillStyle = '#00ffff';
      ctx.globalAlpha = 0.6 + 0.4 * pulse;
      ctx.beginPath();
      ctx.arc(powerX, laneEndY, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      ctx.strokeStyle = '#ff00ff88';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(powerX, laneEndY - 16);
      ctx.lineTo(powerX + (powerX - W / 2) * 0.35, pinStartY + 20);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.font = 'bold 18px Orbitron, monospace';
    ctx.fillStyle = '#ff00ff';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff00ff';
    ctx.fillText('BOWLING STRIKE', 16, 28);
    ctx.font = '12px Orbitron, monospace';
    ctx.fillStyle = '#ff88ff';
    ctx.fillText('SPACE/TAP Bowl  |  Watch marker for curve  |  2 rolls/frame', 16, 46);
    ctx.shadowBlur = 0;

    ctx.font = 'bold 18px Orbitron, monospace';
    ctx.fillStyle = '#ffff00';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffff00';
    ctx.fillText('SCORE: ' + totalScore, W - 190, 36);
    ctx.font = '14px Orbitron, monospace';
    ctx.fillStyle = '#ffaa00';
    ctx.fillText('Frame ' + Math.min(frame, 10) + '/10  Roll ' + roll, W - 190, 56);
    ctx.shadowBlur = 0;

    if (messageTimer > 0) {
      ctx.globalAlpha = Math.min(1, messageTimer);
      ctx.font = 'bold 36px Orbitron, monospace';
      const mColor = message === 'STRIKE!' ? '#00ff88' : message === 'SPARE!' ? '#00ffff' : '#ffbb33';
      ctx.fillStyle = mColor;
      ctx.shadowBlur = 22;
      ctx.shadowColor = mColor;
      const tw = ctx.measureText(message).width;
      ctx.fillText(message, W / 2 - tw / 2, H / 2);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
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