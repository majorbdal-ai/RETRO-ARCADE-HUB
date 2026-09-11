function pong(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  const PW = 12, PH = 76, PAD = 18, BALL_R = 7, WIN = 7;
  let raf = null, last = 0, running = false, over = false, overSent = false;
  let score = 0, aiScore = 0, coins = 0, keys = {}, touches = {};
  let p = null, ai = null, ball = null, trail = [];
  let serveTimer = 0, serveDir = 1, state = 'play', stateWin = false;
  let message = '', msgT = 0, flashHit = 0, time = 0;
  let particles = [];
  let hitFlash = 0;
  let shakeAmount = 0;
  let rallyCount = 0; // consecutive hits without scoring
  let maxRally = 0;
  let serveCount = 0; // how many serves (for difficulty)
  let difficultyMult = 1;   // v7.18 difficulty ramp
  const BALL_SPEED_CAP = 720 * 2; // ~2x base cap

  function vibrate(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function spawnParticles(x, y, color, count, spread, life) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x, y: y,
        vx: rnd(-spread, spread),
        vy: rnd(-spread, spread),
        life: life || 0.6,
        maxLife: life || 0.6,
        color: color,
        size: rnd(2, 5)
      });
    }
  }

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
    particles = [];
    hitFlash = 0; shakeAmount = 0;
    rallyCount = 0; maxRally = 0; serveCount = 0;
    difficultyMult = 1;
  }

  function callScore() { if (typeof onScore === 'function') onScore(score); }
  function callCoins() { if (typeof onCoins === 'function') onCoins(coins); }

  function serve(dir) {
    serveCount++;
    const a = (Math.random() * 0.7 - 0.35);
    // Speed increases slightly each serve for intensity
    const baseSpeed = (300 + Math.min(serveCount * 5, 60)) * difficultyMult;
    const sp = baseSpeed + Math.random() * 30;
    ball.x = W / 2; ball.y = H / 2;
    ball.vx = Math.cos(a) * sp * dir;
    ball.vy = Math.sin(a) * sp;
    trail = [];
    rallyCount = 0;
    // Serve particles
    spawnParticles(W / 2, H / 2, '#ffd93b', 8, 80, 0.5);
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
    sp = Math.max(300, Math.min(sp * 1.05, Math.min(720 * difficultyMult, BALL_SPEED_CAP)));
    const ang = off * 0.75;
    const dir = side < 0 ? 1 : -1;
    ball.vx = Math.cos(ang) * sp * dir;
    ball.vy = Math.sin(ang) * sp;
    ball.x = side < 0 ? border + 1 : border - 1;
    flashHit = 0.12;
    hitFlash = 0.08;
    rallyCount++;
    if (rallyCount > maxRally) maxRally = rallyCount;
    // Nokia paddle *bop* — higher pitch with each rally (retro escalation)
    if (typeof window.playSfx === 'function') { try { window.playSfx('click'); } catch (e) {} }
    if (navigator.vibrate) { try { navigator.vibrate(Math.min(10 + rallyCount, 25)); } catch (e) {} }

    // Hit particles
    let color = side < 0 ? '#3bc9ff' : '#ff4d5e';
    spawnParticles(ball.x, ball.y, color, 6, 100, 0.4);

    // Haptic: short buzz on hit, longer for fast rallies
    vibrate(rallyCount > 5 ? 25 : 15);
  }

  function final() {
    overSent = true; over = true; state = 'over';
    callScore();
    // Big celebration particles
    let winColor = stateWin ? '#3bff8f' : '#ff4d5e';
    for (let i = 0; i < 40; i++) {
      spawnParticles(W / 2 + rnd(-200, 200), H / 2 + rnd(-100, 100), winColor, 1, 300, 1.5);
    }
    // Vibrate pattern
    vibrate(stateWin ? [50, 30, 80, 30, 120] : [100, 50, 100]);
    if (typeof window.playSfx === 'function') { try { window.playSfx(stateWin ? 'win2' : 'over'); } catch (e) {} }
    if (typeof onGameOver === 'function') onGameOver(score, coins);
  }

  function pointFor(who) {
    if (who === 0) {
      score = score + 1; callScore();
      coins = coins + 1; callCoins();
      serveDir = -1;
      message = 'YOU SCORE!'; msgT = 1.1;
      vibrate([40, 20, 60]);
      if (typeof window.playSfx === 'function') { try { window.playSfx('coin'); } catch (e) {} }
      spawnParticles(W - 30, ball.y, '#3bc9ff', 15, 180, 0.8);
      if (score >= WIN) { stateWin = true; final(); return; }
    } else {
      aiScore = aiScore + 1;
      serveDir = 1;
      message = 'AI SCORES'; msgT = 1.1;
      vibrate(60);
      if (typeof window.playSfx === 'function') { try { window.playSfx('error'); } catch (e) {} }
      spawnParticles(30, ball.y, '#ff4d5e', 15, 180, 0.8);
      if (aiScore >= WIN) { stateWin = false; final(); return; }
    }
    ball.vx = 0; ball.vy = 0;
    trail = [];
    serveTimer = 1.1;
  }

  function update(dt) {
    time = time + dt;
    if (flashHit > 0) flashHit = flashHit - dt;
    if (hitFlash > 0) hitFlash = hitFlash - dt;
    if (msgT > 0) msgT = msgT - dt;
    if (shakeAmount > 0) shakeAmount *= Math.max(0, 1 - 10 * dt);

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      let pt = particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 100 * dt;
      pt.life -= dt;
      if (pt.life <= 0) particles.splice(i, 1);
    }

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

    // AI difficulty: gets slightly harder as player scores more
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
      if (ball.y - BALL_R < 0) {
        ball.y = BALL_R; ball.vy = Math.abs(ball.vy);
        spawnParticles(ball.x, BALL_R, 'rgba(200,200,255,0.5)', 3, 50, 0.3);
        if (typeof window.playSfx === 'function') { try { window.playSfx('move'); } catch (e) {} }
      }
      if (ball.y + BALL_R > H) {
        ball.y = H - BALL_R; ball.vy = -Math.abs(ball.vy);
        spawnParticles(ball.x, H - BALL_R, 'rgba(200,200,255,0.5)', 3, 50, 0.3);
        if (typeof window.playSfx === 'function') { try { window.playSfx('move'); } catch (e) {} }
      }
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
    ctx.save();
    // Screen shake
    if (shakeAmount > 0.5) {
      ctx.translate(
        (Math.random() - 0.5) * shakeAmount * 2,
        (Math.random() - 0.5) * shakeAmount * 2
      );
    }

    ctx.fillStyle = '#06060f';
    ctx.fillRect(0, 0, W, H);

    // Hit flash
    if (hitFlash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (hitFlash * 1.5) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    // Center line
    ctx.strokeStyle = 'rgba(120,130,220,0.18)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 14]);
    ctx.beginPath(); ctx.moveTo(W / 2, 18); ctx.lineTo(W / 2, H - 18); ctx.stroke();
    ctx.setLineDash([]);

    // Rally indicator (grows with consecutive hits)
    if (rallyCount > 2 && !over) {
      ctx.save();
      ctx.textAlign = 'center';
      let rallyAlpha = Math.min(0.7, rallyCount * 0.08);
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = 'rgba(255,217,59,' + rallyAlpha + ')';
      ctx.fillText('RALLY x' + rallyCount, W / 2, H - 12);
      ctx.textAlign = 'left';
      ctx.restore();
    }

    // Ball trail
    for (let i = 0; i < trail.length; i++) {
      const tr = trail[i];
      const a = (i + 1) / trail.length;
      ctx.globalAlpha = a * 0.35;
      glowCircle(tr.x, tr.y, BALL_R * (0.5 + 0.5 * a), '#bffcff');
    }
    ctx.globalAlpha = 1;

    // Paddles with glow
    glowRect(PAD, p.y, PW, PH, '#3bc9ff');
    glowRect(W - PAD - PW, ai.y, PW, PH, '#ff4d5e');

    // Ball with extra glow
    ctx.save();
    let ballGlow = flashHit > 0 ? 24 : 14;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = ballGlow;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R + (flashHit > 0 ? 2 : 0), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // Particles
    for (let i = 0; i < particles.length; i++) {
      let pt = particles[i];
      let alpha = pt.life / pt.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pt.color;
      ctx.shadowColor = pt.color;
      ctx.shadowBlur = 3;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Score display
    ctx.textAlign = 'center';
    neonText(String(score), W / 2 - 70, 66, 46, '#3bc9ff');
    neonText(String(aiScore), W / 2 + 70, 66, 46, '#ff4d5e');
    ctx.textAlign = 'left';

    // Score dots (best of WIN)
    for (let i = 0; i < WIN; i++) {
      let dx = W / 2 - 70 - 20 - i * 16;
      ctx.fillStyle = i < score ? '#3bc9ff' : '#1a1a3a';
      ctx.beginPath();
      ctx.arc(dx, 80, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < WIN; i++) {
      let dx = W / 2 + 70 + 20 + i * 16;
      ctx.fillStyle = i < aiScore ? '#ff4d5e' : '#1a1a3a';
      ctx.beginPath();
      ctx.arc(dx, 80, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Title and controls
    neonText('NEON PONG', 14, 16, 15, '#7df9ff');
    neonText('MOVE: DRAG/ARROWS/WASD  FIRST TO ' + WIN, 14, 33, 10, '#8a93b8');

    // Serve countdown
    if (serveTimer > 0 && !over) {
      ctx.textAlign = 'center';
      let countdown = Math.ceil(serveTimer);
      let pulseScale = 1 + 0.15 * Math.sin(time * 12);
      ctx.save();
      ctx.translate(W / 2, H - 40);
      ctx.scale(pulseScale, pulseScale);
      neonText('GET READY...', 0, 0, 16, '#9aa3c8');
      ctx.restore();
      ctx.textAlign = 'left';
    }

    // Score messages
    if (msgT > 0 && !over) {
      ctx.textAlign = 'center';
      let msgPulse = 1 + 0.1 * Math.sin(time * 8);
      ctx.save();
      ctx.translate(W / 2, 104);
      ctx.scale(msgPulse, msgPulse);
      neonText(message, 0, 0, 18, '#ffd93b');
      ctx.restore();
      ctx.textAlign = 'left';
    }

    // Game over
    if (state === 'over') {
      ctx.fillStyle = 'rgba(4,4,10,0.78)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';

      neonText(stateWin ? '🏆 YOU WIN!' : '💔 AI WINS', W / 2, 160, 40, stateWin ? '#3bff8f' : '#ff4d5e');
      neonText('FINAL  ' + score + ' - ' + aiScore, W / 2, 210, 24, '#ffd93b');

      // Stats
      ctx.font = '13px monospace';
      ctx.fillStyle = '#7f92b8';
      ctx.shadowColor = '#7f92b8';
      ctx.shadowBlur = 4;
      ctx.fillText('Best Rally: ' + maxRally + ' hits', W / 2, 248);
      ctx.fillText('Coins +' + coins, W / 2, 270);
      ctx.shadowBlur = 0;

      if (stateWin) {
        ctx.font = '14px monospace';
        ctx.fillStyle = '#3bff8f';
        ctx.shadowColor = '#3bff8f';
        ctx.fillText('Champion! 🏅', W / 2, 298);
      }
      ctx.textAlign = 'left';
    }

    // Control hint
    ctx.save();
    ctx.fillStyle = 'rgba(20,20,40,0.6)';
    ctx.fillRect(4, H - 22, 320, 18);
    ctx.fillStyle = '#4a5a7a';
    ctx.font = '10px monospace';
    ctx.fillText('↕ DRAG or ↑↓ or W/S to move paddle', 10, H - 9);
    ctx.restore();

    ctx.restore(); // end screen shake
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

  return { start: start, pause: pause, resume: resume, destroy: destroy, setInput: setInput,
    setDifficulty: function(level) {
      const m = [1.0, 1.15, 1.3, 1.5, 1.75, 2.0];
      const l = Math.max(0, Math.min(5, Math.floor(level) || 0));
      difficultyMult = m[l];
    } };
}
