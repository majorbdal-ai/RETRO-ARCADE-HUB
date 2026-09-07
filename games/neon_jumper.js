function neonJumper(canvas, ctx, onScore, onGameOver, onCoins) {
  'use strict';
  var W = 800, H = 450;
  var G = 1500, JUMP = 830, PR = 13;
  var raf = null, last = 0, running = false, over = false;
  var keys = {}, touches = {};
  var score = 0, coins = 0;
  var px = 0, py = 0, vx = 0, vy = 0;
  var cam = 0, camStart = 0;
  var plats = [], stars = [], trail = [];
  var time = 0;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function down(name, k) {
    return !!((touches && touches[name]) || (keys && k.some(function (x) { return !!keys[x]; })));
  }

  function diff() { return Math.max(0, camStart - cam); }

  function pushPlatform(y) {
    var d = diff();
    var r = Math.random();
    var kind = 0;
    if (d > 2600 && r < 0.28) kind = 2;
    else if (d > 1300 && r < 0.52) kind = 1;
    var w = kind === 2 ? rnd(44, 60) : Math.max(42, 100 - Math.min(52, d / 130));
    var p = { x: 0, y: y, w: w, kind: kind, breakT: 0, vx: 0, amp: 0, ph: 0, spd: 0, spring: false, dx: 0, initX: 0 };
    p.initX = rnd(16, W - 16 - w);
    p.x = p.initX;
    if (kind === 1) {
      p.amp = rnd(12, 34); p.spd = rnd(1.4, 2.8); p.ph = rnd(0, 6.28);
    } else if (kind === 0 && Math.random() < 0.07 && d > 800) {
      p.spring = true;
    }
    plats.push(p);
  }

  function reset() {
    cam = -240; camStart = cam;
    px = W / 2; py = H * 0.6 + cam; vx = 0; vy = 0;
    score = 0; coins = 0; time = 0;
    plats = []; trail = []; stars = [];
    for (var i = 0; i < 70; i++) {
      stars.push({ x: rnd(0, W), y: rnd(0, H), s: rnd(0.5, 1.9), p: rnd(0, 6.28) });
    }
    plats.push({ x: px - 70, y: py + 34, w: 140, kind: 0, breakT: 0, vx: 0, amp: 0, ph: 0, spd: 0, spring: false, dx: 0, initX: px - 70 });
    var y = py + 34;
    while (y < cam + H + 130) { y += rnd(84, 112); pushPlatform(y); }
    var y2 = py + 34 - rnd(84, 112);
    while (y2 > cam - 300) { pushPlatform(y2); y2 -= rnd(84, 112); }
  }

  function update(dt) {
    time += dt;
    var left = down('left', ['ArrowLeft', 'KeyA']);
    var right = down('right', ['ArrowRight', 'KeyD']);
    var acc = (right ? 1 : 0) - (left ? 1 : 0);
    vx += acc * 2600 * dt;
    if (!acc) vx *= Math.max(0, 1 - 9 * dt);
    vx = clamp(vx, -380, 380);
    px += vx * dt;
    if (px < -16) px = W + 16;
    if (px > W + 16) px = -16;
    vy += G * dt;
    py += vy * dt;
    var targetC = py - H * 0.42;
    if (targetC < cam) {
      cam += (targetC - cam) * Math.min(1, 14 * dt);
      if (cam > targetC) cam = targetC;
    }
    for (var i = 0; i < plats.length; i++) {
      var p = plats[i];
      p.dx = 0;
      if (p.kind === 1) {
        var nx = p.initX + Math.sin(time * p.spd + p.ph) * p.amp;
        nx = clamp(nx, 4, W - 4 - p.w);
        p.dx = nx - p.x;
        p.x = nx;
      }
      if (p.breakT > 0) {
        p.breakT -= dt;
        if (p.breakT <= 0) { plats.splice(i, 1); i--; }
      }
    }
    if (vy > 0) {
      var prevY = py - vy * dt;
      for (var j = 0; j < plats.length; j++) {
        var pf = plats[j];
        if (pf.breakT > 0) continue;
        var top = pf.y;
        if (prevY + PR <= top + 2 && py + PR >= top && px > pf.x - 10 && px < pf.x + pf.w + 10) {
          py = top - PR;
          vy = pf.spring ? -1290 : -JUMP;
          if (pf.kind === 2) pf.breakT = 0.15;
          px += pf.dx;
          break;
        }
      }
    }
    var sc = Math.floor((camStart - cam) / 5);
    if (sc !== score) {
      score = sc;
      if (onScore) onScore(score);
      var nc = Math.floor(score / 2500);
      if (nc !== coins) { coins = nc; if (onCoins) onCoins(coins); }
    }
    var maxY = -Infinity;
    for (var k = 0; k < plats.length; k++) if (plats[k].y > maxY) maxY = plats[k].y;
    while (maxY < cam + H + 200) { maxY += rnd(84, 112); pushPlatform(maxY); }
    trail.push({ x: px, y: py - cam });
    if (trail.length > 12) trail.shift();
    if (py - cam > H + 90) {
      over = true;
      if (onGameOver) onGameOver(score, coins);
    }
  }

  function draw() {
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#04060e');
    grad.addColorStop(1, '#0b0f26');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    for (var i = 0; i < stars.length; i++) {
      var st = stars[i];
      var sy = ((st.y - cam * 0.25) % H + H) % H;
      ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(time * 1.5 + st.p));
      ctx.fillStyle = '#9fd8ff';
      ctx.fillRect(st.x, sy, st.s, st.s);
    }
    ctx.globalAlpha = 1;
    var cs = ['#2bff88', '#3bc9ff', '#ff8c3b'];
    for (var p = 0; p < plats.length; p++) {
      var pf = plats[p];
      var sy2 = pf.y - cam;
      if (sy2 < -30 || sy2 > H + 30) continue;
      var col = cs[pf.kind];
      ctx.save();
      if (pf.breakT > 0) ctx.globalAlpha = Math.max(0.2, pf.breakT / 0.15);
      ctx.shadowColor = col; ctx.shadowBlur = 12;
      ctx.fillStyle = col;
      ctx.fillRect(pf.x, sy2, pf.w, 9);
      ctx.fillStyle = 'rgba(4,6,14,0.9)';
      ctx.fillRect(pf.x + 3, sy2 + 2, pf.w - 6, 2);
      if (pf.spring) {
        ctx.fillStyle = '#2bff88';
        ctx.shadowColor = '#2bff88';
        ctx.beginPath();
        ctx.moveTo(pf.x + pf.w * 0.5 - 6, sy2 - 2);
        ctx.lineTo(pf.x + pf.w * 0.5 + 6, sy2 - 2);
        ctx.lineTo(pf.x + pf.w * 0.5, sy2 - 13);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    for (var t = 0; t < trail.length; t++) {
      var tr = trail[t];
      ctx.save();
      ctx.globalAlpha = (t + 1) / (trail.length + 2);
      ctx.fillStyle = '#ff3b6b';
      ctx.shadowColor = '#ff3b6b'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(tr.x, tr.y, PR * (0.4 + 0.6 * (t / trail.length)), 0, 6.283); ctx.fill();
      ctx.restore();
    }
    var sy3 = py - cam;
    ctx.save();
    ctx.shadowColor = '#ff3b6b'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#ff3b6b';
    ctx.beginPath(); ctx.arc(px, sy3, PR, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#ffd23b';
    ctx.shadowColor = '#ffd23b'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(px - 2, sy3 - 3, 4.5, 0, 6.283); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = '#3bc9ff'; ctx.shadowColor = '#3bc9ff'; ctx.shadowBlur = 10;
    ctx.font = 'bold 17px monospace'; ctx.textAlign = 'left';
    ctx.fillText('NEON JUMPER', 12, 24);
    ctx.shadowBlur = 0; ctx.fillStyle = '#7f92b8'; ctx.font = '11px monospace';
    ctx.fillText('HOLD ◀ ▶ TO MOVE · BOUNCE UP · DON\'T FALL', 12, 42);
    ctx.fillStyle = '#2bff88'; ctx.shadowColor = '#2bff88'; ctx.shadowBlur = 8;
    ctx.font = 'bold 14px monospace'; ctx.textAlign = 'right';
    ctx.fillText('HEIGHT ' + score, W - 14, 24);
    ctx.restore();
  }

  function loop(ts) {
    var dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    update(dt);
    draw();
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

  function resume() {
    if (!over && !running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }

  function destroy() { running = false; over = true; cancelAnimationFrame(raf); }

  return {
    start: start,
    pause: pause,
    resume: resume,
    destroy: destroy,
    setInput: function (t, k) { touches = t || {}; keys = k || {}; }
  };
}