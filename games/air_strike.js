function airStrike(canvas, ctx, onScore, onGameOver, onCoins) {
  'use strict';
  var W = 800, H = 450;
  var G = 430, GROUND = H - 58;
  var raf = null, last = 0, running = false, over = false;
  var keys = {}, touches = {};
  var score = 0, coins = 0, wave = 1, bombs = 12;
  var plane = null, targets = [], bombsA = [], booms = [], sparks = [];
  var diffMul = 1;   // v7.18 difficulty ramp
  var held = false, prevHeld = false, time = 0, reticleX = 0;
  var stars = [];
  var TANK = 0, JEEP = 1;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function down(name, k) {
    return !!((touches && touches[name]) || (keys && k.some(function (x) { return !!keys[x]; })));
  }

  function notify() {
    if (onScore) onScore(score);
    var nc = Math.floor(score / 500);
    if (nc !== coins) { coins = nc; if (onCoins) onCoins(coins); }
  }

  function spawnWave() {
    var count = Math.min(4 + (wave - 1) * 2, 11);
    targets = [];
    for (var i = 0; i < count; i++) {
      var isJeep = wave >= 2 && Math.random() < Math.min(0.12 + wave * 0.05, 0.55);
      var w = isJeep ? 62 : 54, h = isJeep ? 20 : 26;
      var x = 60 + (i + 0.5) * ((W - 120) / count) + rnd(-12, 12);
      x = clamp(x, 30, W - 30 - w);
      targets.push({
        kind: isJeep ? JEEP : TANK,
        x: x, y: GROUND - h, w: w, h: h,
        pts: isJeep ? 150 : 100,
        vx: isJeep ? (Math.random() < 0.5 ? -1 : 1) * (55 + wave * 9) : 0,
        seed: Math.random() * 6.28
      });
    }
  }

  function checkWave() {
    if (targets.length > 0) return;
    if (wave >= 5) {
      over = true;
      if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
      if (navigator.vibrate) { try { navigator.vibrate(150); } catch (e) {} }
      if (onGameOver) if (typeof gameFX !== 'undefined') { try { var __r = canvas.getBoundingClientRect(); gameFX.burst(__r.left + (W/2) * __r.width / canvas.width, __r.top + (H/2) * __r.height / canvas.height, '#ff4444', 16); } catch(e){} gameFX.shake(5); }
      onGameOver(score, coins);
      return;
    }
    wave++;
    bombs = Math.min(bombs + 10, 40);
    spawnWave();
    if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
    if (navigator.vibrate) { try { navigator.vibrate(80); } catch (e) {} }
  }

  function explode(x, y) {
    booms.push({ x: x, y: y, r: 6, max: rnd(34, 56), life: 0.5 });
    for (var i = 8; i--;) {
      sparks.push({
        x: x, y: y, vx: rnd(-220, 220), vy: rnd(-320, 40),
        life: rnd(0.25, 0.55), c: Math.random() < 0.5 ? '#ffd23b' : '#ff6b3b'
      });
    }
    var hit = false;
    for (var j = targets.length - 1; j >= 0; j--) {
      var t = targets[j];
      var cx = t.x + t.w / 2, cy = t.y + t.h / 2;
      if (Math.abs(cx - x) < 44 && Math.abs(cy - y) < 34) {
        score += t.pts; hit = true;
        for (var k = 10; k--;) {
          sparks.push({
            x: cx, y: cy, vx: rnd(-160, 160), vy: rnd(-260, 20),
            life: rnd(0.2, 0.5), c: t.kind === JEEP ? '#3bc9ff' : '#2bff88'
          });
        }
        targets.splice(j, 1);
      }
    }
    if (hit) {
      if (typeof window.playSfx === 'function') { try { window.playSfx('pop'); } catch (e) {} }
      if (navigator.vibrate) { try { navigator.vibrate(40); } catch (e) {} }
      notify();
      checkWave();
    }
  }

  function reset() {
    score = 0; coins = 0; wave = 1; bombs = 12;
    plane = { x: 100, y: 70, dir: 1, speed: 245 * diffMul, vx: 245 * diffMul };
    targets = []; bombsA = []; booms = []; sparks = [];
    held = false; prevHeld = false; time = 0; reticleX = 0;
    stars = [];
    for (var i = 0; i < 60; i++) {
      stars.push({ x: Math.random() * W, y: Math.random() * H, s: rnd(0.5, 1.8), p: rnd(0, 6.28) });
    }
    spawnWave();
  }

  function update(dt) {
    time += dt;
    var aim = down('action', ['Space', 'KeyJ']);
    prevHeld = held; held = aim;
    var spd = plane.speed * (held ? 0.15 : 1);
    plane.vx = plane.dir * spd;
    plane.x += plane.vx * dt;
    plane.y = 70 + Math.sin(time * 2.4) * 7;
    if (plane.x > W + 60) plane.dir = -1;
    if (plane.x < -60) plane.dir = 1;
    if (held) {
      var tt = Math.sqrt(2 * (GROUND - plane.y) / G);
      reticleX = plane.x + plane.vx * tt;
    }
    if (prevHeld && !held) {
      if (bombs > 0) {
        bombs--;
        bombsA.push({ x: plane.x, y: plane.y, vx: plane.vx, vy: 0 });
        sparks.push({ x: plane.x, y: plane.y + 18, vx: 0, vy: 60, life: 0.25, c: '#ffd23b' });
        if (typeof window.playSfx === 'function') { try { window.playSfx('shoot'); } catch (e) {} }
        if (navigator.vibrate) { try { navigator.vibrate(20); } catch (e) {} }
      } else {
        if (typeof window.playSfx === 'function') { try { window.playSfx('error'); } catch (e) {} }
        if (navigator.vibrate) { try { navigator.vibrate(60); } catch (e) {} }
      }
    }
    for (var i = bombsA.length - 1; i >= 0; i--) {
      var b = bombsA[i];
      b.vy += G * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      var done = false;
      if (b.y >= GROUND - 4) { explode(b.x, GROUND - 4); done = true; }
      if (!done) {
        for (var j = 0; j < targets.length; j++) {
          var t = targets[j];
          if (b.x > t.x - 6 && b.x < t.x + t.w + 6 && b.y > t.y - 8 && b.y < t.y + t.h + 10) {
            explode(b.x, b.y); done = true; break;
          }
        }
      }
      if (done) bombsA.splice(i, 1);
    }
    for (var m = 0; m < targets.length; m++) {
      var tp = targets[m];
      if (tp.kind === JEEP) {
        tp.x += tp.vx * dt;
        if (tp.x < 24 || tp.x > W - tp.w - 24) { tp.vx *= -1; tp.x = clamp(tp.x, 24, W - tp.w - 24); }
      }
    }
    for (var q = booms.length - 1; q >= 0; q--) {
      var bo = booms[q];
      bo.life -= dt;
      if (bo.life <= 0) booms.splice(q, 1);
      else bo.r += (bo.max - bo.r) * Math.min(1, 10 * dt);
    }
    for (var s = sparks.length - 1; s >= 0; s--) {
      var sp = sparks[s];
      sp.life -= dt;
      if (sp.life <= 0) { sparks.splice(s, 1); continue; }
      sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += 300 * dt;
    }
    if (!over && bombs <= 0 && targets.length > 0 && bombsA.length === 0) {
      over = true;
      if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
      if (navigator.vibrate) { try { navigator.vibrate(200); } catch (e) {} }
      if (onGameOver) onGameOver(score, coins);
    }
  }

  function draw() {
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#05070f');
    grad.addColorStop(1, '#0a0f22');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    for (var i = 0; i < stars.length; i++) {
      var st = stars[i];
      var a = 0.35 + 0.65 * Math.abs(Math.sin(time * 1.7 + st.p));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#9fd8ff';
      ctx.fillRect(st.x, st.y, st.s, st.s);
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.shadowColor = '#2bff88'; ctx.shadowBlur = 14;
    ctx.strokeStyle = '#2bff88'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, GROUND); ctx.lineTo(W, GROUND); ctx.stroke();
    ctx.strokeStyle = 'rgba(43,255,136,0.25)'; ctx.lineWidth = 1;
    for (var gx = ((time * 40) % 60); gx < W; gx += 60) {
      ctx.beginPath(); ctx.moveTo(gx, GROUND); ctx.lineTo(gx - 30, H); ctx.stroke();
    }
    ctx.restore();
    for (var t = 0; t < targets.length; t++) {
      var tg = targets[t];
      var col = tg.kind === JEEP ? '#3bc9ff' : '#ff3b6b';
      ctx.save();
      ctx.shadowColor = col; ctx.shadowBlur = 14;
      ctx.fillStyle = col;
      ctx.fillRect(tg.x, tg.y, tg.w, tg.h);
      ctx.fillStyle = '#0a0f22';
      ctx.fillRect(tg.x + 6, tg.y + 5, tg.w - 12, 5);
      ctx.restore();
    }
    for (var b = 0; b < bombsA.length; b++) {
      var bm = bombsA[b];
      ctx.save();
      ctx.shadowColor = '#ffd23b'; ctx.shadowBlur = 12;
      ctx.fillStyle = '#ffd23b';
      ctx.beginPath(); ctx.arc(bm.x, bm.y, 5, 0, 6.283); ctx.fill();
      ctx.restore();
    }
    for (var q = 0; q < booms.length; q++) {
      var bo = booms[q];
      var al = Math.max(0, bo.life / 0.5);
      ctx.save();
      ctx.globalAlpha = al;
      ctx.shadowColor = '#ff8c3b'; ctx.shadowBlur = 24;
      ctx.strokeStyle = '#ff8c3b'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(bo.x, bo.y, bo.r, 0, 6.283); ctx.stroke();
      ctx.fillStyle = 'rgba(255,140,59,' + (0.35 * al).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(bo.x, bo.y, bo.r * 0.55, 0, 6.283); ctx.fill();
      ctx.restore();
    }
    for (var s = 0; s < sparks.length; s++) {
      var sp = sparks[s];
      ctx.save();
      ctx.globalAlpha = Math.max(0, sp.life / 0.5);
      ctx.shadowColor = sp.c; ctx.shadowBlur = 8;
      ctx.fillStyle = sp.c;
      ctx.fillRect(sp.x - 2, sp.y - 2, 4, 4);
      ctx.restore();
    }
    if (held) {
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(255,210,59,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(plane.x, plane.y + 14); ctx.lineTo(reticleX, GROUND - 4); ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowColor = '#ffd23b'; ctx.shadowBlur = 16;
      ctx.strokeStyle = '#ffd23b'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(reticleX, GROUND - 4, 16, 0, 6.283); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(reticleX - 26, GROUND - 4); ctx.lineTo(reticleX + 26, GROUND - 4);
      ctx.moveTo(reticleX, GROUND - 30); ctx.lineTo(reticleX, GROUND + 22);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.shadowColor = '#3bc9ff'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#3bc9ff';
    ctx.beginPath();
    ctx.moveTo(plane.x + plane.dir * 26, plane.y);
    ctx.lineTo(plane.x - plane.dir * 14, plane.y - 10);
    ctx.lineTo(plane.x - plane.dir * 14, plane.y + 10);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd23b';
    ctx.beginPath(); ctx.arc(plane.x - plane.dir * 16, plane.y, 4, 0, 6.283); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = '#3bc9ff';
    ctx.shadowColor = '#3bc9ff'; ctx.shadowBlur = 10;
    ctx.font = 'bold 17px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('NEON AIR STRIKE', 12, 24);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#7f92b8';
    ctx.font = '11px monospace';
    ctx.fillText('HOLD ACTION / SPACE TO AIM · RELEASE TO BOMB', 12, 42);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd23b';
    ctx.shadowColor = '#ffd23b'; ctx.shadowBlur = 8;
    ctx.font = 'bold 14px monospace';
    ctx.fillText('WAVE ' + wave, W - 14, 22);
    ctx.fillStyle = '#ff3b6b';
    ctx.fillText('BOMBS ' + bombs, W - 14, 40);
    ctx.fillStyle = '#2bff88';
    ctx.fillText('SCORE ' + score, W - 14, 58);
    ctx.restore();
    if (over) {
      ctx.save();
      ctx.fillStyle = 'rgba(3,5,12,0.82)';
      ctx.fillRect(0, H / 2 - 56, W, 112);
      ctx.textAlign = 'center';
      var wCol = (wave >= 5 && targets.length === 0) ? '#2bff88' : '#ff3b6b';
      ctx.fillStyle = wCol;
      ctx.shadowColor = wCol; ctx.shadowBlur = 14;
      ctx.font = 'bold 30px monospace';
      ctx.fillText((wave >= 5 && targets.length === 0) ? 'MISSION COMPLETE!' : 'GAME OVER', W / 2, H / 2 + 6);
      ctx.fillStyle = '#e8f4ff';
      ctx.shadowBlur = 0;
      ctx.font = '13px monospace';
      ctx.fillText('WAVE ' + wave + '  ·  SCORE ' + score, W / 2, H / 2 + 30);
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
    setInput: function (t, k) { touches = t || {}; keys = k || {}; },
    setDifficulty: function(level) { diffMul = [1, 1.15, 1.3, 1.5, 1.75, 2][Math.min(5, level)] || 1; }
  };
}