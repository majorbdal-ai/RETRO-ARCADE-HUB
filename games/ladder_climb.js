function ladderClimb(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, overSent = false;
  let score = 0, coins = 0, keys = {}, touches = {};
  let time = 0, climber = null, holds = [], speed = 0, state = 'play';
  let hand = 0, combo = 0;

  function key(n) { return !!keys[n]; }
  function t(n) { return !!touches[n]; }

  function reset() {
    over = false; overSent = false;
    score = 0; coins = 0; time = 0; hand = 0; combo = 0;
    state = 'play'; speed = 90;
    climber = { x: W / 2, y: H - 60, grip: 0 };

    // climbing holds — column x positions (3 lanes), each a rock to grab
    holds = [];
    // generate a path of reachable holds going up
    let x = W / 2;
    for (let i = 0; i < 40; i++) {
      x = Math.max(90, Math.min(W - 90, x + (Math.random() - 0.5) * 120));
      holds.push({ x: x, y: H - 60 - i * 90, grabbed: false, missed: false });
    }
  }

  function callScore() { if (typeof onScore === 'function') onScore(score); }
  function callCoins() { if (typeof onCoins === 'function') onCoins(coins); }

  function die() {
    if (overSent) return;
    overSent = true; over = true; state = 'over';
    callScore();
    if (typeof onGameOver === 'function') onGameOver(score, coins);
  }

  function grabNext() {
    if (over) return;
    // find current target hold (the next one above climber)
    let target = null, minY = 1e9;
    for (let i = 0; i < holds.length; i++) {
      const h = holds[i];
      // holds above current position (lower y) not yet passed
      if (h.y < climber.y - 30 && !h.missed) {
        if (h.y < minY + 90) { target = h; minY = h.y; }
        break;
      }
      if (h.y < climber.y - 30 && !h.missed && !h.grabbed) { target = h; break; }
    }
  }

  function input() {
    // tap/action = grab next hold
    const pressNow = t('action') || key('Space') || key('ArrowUp') || key('KeyW');
    if (pressNow) {
      // find next hold above
      let target = null;
      for (let i = 0; i < holds.length; i++) {
        const h = holds[i];
        if (h.y < climber.y - 20 && !h.grabbed) { target = h; break; }
      }
      if (target) {
        // reach check — horizontal distance small enough?
        const dx = Math.abs(target.x - climber.x);
        if (dx < 130) {
          climber.y = target.y;
          climber.x = target.x;
          target.grabbed = true;
          hand = (hand + 1) % 2;
          combo++;
          const pts = 5 + (combo >= 4 ? 3 : 0);
          score += pts; callScore();
          coins++; callCoins();
          // spring score pop at the hold (canvas → screen coords)
          try {
            const c = document.getElementById('gameCanvas');
            const r = c.getBoundingClientRect();
            const sx = r.left + r.width * (target.x / W), sy = r.top + r.height * (target.y / H);
            if (typeof window.popScore === 'function') window.popScore(sx, sy, '+' + pts);
          } catch (e) {}
        } else {
          // too far — miss
          combo = 0;
          lifeLoss();
        }
      }
    }
  }

  function lifeLoss() {
    // fall a bit
    score = 0; // reset? No — keep simple: reduce
    die();
  }

  function update(dt) {
    time = time + dt;
    input();

    // auto-scroll: climber drifts up slowly; if they don't grab, they fall
    climber.y -= speed * dt * 0.0; // climber stays, holds scroll down instead

    // scroll holds down toward climber
    for (let i = 0; i < holds.length; i++) {
      if (holds[i].y > climber.y) {
        holds[i].y += speed * dt;
      }
      if (holds[i].y > H + 60) {
        holds[i].missed = true;
        holds[i].y = climber.y - 400;
        holds[i].grabbed = false;
        holds[i].x = Math.max(90, Math.min(W - 90, holds[i].x + (Math.random() - 0.5) * 100));
      }
    }

    // check miss: next ungrabbed hold above climber got scrolled below
    let nextHold = null;
    for (let i = 0; i < holds.length; i++) {
      if (!holds[i].grabbed && !holds[i].missed && holds[i].y < climber.y - 20) { nextHold = holds[i]; break; }
    }
    if (nextHold && nextHold.y > climber.y) {
      // missed the hold — fall / game over
      die();
      return;
    }

    speed = 90 + score * 1.2;
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

  function render() {
    ctx.fillStyle = '#0a0612';
    ctx.fillRect(0, 0, W, H);

    // mountain bg
    ctx.fillStyle = '#12081f';
    ctx.beginPath();
    ctx.moveTo(0, H); ctx.lineTo(0, H * 0.6);
    ctx.lineTo(W * 0.3, H * 0.35); ctx.lineTo(W * 0.5, H * 0.55);
    ctx.lineTo(W * 0.7, H * 0.3); ctx.lineTo(W, H * 0.5); ctx.lineTo(W, H);
    ctx.closePath(); ctx.fill();

    // holds
    for (let i = 0; i < holds.length; i++) {
      const h = holds[i];
      if (h.y < -20 || h.y > H + 20) continue;
      if (h.grabbed) {
        glowCircle(h.x, h.y, 9, '#3bff8f');
      } else {
        glowCircle(h.x, h.y, 8, '#c084fc');
      }
    }

    // climber (rock climber with 2 hands)
    if (climber) {
      const cx = climber.x, cy = climber.y;
      // body
      ctx.fillStyle = '#ffd93b';
      ctx.shadowColor = '#ffd93b'; ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(cx, cy - 12, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // head
      ctx.fillStyle = '#f5b3a0';
      ctx.beginPath();
      ctx.arc(cx, cy - 26, 7, 0, Math.PI * 2);
      ctx.fill();
      // arms (reaching up)
      ctx.strokeStyle = '#ffd93b';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx, cy - 14); ctx.lineTo(cx - 16, cy - 34); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - 14); ctx.lineTo(cx + 16, cy - 34); ctx.stroke();
      // helmet
      ctx.fillStyle = '#ff3b6b';
      ctx.beginPath();
      ctx.arc(cx, cy - 28, 8, Math.PI, 0);
      ctx.fill();
    }

    // HUD
    neonText('LADDER CLIMB', 14, 20, 15, '#7df9ff');
    neonText('TAP / SPACE TO GRAB NEXT HOLD', 14, 36, 9, '#8a93b8');
    ctx.textAlign = 'right';
    neonText('SCORE ' + score, W - 14, 20, 16, '#ffd93b');
    ctx.textAlign = 'left';

    if (combo >= 4) {
      ctx.textAlign = 'center';
      neonText('KING OF THE MOUNTAIN x' + combo, W / 2, 60, 14, '#ffd93b');
      ctx.textAlign = 'left';
    }

    if (state === 'over') {
      ctx.fillStyle = 'rgba(4,4,10,0.8)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      neonText('FELL!', W / 2, 170, 44, '#ff4d5e');
      neonText('HEIGHT ' + score, W / 2, 224, 24, '#ffd93b');
      neonText('COINS +' + coins, W / 2, 258, 16, '#3bff8f');
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
