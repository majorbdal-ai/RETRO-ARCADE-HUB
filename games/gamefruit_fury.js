/**
 * Fruit Fury v4 — polished: haptic feedback, bomb ring, combo glow, control hint, milestone celebration
 * Contract: window.gameFruitFury(canvas, ctx, W, H, input, state)
 */
;(function () {
  function gameFruitFury(canvas, ctx, W, H, input, state) {
    W = 800; H = 450;

    // === FRUIT DATA ===
    var FRUITS = [
      { id: 'apple',    color: '#FF4D6D', hi: '#FF8FA3', lo: '#CC2244', leaf: '#5CD85C' },
      { id: 'orange',   color: '#FF9F1C', hi: '#FFC966', lo: '#CC6600', leaf: '#5CD85C' },
      { id: 'grape',    color: '#B563FF', hi: '#D49CFF', lo: '#7733BB', leaf: '#5CD85C' },
      { id: 'lemon',    color: '#FFD93D', hi: '#FFE87A', lo: '#CCAA00', leaf: '#5CD85C' },
      { id: 'kiwi',     color: '#7BD88F', hi: '#A8E6B3', lo: '#449955', leaf: '#5CD85C' },
      { id: 'watermelon', color: '#3DD68C', hi: '#6DE8B8', lo: '#22AA55', leaf: '#5CD85C' }
    ];
    var THROW_IV = 1000, GRAVITY = 1050, BOMB_PCT = 0.15;
    // MISS RULE (Fruit Ninja style): 3 fruits that hit the ground = game over
    var MAX_MISS = 3, missCount = 0;

    // === STATE ===
    var raf = null, alive = false, isOver = false;
    var lastTs = 0, score = 0, combo = 0, comboTimer = 0, bestCombo = 0;
    var diff = 0, spawnAcc = 0, overTime = 0;
    var fruits = [], halves = [], particles = [], popups = [], trails = [];
    var screenShake = 0;

    // === NEW: UX FX state ===
    var hintAlpha = 1;      // swipe hint fades on first input
    var hintUsed = false;
    var bombRings = [];      // explosion ring effects
    var comboGlow = 0;       // screen glow intensity (peaks at combo >= 5)
    var milestoneTimer = 0;  // celebration timer for score milestones (every 10)
    var milestoneText = '';   // celebration text
    var milestoneColor = '#FFE600';

    function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

    // === SPAWN ===
    function spawn(early) {
      var bomb = Math.random() < BOMB_PCT;
      var fd = bomb ? null : FRUITS[(Math.random() * FRUITS.length) | 0];
      var r = 24 + Math.random() * 12;
      var x, y, vx, vy;
      if (early) {
        x = W * (0.12 + Math.random() * 0.76);
        y = H * (0.2 + Math.random() * 0.4);
        vx = (Math.random() - 0.5) * 220;
        vy = -(80 + Math.random() * 160);
      } else {
        x = r + Math.random() * (W - 2 * r);
        y = H + r + 10;
        vx = (Math.random() - 0.5) * 320;
        // STRONG upward velocity: fruit arcs high above the screen.
        vy = -(620 + Math.random() * 340 + diff * 20);
      }
      fruits.push({
        x: x, y: y, vx: vx, vy: vy, r: r,
        rot: Math.random() * 6.28, rv: (Math.random() - 0.5) * 8,
        fd: fd, bomb: bomb, alive: true, age: 0, shadow: 1
      });
    }

    // === PARTICLES ===
    function emitJuice(x, y, color, n) {
      for (var i = 0; i < n; i++) {
        var a = Math.random() * 6.28;
        var sp = 80 + Math.random() * 250;
        particles.push({
          x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
          life: 400 + Math.random() * 300, maxLife: 700,
          color: color, r: 2 + Math.random() * 4
        });
      }
    }
    function emitPopup(x, y, text, color) {
      popups.push({ x: x, y: y, text: text, color: color || '#fff', life: 800, maxLife: 800, vy: -80 });
    }
    function spawnHalves(f) {
      var c = f.fd ? f.fd.color : '#888';
      var lo = f.fd ? f.fd.lo : '#444';
      halves.push({ x: f.x - 4, y: f.y, vx: -80 - Math.random() * 60, vy: -200 - Math.random() * 100, r: f.r, rot: f.rot, rv: -3 - Math.random() * 3, color: c, lo: lo, life: 900, side: -1 });
      halves.push({ x: f.x + 4, y: f.y, vx: 80 + Math.random() * 60, vy: -200 - Math.random() * 100, r: f.r, rot: f.rot, rv: 3 + Math.random() * 3, color: c, lo: lo, life: 900, side: 1 });
    }

    // === BOMB EXPLOSION RING ===
    function emitBombRing(x, y) {
      bombRings.push({ x: x, y: y, r: 0, maxR: 180, life: 500, maxLife: 500 });
    }

    // === HAPTIC FEEDBACK ===
    function hapticSlice() {
      if (!navigator.vibrate) return;
      try { navigator.vibrate(15); } catch (_) {}
    }
    function hapticBomb() {
      if (!navigator.vibrate) return;
      try { navigator.vibrate([40, 20, 60, 20, 100]); } catch (_) {}
    }

    // === UPDATE ===
    function update(dt) {
      if (screenShake > 0) screenShake = Math.max(0, screenShake - dt * 15);
      if (isOver) {
        overTime += dt;
        // update leftover halves/particles even during game over
        updateFx(dt);
        updateBombRings(dt);
        if (overTime > 1.2) {
          try { state.onGameOver(score); } catch (_) {}
          try { state.onCoins(Math.max(1, Math.floor(score / 8))); } catch (_) {}
          isOver = false;
        }
        return;
      }

      // fade hint
      if (hintUsed && hintAlpha > 0) {
        hintAlpha = Math.max(0, hintAlpha - dt * 2.5);
      }

      // combo glow decay
      if (comboGlow > 0) comboGlow = Math.max(0, comboGlow - dt * 3);

      // milestone timer
      if (milestoneTimer > 0) milestoneTimer -= dt * 1000;

      // spawn
      spawnAcc += dt * 1000;
      var iv = Math.max(380, THROW_IV - diff * 100);
      while (spawnAcc >= iv) { spawnAcc -= iv; spawn(false); }
      // fruits
      for (var i = fruits.length - 1; i >= 0; i--) {
        var f = fruits[i];
        f.age += dt;
        f.vy += GRAVITY * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.rot += f.rv * dt;
        // fruit that falls past the ground = MISS (Fruit Ninja rule)
        if (f.y > H + 24 && f.alive && !f.bomb) {
          f.alive = false;
          missCount++;
          emitPopup(f.x, H - 40, 'MISS', '#FF6B6B');
          if (missCount >= MAX_MISS) {
            isOver = true; overTime = 0;
            screenShake = 0.6;
            try { if (window.playSfx) window.playSfx('over'); } catch (_) {}
          }
        }
        if (f.y > H + 80 || f.x < -80 || f.x > W + 80 || (!f.alive && f.age > 0.45)) {
          fruits.splice(i, 1);
        }
      }
      // combo decay
      comboTimer -= dt * 1000;
      if (comboTimer <= 0) combo = 0;
      updateFx(dt);
      updateBombRings(dt);
    }

    function updateFx(dt) {
      for (var j = particles.length - 1; j >= 0; j--) {
        var p = particles[j]; p.life -= dt * 1000;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vy += 400 * dt;
        if (p.life <= 0) particles.splice(j, 1);
      }
      for (var k = halves.length - 1; k >= 0; k--) {
        var h = halves[k]; h.life -= dt * 1000;
        h.vy += GRAVITY * dt; h.x += h.vx * dt; h.y += h.vy * dt;
        h.rot += h.rv * dt;
        if (h.life <= 0 || h.y > H + 100) halves.splice(k, 1);
      }
      for (var m = popups.length - 1; m >= 0; m--) {
        var pp = popups[m]; pp.life -= dt * 1000;
        pp.y += pp.vy * dt;
        if (pp.life <= 0) popups.splice(m, 1);
      }
      for (var n = trails.length - 1; n >= 0; n--) {
        trails[n].life -= dt * 1000;
        if (trails[n].life <= 0) trails.splice(n, 1);
      }
    }

    function updateBombRings(dt) {
      for (var i = bombRings.length - 1; i >= 0; i--) {
        var br = bombRings[i];
        br.life -= dt * 1000;
        var prog = 1 - br.life / br.maxLife;
        br.r = br.maxR * prog;
        if (br.life <= 0) bombRings.splice(i, 1);
      }
    }

    // === DRAW ===
    function draw() {
      try {
        ctx.save();
        // screen shake
        if (screenShake > 0) {
          ctx.translate((Math.random() - 0.5) * screenShake * 6, (Math.random() - 0.5) * screenShake * 6);
        }
        ctx.clearRect(-20, -20, W + 40, H + 40);

        // background — neon gradient
        var bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#0f0c29');
        bg.addColorStop(0.4, '#1a1040');
        bg.addColorStop(1, '#0d0d1a');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // subtle neon grid
        ctx.strokeStyle = 'rgba(139,92,246,0.05)';
        ctx.lineWidth = 1;
        for (var gx = 0; gx < W; gx += 50) {
          ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
        }
        for (var gy = 0; gy < H; gy += 50) {
          ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
        }

        // === COMBO SCREEN GLOW (at combo >= 5) ===
        if (comboGlow > 0.01) {
          var ga = comboGlow * 0.12;
          var cg = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.6);
          cg.addColorStop(0, 'rgba(139,92,246,' + ga + ')');
          cg.addColorStop(0.5, 'rgba(236,72,153,' + (ga * 0.5) + ')');
          cg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = cg;
          ctx.fillRect(0, 0, W, H);
        }

        // fruit shadows on ground
        for (var si = 0; si < fruits.length; si++) {
          var sf = fruits[si];
          if (!sf.alive) continue;
          var shY = H - 8;
          var shScale = Math.max(0.2, 1 - (shY - sf.y) / 600);
          ctx.fillStyle = 'rgba(0,0,0,' + (0.15 * shScale) + ')';
          ctx.beginPath(); ctx.ellipse(sf.x, shY, sf.r * 0.8 * shScale, 4 * shScale, 0, 0, 6.28); ctx.fill();
        }

        // swipe trails (glow)
        for (var t = 0; t < trails.length; t++) {
          var tr = trails[t];
          var ta = tr.life / tr.maxLife;
          ctx.shadowColor = '#00ffff';
          ctx.shadowBlur = 10 * ta;
          ctx.strokeStyle = 'rgba(0,255,255,' + (ta * 0.7) + ')';
          ctx.lineWidth = (2 + 3 * ta);
          ctx.beginPath();
          if (tr.pts.length > 1) {
            ctx.moveTo(tr.pts[0].x, tr.pts[0].y);
            for (var p = 1; p < tr.pts.length; p++) ctx.lineTo(tr.pts[p].x, tr.pts[p].y);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // juice particles
        for (var pi = 0; pi < particles.length; pi++) {
          var pp = particles[pi];
          var pa = pp.life / pp.maxLife;
          ctx.globalAlpha = pa;
          ctx.fillStyle = pp.color;
          ctx.beginPath(); ctx.arc(pp.x, pp.y, pp.r * pa, 0, 6.28); ctx.fill();
        }
        ctx.globalAlpha = 1;

        // sliced halves
        for (var hi = 0; hi < halves.length; hi++) {
          var hh = halves[hi];
          var ha = Math.min(1, hh.life / 300);
          ctx.save();
          ctx.translate(hh.x, hh.y);
          ctx.rotate(hh.rot);
          ctx.globalAlpha = ha;
          // half circle
          ctx.fillStyle = hh.color;
          ctx.beginPath(); ctx.arc(0, 0, hh.r, hh.side < 0 ? Math.PI : 0, hh.side < 0 ? 2 * Math.PI : Math.PI); ctx.fill();
          // inner flesh
          ctx.fillStyle = hh.lo;
          ctx.beginPath(); ctx.arc(0, 0, hh.r * 0.7, hh.side < 0 ? Math.PI : 0, hh.side < 0 ? 2 * Math.PI : Math.PI); ctx.fill();
          // seeds (2-3 dots)
          ctx.fillStyle = '#3a2010';
          for (var si2 = 0; si2 < 3; si2++) {
            var sx2 = (si2 - 1) * hh.r * 0.3;
            ctx.beginPath(); ctx.arc(sx2, hh.side * hh.r * 0.15, 1.5, 0, 6.28); ctx.fill();
          }
          ctx.restore();
        }
        ctx.globalAlpha = 1;

        // === BOMB EXPLOSION RINGS ===
        for (var ri = 0; ri < bombRings.length; ri++) {
          var br = bombRings[ri];
          var bra = Math.max(0, br.life / br.maxLife);
          ctx.globalAlpha = bra * 0.7;
          ctx.strokeStyle = '#FF4444';
          ctx.lineWidth = 3 + 4 * bra;
          ctx.shadowColor = '#FF4444';
          ctx.shadowBlur = 15 * bra;
          ctx.beginPath(); ctx.arc(br.x, br.y, br.r, 0, 6.28); ctx.stroke();
          // inner white ring
          ctx.strokeStyle = 'rgba(255,255,255,' + (bra * 0.4) + ')';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(br.x, br.y, br.r * 0.6, 0, 6.28); ctx.stroke();
          ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1;

        // fruits
        for (var fi = 0; fi < fruits.length; fi++) {
          var f = fruits[fi];
          if (!f.alive) continue;
          ctx.save();
          ctx.translate(f.x, f.y);
          ctx.rotate(f.rot);
          if (f.bomb) {
            drawBomb(f);
          } else {
            drawFruit(f);
          }
          ctx.restore();
        }

        // floating popups (score text)
        for (var ui = 0; ui < popups.length; ui++) {
          var pu = popups[ui];
          var ua = Math.min(1, pu.life / 300);
          ctx.globalAlpha = ua;
          ctx.fillStyle = pu.color;
          ctx.font = 'bold ' + (16 + 8 * ua) + 'px Arial,sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = pu.color;
          ctx.shadowBlur = 8;
          ctx.fillText(pu.text, pu.x, pu.y);
          ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1;

        // === HUD ===
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px Arial,sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(139,92,246,0.5)';
        ctx.shadowBlur = 6;
        ctx.fillText('SCORE ' + score, 14, 10);
        ctx.shadowBlur = 0;
        if (combo > 1) {
          var comboColor = combo >= 8 ? '#FFE600' : (combo >= 5 ? '#EC4899' : '#22D3EE');
          ctx.fillStyle = comboColor;
          ctx.font = 'bold 18px Arial,sans-serif';
          ctx.shadowColor = comboColor;
          ctx.shadowBlur = combo >= 5 ? 10 : 4;
          ctx.fillText('COMBO x' + combo, 14, 36);
          ctx.shadowBlur = 0;
        }

        // === DIFFICULTY HUD (top-right) ===
        var lvl = Math.min(5, Math.max(0, Math.round(diff)));
        ctx.textAlign = 'right';
        ctx.fillStyle = '#A855F7';
        ctx.font = 'bold 16px Arial,sans-serif';
        ctx.fillText('LVL ' + lvl, W - 14, 10);
        var barW = 60, barH = 5;
        var barX = W - 14 - barW, barY = 30;
        var spawnIv = Math.max(380, THROW_IV - diff * 100);
        var fillRatio = 1 - (spawnIv - 380) / (THROW_IV - 380);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = '#A855F7';
        ctx.fillRect(barX, barY, barW * fillRatio, barH);
        // MISS indicator below LVL bar (Fruit Ninja: 3 misses = game over)
        ctx.fillStyle = missCount >= MAX_MISS ? '#FF4444' : '#FFB3B3';
        ctx.font = 'bold 13px Arial,sans-serif';
        ctx.fillText('MISS x' + missCount, W - 14, 40);

        // === SWIPE HINT (center-bottom, fades on first input) ===
        if (hintAlpha > 0.01 && !isOver) {
          ctx.globalAlpha = hintAlpha;
          ctx.fillStyle = '#00ffff';
          ctx.font = 'bold 20px Arial,sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = '#00ffff';
          ctx.shadowBlur = 12;
          ctx.fillText('SWIPE ACROSS FRUITS', W / 2, H - 40);
          ctx.shadowBlur = 0;
          // swipe line icon
          ctx.strokeStyle = 'rgba(0,255,255,0.4)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(W / 2 - 60, H - 20);
          ctx.lineTo(W / 2 + 60, H - 20);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }

        // === MILESTONE CELEBRATION ===
        if (milestoneTimer > 0) {
          var mt = Math.min(1, milestoneTimer / 400);
          ctx.globalAlpha = mt;
          ctx.fillStyle = milestoneColor;
          ctx.font = 'bold 28px Arial,sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = milestoneColor;
          ctx.shadowBlur = 15;
          ctx.fillText(milestoneText, W / 2, H / 2 - 80);
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }

        // game over flash
        if (isOver) {
          var oa = Math.min(0.6, overTime * 2);
          ctx.fillStyle = 'rgba(255,20,60,' + oa + ')';
          ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 40px Arial,sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('GAME OVER', W / 2, H / 2 - 20);
          ctx.font = 'bold 18px Arial,sans-serif';
          ctx.fillStyle = '#aaa';
          ctx.fillText('Score: ' + score, W / 2, H / 2 + 20);
        }

        ctx.restore();
      } catch (e) {
        if (!draw._logged) { draw._logged = true; try { console.error('FF draw:', e); } catch (_) {} }
      }
    }

    function drawFruit(f) {
      var c = f.fd;
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.arc(2, 3, f.r, 0, 6.28); ctx.fill();
      // outer
      ctx.fillStyle = c.color;
      ctx.beginPath(); ctx.arc(0, 0, f.r, 0, 6.28); ctx.fill();
      // gradient highlight
      var g = ctx.createRadialGradient(-f.r * 0.3, -f.r * 0.35, 1, 0, 0, f.r);
      g.addColorStop(0, 'rgba(255,255,255,0.45)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.1)');
      g.addColorStop(1, 'rgba(0,0,0,0.15)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, f.r, 0, 6.28); ctx.fill();
      // leaf
      ctx.fillStyle = c.leaf;
      ctx.beginPath(); ctx.ellipse(f.r * 0.3, -f.r * 0.9, 5, 8, 0.4, 0, 6.28); ctx.fill();
      // stem
      ctx.strokeStyle = '#8B5A2B';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -f.r); ctx.lineTo(1, -f.r - 6); ctx.stroke();
    }

    function drawBomb(f) {
      // glow
      ctx.shadowColor = '#ff3333';
      ctx.shadowBlur = 12;
      // body
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath(); ctx.arc(0, 0, f.r, 0, 6.28); ctx.fill();
      ctx.shadowBlur = 0;
      // ring
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, f.r, 0, 6.28); ctx.stroke();
      // inner highlight
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.arc(-f.r * 0.2, -f.r * 0.2, f.r * 0.5, 0, 6.28); ctx.fill();
      // fuse
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -f.r);
      ctx.quadraticCurveTo(6, -f.r - 8, 4, -f.r - 14);
      ctx.stroke();
      // spark
      var spark = (Date.now() % 400 < 200);
      ctx.fillStyle = spark ? '#FF4444' : '#FFaa00';
      ctx.beginPath(); ctx.arc(4, -f.r - 15, spark ? 4 : 3, 0, 6.28); ctx.fill();
      // X
      ctx.strokeStyle = '#FF3333';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-7, -7); ctx.lineTo(7, 7);
      ctx.moveTo(7, -7); ctx.lineTo(-7, 7);
      ctx.stroke();
    }

    // === LOOP ===
    function loop(ts) {
      if (!alive) return;
      var nowTs = typeof ts === 'number' ? ts : now();
      var raw = (nowTs - lastTs) / 1000;
      var dt = (raw > 0 && raw < 0.15) ? raw : 0.016;
      lastTs = nowTs;
      try { update(dt); draw(); } catch (e) {
        if (!loop._logged) { loop._logged = true; try { console.error('FF loop:', e); } catch (_) {} }
      }
      raf = requestAnimationFrame(loop);
    }

    // === INPUT ===
    // core.js bindGameTouch() calls pointerDown/pointerMove/pointerUp
    // with LOGICAL 800×450 coords (canvasXY). These are our only input path.
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
      if (_pts.length > 24) _pts.shift();
      if (_pts.length >= 2) checkSliceSegment(_pts[_pts.length - 2], _pts[_pts.length - 1]);
    }
    function pUp() { _ptr = null; _pts = []; }

    function checkSliceSegment(a, b) {
      for (var i = 0; i < fruits.length; i++) {
        var f = fruits[i];
        if (!f.alive) continue;
        // point-line distance
        var dx = b.x - a.x, dy = b.y - a.y;
        var len2 = dx * dx + dy * dy;
        if (len2 < 1) continue;
        var t = Math.max(0, Math.min(1, ((f.x - a.x) * dx + (f.y - a.y) * dy) / len2));
        var px = a.x + t * dx, py = a.y + t * dy;
        var ex = f.x - px, ey = f.y - py;
        if (ex * ex + ey * ey < (f.r + 15) * (f.r + 15)) {
          doSlice(f, (a.x + b.x) / 2, (a.y + b.y) / 2);
          return;
        }
      }
    }

    function doSlice(f, mx, my) {
      f.alive = false;
      if (f.bomb) {
        isOver = true; overTime = 0;
        screenShake = 1;
        emitJuice(f.x, f.y, '#FF4444', 20);
        emitBombRing(f.x, f.y);
        emitPopup(f.x, f.y - 30, 'BOOM!', '#FF4444');
        hapticBomb();
        try { if (window.playSfx) window.playSfx('hit'); } catch (_) {}
      } else {
        combo++;
        comboTimer = 900;
        if (combo > bestCombo) bestCombo = combo;
        var gain = 1 + Math.floor(combo / 2);
        score += gain;
        try { state.onScore(score); } catch (_) {}
        // haptic feedback
        hapticSlice();
        // juice
        emitJuice(f.x, f.y, f.fd.color, 8 + combo * 2);
        // halves
        spawnHalves(f);
        // popup
        var txt = '+' + gain;
        if (combo > 2) txt += ' x' + combo;
        emitPopup(f.x, f.y - 20, txt, combo > 3 ? '#FFE600' : '#fff');
        // combo glow escalation
        if (combo >= 5) comboGlow = 1;
        // trail
        var copy = _pts.slice(-10);
        if (copy.length > 1) trails.push({ pts: copy, life: 350, maxLife: 350 });
        try { if (window.playSfx) window.playSfx('slice'); } catch (_) {}
        // score milestone (every 10 points)
        if (score > 0 && score % 10 < gain) {
          milestoneTimer = 1200;
          milestoneText = '🔥 ' + score + ' POINTS!';
          milestoneColor = score >= 50 ? '#FFE600' : '#22D3EE';
          screenShake = 0.5;
        }
      }
    }

    function checkSlice(p) { checkSliceSegment({ x: p.x - 10, y: p.y - 10 }, p); }

    // === PUBLIC API ===
    return {
      start: function () {
        alive = true; isOver = false;
        score = 0; combo = 0; comboTimer = 0; bestCombo = 0;
        diff = 0; spawnAcc = 0; overTime = 0; screenShake = 0;
        missCount = 0;
        hintAlpha = 1; hintUsed = false;
        bombRings = []; comboGlow = 0; milestoneTimer = 0;
        lastTs = now();
        fruits = []; halves = []; particles = []; popups = []; trails = [];
        for (var i = 0; i < 3; i++) spawn(true);
        try { state.onScore(0); } catch (_) {}
        raf = requestAnimationFrame(loop);
      },
      destroy: function () { alive = false; if (raf) cancelAnimationFrame(raf); raf = null; fruits = []; halves = []; particles = []; popups = []; trails = []; bombRings = []; },
      pause: function () { alive = false; if (raf) cancelAnimationFrame(raf); raf = null; },
      resume: function () { if (!alive && !isOver) { alive = true; lastTs = now(); raf = requestAnimationFrame(loop); } },
      setInput: function () {},
      setDifficulty: function (l) { diff = l; },
      getScore: function () { return score; },
      end: function () { isOver = true; overTime = 0; },
      resize: function () {},
      pointerDown: pDown,
      pointerMove: pMove,
      pointerUp: pUp
    };
  }
  window.gameFruitFury = gameFruitFury;
})();
