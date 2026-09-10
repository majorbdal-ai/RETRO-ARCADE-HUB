/* ============================================================
   Color Switch — Match ball color, tap to switch (v2: particles, trail, levels, death FX)
   Canvas 800x450
   ============================================================ */
function colorSwitch(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  const COLORS = ['#ff3b6b', '#ffd93b', '#3bff8f', '#3bc9ff'];
  const COLOR_NAMES = ['RED', 'YELLOW', 'GREEN', 'BLUE'];
  const BALL_R = 11;
  let raf = null, last = 0, running = false, over = false, overSent = false;
  let score = 0, coins = 0, keys = {}, touches = {};
  let ball = null, rings = [], floorY = 0, scroll = 0;
  let ringTimer = 0, time = 0, pulse = 0, prevPressed = false, state = 'play';
  let deathTimer = 0;

  // FX
  let particles = [];
  let trailParts = [];
  let scorePopups = [];
  let shakeTimer = 0;
  let flashColor = null;
  let flashTimer = 0;

  // difficulty
  let level = 1;
  let streakCount = 0;
  let highScore = 0;

  function vibrate(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {}
  }

  function key(n) { return !!keys[n]; }
  function t(n) { return !!touches[n]; }

  function reset() {
    over = false; overSent = false; deathTimer = 0;
    score = 0; coins = 0; time = 0; pulse = 0;
    prevPressed = false; state = 'play';
    floorY = H - 44; scroll = 170; ringTimer = 0.7;
    ball = { x: W / 2, y: H - 110, vy: 0, color: 0, py: H - 110 };
    rings = [];
    particles = [];
    trailParts = [];
    scorePopups = [];
    shakeTimer = 0;
    flashColor = null;
    flashTimer = 0;
    level = 1;
    streakCount = 0;
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

  // ---- FX helpers ----
  function spawnParticles(x, y, color, count, spread) {
    spread = spread || 150;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * spread;
      particles.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 0.3 + Math.random() * 0.5,
        maxLife: 0.8,
        color,
        size: 1.5 + Math.random() * 3
      });
    }
  }

  function spawnTrail(x, y, color) {
    trailParts.push({
      x: x + (Math.random() - 0.5) * 4,
      y: y + (Math.random() - 0.5) * 4,
      life: 0.2 + Math.random() * 0.15,
      color,
      size: 2 + Math.random() * 2
    });
  }

  function spawnScorePopup(x, y, text, color) {
    scorePopups.push({ x, y, text, color, life: 1.0, vy: -55 });
  }

  function die() {
    if (overSent) return;
    overSent = true; over = true; state = 'over';
    deathTimer = 0;
    shakeTimer = 0.35;
    flashColor = COLORS[ball.color];
    flashTimer = 0.25;
    // death burst
    spawnParticles(ball.x, ball.y, COLORS[ball.color], 35, 200);
    spawnParticles(ball.x, ball.y, '#ffffff', 15, 120);
    vibrate([80, 40, 120]);
    callScore();
    setTimeout(() => {
      if (score > highScore) highScore = score;
      if (typeof onGameOver === 'function') onGameOver(score, coins);
    }, 500);
  }

  function update(dt) {
    time = time + dt;
    if (pulse > 0) pulse = pulse - dt;

    // death animation
    if (over) {
      deathTimer += dt;
      updateParticles(dt);
      updateTrail(dt);
      updatePopups(dt);
      if (shakeTimer > 0) shakeTimer -= dt;
      if (flashTimer > 0) flashTimer -= dt;
      if (deathTimer > 0.5 && (t('action') || key('Space') || key('ArrowUp'))) {
        return; // let core handle restart
      }
      return;
    }

    if (!running) return;

    const pressNow = t('action') || key('Space') || key('ArrowUp') || key('KeyW') || t('gas');
    if (pressNow && !prevPressed) {
      const oldColor = ball.color;
      ball.color = (ball.color + 1) % COLORS.length;
      pulse = 0.16;
      // switch particles
      spawnParticles(ball.x, ball.y, COLORS[oldColor], 8, 80);
      spawnParticles(ball.x, ball.y, COLORS[ball.color], 6, 60);
      spawnScorePopup(ball.x, ball.y - 25, COLOR_NAMES[ball.color], COLORS[ball.color]);
      vibrate(10);
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

    // trail
    spawnTrail(ball.x, ball.y, COLORS[ball.color]);

    scroll = Math.min(170 + score * 3, 430);
    ringTimer = ringTimer - dt;
    if (ringTimer <= 0) {
      spawnRing();
      ringTimer = Math.max(0.5, 0.95 - score * 0.006);
    }

    // update level
    const newLevel = Math.floor(score / 10) + 1;
    if (newLevel > level) {
      level = newLevel;
      spawnScorePopup(W / 2, H / 2 - 40, 'LEVEL ' + level + '!', '#00ffff');
      vibrate([20, 10, 20, 10, 40]);
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
              streakCount++;
              // match particles
              spawnParticles(ball.x, ball.y, COLORS[ball.color], 12, 100);
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
              streakCount++;
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
        streakCount++;
        // score burst
        spawnParticles(W / 2, rg.cy + rg.r, COLORS[rg.color], 8, 80);
        if (score % 5 === 0) {
          spawnScorePopup(W / 2, rg.cy, 'x' + score, '#ffd93b');
          vibrate(15);
        }
      }
      if (rg.cy - rg.r > H + 60) rings.splice(i, 1);
    }

    // FX updates
    updateParticles(dt);
    updateTrail(dt);
    updatePopups(dt);
    if (shakeTimer > 0) shakeTimer -= dt;
    if (flashTimer > 0) flashTimer -= dt;

    render();
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt * 2.2;
      if (p.life <= 0) particles.splice(i, 1);
    }
    if (particles.length > 200) particles.splice(0, particles.length - 200);
  }

  function updateTrail(dt) {
    for (let i = trailParts.length - 1; i >= 0; i--) {
      trailParts[i].life -= dt * 4;
      if (trailParts[i].life <= 0) trailParts.splice(i, 1);
    }
    if (trailParts.length > 60) trailParts.splice(0, trailParts.length - 60);
  }

  function updatePopups(dt) {
    for (let i = scorePopups.length - 1; i >= 0; i--) {
      scorePopups[i].y += scorePopups[i].vy * dt;
      scorePopups[i].life -= dt * 1.5;
      if (scorePopups[i].life <= 0) scorePopups.splice(i, 1);
    }
  }

  function glowCircle(x, y, r, color) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
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
    // screen shake
    const shx = shakeTimer > 0 ? (Math.random() - 0.5) * 6 * Math.min(1, shakeTimer * 5) : 0;
    const shy = shakeTimer > 0 ? (Math.random() - 0.5) * 6 * Math.min(1, shakeTimer * 5) : 0;

    ctx.save();
    ctx.translate(shx, shy);

    ctx.fillStyle = '#08060f';
    ctx.fillRect(0, 0, W, H);

    // grid
    ctx.strokeStyle = 'rgba(120,90,220,0.08)';
    ctx.lineWidth = 1;
    for (let gx = 40; gx < W; gx = gx + 40) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }

    // trail
    for (const t of trailParts) {
      ctx.globalAlpha = t.life * 0.5;
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.size * t.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (let i = 0; i < rings.length; i++) drawRing(rings[i]);

    // floor
    ctx.strokeStyle = '#3bc9ff';
    ctx.shadowColor = '#3bc9ff'; ctx.shadowBlur = 14;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(W, floorY); ctx.stroke();
    ctx.shadowBlur = 0;

    // ball
    const bc = COLORS[ball.color];
    const br = BALL_R + (pulse > 0 ? pulse * 26 : 0);
    ctx.beginPath(); ctx.arc(ball.x, ball.y, br, 0, Math.PI * 2);
    ctx.fillStyle = bc;
    ctx.shadowColor = bc; ctx.shadowBlur = 22;
    ctx.fill();
    ctx.shadowBlur = 0;
    // highlight
    ctx.beginPath(); ctx.arc(ball.x - 3, ball.y - 3, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // particles
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.shadowBlur = 5;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * Math.max(0.1, p.life / p.maxLife), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // score popups
    for (const p of scorePopups) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.font = 'bold 16px "Courier New", monospace';
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
      ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    ctx.restore(); // end shake

    // === HUD (outside shake) ===

    // flash on death
    if (flashTimer > 0 && flashColor) {
      ctx.globalAlpha = flashTimer * 0.5;
      ctx.fillStyle = flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    // color indicators (bottom)
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

    // title
    neonText('COLOR SWITCH', 14, 16, 15, '#7df9ff');
    neonText('TAP / SPACE: SWITCH COLOR', 14, 33, 10, '#8a93b8');

    // score + level
    ctx.textAlign = 'right';
    neonText('SCORE ' + score, W - 14, 20, 16, '#ffd93b');
    // level badge
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 6;
    ctx.fillText('LV.' + level, W - 14, 36);
    ctx.shadowBlur = 0;

    // streak indicator
    if (streakCount >= 3) {
      ctx.font = 'bold 11px "Courier New", monospace';
      ctx.fillStyle = '#ff8800';
      ctx.shadowColor = '#ff8800';
      ctx.shadowBlur = 4;
      ctx.fillText('STREAK x' + streakCount, W - 14, 50);
      ctx.shadowBlur = 0;
    }
    ctx.textAlign = 'left';

    // game over
    if (state === 'over') {
      const alpha = Math.min(0.74, deathTimer * 2);
      ctx.fillStyle = 'rgba(4,4,10,' + alpha + ')';
      ctx.fillRect(0, 0, W, H);
      if (deathTimer > 0.2) {
        ctx.textAlign = 'center';
        neonText('GAME OVER', W / 2, 170, 44, '#ff4d5e');
        neonText('RINGS ' + score, W / 2, 222, 22, '#ffd93b');
        neonText('COINS +' + coins, W / 2, 252, 16, '#3bff8f');
        if (score > 0 && score >= highScore) {
          neonText('★ NEW BEST ★', W / 2, 282, 14, '#ffd93b');
        }
        ctx.textAlign = 'left';
      }
    }
  }

  function loop(ts) {
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    if (running && !over) update(dt);
    else if (over) {
      // keep rendering death FX
      deathTimer += dt;
      updateParticles(dt);
      updateTrail(dt);
      updatePopups(dt);
      if (shakeTimer > 0) shakeTimer -= dt;
      if (flashTimer > 0) flashTimer -= dt;
      render();
    }
    raf = requestAnimationFrame(loop);
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
