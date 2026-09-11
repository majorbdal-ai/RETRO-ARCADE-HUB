function tableTennis(canvas, ctx, onScore, onGameOver, onCoins) {
  'use strict';
  var W = 800, H = 450;
  var raf = null, last = 0, running = false, over = false;
  var keys = {}, touches = {};
  var score = 0, coins = 0;
  var pScore = 0, bScore = 0, rally = 0, server = 0;
  var pY = H / 2, bY = H / 2, pV = 0;
  var padH = 78;
  var ball = { x: 0, y: 0, vx: 0, vy: 0, speed: 0 };
  var state = 'serve', serveT = 0.8;
  var trail = [], swing = 0, swingRaw = false, prevSwingRaw = false, speedLines = 0;
  var PX = W - 30, BX = 30;
  var time = 0;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function down(name, k) {
    return !!((touches && touches[name]) || (keys && k.some(function (x) { return !!keys[x]; })));
  }
  function botH() { return Math.max(34, padH - Math.floor(rally / 3) * 8); }

  function serve() {
    var fromP = server === 0;
    ball.x = fromP ? PX - 16 : BX + 16;
    ball.y = fromP ? pY : bY;
    var sp = 330 + rnd(0, 60);
    ball.vx = fromP ? -sp : sp;
    ball.vy = rnd(-90, 90);
    ball.speed = sp;
    state = 'play';
    rally = 0;
  }

  function point(who) {
    if (who === 'p') {
      pScore++;
      if (onScore) onScore(pScore);
      var nc = Math.floor(pScore / 2);
      if (nc > coins) { coins = nc; if (onCoins) onCoins(coins); }
      if (typeof window.playSfx === 'function') { try { window.playSfx('pop'); } catch (e) {} }
    } else {
      bScore++;
      if (typeof window.playSfx === 'function') { try { window.playSfx('error'); } catch (e) {} }
    }
    if (pScore >= 11) { over = true; if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} } if (navigator.vibrate) { try { navigator.vibrate(80); } catch (e) {} } if (onGameOver) onGameOver(pScore, coins); return; }
    if (bScore >= 11) { over = true; if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} } if (navigator.vibrate) { try { navigator.vibrate(200); } catch (e) {} } if (onGameOver) onGameOver(pScore, coins); return; }
    server = (server + 1) % 2;
    state = 'serve';
    serveT = 0.7;
  }

  function reset() {
    pScore = 0; bScore = 0; rally = 0; server = 0;
    pY = H / 2; bY = H / 2; pV = 0;
    ball = { x: 0, y: 0, vx: 0, vy: 0, speed: 0 };
    state = 'serve'; serveT = 0.8;
    trail = []; swing = 0; swingRaw = false; prevSwingRaw = false; speedLines = 0; time = 0;
  }

  function update(dt) {
    time += dt;
    pV = (down('down', ['ArrowDown', 'KeyS']) ? 1 : 0) - (down('up', ['ArrowUp', 'KeyW']) ? 1 : 0);
    pY += pV * 540 * dt;
    pY = clamp(pY, 16 + padH / 2, H - 16 - padH / 2);
    swingRaw = down('action', ['Space', 'KeyX']);
    if (swingRaw && !prevSwingRaw) swing = 0.16;
    prevSwingRaw = swingRaw;
    if (swing > 0) swing -= dt;
    var tHit = (ball.vx < 0 && ball.vx !== 0) ? (ball.x - BX - 12) / -ball.vx : -1;
    var tgtY = H / 2;
    if (tHit > 0 && tHit < 4) tgtY = ball.y + ball.vy * tHit * 0.8;
    var bs = 340 + Math.min(200, rally * 6);
    var bmove = clamp(tgtY - bY, -bs * dt, bs * dt);
    bY += bmove;
    bY = clamp(bY, 16 + botH() / 2, H - 16 - botH() / 2);
    if (state !== 'play' || over) {
      if (state === 'serve' && !over) {
        serveT -= dt;
        if (serveT <= 0) serve();
      }
      return;
    }
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    trail.push({ x: ball.x, y: ball.y });
    if (trail.length > 14) trail.shift();
    if (ball.y < 10) { ball.y = 10; ball.vy = Math.abs(ball.vy); }
    if (ball.y > H - 10) { ball.y = H - 10; ball.vy = -Math.abs(ball.vy); }
    ball.speed = Math.hypot(ball.vx, ball.vy);
    if (ball.vx < 0 && ball.x > BX - 18 && ball.x < BX + 6) {
      if (Math.abs(ball.y - bY) < botH() / 2 + 10) {
        var offB = clamp((ball.y - bY) / (botH() / 2), -1, 1);
        var miss = 0;
        if (ball.speed > 620) miss = Math.min(0.8, (ball.speed - 600) / 420);
        if (Math.random() < miss) {
          ball.vx = Math.abs(ball.vx) * 0.6;
          ball.vy = rnd(-260, 260);
          ball.speed = Math.hypot(ball.vx, ball.vy);
        } else {
          var spB = Math.min(780, 320 + (rally + 1) * 9);
          var angB = offB * 0.95;
          ball.vx = Math.cos(angB) * spB;
          ball.vy = Math.sin(angB) * spB;
          rally++;
        }
        ball.x = BX + 8;
      }
    }
    var swinging = swing > 0;
    if (ball.vx > 0 && ball.x > PX - 14 && ball.x < PX + 22) {
      if (Math.abs(ball.y - pY) < padH / 2 + 10) {
        var off = clamp((ball.y - pY) / (padH / 2), -1, 1);
        var sp = Math.min(760, 320 + (rally + 1) * 9);
        if (swinging) sp = Math.min(940, sp * 1.5);
        var ang = off * 0.95;
        ball.vx = -Math.cos(ang) * sp;
        ball.vy = Math.sin(ang) * sp;
        rally++;
        if (swinging) speedLines = 0.25;
        ball.x = PX - 8;
      }
    }
    if (ball.x > W + 60) point('b');
    else if (ball.x < -60) point('p');
    if (speedLines > 0) speedLines -= dt;
  }

  function draw() {
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#05070f');
    grad.addColorStop(1, '#0b1024');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.strokeStyle = 'rgba(59,201,255,0.12)';
    ctx.lineWidth = 1;
    for (var gx = 20; gx < W; gx += 40) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx - 40, H); ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = '#ffd23b';
    ctx.shadowColor = '#ffd23b'; ctx.shadowBlur = 12;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W / 2, 12); ctx.lineTo(W / 2, H - 12); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    for (var i = 0; i < trail.length; i++) {
      var tr = trail[i];
      ctx.save();
      ctx.globalAlpha = (i + 1) / (trail.length + 2);
      ctx.fillStyle = '#8be9ff';
      ctx.beginPath(); ctx.arc(tr.x, tr.y, 4, 0, 6.283); ctx.fill();
      ctx.restore();
    }
    var bh = botH();
    ctx.save();
    ctx.shadowColor = '#ff3b6b'; ctx.shadowBlur = 14;
    ctx.fillStyle = '#ff3b6b';
    ctx.fillRect(BX - 6, bY - bh / 2, 8, bh);
    ctx.fillStyle = 'rgba(255,59,107,0.25)';
    ctx.fillRect(BX - 16, bY - bh / 2 - 4, 16, bh + 8);
    ctx.restore();
    ctx.save();
    ctx.shadowColor = '#2bff88'; ctx.shadowBlur = 14;
    ctx.fillStyle = '#2bff88';
    ctx.fillRect(PX - 2, pY - padH / 2, 8, padH);
    ctx.fillStyle = 'rgba(43,255,136,0.25)';
    ctx.fillRect(PX - 8, pY - padH / 2 - 4, 16, padH + 8);
    if (swing > 0 || speedLines > 0) {
      ctx.strokeStyle = '#eafff2';
      ctx.lineWidth = 2;
      for (var s2 = 0; s2 < 3; s2++) {
        var yy = pY - 30 + s2 * 26;
        ctx.beginPath();
        ctx.arc(PX + 14, yy, 10 + (s2 % 2) * 4, -1.2, 1.2);
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.save();
    ctx.shadowColor = '#ffd23b'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffd23b';
    ctx.beginPath(); ctx.arc(ball.x, ball.y, 7, 0, 6.283); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#2bff88';
    ctx.shadowColor = '#2bff88'; ctx.shadowBlur = 10;
    ctx.font = 'bold 26px monospace';
    ctx.fillText(pScore + '  ·  ' + bScore, W / 2, 120);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#7f92b8';
    ctx.font = '13px monospace';
    ctx.fillText('FIRST TO 11', W / 2, 142);
    if (rally > 1) {
      ctx.fillStyle = '#ffd23b';
      ctx.fillText('RALLY ×' + rally, W / 2, 166);
    }
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#3bc9ff';
    ctx.shadowColor = '#3bc9ff'; ctx.shadowBlur = 10;
    ctx.font = 'bold 17px monospace';
    ctx.fillText('NEON PING PONG', 12, 24);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#7f92b8';
    ctx.font = '11px monospace';
    ctx.fillText('HOLD ▲▼ TO MOVE PADDLE · TAP / SPACE AT THE BALL = SMASH', 12, 42);
    ctx.restore();
    if (state === 'serve' && !over) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd23b';
      ctx.shadowColor = '#ffd23b'; ctx.shadowBlur = 12;
      ctx.font = 'bold 34px monospace';
      ctx.fillText(Math.ceil(serveT), W / 2, H - 60);
      ctx.restore();
    }
    if (over) {
      ctx.save();
      ctx.fillStyle = 'rgba(3,5,12,0.82)';
      ctx.fillRect(0, H / 2 - 56, W, 112);
      ctx.textAlign = 'center';
      ctx.fillStyle = pScore >= 11 ? '#2bff88' : '#ff3b6b';
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 14;
      ctx.font = 'bold 30px monospace';
      ctx.fillText(pScore >= 11 ? 'YOU WIN!' : 'BOT WINS', W / 2, H / 2 + 6);
      ctx.fillStyle = '#e8f4ff';
      ctx.shadowBlur = 0;
      ctx.font = '13px monospace';
      ctx.fillText('FINAL ' + pScore + ' – ' + bScore, W / 2, H / 2 + 30);
      ctx.restore();
    }
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