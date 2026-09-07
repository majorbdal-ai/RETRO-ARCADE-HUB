function simonSays(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  const BTN = [
    { x: 210, y: 120, w: 180, h: 108 },
    { x: 410, y: 120, w: 180, h: 108 },
    { x: 210, y: 246, w: 180, h: 108 },
    { x: 410, y: 246, w: 180, h: 108 }
  ];
  const COLS = ['#ff4d5e', '#3bc9ff', '#ffd93b', '#4dff88'];
  let raf = null, last = 0, running = false, over = false, overSent = false;
  let score = 0, coins = 0, keys = {}, touches = {};
  let seq = [], phase = 'idle', phaseT = 1.0;
  let showIdx = 0, showT = 0, lit = -1, litT = 0;
  let cursor = 0, inputIdx = 0, wrongIdx = -1;
  let status = '', statusT = 0, prevSel = false, time = 0;

  function key(n) { return !!keys[n]; }
  function t(n) { return !!touches[n]; }

  function reset() {
    over = false; overSent = false;
    score = 0; coins = 0; time = 0;
    seq = []; phase = 'idle'; phaseT = 1.0;
    showIdx = 0; showT = 0; lit = -1; litT = 0;
    cursor = 0; inputIdx = 0; wrongIdx = -1;
    status = 'WATCH'; statusT = 0.9; prevSel = false;
  }

  function callScore() { if (typeof onScore === 'function') onScore(score); }
  function callCoins() { if (typeof onCoins === 'function') onCoins(coins); }

  function nextTurn() {
    seq.push(Math.floor(Math.random() * 4));
    phase = 'show';
    showIdx = 0;
    showT = 0.5;
    lit = -1;
    status = 'WATCH';
  }

  function finishGame() {
    if (overSent) return;
    overSent = true; over = true;
    callScore();
    callCoins();
    if (typeof onGameOver === 'function') onGameOver(score, coins);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function update(dt) {
    time = time + dt;
    if (litT > 0) {
      litT = litT - dt;
      if (litT <= 0) lit = -1;
    }
    if (statusT > 0) statusT = statusT - dt;

    const selNow = t('action') || key('Space') || t('gas');

    if (phase === 'idle') {
      phaseT = phaseT - dt;
      if (phaseT <= 0) nextTurn();
      if (selNow && !prevSel) phaseT = 0;
    } else if (phase === 'show') {
      showT = showT - dt;
      if (showT <= 0) {
        if (showIdx < seq.length) {
          lit = seq[showIdx];
          litT = Math.max(0.16, 0.36 - seq.length * 0.012);
          showIdx = showIdx + 1;
          showT = litT + 0.18;
        } else {
          phase = 'input';
          inputIdx = 0;
          cursor = 0;
          lit = -1;
          status = 'YOUR TURN';
          statusT = 0.8;
        }
      }
    } else if (phase === 'input') {
      let row = Math.floor(cursor / 2), col = cursor % 2;
      if (t('up') || key('ArrowUp') || key('KeyW')) row = 0;
      if (t('down') || key('ArrowDown') || key('KeyS')) row = 1;
      if (t('left') || key('ArrowLeft') || key('KeyA')) col = 0;
      if (t('right') || key('ArrowRight') || key('KeyD')) col = 1;
      cursor = row * 2 + col;

      if (selNow && !prevSel) {
        if (cursor === seq[inputIdx]) {
          lit = cursor;
          litT = 0.22;
          inputIdx = inputIdx + 1;
          if (inputIdx >= seq.length) {
            score = score + 1; callScore();
            coins = coins + 1; callCoins();
            status = 'NICE!'; statusT = 0.6;
            phase = 'wait';
            phaseT = 0.7;
            lit = -1;
          }
        } else {
          wrongIdx = cursor;
          phase = 'finish';
          finishGame();
        }
      }
    } else if (phase === 'wait') {
      phaseT = phaseT - dt;
      if (phaseT <= 0) nextTurn();
    }
    prevSel = selNow;
    render();
  }

  function neonText(txt, x, y, size, color) {
    ctx.font = 'bold ' + size + 'px "Courier New", monospace';
    ctx.fillStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.fillText(txt, x, y);
    ctx.shadowBlur = 0;
  }

  function render() {
    ctx.fillStyle = '#06070f';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(20,18,38,0.9)';
    ctx.strokeStyle = 'rgba(120,130,220,0.22)';
    ctx.lineWidth = 2;
    roundRect(180, 92, 440, 290, 18);
    ctx.fill();
    ctx.stroke();

    for (let i = 0; i < 4; i++) {
      const b = BTN[i];
      const c = COLS[i];
      const isLit = lit === i;
      ctx.fillStyle = isLit ? '#ffffff' : c;
      ctx.shadowColor = c;
      ctx.shadowBlur = isLit ? 34 : 16;
      roundRect(b.x, b.y, b.w, b.h, 14);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = isLit ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.12)';
      roundRect(b.x + 10, b.y + 8, b.w - 20, b.h * 0.42, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      roundRect(b.x, b.y, b.w, b.h, 14);
      ctx.stroke();
    }

    const cb = BTN[cursor];
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 12;
    ctx.setLineDash([8, 6]);
    roundRect(cb.x - 7, cb.y - 7, cb.w + 14, cb.h + 14, 16);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    if (wrongIdx >= 0) {
      const wb = BTN[wrongIdx];
      ctx.strokeStyle = '#ff4d5e';
      ctx.lineWidth = 5;
      ctx.shadowColor = '#ff4d5e'; ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(wb.x + 16, wb.y + 16); ctx.lineTo(wb.x + wb.w - 16, wb.y + wb.h - 16);
      ctx.moveTo(wb.x + wb.w - 16, wb.y + 16); ctx.lineTo(wb.x + 16, wb.y + wb.h - 16);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    neonText('SIMON SAYS', 14, 16, 15, '#7df9ff');
    neonText('STICK/ARROWS: MOVE  ACTION: TAP', 14, 33, 10, '#8a93b8');
    ctx.textAlign = 'right';
    neonText('ROUND ' + score, W - 14, 20, 16, '#ffd93b');
    neonText('SEQ ' + seq.length, W - 14, 38, 12, '#a6a8d0');
    ctx.textAlign = 'left';

    if (statusT > 0 && !over) {
      ctx.textAlign = 'center';
      neonText(status, W / 2, 104, 22, '#a6a8d0');
      ctx.textAlign = 'left';
    }
    if (phase === 'input' && !over) {
      ctx.textAlign = 'center';
      neonText('REPEAT THE SEQUENCE', W / 2, 406, 13, '#a6a8d0');
      ctx.textAlign = 'left';
    }
    if (phase === 'finish' && over) {
      ctx.fillStyle = 'rgba(4,4,10,0.76)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      neonText('GAME OVER', W / 2, 190, 42, '#ff4d5e');
      neonText('ROUND ' + score, W / 2, 238, 22, '#ffd93b');
      neonText('COINS +' + coins, W / 2, 268, 16, '#3bff8f');
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