function colorSwitch(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  const COLORS = ['#ff3b6b', '#ffd93b', '#3bff8f', '#3bc9ff'];
  const BALL_R = 11;
  let raf = null, last = 0, running = false, over = false, overSent = false;
  let score = 0, coins = 0, keys = {}, touches = {};
  let ball = null, rings = [], floorY = 0, scroll = 0;
  let ringTimer = 0, time = 0, pulse = 0, prevPressed = false, state = 'play';

  function key(n) { return !!keys[n]; }
  function t(n) { return !!touches[n]; }

  function reset() {
    over = false; overSent = false;
    score = 0; coins = 0; time = 0; pulse = 0;
    prevPressed = false; state = 'play';
    floorY = H - 44; scroll = 170; ringTimer = 0.7;
    ball = { x: W / 2, y: H - 110, vy: 0, color: 0, py: H - 110 };
    rings = [];
  }

  function callScore() { if (typeof onScore === 'function') onScore(score); }
  function callCoins() { if (typeof onCoins === 'function') onCoins(coins); }

  function inGap(rg, angle) {
    let rel = angle - rg.gapStart;
    rel = ((rel % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    return rel < rg.gapSize;
  }

  function spawnRing() {
    const r = 55 + Math.random() * 52;
    const gapSize = Math.max(0.9, 1.35 - score * 0.008);
    let col = Math.floor(Math.random() * 4);
    if (rings.length > 0 && rings[rings.length - 1].color === col && Math.random() < 0.7) {
      col = (col + 1 + Math.floor(Math.random() * 3)) % 4;
    }
    rings.push({ cy: -r - 30, r: r, gapStart: Math.random() * Math.PI * 2, gapSize: gapSize,
                 color: col, rot: (Math.random() - 0.5) * 1.1,
                 entered: false, exited: false, scored: false });
  }

  function die() {
    if (overSent) return;
    overSent = true; over = true; state = 'over';
    callScore();
    if (typeof onGameOver === 'function') onGameOver(score, coins);
  }

  function update(dt) {
    time = time + dt;
    if (pulse > 0) pulse = pulse - dt;

    const pressNow = t('action') || key('Space') || key('ArrowUp') || key('KeyW') || t('gas');
    if (pressNow && !prevPressed) {
      ball.color = (ball.color + 1) % COLORS.length;
      pulse = 0.16;
    }
    prevPressed = pressNow;

    ball.py = ball.y;
    ball.vy = ball.vy + 980 * dt;
    if (ball.vy > 1400) ball.vy = 1400;
    ball.y = ball.y + ball.vy * dt;
    if (ball.y < BALL_R) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); }
    if (ball.y > floorY - BALL_R) {
      ball.y = floorY - BALL_R;
      if (ball.vy > 0) ball.vy = -Math.max(Math.abs(ball.vy) * 0.84, 430);
    }

    scroll = Math.min(170 + score * 3, 430);
    ringTimer = ringTimer - dt;
    if (ringTimer <= 0) {
      spawnRing();
      ringTimer = Math.max(0.5, 0.95 - score * 0.006);
    }

    for (let i = rings.length - 1; i >= 0; i--) {
      const rg = rings[i];
      rg.cy = rg.cy + scroll * dt;
      rg.gapStart = rg.gapStart + rg.rot * dt;
      if (rg.gapStart > Math.PI * 2) rg.gapStart = rg.gapStart - Math.PI * 2;
      if (rg.gapStart < 0) rg.gapStart = rg.gapStart + Math.PI * 2;

      const dPrev = ball.py - rg.cy;
      const dCur = ball.y - rg.cy;

      if (!rg.entered) {
        if (Math.abs(dPrev) >= rg.r && Math.abs(dCur) < rg.r) {
          rg.entered = true;
          const side = dCur >= 0 ? 1 : -1;
          const angle = side > 0 ? Math.PI / 2 : -Math.PI / 2;
          if (!inGap(rg, angle)) {
            if (ball.color === rg.color) {
              ball.y = rg.cy + side * (rg.r + BALL_R);
              ball.vy = -side * Math.max(Math.abs(ball.vy) * 0.85, 260);
            } else {
              die();
            }
          }
        }
      } else if (!rg.exited) {
        if (Math.abs(dPrev) < rg.r && Math.abs(dCur) >= rg.r) {
          rg.exited = true;
          const side = dCur >= 0 ? 1 : -1;
          const angle = side > 0 ? Math.PI / 2 : -Math.PI / 2;
          if (!inGap(rg, angle)) {
            if (ball.color === rg.color) {
              ball.y = rg.cy + side * (rg.r + BALL_R);
              ball.vy = (side > 0 ? 1 : -1) * Math.max(Math.abs(ball.vy) * 0.85, 260);
            } else {
              die();
            }
          }
        }
      }

      if (!rg.scored && rg.cy - rg.r > ball.y + 40) {
        rg.scored = true;
        score = score + 1; callScore();
        coins = coins + 1; callCoins();
      }
      if (rg.cy - rg.r > H + 60) rings.splice(i, 1);
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

  function neonText(txt, x, y, size, color) {
    ctx.font = 'bold ' + size + 'px "Courier New", monospace';
    ctx.fillStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.fillText(txt, x, y);
    ctx.shadowBlur = 0;
  }

  function drawRing(rg) {
    const c = COLORS[rg.color];
    ctx.lineWidth = 11;
    ctx.strokeStyle = c;
    ctx.shadowColor = c;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(W / 2, rg.cy, rg.r, rg.gapStart + rg.gapSize, rg.gapStart + Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(120,130,220,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(W / 2, rg.cy, rg.r + 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  function render() {
    ctx.fillStyle = '#08060f';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,90,220,0.08)';
    ctx.lineWidth = 1;
    for (let gx = 40; gx < W; gx = gx + 40) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }
    for (let i = 0; i < rings.length; i++) drawRing(rings[i]);

    ctx.strokeStyle = '#3bc9ff';
    ctx.shadowColor = '#3bc9ff'; ctx.shadowBlur = 14;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(W, floorY); ctx.stroke();
    ctx.shadowBlur = 0;

    const bc = COLORS[ball.color];
    const br = BALL_R + (pulse > 0 ? pulse * 26 : 0);
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, br, 0, Math.PI * 2);
    ctx.fillStyle = bc;
    ctx.shadowColor = bc; ctx.shadowBlur = 22;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(ball.x - 3, ball.y - 3, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    for (let i = 0; i < COLORS.length; i++) {
      ctx.strokeStyle = COLORS[i];
      ctx.lineWidth = 2;
      if (i === ball.color) {
        ctx.shadowColor = COLORS[i]; ctx.shadowBlur = 10;
        ctx.fillStyle = COLORS[i];
      } else {
        ctx.fillStyle = 'rgba(10,10,20,0.9)';
      }
      ctx.beginPath();
      ctx.arc(W - 28 - i * 26, H - 20, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    neonText('COLOR SWITCH', 14, 16, 15, '#7df9ff');
    neonText('TAP / SPACE: SWITCH COLOR', 14, 33, 10, '#8a93b8');
    ctx.textAlign = 'right';
    neonText('SCORE ' + score, W - 14, 20, 16, '#ffd93b');
    ctx.textAlign = 'left';

    if (state === 'over') {
      ctx.fillStyle = 'rgba(4,4,10,0.74)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      neonText('GAME OVER', W / 2, 180, 44, '#ff4d5e');
      neonText('RINGS ' + score, W / 2, 232, 22, '#ffd93b');
      neonText('COINS +' + coins, W / 2, 262, 16, '#3bff8f');
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