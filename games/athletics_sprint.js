function athleticsSprint(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  const RACE = 100;
  let raf = null, last = 0, running = false, over = false, overSent = false;
  let score = 0, coins = 0, keys = {}, touches = {};
  let phase = 'idle', phaseT = 0, gunDelay = 0;
  let tRun = 0, distance = 0, power = 0, stamina = 100, tapCd = 0;
  let speed = 0, kmh = 0, goFlash = 0, shake = 0;
  let legPhase = 0, perfect = false, perfectChecked = false;
  let medal = '', prevPress = false, time = 0;

  function key(n) { return !!keys[n]; }
  function t(n) { return !!touches[n]; }

  function reset() {
    over = false; overSent = false;
    score = 0; coins = 0; time = 0;
    phase = 'idle'; phaseT = 1.2; gunDelay = 0;
    tRun = 0; distance = 0; power = 0; stamina = 100; tapCd = 0;
    speed = 0; kmh = 0; goFlash = 0; shake = 0;
    legPhase = 0; perfect = false; perfectChecked = false;
    medal = ''; prevPress = false;
  }

  function callScore() { if (typeof onScore === 'function') onScore(score); }
  function callCoins() { if (typeof onCoins === 'function') onCoins(coins); }

  function finishGame(sc, c) {
    if (overSent) return;
    overSent = true; over = true;
    if (sc === 0 && typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
    score = sc;
    callScore();
    callCoins();
    if (typeof onGameOver === 'function') onGameOver(sc, c);
  }

  function fmt(t) {
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
  }

  function update(dt) {
    time = time + dt;
    if (goFlash > 0) goFlash = goFlash - dt;
    if (shake > 0) shake = shake - dt;

    const pressNow = t('action') || key('Space') || key('ArrowUp') || key('KeyW') || t('gas');
    const pressEdge = pressNow && !prevPress;
    prevPress = pressNow;
    tapCd = tapCd - dt;

    if (phase === 'idle') {
      phaseT = phaseT - dt;
      if (phaseT <= 0) {
        phase = 'set';
        gunDelay = 0.55 + Math.random() * 0.95;
      }
    } else if (phase === 'set') {
      if (pressEdge) {
        phase = 'finish';
        if (typeof window.playSfx === 'function') { try { window.playSfx('shoot'); } catch (e) {} }
        finishGame(0, 0);
      }
      gunDelay = gunDelay - dt;
      if (gunDelay <= 0) {
        phase = 'run';
        goFlash = 0.55;
        if (typeof window.playSfx === 'function') { try { window.playSfx('shoot'); } catch (e) {} }
      }
    } else if (phase === 'run') {
      tRun = tRun + dt;
      if (pressEdge && tapCd <= 0) {
        tapCd = 0.07;
        power = Math.min(100, power + 17);
        stamina = Math.min(100, stamina + 6);
        legPhase = legPhase + 0.9;
        if (!perfectChecked && tRun < 0.22) perfect = true;
        perfectChecked = true;
        if (typeof window.playSfx === 'function') { try { window.playSfx('click'); } catch (e) {} }
      }
      const fatigue = stamina <= 0 ? 1.8 : 1;
      power = Math.max(0, power - 40 * fatigue * dt);
      stamina = Math.max(0, stamina - 11 * dt);
      speed = 2.5 + power * 0.085;
      distance = distance + speed * dt;
      kmh = speed * 3.6;
      legPhase = legPhase + speed * dt * 1.3;
      shake = Math.min(0.35, power * 0.003);
      score = Math.round(tRun * 1000);
      callScore();

      if (distance >= RACE) {
        const overShoot = (distance - RACE) / speed;
        tRun = tRun - overShoot;
        score = Math.round(tRun * 1000);
        if (tRun < 12.0) medal = 'GOLD';
        else if (tRun < 13.5) medal = 'SILVER';
        else if (tRun < 15.5) medal = 'BRONZE';
        else medal = 'FINISHED';
        coins = 3;
        if (medal === 'GOLD') coins = 10;
        else if (medal === 'SILVER') coins = 6;
        else if (medal === 'BRONZE') coins = 4;
        if (perfect) coins = coins + 2;
        if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
        if (navigator.vibrate) { try { navigator.vibrate([60, 40, 60]); } catch (e) {} }
        callScore();
        callCoins();
        phase = 'finish';
        finishGame(score, coins);
      }
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

  function drawRunner(x, y) {
    const c = '#ffd93b';
    ctx.save();
    ctx.translate(x, y);
    const l1 = Math.sin(legPhase), l2 = Math.sin(legPhase + Math.PI);
    ctx.strokeStyle = c;
    ctx.lineWidth = 3;
    ctx.shadowColor = c; ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(l1 * 11, 0);
    ctx.moveTo(0, -22);
    ctx.lineTo(l2 * 11, 0);
    ctx.moveTo(0, -22);
    ctx.lineTo(0, -40);
    ctx.moveTo(0, -34);
    ctx.lineTo(-l1 * 9, -27);
    ctx.moveTo(0, -34);
    ctx.lineTo(-l2 * 9, -27);
    ctx.moveTo(0, -40);
    ctx.lineTo(0, -46);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, -51, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
    ctx.restore();
  }

  function render() {
    ctx.fillStyle = '#06070f';
    ctx.fillRect(0, 0, W, H);

    const trackY = H - 52;

    for (let i = 0; i < 10; i++) {
      ctx.globalAlpha = 0.10 + 0.05 * Math.sin(time * 1.5 + i * 2.1);
      glowCircle(60 + i * 78, 26, 26, '#8fb3ff');
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#0d0a1a';
    ctx.fillRect(0, trackY - 26, W, 66);
    ctx.strokeStyle = 'rgba(140,120,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, trackY - 26); ctx.lineTo(W, trackY - 26); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, trackY + 40); ctx.lineTo(W, trackY + 40); ctx.stroke();

    const off = (distance * 26) % 44;
    ctx.fillStyle = 'rgba(140,120,255,0.22)';
    for (let x = -44 + off; x < W; x = x + 44) {
      ctx.fillRect(x, trackY - 26, 16, 66);
    }

    ctx.textAlign = 'center';
    for (let m = 10; m < 100; m = m + 10) {
      const x = 70 + (m / RACE) * (W - 200);
      ctx.globalAlpha = 0.5;
      neonText(String(m) + 'm', x, trackY - 34, 9, '#9aa3c8');
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(140,120,255,0.25)';
      ctx.beginPath(); ctx.moveTo(x, trackY - 26); ctx.lineTo(x, trackY + 40); ctx.stroke();
    }
    ctx.textAlign = 'left';

    const fx = 70 + (W - 200);
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = k % 2 === 0 ? '#ffd93b' : '#0d0a1a';
      ctx.shadowColor = '#ffd93b'; ctx.shadowBlur = 8;
      ctx.fillRect(fx + k * 7, trackY - 26, 7, 66);
      ctx.shadowBlur = 0;
    }
    neonText('FINISH', fx - 4, trackY - 34, 9, '#ffd93b');

    const rx = 70 + Math.min(1, distance / RACE) * (W - 200) - 30;
    const ry = trackY - 2;
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 7 * (shake * 3), (Math.random() - 0.5) * 7 * (shake * 3));
    drawRunner(rx, ry);
    ctx.restore();

    if (power > 40) {
      ctx.strokeStyle = 'rgba(160,200,255,0.30)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const ly = 20 + i * 70;
        const sx = (time * (180 + power * 3) + i * 130) % (W + 120) - 60;
        ctx.beginPath(); ctx.moveTo(sx, ly); ctx.lineTo(sx - 60 - power, ly); ctx.stroke();
      }
    }

    neonText('SPRINT 100M', 14, 16, 15, '#7df9ff');
    neonText('TAP RAPIDLY TO RUN', 14, 33, 10, '#8a93b8');

    ctx.textAlign = 'center';
    neonText(fmt(phase === 'run' ? tRun : (phase === 'finish' ? tRun : 0)), W / 2, 52, 34, '#ffffff');
    neonText('SPEED ' + Math.round(kmh) + ' km/h', W / 2, 78, 12, '#3bc9ff');
    if (phase === 'idle') neonText('ON YOUR MARKS...', W / 2, 130, 24, '#ffd93b');
    else if (phase === 'set') neonText('SET...', W / 2, 130, 28, '#ffd93b');
    else if (phase === 'run' && goFlash > 0) neonText('GO!', W / 2, 130, 34, '#3bff8f');

    ctx.fillStyle = 'rgba(20,20,40,0.8)';
    ctx.fillRect(W / 2 - 90, H - 16, 180, 8);
    ctx.fillStyle = stamina > 30 ? '#3bff8f' : '#ff4d5e';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
    ctx.fillRect(W / 2 - 90, H - 16, 180 * (stamina / 100), 8);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';

    if (phase === 'finish' && over) {
      ctx.fillStyle = 'rgba(4,4,10,0.74)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      if (score === 0) {
        neonText('FALSE START!', W / 2, 180, 42, '#ff4d5e');
        neonText('WAIT FOR THE GUN', W / 2, 226, 18, '#9aa3c8');
      } else {
        neonText('TIME ' + fmt(tRun), W / 2, 175, 38, '#ffffff');
        neonText(medal + (perfect ? '  PERFECT START!' : ''), W / 2, 222, 22, '#ffd93b');
      }
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