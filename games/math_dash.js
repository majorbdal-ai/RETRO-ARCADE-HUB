function mathDash(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, overSent = false;
  let score = 0, coins = 0, keys = {}, touches = {};
  let time = 0, state = 'play';
  let a = 0, b = 0, op = '+', answer = 0, options = [];
  let timeLeft = 30, combo = 0, shake = 0, flash = null;

  function key(n) { return !!keys[n]; }
  function t(n) { return !!touches[n]; }

  function reset() {
    over = false; overSent = false;
    score = 0; coins = 0; time = 0; combo = 0; shake = 0;
    timeLeft = 30; state = 'play'; flash = null;
    newQuestion();
  }

  function callScore() { if (typeof onScore === 'function') onScore(score); }
  function callCoins() { if (typeof onCoins === 'function') onCoins(coins); }

  function newQuestion() {
    op = ['+', '-', 'x'][Math.floor(Math.random() * 3)];
    if (op === '+') { a = rand(2, 12); b = rand(2, 12); answer = a + b; }
    else if (op === '-') { a = rand(8, 20); b = rand(2, a - 1); answer = a - b; }
    else { a = rand(2, 9); b = rand(2, 9); answer = a * b; }

    // build 4 options with 1 correct
    const opts = [answer];
    while (opts.length < 4) {
      let wrong = answer + rand(-5, 5);
      if (wrong === answer) wrong = answer + 1 + Math.floor(Math.random() * 7);
      if (!opts.includes(wrong)) opts.push(wrong);
    }
    // shuffle
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    options = opts;
    flash = null;
  }

  function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  function pickAnswer(v) {
    if (over) return;
    if (v === answer) {
      combo++;
      const pts = 10 + (combo >= 3 ? 5 : 0);
      score += pts; callScore();
      coins++; callCoins();
      timeLeft = Math.min(timeLeft + 1, 30);
      flash = 'correct';
      // spring score pop (canvas → screen coords)
      try {
        const c = document.getElementById('gameCanvas');
        const r = c.getBoundingClientRect();
        const sx = r.left + r.width * (0.5), sy = r.top + r.height * 0.35;
        if (typeof window.popScore === 'function') window.popScore(sx, sy, '+' + pts);
      } catch (e) {}
      newQuestion();
    } else {
      combo = 0;
      timeLeft -= 2;
      flash = 'wrong';
      if (timeLeft <= 0) { die(); }
    }
  }

  function die() {
    if (overSent) return;
    overSent = true; over = true; state = 'over';
    callScore();
    if (typeof onGameOver === 'function') onGameOver(score, coins);
  }

  function update(dt) {
    time += dt;
    timeLeft -= dt;
    if (timeLeft <= 0) { timeLeft = 0; die(); return; }
    if (shake > 0) shake -= dt;
    if (flash) { flash = null; }

    // number key input
    const nums = { Digit1:0, Numpad1:0, Digit2:1, Numpad2:1, Digit3:2, Numpad3:2, Digit4:3, Numpad4:3 };
    for (const k in nums) if (keys[k]) {
      pickAnswer(options[nums[k]]);
      keys[k] = false;
    }
    // arrow/touch left..right select option 0..3 index
    if (touches.left && !touches.left_p) { pickAnswer(options[0]); touches.left = false; }
    if (touches.up && !touches.up_p) { pickAnswer(options[1]); touches.up = false; }
    if (touches.down && !touches.down_p) { pickAnswer(options[2]); touches.down = false; }
    if (touches.right && !touches.right_p) { pickAnswer(options[3]); touches.right = false; }

    render();
  }

  function neonText(txt, x, y, size, color) {
    ctx.font = 'bold ' + size + 'px "Courier New", monospace';
    ctx.fillStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.fillText(txt, x, y);
    ctx.shadowBlur = 0;
  }

  function glowBox(x, y, w, h, color) {
    ctx.fillStyle = color + '22';
    ctx.shadowColor = color; ctx.shadowBlur = 12;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, 14);
    else ctx.rect(x, y, w, h);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function render() {
    const ox = shake > 0 ? Math.sin(time * 80) * 6 * shake : 0;
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, W, H);

    // grid
    ctx.strokeStyle = 'rgba(120,130,220,0.05)';
    ctx.lineWidth = 1;
    for (let gx = 40; gx < W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (let gy = 40; gy < H; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

    // question display
    ctx.textAlign = 'center';
    const qStr = `${a} ${op} ${b}`;
    ctx.font = 'bold 72px "Courier New", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#3bc9ff'; ctx.shadowBlur = 20;
    ctx.fillText(qStr + ' = ?', W / 2 + ox, 170);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';

    // timer bar
    const tW = (timeLeft / 30) * (W - 80);
    ctx.fillStyle = timeLeft > 10 ? '#3bff8f' : timeLeft > 5 ? '#ffd93b' : '#ff3b6b';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10;
    ctx.fillRect(40, 40, tW, 10);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(40, 40, W - 80, 10);

    // 4 options
    const bw = 150, bh = 70, gap = 20;
    const total = bw * 2 + gap;
    const startX = (W - total) / 2;
    const oy = 260;
    for (let i = 0; i < 4; i++) {
      const col = i % 2, row = Math.floor(i / 2);
      const x = startX + col * (bw + gap);
      const y = oy + row * (bh + 20);
      const colors = ['#3bc9ff', '#ffd93b', '#3bff8f', '#ff3b6b'];
      glowBox(x, y, bw, bh, colors[i]);
      ctx.textAlign = 'center';
      neonText(String(options[i]), x + bw / 2, y + bh / 2 + 14, 40, colors[i]);
      ctx.textAlign = 'left';
      // key hint
      ctx.textAlign = 'center';
      neonText(String(i + 1), x + bw - 20, y + 20, 12, '#8a93b8');
      ctx.textAlign = 'left';
    }

    // HUD
    ctx.textAlign = 'left';
    neonText('MATH DASH', 14, 20, 15, '#7df9ff');
    ctx.textAlign = 'right';
    neonText('SCORE ' + score, W - 14, 64, 16, '#ffd93b');
    ctx.textAlign = 'left';

    if (combo >= 3) {
      ctx.textAlign = 'center';
      neonText('SPEED BRAIN x' + combo + '!', W / 2, 220, 14, '#ffd93b');
      ctx.textAlign = 'left';
    }

    if (flash === 'correct') {
      ctx.textAlign = 'center';
      neonText('✓ CORRECT!', W / 2, 210, 20, '#3bff8f');
      ctx.textAlign = 'left';
    } else if (flash === 'wrong') {
      ctx.textAlign = 'center';
      neonText('✗ WRONG!', W / 2, 210, 20, '#ff3b6b');
      ctx.textAlign = 'left';
    }

    if (state === 'over') {
      ctx.fillStyle = 'rgba(4,4,10,0.8)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      neonText('TIME UP!', W / 2, 170, 44, '#ff4d5e');
      neonText('SCORE ' + score, W / 2, 224, 24, '#ffd93b');
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
