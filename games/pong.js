function pong(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  const PW = 12, PH = 76, PAD = 18, BALL_R = 7, WIN = 7;
  let raf = null, last = 0, running = false, over = false, overSent = false;
  let score = 0, aiScore = 0, coins = 0, keys = {}, touches = {};
  let p = null, ai = null, ball = null, trail = [];
  let serveTimer = 0, serveDir = 1, state = 'play', stateWin = false;
  let message = '', msgT = 0, flashHit = 0, time = 0;

  function key(n) { return !!keys[n]; }
  function t(n) { return !!touches[n]; }

  function reset() {
    over = false; overSent = false;
    score = 0; aiScore = 0; coins = 0; time = 0;
    p = { y: (H - PH) / 2 };
    ai = { y: (H - PH) / 2 };
    ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
    trail = [];
    serveTimer = 1.2; serveDir = 1;
    state = 'play'; stateWin = false;
    message = ''; msgT = 0; flashHit = 0;
  }

  function callScore() { if (typeof onScore === 'function') onScore(score); }
  function callCoins() { if (typeof onCoins === 'function') onCoins(coins); }

  function serve(dir) {
    const a = (Math.random() * 0.7 - 0.35);
    const sp = 300 + Math.random() * 30;
    ball.x = W / 2; ball.y = H / 2;
    ball.vx = Math.cos(a) * sp * dir;
    ball.vy = Math.sin(a) * sp;
    trail = [];
  }

  function paddleHit(px, py, pad, side) {
    const paddleX = side < 0 ? PAD : W - PAD - PW;
    const border = side < 0 ? paddleX + PW + BALL_R : paddleX - BALL_R;
    if (side < 0 && ball.vx >= 0) return;
    if (side > 0 && ball.vx <= 0) return;
    const crossed = side < 0
      ? (px - BALL_R >= border && ball.x - BALL_R < border)
      : (px + BALL_R <= border && ball.x + BALL_R > border);
    if (!crossed) return;
    if (ball.y < pad.y - 4 || ball.y > pad.y + PH + 4) return;
    const off = (ball.y - (pad.y + PH / 2)) / (PH / 2);
    let sp = Math.hypot(ball.vx, ball.vy);
    sp = Math.max(300, Math.min(sp * 1.05, 720));
    const ang = off * 0.75;
    const dir = side < 0 ? 1 : -1;
    ball.vx = Math.cos(ang) * sp * dir;
    ball.vy = Math.sin(ang) * sp;
    ball.x = side < 0 ? border + 1 : border - 1;
    flashHit = 0.12;
  }

  function final() {
    overSent = true; over = true; state = 'over';
    callScore();
    if (typeof onGameOver === 'function') onGameOver(score, coins);
  }

  function pointFor(who) {
    if (who === 0) {
      score = score + 1; callScore();
      coins = coins + 1; callCoins();
      serveDir = -1;
      message = 'YOU SCORE!'; msgT = 1.1;
      if (score >= WIN) { stateWin = true; final(); return; }
    } else {
      aiScore = aiScore + 1;
      serveDir = 1;
      message = 'AI SCORES'; msgT = 1.1;
      if (aiScore >= WIN) { stateWin = false; final(); return; }
    }
    ball.vx = 0; ball.vy = 0;
    trail = [];
    serveTimer = 1.1;
  }

  function update(dt) {
    time = time + dt;
    if (flashHit > 0) flashHit = flashHit - dt;
    if (msgT > 0) msgT = msgT - dt;

    if (serveTimer > 0) {
      serveTimer = serveTimer - dt;
      if (serveTimer <= 0) serve(serveDir);
    }

    let pv = 0;
    if (t('up')) pv = pv - 1;
    if (t('down')) pv = pv + 1;
    if (pv === 0) {
      if (key('ArrowUp') || key('KeyW')) pv = pv - 1;
      if (key('ArrowDown') || key('KeyS')) pv = pv + 1;
    }
    p.y = p.y + pv * 460 * dt;
    if (p.y < 0) p.y = 0;
    if (p.y > H - PH) p.y = H - PH;

    const aiSpeed = Math.min(205 + aiScore * 8, 300) + score * 4;
    let targetY = ball.y - PH / 2;
    if (ball.vx > 0) {
      let ty = ball.y + ball.vy * ((W - PAD - PW) - ball.x) / ball.vx;
      for (let k = 0; k < 6; k++) {
        if (ty < BALL_R) ty = 2 * BALL_R - ty;
        if (ty > H - BALL_R) ty = 2 * (H - BALL_R) - ty;
      }
      targetY = ty - PH / 2;
    }
    targetY = targetY + Math.sin(time * 2.1) * 22;
    const diff = targetY - ai.y;
    const step = Math.max(-aiSpeed * dt, Math.min(aiSpeed * dt, diff));
    ai.y = ai.y + step;
    if (ai.y < 0) ai.y = 0;
    if (ai.y > H - PH) ai.y = H - PH;

    if (ball.vx !== 0 || ball.vy !== 0) {
      const prevX = ball.x, prevY = ball.y;
      ball.x = ball.x + ball.vx * dt;
      ball.y = ball.y + ball.vy * dt;
      trail.push({ x: ball.x, y: ball.y });
      if (trail.length > 14) trail.shift();
      if (ball.y - BALL_R < 0) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); }
      if (ball.y + BALL_R > H) { ball.y = H - BALL_R; ball.vy = -Math.abs(ball.vy); }
      paddleHit(prevX, prevY, p, -1);
      paddleHit(prevX, prevY, ai, 1);
      if (ball.x + BALL_R < 0) pointFor(1);
      if (ball.x - BALL_R > W) pointFor(0);
    }
    render();
  }

  function glowCircle(x, y, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function glowRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = 12;
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
  }

  function neonText(txt, x, y, size, color) {
    ctx.font = 'bold ' + size + 'px "Courier New", monospace';
    ctx.fillStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.fillText(txt, x, y);
    ctx.shadowBlur = 0;
  }

  function render() {
    ctx.fillStyle = '#06060f';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,130,220,0.18)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 14]);
    ctx.beginPath(); ctx.moveTo(W / 2, 18); ctx.lineTo(W / 2, H - 18); ctx.stroke();
    ctx.setLineDash([]);

    for (let i = 0; i < trail.length; i++) {
      const tr = trail[i];
      const a = (i + 1) / trail.length;
      ctx.globalAlpha = a * 0.35;
      glowCircle(tr.x, tr.y, BALL_R * (0.5 + 0.5 * a), '#bffcff');
    }
    ctx.globalAlpha = 1;

    glowRect(PAD, p.y, PW, PH, '#3bc9ff');
    glowRect(W - PAD - PW, ai.y, PW, PH, '#ff4d5e');
    glowCircle(ball.x, ball.y, BALL_R, '#ffffff');

    ctx.textAlign = 'center';
    neonText(String(score), W / 2 - 70, 66, 46, '#3bc9ff');
    neonText(String(aiScore), W / 2 + 70, 66, 46, '#ff4d5e');
    ctx.textAlign = 'left';

    neonText('NEON PONG', 14, 16, 15, '#7df9ff');
    neonText('MOVE: DRAG/ARROWS/WASD  FIRST TO 7', 14, 33, 10, '#8a93b8');

    if (serveTimer > 0 && !over) {
      ctx.textAlign = 'center';
      neonText('READY...', W / 2, H - 26, 16, '#9aa3c8');
      ctx.textAlign = 'left';
    }
    if (msgT > 0 && !over) {
      ctx.textAlign = 'center';
      neonText(message, W / 2, 104, 18, '#ffd93b');
      ctx.textAlign = 'left';
    }
    if (state === 'over') {
      ctx.fillStyle = 'rgba(4,4,10,0.74)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      neonText(stateWin ? 'YOU WIN!' : 'AI WINS', W / 2, 180, 44, stateWin ? '#3bff8f' : '#ff4d5e');
      neonText('FINAL ' + score + ' - ' + aiScore, W / 2, 234, 22, '#ffd93b');
      neonText('COINS +' + coins, W / 2, 266, 16, '#3bff8f');
      ctx.textAlign = 'left';
    }
  }

  function loop(ts) {
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    if (running && !over) update(dt);
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
  function destroy() { running = false; over = true; cancelAnimationFrame(raf); }
  function setInput(ts, ks) { touches = ts || {}; keys = ks || {}; }

  return { start: start, pause: pause, resume: resume, destroy: destroy, setInput: setInput };
}