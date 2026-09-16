/**
 * Fruit Fury v5 — সম্পূর্ণ রিডিজাইন (first-from-scratch, user request)
 * Chinese-market Fruit Ninja vibe: dragonfruit, lychee, starfruit, mango...
 * Contract: window.gameFruitFury(canvas, ctx, W, H, input, state)
 *   state = { onScore(s), onGameOver(s), onCoins(n) }
 *   return { start, pause, resume, destroy, setInput, setDifficulty,
 *            pointerDown, pointerMove, pointerUp, getScore, end, resize }
 * Hub contract (native-canvas-engine-contract.md):
 *   - W/H MUST be overridden to LOGICAL 800×450 (ctx carries the DPR transform)
 *   - pointerDown/Move/Up receive LOGICAL coords from core.js bindGameTouch
 *   - onGameOver reports the score; the hub plays terminal SFX + overlay
 */
;(function () {
  function gameFruitFury(canvas, ctx, W, H, input, state) {
    'use strict';
    W = 800; H = 450;   // DPR override — draw logical, hub ctx pre-scaled

    // === CONFIG ===
    var GRAVITY = 1080;              // floaty arc (ref 3g: apex = vy²/2g)
    var THROW_IV = 1050;             // ms between throws (ramps down w/ difficulty)
    var MIN_IV = 360;
    var BOMB_PCT = 0.14;
    var MAX_MISS = 3;                // Fruit Ninja rule: 3 misses = game over
    var COMBO_WINDOW = 1100;         // ms to keep a combo alive
    var MAX_PARTICLES = 120;

    var FRUITS = [
      { name: 'Dragonfruit', color: '#FF3D8A', lo: '#F9E8F2', leaf: '#7CFC9A', r: 26, pts: 2 },
      { name: 'Watermelon',  color: '#3ED66F', lo: '#FF5E6B', leaf: '#1F9E4F', r: 30, pts: 2 },
      { name: 'Lychee',      color: '#E8425E', lo: '#FFF4F0', leaf: '#9ACD5A', r: 22, pts: 1 },
      { name: 'Mango',       color: '#FFB020', lo: '#FFE98A', leaf: '#5BBE5B', r: 27, pts: 2 },
      { name: 'Starfruit',   color: '#FFE14D', lo: '#FFF9C9', leaf: '#8BC34A', r: 24, pts: 2 },
      { name: 'Kiwi',        color: '#8A6A4B', lo: '#A8E063', leaf: '#6E9E3A', r: 24, pts: 1 },
      { name: 'Orange',      color: '#FF8A3D', lo: '#FFE0B2', leaf: '#66BB6A', r: 26, pts: 1 },
    ];

    // === STATE ===
    var raf = null, alive = false, isOver = false;
    var lastTs = 0, score = 0, combo = 0, comboTimer = 0, bestCombo = 0;
    var diff = 0, missCount = 0, overTime = 0, spawnAcc = 0;
    var fruits = [], halves = [], particles = [], popups = [], trails = [], bombRings = [];
    var speedLines = [], speedAcc = 0;
    var hintAlpha = 1, hintUsed = false;
    var comboGlow = 0, screenShake = 0, shakeX = 0, shakeY = 0;
    var milestoneTimer = 0, milestoneText = '', milestoneColor = '#FFE600';

    function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

    // === SPAWN ===
    function spawn(early) {
      var bomb = Math.random() < BOMB_PCT;
      var fd = bomb ? null : FRUITS[(Math.random() * FRUITS.length) | 0];
      var r = (fd ? fd.r : 26) + Math.random() * 4;
      var x, y, vx, vy;
      var side = Math.random() < 0.5;
      if (early) {
        // visible batch at frame 1 — never an empty black start
        x = W * (0.15 + Math.random() * 0.7);
        y = H * (0.35 + Math.random() * 0.4);
        vx = (Math.random() - 0.5) * 240;
        vy = -(120 + Math.random() * 160);
      } else {
        // Fruit Ninja style: launch from below the bottom edge, arc up
        x = side ? -20 - Math.random() * 40 : W + 20 + Math.random() * 40;
        y = H + 24 + Math.random() * 30;
        vx = side ? (320 + Math.random() * 240 + diff * 20) : -(320 + Math.random() * 240 + diff * 20);
        vy = -(640 + Math.random() * 330 + diff * 22);   // apex 190–440px above launch (ref 3g)
      }
      var rp = 0.9 + Math.random() * 0.25;   // random size variance
      fruits.push({
        x: x, y: y, vx: vx, vy: vy, rot: (Math.random() - 0.5) * 0.9,
        r: r * rp, fd: fd, bomb: bomb, alive: true, age: 0, spin: (Math.random() - 0.5) * 6
      });
    }

    // === FX HELPERS ===
    function emitJuice(x, y, color, n) {
      n = Math.min(MAX_PARTICLES, n | 0);
      for (var i = 0; i < n; i++) {
        var a = Math.random() * 6.283;
        var sp = 90 + Math.random() * 280;
        particles.push({
          x: x, y: y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 90,
          life: 400 + Math.random() * 400, maxLife: 800,
          color: color, r: 2 + Math.random() * 3.5
        });
      }
    }

    function emitPopup(x, y, text, color) {
      popups.push({ x: x, y: y, text: text, color: color, life: 750, maxLife: 750 });
    }

    function spawnHalves(f) {
      var c = f.fd ? f.fd.color : '#888';
      var lo = f.fd ? f.fd.lo : '#444';
      for (var s = -1; s <= 1; s += 2) {
        halves.push({
          x: f.x, y: f.y, r: f.r, side: s, rot: f.rot,
          color: c, lo: lo,
          vx: f.vx * 0.35 + s * 70, vy: f.vy * 0.35 - 80,
          life: 620, maxLife: 620
        });
      }
    }

    function emitBombRing(x, y) {
      bombRings.push({ x: x, y: y, r: 10, maxR: 220, life: 520, maxLife: 520 });
    }

    function addTrail(pts) {
      var copy = pts.slice(-12);
      if (copy.length > 1) trails.push({ pts: copy, life: 320, maxLife: 320 });
      while (trails.length > 8) trails.shift();
    }

    // === UPDATE ===
    function update(dt) {
      if (isOver) { overTime += dt; return; }
      // difficulty: throw interval + bomb chance ramp
      var iv = Math.max(MIN_IV, THROW_IV - diff * 110);
      spawnAcc += dt * 1000;
      if (spawnAcc >= iv) { spawnAcc = 0; spawn(false); }

      // ambient speed lines (motion feel)
      speedAcc += dt;
      if (speedAcc > 0.12) {
        speedAcc = 0;
        if (speedLines.length < 10) {
          speedLines.push({ x: Math.random() * W, y: Math.random() * H, len: 30 + Math.random() * 60, lf: 0.5 + Math.random() * 0.5, life: 1 });
        }
      }
      for (var si = speedLines.length - 1; si >= 0; si--) {
        var sl = speedLines[si];
        sl.x -= (300 + diff * 40) * dt * sl.lf;
        sl.life -= dt * 1.4;
        if (sl.life <= 0 || sl.x + sl.len < 0) speedLines.splice(si, 1);
      }

      // fruits
      for (var i = fruits.length - 1; i >= 0; i--) {
        var f = fruits[i];
        f.age += dt;
        f.vy += GRAVITY * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.rot += f.spin * dt;
        if (f.y > H + 30 && f.alive && !f.bomb) {
          // fell off without being sliced — MISS
          missCount++;
          emitPopup(f.x, Math.min(H - 30, f.y), 'MISS!', '#FF5A5A');
          f.alive = false;
          if (missCount >= MAX_MISS) triggerGameOver();
        }
        if (f.alive && (f.y > H + 60 || f.x < -80 || f.x > W + 80)) fruits.splice(i, 1);
      }

      // combo decay
      if (combo > 0) {
        comboTimer -= dt * 1000;
        if (comboTimer <= 0) combo = 0;
      }
      if (comboGlow > 0) comboGlow = Math.max(0, comboGlow - dt * 1.6);
      if (screenShake > 0) {
        screenShake = Math.max(0, screenShake - dt * 2.2);
        shakeX = (Math.random() - 0.5) * screenShake * 7;
        shakeY = (Math.random() - 0.5) * screenShake * 7;
      } else { shakeX = 0; shakeY = 0; }

      updateFx(dt);
    }

    function updateFx(dt) {
      for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.life -= dt * 1000;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vy += 620 * dt;
        if (p.life <= 0) particles.splice(i, 1);
      }
      for (var j = halves.length - 1; j >= 0; j--) {
        var h = halves[j];
        h.life -= dt * 1000;
        h.x += h.vx * dt; h.y += h.vy * dt;
        h.vy += 700 * dt;
        h.rot += 4 * dt;
        if (h.life <= 0) halves.splice(j, 1);
      }
      for (var k = popups.length - 1; k >= 0; k--) {
        var pp = popups[k];
        pp.life -= dt * 1000;
        pp.y -= 34 * dt;
        if (pp.life <= 0) popups.splice(k, 1);
      }
      for (var m = trails.length - 1; m >= 0; m--) {
        trails[m].life -= dt * 1000;
        if (trails[m].life <= 0) trails.splice(m, 1);
      }
      for (var n = bombRings.length - 1; n >= 0; n--) {
        var br = bombRings[n];
        br.life -= dt * 1000;
        br.r = br.maxR * (1 - br.life / br.maxLife);
        if (br.life <= 0) bombRings.splice(n, 1);
      }
    }

    function triggerGameOver() {
      if (isOver) return;
      isOver = true; overTime = 0;
      screenShake = 2;
      try { state.onScore(score); } catch (e) {}
      try { state.onGameOver(score); } catch (e) {}
    }

    // === DRAW ===
    function draw() {
      try {
        ctx.clearRect(0, 0, W, H);
        ctx.save();
        if (screenShake > 0.2) ctx.translate(shakeX, shakeY);

        // bg — Dark Neon Fusion gradient + subtle grid
        var bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#0D0D1A');
        bg.addColorStop(0.55, '#121218');
        bg.addColorStop(1, '#1A0F2E');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(139,92,246,0.10)';
        ctx.lineWidth = 1;
        for (var gx = 0; gx <= W; gx += 50) {
          ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
        }
        for (var gy = 0; gy <= H; gy += 50) {
          ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
        }

        // speed lines
        ctx.strokeStyle = 'rgba(34,211,238,0.20)';
        ctx.lineWidth = 2;
        for (var sli = 0; sli < speedLines.length; sli++) {
          var sl = speedLines[sli];
          ctx.globalAlpha = sl.life * 0.5;
          ctx.beginPath(); ctx.moveTo(sl.x, sl.y); ctx.lineTo(sl.x + sl.len, sl.y); ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // combo screen glow
        if (comboGlow > 0.01) {
          var ga = comboGlow * 0.14;
          var cg = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.62);
          cg.addColorStop(0, 'rgba(236,72,153,' + ga + ')');
          cg.addColorStop(1, 'rgba(236,72,153,0)');
          ctx.fillStyle = cg;
          ctx.fillRect(0, 0, W, H);
        }

        // swipe trails (neon)
        for (var t = 0; t < trails.length; t++) {
          var tr = trails[t];
          var ta = tr.life / tr.maxLife;
          ctx.strokeStyle = 'rgba(34,211,238,' + (ta * 0.75) + ')';
          ctx.lineWidth = 2 + 3 * ta;
          ctx.shadowColor = '#22D3EE';
          ctx.shadowBlur = 12 * ta;
          ctx.beginPath();
          ctx.moveTo(tr.pts[0].x, tr.pts[0].y);
          for (var p2 = 1; p2 < tr.pts.length; p2++) ctx.lineTo(tr.pts[p2].x, tr.pts[p2].y);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;

        // bomb rings
        for (var ri = 0; ri < bombRings.length; ri++) {
          var br = bombRings[ri];
          var bra = Math.max(0, br.life / br.maxLife);
          ctx.globalAlpha = bra * 0.7;
          ctx.strokeStyle = '#FF4444';
          ctx.lineWidth = 3 + 4 * (1 - bra);
          ctx.shadowColor = '#FF4444';
          ctx.shadowBlur = 18 * bra;
          ctx.beginPath(); ctx.arc(br.x, br.y, br.r, 0, 6.283); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,' + (bra * 0.5) + ')';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(br.x, br.y, br.r * 0.62, 0, 6.283); ctx.stroke();
          ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1;

        // juice particles
        for (var pi = 0; pi < particles.length; pi++) {
          var pp = particles[pi];
          var pa = Math.max(0, pp.life / pp.maxLife);
          ctx.globalAlpha = pa;
          ctx.fillStyle = pp.color;
          ctx.beginPath(); ctx.arc(pp.x, pp.y, pp.r * pa, 0, 6.283); ctx.fill();
        }
        ctx.globalAlpha = 1;

        // sliced halves
        for (var hi = 0; hi < halves.length; hi++) {
          var hh = halves[hi];
          var ha = Math.min(1, hh.life / 400);
          ctx.save();
          ctx.translate(hh.x, hh.y);
          ctx.rotate(hh.rot);
          ctx.globalAlpha = ha;
          ctx.fillStyle = hh.color;
          ctx.beginPath();
          ctx.arc(0, 0, hh.r, hh.side < 0 ? Math.PI : 0, hh.side < 0 ? 6.283 : Math.PI);
          ctx.fill();
          ctx.fillStyle = hh.lo;
          ctx.beginPath();
          ctx.arc(0, 0, hh.r * 0.72, hh.side < 0 ? Math.PI : 0, hh.side < 0 ? 6.283 : Math.PI);
          ctx.fill();
          ctx.fillStyle = 'rgba(60,30,10,0.7)';
          for (var sd = 0; sd < 3; sd++) {
            var sx = (sd - 1) * hh.r * 0.3;
            ctx.beginPath(); ctx.arc(sx, hh.side * hh.r * 0.18, 1.6, 0, 6.283); ctx.fill();
          }
          ctx.restore();
        }
        ctx.globalAlpha = 1;

        // fruits
        for (var fi = 0; fi < fruits.length; fi++) {
          var f = fruits[fi];
          if (!f.alive) continue;
          // ground shadow
          var shY = H - 8;
          var shScale = Math.max(0.18, Math.min(1, 1 - (shY - f.y) / 700));
          ctx.save();
          ctx.globalAlpha = 0.28 * shScale;
          ctx.fillStyle = '#000';
          ctx.beginPath();
          ctx.ellipse(f.x, shY, f.r * 0.9 * shScale, f.r * 0.28 * shScale, 0, 0, 6.283);
          ctx.fill();
          ctx.restore();
          // body
          ctx.save();
          ctx.translate(f.x, f.y);
          ctx.rotate(f.rot);
          if (f.bomb) drawBomb(f); else drawFruit(f);
          ctx.restore();
        }

        // popups
        for (var ui = 0; ui < popups.length; ui++) {
          var pu = popups[ui];
          var ua = Math.min(1, pu.life / 300);
          ctx.globalAlpha = ua;
          ctx.fillStyle = pu.color;
          ctx.font = 'bold ' + (15 + 9 * ua) + 'px "Orbitron","Poppins",Arial,sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = pu.color;
          ctx.shadowBlur = 10;
          ctx.fillText(pu.text, pu.x, pu.y);
          ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1;

        drawHUD();
        drawHint();

        // game over flash (light — the hub shows the real overlay)
        if (isOver && overTime < 1.2) {
          var oa = Math.max(0, 0.55 - overTime * 0.5);
          ctx.fillStyle = 'rgba(255,30,70,' + oa + ')';
          ctx.fillRect(0, 0, W, H);
          ctx.globalAlpha = Math.max(0, 1 - overTime * 1.4);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 42px "Orbitron",Arial,sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = '#FF0000';
          ctx.shadowBlur = 20;
          ctx.fillText('GAME OVER', W / 2, H / 2 - 18);
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }

        ctx.restore();
      } catch (e) {
        if (!draw._logged) { draw._logged = true; try { console.error('FF draw:', e); } catch (_) {} }
      }
    }

    function drawFruit(f) {
      var c = f.fd;
      // 3D-ish sphere: base + radial highlight + rim
      var g = ctx.createRadialGradient(-f.r * 0.35, -f.r * 0.4, 2, 0, 0, f.r * 1.05);
      g.addColorStop(0, '#ffffffcc');
      g.addColorStop(0.35, c.color);
      g.addColorStop(1, shade(c.color, -34));
      ctx.fillStyle = c.color;
      ctx.beginPath(); ctx.arc(0, 0, f.r, 0, 6.283); ctx.fill();
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, f.r, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(0, 0, f.r, 0, 6.283); ctx.stroke();
      // per-kind detail
      if (c.name === 'Starfruit') drawStarAt(f.r, c.color);
      else if (c.name === 'Kiwi') drawKiwi(c, f.r);
      else if (c.name === 'Watermelon') drawWatermelonDetail(f.r);
      else if (c.name === 'Dragonfruit') drawDragonDots(f.r);
      else if (c.name === 'Orange' || c.name === 'Lychee') drawDimples(f.r);
      // leaf + stem
      ctx.fillStyle = c.leaf;
      ctx.beginPath();
      ctx.ellipse(f.r * 0.28, -f.r * 0.92, 5.5, 8.5, 0.42, 0, 6.283);
      ctx.fill();
      ctx.strokeStyle = '#7A5230';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -f.r); ctx.lineTo(1, -f.r - 7); ctx.stroke();
    }

    function shade(hex, amt) {
      var n = parseInt(hex.slice(1), 16);
      var r = Math.max(0, Math.min(255, (n >> 16) + amt));
      var g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
      var b = Math.max(0, Math.min(255, (n & 0xff) + amt));
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    // (starfruit drawn via 5-point star using f.r)
    function drawStarAt(r) {
      ctx.fillStyle = '#FFE14D';
      ctx.beginPath();
      for (var i = 0; i < 10; i++) {
        var rad = i % 2 === 0 ? r : r * 0.45;
        var a = -Math.PI / 2 + i * Math.PI / 5;
        var px = Math.cos(a) * rad, py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }

    function drawKiwi(c, r) {
      ctx.fillStyle = '#A8E063';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.2;
      for (var i = 0; i < 10; i++) {
        var a = i * 0.6283;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(30,30,30,0.55)';
      for (var s = 0; s < 6; s++) {
        var sa = s * 1.047 + 0.5;
        ctx.beginPath(); ctx.arc(Math.cos(sa) * r * 0.42, Math.sin(sa) * r * 0.42, 1.7, 0, 6.283); ctx.fill();
      }
    }

    function drawWatermelonDetail(r) {
      // darker rind stripes
      ctx.strokeStyle = 'rgba(0,80,40,0.35)';
      ctx.lineWidth = r * 0.16;
      for (var i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * r * 0.45, -r);
        ctx.quadraticCurveTo(i * r * 0.45 + r * 0.18, 0, i * r * 0.45, r);
        ctx.stroke();
      }
    }

    function drawDragonDots(r) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (var i = 0; i < 7; i++) {
        var a = i * 0.9 + 0.3;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, 2.4, 0, 6.283);
        ctx.fill();
      }
    }

    function drawDimples(r) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      for (var i = 0; i < 8; i++) {
        var a = i * 0.785 + 0.2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, 1.3, 0, 6.283);
        ctx.fill();
      }
    }

    function drawBomb(f) {
      ctx.shadowColor = '#FF3333';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#14141F';
      ctx.beginPath(); ctx.arc(0, 0, f.r, 0, 6.283); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,60,60,0.6)';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(0, 0, f.r, 0, 6.283); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.arc(-f.r * 0.22, -f.r * 0.22, f.r * 0.5, 0, 6.283); ctx.fill();
      var spark = (Date.now() % 380 < 190);
      ctx.fillStyle = spark ? '#FF4545' : '#FFAA33';
      ctx.beginPath(); ctx.arc(f.r * 0.16, -f.r * 0.95 - 8, spark ? 4 : 3, 0, 6.283); ctx.fill();
      ctx.strokeStyle = '#AAAAAA';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, -f.r);
      ctx.quadraticCurveTo(f.r * 0.24, -f.r - 8, f.r * 0.14, -f.r - 15);
      ctx.stroke();
      ctx.strokeStyle = '#FF3333';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-f.r * 0.3, -f.r * 0.3); ctx.lineTo(f.r * 0.3, f.r * 0.3);
      ctx.moveTo(f.r * 0.3, -f.r * 0.3); ctx.lineTo(-f.r * 0.3, f.r * 0.3);
      ctx.stroke();
    }

    function drawHUD() {
      // SCORE (top-left, gradient-ish neon)
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px "Orbitron","Poppins",Arial,sans-serif';
      ctx.shadowColor = 'rgba(139,92,246,0.7)';
      ctx.shadowBlur = 8;
      ctx.fillText(score, 16, 12);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = 'bold 11px "Orbitron",Arial,sans-serif';
      ctx.fillText('SCORE', 16, 42);
      // combo
      if (combo > 1) {
        var cc = combo >= 8 ? '#FFE600' : (combo >= 5 ? '#EC4899' : '#22D3EE');
        ctx.fillStyle = cc;
        ctx.font = 'bold 17px "Orbitron",Arial,sans-serif';
        ctx.shadowColor = cc;
        ctx.shadowBlur = combo >= 5 ? 12 : 5;
        ctx.fillText('COMBO x' + combo, 16, 62);
        ctx.shadowBlur = 0;
      }
      // MISS pips (top-center-right — Fruit Ninja style)
      ctx.textAlign = 'right';
      for (var i = 0; i < MAX_MISS; i++) {
        var mx = W - 18 - (MAX_MISS - 1 - i) * 24;
        ctx.fillStyle = i < missCount ? '#FF4D5E' : 'rgba(255,255,255,0.18)';
        ctx.beginPath(); ctx.arc(mx, 26, 7, 0, 6.283); ctx.fill();
        ctx.strokeStyle = i < missCount ? '#FF8A93' : 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(mx, 26, 7, 0, 6.283); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = 'bold 10px "Orbitron",Arial,sans-serif';
      ctx.fillText('MISS', W - 18, 40);
      // LVL (top-right below)
      var lvl = Math.min(5, Math.max(0, Math.round(diff)));
      ctx.fillStyle = '#A855F7';
      ctx.font = 'bold 13px "Orbitron",Arial,sans-serif';
      ctx.fillText('LVL ' + lvl, W - 18, 78);
      var barW = 64, barH = 5;
      var iv = Math.max(MIN_IV, THROW_IV - diff * 110);
      var fillRatio = 1 - (iv - MIN_IV) / (THROW_IV - MIN_IV);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(W - 18 - barW, 96, barW, barH);
      ctx.fillStyle = '#A855F7';
      ctx.fillRect(W - 18 - barW, 96, barW * fillRatio, barH);
    }

    function drawHint() {
      if (hintAlpha > 0.01 && !isOver && !hintUsed) {
        ctx.globalAlpha = hintAlpha;
        ctx.fillStyle = '#22D3EE';
        ctx.font = 'bold 19px "Orbitron","Poppins",Arial,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#22D3EE';
        ctx.shadowBlur = 14;
        ctx.fillText('SWIPE ACROSS THE FRUIT', W / 2, H - 46);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(34,211,238,0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        ctx.moveTo(W / 2 - 64, H - 22);
        ctx.lineTo(W / 2 + 64, H - 22);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      } else if (hintAlpha > 0.01 && hintUsed && !isOver) {
        // gentle pulse "keep going"
        hintAlpha = Math.max(0, hintAlpha - 0.012);
      }
    }

    // === INPUT (hub pointer contract) ===
    var _ptr = null, _pts = [];
    function pDown(x, y) {
      if (isOver || !alive) return;
      _ptr = 1;
      _pts = [{ x: x, y: y }];
      if (!hintUsed) hintUsed = true;
    }
    function pMove(x, y) {
      if (_ptr === null || isOver || !alive) return;
      _pts.push({ x: x, y: y });
      if (_pts.length > 26) _pts.shift();
      if (_pts.length >= 2) checkSliceSegment(_pts[_pts.length - 2], _pts[_pts.length - 1]);
    }
    function pUp() { _ptr = null; _pts = []; }

    function checkSliceSegment(a, b) {
      var dx = b.x - a.x, dy = b.y - a.y;
      var len2 = dx * dx + dy * dy;
      if (len2 < 1) return;
      for (var i = 0; i < fruits.length; i++) {
        var f = fruits[i];
        if (!f.alive) continue;
        var t = Math.max(0, Math.min(1, ((f.x - a.x) * dx + (f.y - a.y) * dy) / len2));
        var px = a.x + t * dx, py = a.y + t * dy;
        var ex = f.x - px, ey = f.y - py;
        if (ex * ex + ey * ey < (f.r + 14) * (f.r + 14)) {
          doSlice(f, (a.x + b.x) / 2, (a.y + b.y) / 2);
          return;
        }
      }
    }

    function doSlice(f, mx, my) {
      f.alive = false;
      if (f.bomb) {
        // bomb = instant game over (Fruit Ninja rule)
        screenShake = 2.4;
        emitJuice(f.x, f.y, '#FF4444', 22);
        emitJuice(f.x, f.y, '#FFAA33', 12);
        emitBombRing(f.x, f.y);
        emitPopup(f.x, f.y - 34, 'BOOM!', '#FF4444');
        try { state.onCoins(0); } catch (e) {}
        try { if (window.playSfx) window.playSfx('hit'); } catch (e) {}
        triggerGameOver();
        return;
      }
      combo++;
      comboTimer = COMBO_WINDOW;
      if (combo > bestCombo) bestCombo = combo;
      var gain = (f.fd ? f.fd.pts : 1) + Math.floor(combo / 3);
      score += gain;
      try { state.onScore(score); } catch (e) {}
      emitJuice(f.x, f.y, f.fd.color, 9 + Math.min(12, combo));
      spawnHalves(f);
      var txt = '+' + gain;
      if (combo > 2) txt += ' x' + combo;
      emitPopup(f.x, f.y - 22, txt, combo > 4 ? '#FFE600' : '#fff');
      if (combo >= 5) comboGlow = 1;
      if (combo % 5 === 0) {
        emitJuice(f.x, f.y, '#FFE600', 8);
        emitPopup(f.x, f.y - 46, 'COMBO ' + combo + '!', '#FFE600');
        screenShake = 0.55;
      }
      addTrail(_pts);
      try { if (window.playSfx) window.playSfx('slice'); } catch (e) {}
      // milestone every 10 points
      if (score > 0 && score % 10 < gain) {
        milestoneTimer = 1100;
        milestoneText = score >= 50 ? '🔥 ' + score + ' POINTS!' : '★ ' + score + ' POINTS!';
        milestoneColor = score >= 50 ? '#FFE600' : '#22D3EE';
        screenShake = Math.max(screenShake, 0.7);
      }
    }

    function checkSlice(p) { checkSliceSegment({ x: p.x - 10, y: p.y - 10 }, p); }

    // === LOOP ===
    function loop(ts) {
      if (!alive) return;
      var nowTs = typeof ts === 'number' ? ts : now();
      var raw = (nowTs - lastTs) / 1000;
      var dt = (raw > 0 && raw < 0.15) ? raw : 0.016;   // negative/exploded dt → 60fps fallback
      lastTs = nowTs;
      try { update(dt); draw(); } catch (e) {
        if (!loop._logged) { loop._logged = true; try { console.error('FF loop:', e); } catch (_) {} }
      }
      raf = requestAnimationFrame(loop);
    }

    // === PUBLIC API ===
    return {
      start: function () {
        alive = true; isOver = false;
        score = 0; combo = 0; comboTimer = 0; bestCombo = 0;
        diff = 0; missCount = 0; overTime = 0; screenShake = 0;
        hintAlpha = 1; hintUsed = false;
        comboGlow = 0; milestoneTimer = 0;
        spawnAcc = 0; speedAcc = 0;
        fruits = []; halves = []; particles = []; popups = []; trails = []; bombRings = []; speedLines = [];
        for (var i = 0; i < 3; i++) spawn(true);
        try { state.onScore(0); } catch (e) {}
        lastTs = now();
        raf = requestAnimationFrame(loop);
      },
      destroy: function () {
        alive = false;
        if (raf) cancelAnimationFrame(raf);
        raf = null; _ptr = null; _pts = [];
        fruits = []; halves = []; particles = []; popups = []; trails = []; bombRings = []; speedLines = [];
      },
      pause: function () { alive = false; if (raf) cancelAnimationFrame(raf); raf = null; },
      resume: function () {
        if (!alive && !isOver) { alive = true; lastTs = now(); raf = requestAnimationFrame(loop); }
      },
      setInput: function () {},
      setDifficulty: function (l) { diff = l; },
      getScore: function () { return score; },
      end: function () { triggerGameOver(); },
      resize: function () {},
      pointerDown: pDown,
      pointerMove: pMove,
      pointerUp: pUp
    };
  }
  window.gameFruitFury = gameFruitFury;
})();