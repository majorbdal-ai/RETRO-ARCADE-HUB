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
  var combo = 0, maxCombo = 0; // consecutive platform landings
  var lastMilestone = 0; // distance milestone tracker
  var landParticles = []; // dust on landing
  var hintTimer = 3; // control hint
  var highestReached = 0; // peak tracker for milestone celebrations

  // Safe SFX/haptic wrappers
  function sfx(name) {
    if (typeof window.playSfx === 'function') { try { window.playSfx(name); } catch (e) {} }
  }
  function haptic(pattern) {
    if (typeof window.hapticVibe === 'function') { try { window.hapticVibe(pattern); } catch (e) {} }
  }
  function fx_burst(x, y, color, count) {
    if (window.gameFX && window.gameFX.burst) { try { window.gameFX.burst(x, y, color, count); } catch (e) {} }
  }
  function fx_shake(intensity) {
    if (window.gameFX && window.gameFX.shake) { try { window.gameFX.shake(intensity); } catch (e) {} }
  }

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
    if (d > 2600 && r < 0.28) kind = 2; // breakable
    else if (d > 1300 && r < 0.52) kind = 1; // moving
    var w = kind === 2 ? rnd(44, 60) : Math.max(42, 100 - Math.min(52, d / 130));
    var p = { x: 0, y: y, w: w, kind: kind, breakT: 0, vx: 0, amp: 0, ph: 0, spd: 0, spring: false, dx: 0, initX: 0, landed: false };
    p.initX = rnd(16, W - 16 - w);
    p.x = p.initX;
    if (kind === 1) {
      p.amp = rnd(12, 34); p.spd = rnd(1.4, 2.8); p.ph = rnd(0, 6.28);
    } else if (kind === 0 && Math.random() < 0.07 && d > 800) {
      p.spring = true;
    }
    plats.push(p);
  }

  function spawnLandDust(x, y, color) {
    for (var i = 0; i < 6; i++) {
      landParticles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y,
        vx: (Math.random() - 0.5) * 60,
        vy: -20 - Math.random() * 40,
        life: 0.3 + Math.random() * 0.3,
        color: color || '#2bff88'
      });
    }
  }

  function checkMilestone(height) {
    var milestone = Math.floor(height / 1000) * 1000;
    if (milestone > lastMilestone && milestone > 0) {
      lastMilestone = milestone;
      sfx('win2');
      haptic('win');
      fx_burst(W / 2, H / 3, '#FFD700', 15);
      fx_burst(W / 4, H / 2, '#ff3b6b', 10);
      fx_burst(3 * W / 4, H / 2, '#3bc9ff', 10);
    }
  }

  function reset() {
    cam = -240; camStart = cam;
    px = W / 2; py = H * 0.6 + cam; vx = 0; vy = 0;
    score = 0; coins = 0; time = 0;
    combo = 0; maxCombo = 0; lastMilestone = 0;
    plats = []; trail = []; stars = []; landParticles = [];
    hintTimer = 3; highestReached = 0;
    for (var i = 0; i < 70; i++) {
      stars.push({ x: rnd(0, W), y: rnd(0, H), s: rnd(0.5, 1.9), p: rnd(0, 6.28) });
    }
    plats.push({ x: px - 70, y: py + 34, w: 140, kind: 0, breakT: 0, vx: 0, amp: 0, ph: 0, spd: 0, spring: false, dx: 0, initX: px - 70, landed: false });
    var y = py + 34;
    while (y < cam + H + 130) { y += rnd(84, 112); pushPlatform(y); }
    var y2 = py + 34 - rnd(84, 112);
    while (y2 > cam - 300) { pushPlatform(y2); y2 -= rnd(84, 112); }
  }

  function update(dt) {
    time += dt;
    if (hintTimer > 0) hintTimer -= dt;
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

    // Platform updates
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

    // Collision
    if (vy > 0) {
      var prevY = py - vy * dt;
      for (var j = 0; j < plats.length; j++) {
        var pf = plats[j];
        if (pf.breakT > 0) continue;
        var top = pf.y;
        if (prevY + PR <= top + 2 && py + PR >= top && px > pf.x - 10 && px < pf.x + pf.w + 10) {
          py = top - PR;
          var wasSpring = pf.spring;
          vy = pf.spring ? -1290 : -JUMP;
          if (pf.kind === 2) { pf.breakT = 0.15; sfx('pop'); haptic('boom'); }
          if (wasSpring) { sfx('hit'); haptic('action'); fx_shake(0.4); }
          else { sfx('flap'); haptic('tap'); }

          // Landing effects
          var landColor = wasSpring ? '#ffd23b' : pf.kind === 2 ? '#ff8c3b' : '#2bff88';
          spawnLandDust(px, top, landColor);

          // Combo tracking
          if (!pf.landed) {
            pf.landed = true;
            combo++;
            if (combo > maxCombo) maxCombo = combo;
            if (combo >= 5 && combo % 5 === 0) {
              sfx('coin');
              haptic('win');
              fx_burst(W / 2, H / 3, '#FFD700', 12);
            }
          }

          px += pf.dx;
          break;
        }
      }
    }

    // Score from height
    var sc = Math.floor((camStart - cam) / 5);
    if (sc !== score) {
      score = sc;
      if (onScore) onScore(score);
      var nc = Math.floor(score / 2500);
      if (nc !== coins) { coins = nc; if (onCoins) onCoins(coins); }
    }

    // Track height for milestones
    var currentHeight = Math.floor((camStart - cam));
    if (currentHeight > highestReached) {
      highestReached = currentHeight;
      checkMilestone(currentHeight);
    }

    // Generate platforms upward
    var maxY = -Infinity;
    for (var k = 0; k < plats.length; k++) if (plats[k].y > maxY) maxY = plats[k].y;
    while (maxY < cam + H + 200) { maxY += rnd(84, 112); pushPlatform(maxY); }

    // Trail
    trail.push({ x: px, y: py - cam, spd: Math.abs(vy) });
    if (trail.length > 14) trail.shift();

    // Update land particles
    for (var lp = landParticles.length - 1; lp >= 0; lp--) {
      var lp2 = landParticles[lp];
      lp2.life -= dt;
      lp2.x += lp2.vx * dt;
      lp2.y += lp2.vy * dt;
      lp2.vy += 200 * dt;
      if (lp2.life <= 0) landParticles.splice(lp, 1);
    }

    // Fall death
    if (py - cam > H + 90) {
      over = true;
      haptic('over');
      if (onGameOver) onGameOver(score, coins);
    }
  }

  function draw() {
    // Background gradient — shifts hue with height
    var hueShift = Math.min(30, diff() / 200);
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'hsl(' + (230 + hueShift) + ', 60%, 4%)');
    grad.addColorStop(1, 'hsl(' + (235 + hueShift) + ', 50%, 10%)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (var i = 0; i < stars.length; i++) {
      var st = stars[i];
      var sy = ((st.y - cam * 0.25) % H + H) % H;
      ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(time * 1.5 + st.p));
      ctx.fillStyle = '#9fd8ff';
      ctx.fillRect(st.x, sy, st.s, st.s);
    }
    ctx.globalAlpha = 1;

    // Platforms
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
      // Inner detail
      ctx.fillStyle = 'rgba(4,6,14,0.9)';
      ctx.fillRect(pf.x + 3, sy2 + 2, pf.w - 6, 2);
      // Landing glow for recently landed platforms
      if (pf.landed) {
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = col;
        ctx.fillRect(pf.x - 2, sy2 - 3, pf.w + 4, 15);
        ctx.globalAlpha = pf.breakT > 0 ? Math.max(0.2, pf.breakT / 0.15) : 1;
      }
      // Spring indicator
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

    // Land particles
    for (var lp = 0; lp < landParticles.length; lp++) {
      var lpp = landParticles[lp];
      ctx.save();
      ctx.globalAlpha = Math.max(0, lpp.life / 0.6);
      ctx.fillStyle = lpp.color;
      ctx.shadowColor = lpp.color;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(lpp.x, lpp.y, 2, 0, 6.283);
      ctx.fill();
      ctx.restore();
    }

    // Trail — intensity based on speed
    for (var t = 0; t < trail.length; t++) {
      var tr = trail[t];
      var trailAlpha = (t + 1) / (trail.length + 2);
      var trailSize = PR * (0.3 + 0.7 * (t / trail.length));
      // Faster = more intense trail
      var speedIntensity = clamp(tr.spd / 800, 0.3, 1.0);
      ctx.save();
      ctx.globalAlpha = trailAlpha * speedIntensity;
      // Color shifts from blue (falling) to red (ascending fast)
      var trailHue = tr.spd > 400 ? 340 : (tr.spd > 200 ? 30 : 200);
      ctx.fillStyle = 'hsl(' + trailHue + ', 80%, 60%)';
      ctx.shadowColor = 'hsl(' + trailHue + ', 80%, 60%)';
      ctx.shadowBlur = 8 * speedIntensity;
      ctx.beginPath(); ctx.arc(tr.x, tr.y, trailSize, 0, 6.283); ctx.fill();
      ctx.restore();
    }

    // Player
    var sy3 = py - cam;
    ctx.save();
    // Dynamic glow based on speed
    var glowIntensity = clamp(Math.abs(vy) / 1000, 0.3, 1.0);
    ctx.shadowColor = '#ff3b6b';
    ctx.shadowBlur = 12 + glowIntensity * 10;
    ctx.fillStyle = '#ff3b6b';
    ctx.beginPath(); ctx.arc(px, sy3, PR, 0, 6.283); ctx.fill();
    // Inner highlight
    ctx.fillStyle = '#ff7b9b';
    ctx.beginPath(); ctx.arc(px - 2, sy3 - 2, PR * 0.5, 0, 6.283); ctx.fill();
    // Eye
    ctx.fillStyle = '#ffd23b';
    ctx.shadowColor = '#ffd23b'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(px - 2, sy3 - 3, 4.5, 0, 6.283); ctx.fill();
    // Speed lines when fast
    if (Math.abs(vy) > 600) {
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#ff3b6b';
      ctx.lineWidth = 1;
      for (var sl = 0; sl < 3; sl++) {
        var slx = px + (Math.random() - 0.5) * 20;
        var sly = sy3 + (vy > 0 ? -1 : 1) * (20 + sl * 8);
        ctx.beginPath();
        ctx.moveTo(slx, sly);
        ctx.lineTo(slx + (Math.random() - 0.5) * 4, sly + (vy > 0 ? 1 : -1) * 15);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // HUD
    ctx.save();
    ctx.fillStyle = '#3bc9ff'; ctx.shadowColor = '#3bc9ff'; ctx.shadowBlur = 10;
    ctx.font = 'bold 17px monospace'; ctx.textAlign = 'left';
    ctx.fillText('NEON JUMPER', 12, 24);
    ctx.shadowBlur = 0; ctx.fillStyle = '#7f92b8'; ctx.font = '11px monospace';
    ctx.fillText('HOLD \u25C0 \u25B6 TO MOVE \u00B7 BOUNCE UP \u00B7 DON\'T FALL', 12, 42);
    ctx.fillStyle = '#2bff88'; ctx.shadowColor = '#2bff88'; ctx.shadowBlur = 8;
    ctx.font = 'bold 14px monospace'; ctx.textAlign = 'right';
    ctx.fillText('HEIGHT ' + score, W - 14, 24);
    // Combo display
    if (combo >= 3) {
      ctx.shadowColor = combo >= 10 ? '#f0f' : '#ffd23b';
      ctx.fillStyle = ctx.shadowColor;
      ctx.shadowBlur = 10;
      ctx.font = 'bold 12px monospace';
      ctx.fillText('COMBO x' + combo, W - 14, 42);
    }
    ctx.restore();

    // Height milestone markers (every 1000)
    for (var ms = 1000; ms < highestReached; ms += 1000) {
      var msy = (camStart - ms) - cam;
      if (msy > -20 && msy < H + 20) {
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, msy);
        ctx.lineTo(W, msy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#FFD700';
        ctx.font = '9px monospace';
        ctx.fillText(ms + 'm', W - 30, msy - 3);
        ctx.restore();
      }
    }

    // Control hint
    if (hintTimer > 0) {
      ctx.save();
      var ha = Math.min(1, hintTimer / 0.5);
      ctx.globalAlpha = ha;
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#3bc9ff';
      ctx.shadowBlur = 12;
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('HOLD \u25C0 \u25B6 OR SWIPE TO MOVE', W / 2, H / 2 - 10);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#aaa';
      ctx.font = '12px monospace';
      ctx.fillText('Bounce on platforms \u00B7 Avoid falling off', W / 2, H / 2 + 12);
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
