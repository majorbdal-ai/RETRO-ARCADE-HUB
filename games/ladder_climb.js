function ladderClimb(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  const START_Y = H - 60, HOLD_SPACE = 90, REACH = 130;
  let raf = null, last = 0, running = false, over = false, overSent = false;
  let score = 0, coins = 0, keys = {}, touches = {};
  let time = 0, climber = null, holds = [], speed = 0, state = 'play';
  let combo = 0, diffMul = 1, prevPress = false;
  let hearts = 3, missFlash = 0, hintTimer = 4, lastMilestone = 0;

  function key(n) { return !!keys[n]; }
  function t(n) { return !!touches[n]; }

  function sfx(n) { if (typeof window.playSfx === 'function') { try { window.playSfx(n); } catch (e) {} } }
  function haptic(p) { if (typeof window.hapticVibe === 'function') { try { window.hapticVibe(p); } catch (e) {} } }
  function fxBurst(x, y, color, count) { if (window.gameFX && window.gameFX.burst) { try { window.gameFX.burst(x, y, color, count); } catch (e) {} } }
  function fxShake(i) { if (window.gameFX && window.gameFX.shake) { try { window.gameFX.shake(i); } catch (e) {} } }
  function holdScreen(h) {
    try { const r = canvas.getBoundingClientRect(); return { x: r.left + r.width * (h.x / W), y: r.top + r.height * (h.y / H) }; }
    catch (e) { return { x: h.x, y: h.y }; }
  }

  function holdX(prevX) {
    // consecutive holds max ±100px horizontal step — always inside the
    // 130px reach window, so skill is tap TIMING, never broken geometry
    const nx = prevX + (Math.random() - 0.5) * 200;
    return Math.max(90, Math.min(W - 90, nx));
  }

  function reset() {
    over = false; overSent = false;
    score = 0; coins = 0; time = 0; combo = 0; hearts = 3;
    prevPress = false; missFlash = 0; hintTimer = 4; lastMilestone = 0;
    state = 'play';
    climber = { x: W / 2, y: START_Y };

    // chain of reachable holds climbing up from the start position
    holds = [];
    let x = W / 2, y = START_Y - HOLD_SPACE - 20;
    for (let i = 0; i < 8; i++) {
      holds.push({ x: x, y: y, grabbed: false });
      x = holdX(x);
      y -= HOLD_SPACE;
    }
  }

  function callScore() { if (typeof onScore === 'function') onScore(score); }
  function callCoins() { if (typeof onCoins === 'function') onCoins(coins); }

  function die() {
    if (overSent) return;
    overSent = true; over = true; state = 'over';
    sfx('over');
    haptic('over');
    callScore();
    try {
      const s = holdScreen({ x: climber.x, y: climber.y });
      fxBurst(s.x, s.y, '#ff4444', 16);
    } catch (e) {}
    fxShake(5);
    if (typeof onGameOver === 'function') onGameOver(score, coins);
  }

  // grab the nearest ungrabbed hold inside the reach window above the climber
  function tryGrab() {
    if (over) return;
    let best = null, bestY = -1e9;
    for (let i = 0; i < holds.length; i++) {
      const h = holds[i];
      if (h.grabbed) continue;
      if (h.y > climber.y - 25 || h.y < climber.y - 175) continue; // outside window
      if (Math.abs(h.x - climber.x) >= REACH) continue;             // out of arm's reach
      if (h.y > bestY) { bestY = h.y; best = h; }                   // nearest (largest y) first
    }
    if (!best) return; // tapped too early/empty air — nothing to grab

    best.grabbed = true;
    climber.x = best.x;
    climber.y = best.y;
    combo++;
    // last-chance grab: hold was already inside the danger pulse window
    const lastChance = best.y > climber.y - 70;
    let pts = 5 + (combo >= 4 ? 3 : 0);
    if (lastChance) pts += 2; // clutch bonus
    score += pts; callScore();
    coins++; callCoins();
    sfx(combo >= 4 || lastChance ? 'win2' : 'click');
    haptic('tap');
    try {
      const s = holdScreen(best);
      fxBurst(s.x, s.y - 8, '#3bff8f', 5);
      if (typeof window.popScore === 'function') window.popScore(s.x, s.y - 14, '+' + pts);
      if (lastChance && typeof window.popScore === 'function') window.popScore(s.x, s.y - 32, 'CLOSE! +2');
    } catch (e) {}
    // altitude milestone — every 100m of height
    const mstone = Math.floor(score / 100);
    if (mstone > lastMilestone) {
      lastMilestone = mstone;
      try {
        const s = holdScreen({ x: climber.x, y: climber.y });
        fxBurst(s.x, s.y - 20, '#ffd93b', 14);
        fxShake(1);
        if (typeof window.popScore === 'function') window.popScore(s.x, s.y - 44, 'ALTITUDE ' + (mstone * 100) + 'M!');
      } catch (e) {}
    }
  }

  function update(dt) {
    time = time + dt;
    if (missFlash > 0) missFlash -= dt;
    if (hintTimer > 0) hintTimer -= dt;

    speed = Math.min(330, (90 + score * 0.9) * diffMul);

    // whole wall scrolls down — the next hold is always arriving;
    // miss it and it falls past you.
    for (let i = holds.length - 1; i >= 0; i--) {
      const h = holds[i];
      h.y += speed * dt;
      if (!h.grabbed && h.y > climber.y + 6) {
        // hold slipped past — fell!
        holds.splice(i, 1);
        combo = 0;
        hearts--;
        missFlash = 0.35;
        sfx('error');
        haptic('over');
        fxShake(2);
        if (hearts <= 0) { die(); return; }
      } else if (h.y > H + 80) {
        holds.splice(i, 1); // old scenery below — recycle
      }
    }

    // keep the chain stocked ahead of the climber
    let topY = 1e9, topX = W / 2;
    for (let i = 0; i < holds.length; i++) {
      if (holds[i].y < topY) { topY = holds[i].y; topX = holds[i].x; }
    }
    if (topY > climber.y - 400) {
      const nx = holdX(topX);
      holds.push({ x: nx, y: topY - HOLD_SPACE, grabbed: false });
    }

    // edge-triggered grab: only a fresh tap/space counts (no hold-to-auto-climb)
    const press = t('action') || key('Space') || key('ArrowUp') || key('KeyW');
    if (press && !prevPress) tryGrab();
    prevPress = press;

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
      // hold about to pass the climber → danger pulse (must grab NOW)
      const danger = !h.grabbed && h.y > climber.y - 70 && h.y <= climber.y - 25;
      const pulse = danger ? (0.5 + 0.5 * Math.abs(Math.sin(time * 10))) : 0;
      if (h.grabbed) {
        glowCircle(h.x, h.y, 9, '#3bff8f');
      } else if (danger) {
        glowCircle(h.x, h.y, 8 + pulse * 2, pulse > 0.7 ? '#ff3b3b' : '#ff9d3b');
      } else {
        glowCircle(h.x, h.y, 8, '#c084fc');
      }
    }

    // climber
    if (climber) {
      const cx = climber.x, cy = climber.y;
      ctx.fillStyle = '#ffd93b';
      ctx.shadowColor = '#ffd93b'; ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(cx, cy - 12, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#f5b3a0';
      ctx.beginPath();
      ctx.arc(cx, cy - 26, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd93b';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx, cy - 14); ctx.lineTo(cx - 16, cy - 34); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - 14); ctx.lineTo(cx + 16, cy - 34); ctx.stroke();
      ctx.fillStyle = '#ff3b6b';
      ctx.beginPath();
      ctx.arc(cx, cy - 28, 8, Math.PI, 0);
      ctx.fill();
    }

    // HUD
    neonText('LADDER CLIMB', 14, 20, 15, '#7df9ff');
    if (hintTimer > 0) {
      neonText('TAP WHEN THE HOLD IS IN REACH — DON\'T LET IT FALL!', 14, 36, 9, '#8a93b8');
    }
    ctx.textAlign = 'right';
    neonText('SCORE ' + score, W - 14, 20, 16, '#ffd93b');
    // hearts
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < hearts ? '#ff4d5e' : 'rgba(255,255,255,0.15)';
      ctx.font = '16px "Courier New", monospace';
      ctx.fillText('\u2665', W - 14 - (i + 1) * 22, 40);
    }
    ctx.textAlign = 'left';
    if (missFlash > 0) {
      ctx.fillStyle = 'rgba(255,40,60,' + Math.min(0.5, missFlash * 1.4) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    if (combo >= 4) {
      ctx.textAlign = 'center';
      neonText('KING OF THE MOUNTAIN x' + combo, W / 2, 60, 14, '#ffd93b');
      ctx.textAlign = 'left';
    }

    if (state === 'over') {
      ctx.fillStyle = 'rgba(4,4,10,0.8)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      neonText(hearts > 0 ? 'FELL!' : 'FELL!', W / 2, 170, 44, '#ff4d5e');
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

  return { start: start, pause: pause, resume: resume, destroy: destroy, setInput: setInput, setDifficulty: function(level) { diffMul = [1, 1.15, 1.3, 1.5, 1.75, 2][Math.min(5, level)] || 1; }, getHelp: function() { return 'TAP / SPACE when a glowing hold is in reach above you. Grab it before it falls past — 3 misses and you fall! Chain quick grabs for combos and clutch bonuses.'; } };
}