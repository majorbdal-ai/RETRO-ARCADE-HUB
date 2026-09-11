function trashSorter(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, overSent = false;
  let score = 0, coins = 0, keys = {}, touches = {};
  let time = 0, item = null, bins = [], nextIn = 0, state = 'play';
  let life = 3, fallSpeed = 0, shake = 0, combo = 0;

  function key(n) { return !!keys[n]; }
  function t(n) { return !!touches[n]; }

  const WASTE = [
    { name: 'paper', ico: '📄', bin: 0, color: '#3bc9ff' },
    { name: 'bottle', ico: '🍾', bin: 1, color: '#3bff8f' },
    { name: 'can',    ico: '🥫', bin: 1, color: '#3bff8f' },
    { name: 'apple',  ico: '🍎', bin: 2, color: '#ffd93b' },
    { name: 'banana', ico: '🍌', bin: 2, color: '#ffd93b' },
    { name: 'glass',  ico: '🍷', bin: 1, color: '#3bff8f' },
    { name: 'cardboard', ico: '📦', bin: 0, color: '#3bc9ff' },
    { name: 'leaf',   ico: '🍃', bin: 2, color: '#ffd93b' }
  ];

  function reset() {
    over = false; overSent = false;
    score = 0; coins = 0; time = 0; life = 3; shake = 0; combo = 0;
    state = 'play'; nextIn = 1.2; fallSpeed = 60;
    bins = [
      { x: W * 0.25, color: '#3bc9ff', label: 'RECYCLE', fill: 0 },
      { x: W * 0.5,  color: '#3bff8f', label: 'COMPOST', fill: 0 },
      { x: W * 0.75, color: '#ffd93b', label: 'GARBAGE', fill: 0 }
    ];
    spawnItem();
  }

  function spawnItem() {
    const w = WASTE[Math.floor(Math.random() * WASTE.length)];
    const x = 70 + Math.random() * (W - 140);
    item = { x: x, y: -30, ico: w.ico, bin: w.bin, color: w.color, name: w.name, w: 34, h: 34 };
  }

  function callScore() { if (typeof onScore === 'function') onScore(score); }
  function callCoins() { if (typeof onCoins === 'function') onCoins(coins); }

  function die() {
    if (overSent) return;
    overSent = true; over = true; state = 'over';
    callScore();
    if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
    if (typeof onGameOver === 'function') onGameOver(score, coins);
  }

  function selectBin(i) {
    if (!item || over) return;
    const correct = item.bin === i;
    const bx = bins[i].x;
    const dx = Math.abs(item.x - bx);
    if (typeof window.playSfx === 'function') { try { window.playSfx('click'); } catch (e) {} }
    // bin within reach
    if (dx > 170) {
      life--; combo = 0; shake = 0.2;
      if (life <= 0) { die(); return; }
      return;
    }
    if (correct) {
      combo++;
      const pts = 10 + (combo >= 3 ? 5 : 0);
      score += pts; callScore();
      bins[i].fill += 1;
      coins++; callCoins();
      if (typeof onCoins === 'function') onCoins(coins);
      if (typeof window.playSfx === 'function') { try { window.playSfx('coin'); } catch (e) {} }
      if (combo >= 3) {
        if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
      }
      // spring score pop at the bin (canvas → screen coords)
      try {
        const c = document.getElementById('gameCanvas');
        const r = c.getBoundingClientRect();
        const sx = r.left + r.width * (bx / W), sy = r.top + r.height * 0.45;
        if (typeof window.popScore === 'function') window.popScore(sx, sy, '+' + pts);
      } catch (e) {}
      // next item
      item = null;
      nextIn = 0.25;
    } else {
      life--; combo = 0; shake = 0.3;
      if (typeof window.playSfx === 'function') { try { window.playSfx('error'); } catch (e) {} }
      if (life <= 0) { die(); return; }
    }
  }

  function nearestBin() {
    if (!item) return -1;
    let best = -1, bd = 1e9;
    for (let i = 0; i < bins.length; i++) {
      const d = Math.abs(item.x - bins[i].x);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function update(dt) {
    time = time + dt;
    if (shake > 0) shake -= dt;

    // input: bin selection
    const wantBin = (keys['Digit1'] || keys['Numpad1']) ? 0
      : (keys['Digit2'] || keys['Numpad2']) ? 1
      : (keys['Digit3'] || keys['Numpad3']) ? 2
      : (touches.left) ? 0
      : (touches.up) ? 1
      : (touches.right) ? 2
      : (touches.action) ? nearestBin()
      : -1;
    if (wantBin >= 0) {
      selectBin(wantBin);
      // clear to avoid re-fire
      keys['Digit1'] = keys['Numpad1'] = keys['Digit2'] = keys['Numpad2'] = keys['Digit3'] = keys['Numpad3'] = false;
      touches.left = touches.up = touches.right = touches.action = false;
    }

    if (item == null) {
      nextIn -= dt;
      if (nextIn <= 0) spawnItem();
    } else {
      item.y += fallSpeed * dt;
      // reached bottom without input
      if (item.y > H - 90) {
        life--; combo = 0; shake = 0.3;
        item = null;
        nextIn = 0.4;
        if (life <= 0) { die(); return; }
      }
    }

    fallSpeed = 70 + score * 1.5;

    render();
  }

  function drawer() { return ctx; }

  function glowRect(x, y, w, h, color, r) {
    ctx.fillStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = 12;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r || 8);
    else ctx.rect(x, y, w, h);
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
    const ox = shake > 0 ? Math.sin(time * 80) * 6 * shake : 0;
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, W, H);

    // grid
    ctx.strokeStyle = 'rgba(120,130,220,0.06)';
    ctx.lineWidth = 1;
    for (let gx = 40; gx < W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }

    // ground
    glowRect(0, H - 40, W, 6, '#3bc9ff', 2);

    // bins
    for (let i = 0; i < bins.length; i++) {
      const b = bins[i];
      highlight(b.x, i);
      const bx = b.x - 55;
      const by = H - 120;
      // bin glow
      ctx.fillStyle = b.color + '22';
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + 110, by);
      ctx.lineTo(bx + 95, H - 42);
      ctx.lineTo(bx + 15, H - 42);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + 110, by);
      ctx.lineTo(bx + 95, H - 42);
      ctx.lineTo(bx + 15, H - 42);
      ctx.closePath();
      ctx.stroke();
      // fill level
      if (b.fill > 0) {
        const fh = Math.min(60, b.fill * 6);
        ctx.fillStyle = b.color + '66';
        ctx.fillRect(bx + 15, H - 42 - fh, 80, fh);
      }
      // label
      ctx.textAlign = 'center';
      neonText(b.label, b.x, H - 55, 10, b.color);
    }

    // falling item
    if (item) {
      // shadow
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(item.x, H - 46, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;

      ctx.font = '44px "Segoe UI Emoji", "Noto Color Emoji", monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = item.color;
      ctx.shadowBlur = 16;
      ctx.fillText(item.ico, item.x + ox, item.y);
      ctx.shadowBlur = 0;
      // ring under
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(item.x, item.y - 18, 26, 0, Math.PI * 2); ctx.stroke();
    }

    // HUD
    ctx.textAlign = 'left';
    neonText('TRASH SORTER', 14, 20, 15, '#7df9ff');
    neonText('TAP/A/S/D + NUMBER 1/2/3 → BIN', 14, 36, 9, '#8a93b8');
    ctx.textAlign = 'right';
    neonText('SCORE ' + score, W - 14, 20, 16, '#ffd93b');
    // lives
    let lifeStr = '';
    for (let i = 0; i < life; i++) lifeStr += '❤️ ';
    ctx.textAlign = 'right';
    ctx.font = '16px monospace';
    ctx.fillText(lifeStr, W - 14, 36);
    ctx.textAlign = 'left';

    if (combo >= 3) {
      ctx.textAlign = 'center';
      neonText('COMBO x' + combo + '!', W / 2, H - 130, 14, '#ffd93b');
      ctx.textAlign = 'left';
    }

    if (state === 'over') {
      ctx.fillStyle = 'rgba(4,4,10,0.8)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      neonText('GAME OVER', W / 2, 170, 44, '#ff4d5e');
      neonText('SCORE ' + score, W / 2, 224, 24, '#ffd93b');
      neonText('COINS +' + coins, W / 2, 258, 16, '#3bff8f');
      ctx.textAlign = 'left';
    }
  }

  function highlight(bx, i) {
    if (!item) return;
    const dx = Math.abs(item.x - bx);
    if (dx < 170) {
      ctx.fillStyle = bins[i].color + '11';
      ctx.fillRect(bx - 60, H - 126, 120, 88);
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
  function setInput(ts, ks) {
    touches = ts || {}; keys = ks || {};
  }

  return { start: start, pause: pause, resume: resume, destroy: destroy, setInput: setInput };
}
