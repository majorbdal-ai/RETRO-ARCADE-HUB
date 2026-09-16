/**
 * Fruit Fury — swipe-to-slice fruit arcade
 * Contract: window.gameFruitFury(canvas, ctx, W, H, input, state)
 *   state = { onScore(s), onGameOver(s), onCoins(n) }
 *   return { start, destroy, pause, resume, setInput, setDifficulty, getScore, end, resize }
 */
;(function () {
  function gameFruitFury(canvas, ctx, W, H, input, state) {
    // OVERRIDE: hub's canvasScale() hardcodes logical 800×450 for input mapping.
    // canvas.width/height = 800*DPR (from setupDPR), but ctx has DPR transform.
    // We MUST draw in 800×450 logical space — ctx transform scales up.
    W = 800; H = 450;
    // === CONFIG ===
    var FRUITS = ['apple','orange','grape','lemon','kiwi','melon'];
    var COLORS = { apple:'#FF4D6D', orange:'#FF9F1C', grape:'#B563FF', lemon:'#FFD93D', kiwi:'#7BD88F', melon:'#3DD68C' };
    var LABELS  = { apple:'Apple', orange:'Orng', grape:'Grape', lemon:'Lmn', kiwi:'Kiwi', melon:'Melon' };
    var THROW_INTERVAL = 1300;
    var GRAVITY = 1300;
    var BOMB_PCT = 0.15;

    // === STATE ===
    var raf = null, alive = false, isOver = false;
    var lastTs = 0, score = 0, diff = 0, spawnAcc = 0, overTime = 0;
    var fruits = [], trails = [];

    // === TIMING (robust — never negative dt) ===
    function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

    // === FRUIT SPAWN ===
    function spawn(early) {
      var bomb = Math.random() < BOMB_PCT;
      var kind = FRUITS[(Math.random() * FRUITS.length) | 0];
      var r = 22 + Math.random() * 14;
      var x, y, vx, vy;
      if (early) {
        x = W * (0.12 + Math.random() * 0.76);
        y = H * (0.15 + Math.random() * 0.55);
        vx = (Math.random() - 0.5) * 250;
        vy = -(80 + Math.random() * 180);
      } else {
        x = r + Math.random() * (W - 2 * r);
        y = H + r + 10;
        vx = (Math.random() - 0.5) * 160;
        vy = -(500 + Math.random() * 280 + diff * 35);
      }
      fruits.push({ x:x, y:y, vx:vx, vy:vy, r:r, rot:Math.random()*6.28, rv:(Math.random()-0.5)*10, kind:kind, bomb:bomb, alive:true, age:0 });
    }

    // === UPDATE ===
    function update(dt) {
      if (isOver) {
        overTime += dt;
        if (overTime > 1.0) {
          try { state.onGameOver(score); } catch (e) {}
          try { state.onCoins(Math.max(1, Math.floor(score / 10))); } catch (e) {}
          isOver = false;
        }
        return;
      }
      spawnAcc += dt * 1000;
      var iv = Math.max(380, THROW_INTERVAL - diff * 120);
      while (spawnAcc >= iv) { spawnAcc -= iv; spawn(false); }
      for (var i = fruits.length - 1; i >= 0; i--) {
        var f = fruits[i];
        f.age += dt;
        f.vy += GRAVITY * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.rot += f.rv * dt;
        if (f.y > H + 80 || f.x < -80 || f.x > W + 80 || (!f.alive && f.age > 0.5)) {
          fruits.splice(i, 1);
        }
      }
      for (var j = trails.length - 1; j >= 0; j--) {
        trails[j].life -= dt * 1000;
        if (trails[j].life <= 0) trails.splice(j, 1);
      }
    }

    // === DRAW (every call wrapped in try/catch) ===
    function draw() {
      try {
        ctx.clearRect(0, 0, W, H);
        // background gradient (NOT plain black — visible on all screens)
        var bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#0f0c29');
        bg.addColorStop(0.5, '#1a1040');
        bg.addColorStop(1, '#0a0a18');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // subtle grid
        ctx.strokeStyle = 'rgba(100,80,200,0.08)';
        ctx.lineWidth = 1;
        for (var gx = 0; gx < W; gx += 60) {
          ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
        }
        for (var gy = 0; gy < H; gy += 60) {
          ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
        }

        // swipe trails
        for (var t = 0; t < trails.length; t++) {
          var tr = trails[t];
          var a = tr.life / tr.maxLife;
          ctx.strokeStyle = 'rgba(0,255,255,' + (a * 0.6) + ')';
          ctx.lineWidth = 3 * a;
          ctx.beginPath();
          var pts = tr.pts;
          if (pts.length > 0) {
            ctx.moveTo(pts[0].x, pts[0].y);
            for (var p = 1; p < pts.length; p++) ctx.lineTo(pts[p].x, pts[p].y);
          }
          ctx.stroke();
        }

        // fruits
        for (var i = 0; i < fruits.length; i++) {
          var f = fruits[i];
          if (!f.alive) continue;
          ctx.save();
          ctx.translate(f.x, f.y);
          ctx.rotate(f.rot);
          if (f.bomb) {
            // bomb
            ctx.fillStyle = '#1e1e30';
            ctx.beginPath(); ctx.arc(0, 0, f.r, 0, 6.28); ctx.fill();
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, f.r, 0, 6.28); ctx.stroke();
            // fuse
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, -f.r); ctx.lineTo(3, -f.r - 10); ctx.stroke();
            // spark
            ctx.fillStyle = '#FF6B00';
            ctx.beginPath(); ctx.arc(3, -f.r - 12, 4, 0, 6.28); ctx.fill();
            // X mark
            ctx.strokeStyle = '#FF3333';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(-8,-8); ctx.lineTo(8,8); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(8,-8); ctx.lineTo(-8,8); ctx.stroke();
          } else {
            // fruit circle
            ctx.fillStyle = COLORS[f.kind] || '#fff';
            ctx.beginPath(); ctx.arc(0, 0, f.r, 0, 6.28); ctx.fill();
            // highlight
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.beginPath(); ctx.arc(-f.r * 0.2, -f.r * 0.25, f.r * 0.45, 0, 6.28); ctx.fill();
            // label
            ctx.fillStyle = '#000';
            var fs = Math.max(8, (f.r * 0.55) | 0);
            ctx.font = 'bold ' + fs + 'px Arial,sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            var lbl = LABELS[f.kind] || '';
            ctx.fillText(lbl, 0, 1);
          }
          ctx.restore();
        }

        // HUD — score
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 26px Arial,sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('SCORE ' + score, 14, 10);
      } catch (e) {
        // draw error — log once, don't crash loop
        if (!draw._logged) { draw._logged = true; try { console.error('FruitFury draw error:', e); } catch (_) {} }
      }
    }

    // === LOOP ===
    function loop(ts) {
      if (!alive) return;
      // robust dt — always positive, capped
      var nowTs = typeof ts === 'number' ? ts : now();
      var raw = (nowTs - lastTs) / 1000;
      var dt = (raw > 0 && raw < 0.15) ? raw : 0.016; // fallback to 60fps if weird
      lastTs = nowTs;
      try { update(dt); draw(); } catch (e) {
        if (!loop._logged) { loop._logged = true; try { console.error('FruitFury loop error:', e); } catch (_) {} }
      }
      raf = requestAnimationFrame(loop);
    }

    // === INPUT ===
    var _ptr = null, _pts = [];
    function canvasXY(e) {
      var r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
    }
    function pDown(e) {
      if (isOver || alive !== true) return;
      e.preventDefault();
      _ptr = e.pointerId;
      var p = canvasXY(e);
      if (p) { _pts = [p]; checkSlice(p); }
    }
    function pMove(e) {
      if (e.pointerId !== _ptr || isOver) return;
      e.preventDefault();
      var p = canvasXY(e);
      if (p) { _pts.push(p); if (_pts.length > 20) _pts.shift(); checkSlice(p); }
    }
    function pUp(e) { if (e.pointerId === _ptr) { _ptr = null; _pts = []; } }

    function checkSlice(p) {
      for (var i = 0; i < fruits.length; i++) {
        var f = fruits[i];
        if (!f.alive) continue;
        var dx = p.x - f.x, dy = p.y - f.y;
        if (dx * dx + dy * dy < (f.r + 20) * (f.r + 20)) {
          f.alive = false;
          if (f.bomb) {
            isOver = true; overTime = 0;
            try { if (window.playSfx) window.playSfx('hit'); } catch (_) {}
          } else {
            score++;
            try { state.onScore(score); } catch (_) {}
            try { if (window.playSfx) window.playSfx('slice'); } catch (_) {}
            // add trail effect
            var copy = _pts.slice(-8);
            if (copy.length > 1) trails.push({ pts: copy, life: 300, maxLife: 300 });
          }
          return;
        }
      }
    }

    function bind() {
      canvas.addEventListener('pointerdown', pDown);
      canvas.addEventListener('pointermove', pMove);
      canvas.addEventListener('pointerup', pUp);
      canvas.addEventListener('pointercancel', pUp);
      window.addEventListener('keydown', function onKey(e) {
        if (!alive || isOver) return;
        if (e.code === 'Space') { e.preventDefault(); checkSlice({ x: W / 2 + (Math.random() - 0.5) * 300, y: H / 2 + (Math.random() - 0.5) * 200 }); }
      });
    }
    function unbind() {
      canvas.removeEventListener('pointerdown', pDown);
      canvas.removeEventListener('pointermove', pMove);
      canvas.removeEventListener('pointerup', pUp);
      canvas.removeEventListener('pointercancel', pUp);
    }

    // === PUBLIC API ===
    return {
      start: function () {
        alive = true; isOver = false;
        score = 0; diff = 0; spawnAcc = 0; overTime = 0;
        lastTs = now();
        fruits = []; trails = [];
        // spawn 3 initial fruits (visible from frame 1)
        for (var i = 0; i < 3; i++) spawn(true);
        try { state.onScore(0); } catch (_) {}
        raf = requestAnimationFrame(loop);
      },
      destroy: function () { alive = false; if (raf) cancelAnimationFrame(raf); raf = null; unbind(); fruits = []; trails = []; },
      pause: function () { alive = false; if (raf) cancelAnimationFrame(raf); raf = null; },
      resume: function () { if (!alive && !isOver) { alive = true; lastTs = now(); raf = requestAnimationFrame(loop); } },
      setInput: function () {},
      setDifficulty: function (l) { diff = l; },
      getScore: function () { return score; },
      end: function () { isOver = true; overTime = 0; },
      resize: function () {}
    };
  }
  window.gameFruitFury = gameFruitFury;
})();
