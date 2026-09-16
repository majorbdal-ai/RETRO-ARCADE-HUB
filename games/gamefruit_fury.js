/* Fruit Fury — original canvas arcade game (hub-native engine, v7.66.0)
 * Mechanic: slice flying fruits by swiping, avoid bombs, chain combos.
 * Neon-styled to match RETRO ARCADE HUB. Self-contained; no external deps.
 * Engine contract: window.gameFruitFury = function(canvas, ctx, W, H, input, state)
 */
(function () {
  'use strict';

  function gameFruitFury(canvas, ctx, W, H, input, state) {
    const onScore = state && state.onScore ? state.onScore : function () {};
    const onGameOver = state && state.onGameOver ? state.onGameOver : function () {};
    const onCoins = state && state.onCoins ? state.onCoins : function () {};

    // ---- tuning ----
    const FRUITS = ['apple', 'lemon', 'orange', 'grape', 'kiwi', 'watermelon'];
    const FRUIT_COLORS = {
      apple: '#FF4D6D', lemon: '#FFD93D', orange: '#FF9F1C',
      grape: '#B563FF', kiwi: '#7BD88F', watermelon: '#3DD68C'
    };
    const BASE_THROW_MS = 1500;      // start: 1 fruit / 1.5s
    const MIN_THROW_MS = 420;        // max difficulty
    const GRAVITY = 1300;            // px/s^2
    const SWIPE_MIN = 26;            // min swipe length (px) to count as slice
    const BOMB_P = 0.18;             // bomb spawn chance
    const COMBO_WINDOW = 900;        // ms between slices to chain combo
    const MAX_FRUITS = 24;

    let fps = null, raf = null;
    let last = 0, acc = 0;
    let score = 0, combo = 0, comboT = 0;
    let gameOver = false, overT = 0;
    let throws = [];
    let slices = [];
    let pointerDown = false, moved = false;
    let lastSliceT = 0;
    let shake = 0;
    let HUD_T = 0;

    // controls hint
    let hint = 'Swipe to slice';

    function throwFruit() {
      const isBomb = Math.random() < bombP;
      const x0 = Math.random() < 0.5 ? -30 : W + 30;
      const y0 = H + 20;
      const vx = (W / 2 - x0) * (0.55 + Math.random() * 0.45);
      const vy = -(620 + Math.random() * 260);
      const rot = Math.random() * 6.28;
      const rotV = (Math.random() - 0.5) * 8;
      const f = FRUITS[(Math.random() * FRUITS.length) | 0];
      throws.push({
        x: x0, y: y0, vx: vx, vy: vy, rot: rot, rotV: rotV,
        kind: isBomb ? 'bomb' : f, size: isBomb ? 34 : 30 + Math.random() * 10,
        sliced: false, t: 0
      });
      if (throws.length > MAX_FRUITS) throws.shift();
    }

    function sliceFruit(f, sx, sy, ex, ey) {
      // line-circle intersect
      const dx = ex - sx, dy = ey - sy;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) return false;
      const t = ((f.x - sx) * dx + (f.y - sy) * dy) / len2;
      const cx = sx + t * dx, cy = sy + t * dy;
      const d2 = (f.x - cx) * (f.x - cx) + (f.y - cy) * (f.y - cy);
      return d2 <= f.size * f.size;
    }

    function doSwipe(sx, sy, ex, ey) {
      // ripple slice trail
      const dx = ex - sx, dy = ey - sy;
      const dist = Math.hypot(dx, dy);
      if (dist < SWIPE_MIN) return;
      slices.push({ sx: sx, sy: sy, ex: ex, ey: ey, t: 0, life: 240 });
      // check fruits
      let hit = 0, bombHit = false;
      for (const f of throws) {
        if (f.sliced) continue;
        if (sliceFruit(f, sx, sy, ex, ey)) {
          f.sliced = true;
          if (f.kind === 'bomb') bombHit = true;
          else hit++;
        }
      }
      // combo
      const now = performance.now();
      if (hit > 0) {
        if (now - lastSliceT < COMBO_WINDOW) combo++; else combo = 1;
        lastSliceT = now;
        const gain = hit * 10 * combo;
        score += gain;
        onScore(score);
        if (typeof window.playSfx === 'function') { try { window.playSfx('slice' in { slice: 1 } ? 'slice' : 'pop'); } catch (e) {} }
        if (window.gameFX) { try { window.gameFX.burst(sx, sy, '#22D3EE', 6); } catch (e) {} }
      } else {
        combo = 0;
      }
      if (bombHit) {
        endGame();
        return;
      }
      // shake on multi-slice
      if (hit >= 3) shake = Math.min(shake + 4, 10);
    }

    function endGame() {
      if (gameOver) return;
      gameOver = true;
      overT = 0;
      onGameOver(score);
      onCoins(Math.max(1, Math.floor(score / 15)));
      if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
      if (window.gameFX) { try { window.gameFX.deathFX(); } catch (e) {} }
      setTimeout(function () { if (typeof window.endGame === 'function') { try { window.endGame(); } catch (e) {} } }, 900);
    }

    function update(dt) {
      if (gameOver) {
        overT += dt;
        if (overT > 1.5 && typeof window.endGame === 'function') {
          try { window.endGame(); } catch (e) {}
        }
        return;
      }
      // spawn
      HUD_T -= dt;
      const ms = Math.max(MIN_THROW_MS, baseThrowMs - score * 4);
      acc += dt;
      if (acc >= ms / 1000) {
        acc = 0;
        throwFruit();
      }
      // update fruits
      for (let i = throws.length - 1; i >= 0; i--) {
        const f = throws[i];
        f.t += dt;
        f.vy += GRAVITY * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.rot += f.rotV * dt;
        if (f.y > H + 60 || f.x < -80 || f.x > W + 80 || (f.sliced && f.t > 0.6)) {
          throws.splice(i, 1);
        }
        // miss a fruit on the floor = nothing (no penalty, casual)
      }
      // updates swipe trails
      for (let i = slices.length - 1; i >= 0; i--) {
        slices[i].t += dt * 1000;
        if (slices[i].t > slices[i].life) slices.splice(i, 1);
      }
      if (shake > 0) shake = Math.max(0, shake - dt * 18);
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      // background — neon gradient
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0D0D1A');
      g.addColorStop(1, '#1A1030');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // subtle grid
      ctx.strokeStyle = 'rgba(139,92,246,0.10)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // fruits
      for (const f of throws) {
        if (f.sliced) continue;
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rot);
        if (f.kind === 'bomb') {
          // bomb — dark sphere with fuse
          ctx.fillStyle = '#22222E';
          ctx.beginPath(); ctx.arc(0, 0, f.size, 0, 6.29); ctx.fill();
          ctx.fillStyle = '#5A5A6E';
          ctx.beginPath(); ctx.arc(0, 0, f.size * 0.6, 0, 6.29); ctx.fill();
          ctx.strokeStyle = '#EC4899';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(6, -6); ctx.lineTo(14, -16); ctx.stroke();
          // spark
          ctx.fillStyle = '#FFD93D';
          ctx.beginPath(); ctx.arc(15, -17, 4, 0, 6.29); ctx.fill();
        } else {
          // fruit — gradient circle with highlight
          const col = FRUIT_COLORS[f.kind];
          const g2 = ctx.createRadialGradient(-f.size*0.3, -f.size*0.4, 2, 0, 0, f.size*0.9);
          g2.addColorStop(0, lighten(col, 70));
          g2.addColorStop(1, col);
          ctx.fillStyle = g2;
          ctx.beginPath(); ctx.arc(0, 0, f.size, 0, 6.29); ctx.fill();
          // leaf
          ctx.fillStyle = '#3DD68C';
          ctx.beginPath();
          ctx.moveTo(-4, -f.size*0.7);
          ctx.quadraticCurveTo(4, -f.size*1.1, 10, -f.size*0.7);
          ctx.quadraticCurveTo(4, -f.size*0.4, -4, -f.size*0.7);
          ctx.fill();
        }
        ctx.restore();
      }
      // sliced halves (fading flies)
      for (const f of throws) {
        if (!f.sliced) continue;
        const a = Math.max(0, 1 - f.t * 2.2);
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rot);
        ctx.globalAlpha = a;
        ctx.fillStyle = f.kind === 'bomb' ? '#444' : FRUIT_COLORS[f.kind];
        ctx.beginPath(); ctx.arc(-f.size/2, 0, f.size*0.55, 0, 6.29); ctx.fill();
        ctx.beginPath(); ctx.arc(f.size/2, 0, f.size*0.55, 0, 6.29); ctx.fill();
        ctx.restore();
      }
      // swipe trail
      for (const s of slices) {
        const a = Math.max(0, 1 - s.t / s.life);
        ctx.strokeStyle = 'rgba(34,211,238,' + (a * 0.9) + ')';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s.sx, s.sy); ctx.lineTo(s.ex, s.ey); ctx.stroke();
        ctx.strokeStyle = 'rgba(236,72,153,' + (a * 0.5) + ')';
        ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(s.sx, s.sy); ctx.lineTo(s.ex, s.ey); ctx.stroke();
      }

      // score (float)
      ctx.font = 'bold ' + Math.min(46, W / 8) + 'px Orbitron, monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#22D3EE'; ctx.shadowBlur = 18;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(score, W / 2, 54);
      ctx.shadowBlur = 0;
      if (combo >= 3) {
        ctx.font = 'bold 20px Orbitron, monospace';
        ctx.fillStyle = '#EC4899';
        ctx.fillText('COMBO x' + combo, W / 2, 86);
      }
      if (gameOver) {
        ctx.fillStyle = 'rgba(13,13,26,0.55)';
        ctx.fillRect(0, 0, W, H);
        ctx.font = 'bold 40px Orbitron, monospace';
        ctx.shadowColor = '#EC4899'; ctx.shadowBlur = 24;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('SLICED!', W / 2, H / 2 - 20);
        ctx.shadowBlur = 0;
        ctx.font = '18px Orbitron, monospace';
        ctx.fillStyle = '#9CA3AF';
        ctx.fillText('Score ' + score, W / 2, H / 2 + 20);
      }
      // hint
      if (!gameOver && HUD_T <= 0) {
        ctx.font = '14px Poppins, monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText(hint, W / 2, H - 20);
      }
    }

    function lighten(hex, amt) {
      const n = parseInt(hex.slice(1), 16);
      let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
      r = Math.min(255, r + amt); g = Math.min(255, g + amt); b = Math.min(255, b + amt);
      return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    }

        function setDiff(level) {
      baseThrowMs = Math.max(MIN_THROW_MS, BASE_THROW_MS - level * 160);
      bombP = Math.min(0.32, BOMB_P + level * 0.02);
    }
    let baseThrowMs = BASE_THROW_MS, bombP = BOMB_P;

    function loop(ts) {
      const dt = Math.min(0.05, (ts - (last || ts)) / 1000 || 0);
      last = ts;
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    }

    // ---- input (touch/pointer via hub) ----
    const onDown = function (x, y) {
      pointerDown = true; moved = false;
    };
    const onMove = function (x, y, px, py) {
      if (!pointerDown) return;
      moved = true;
      doSwipe(px, py, x, y);
    };
    const onUp = function () { pointerDown = false; };

    // hub native engines expose input.touches? — here we bind directly to canvas
    // for pointer events (hub's touch sync also mirrors into gameState).
    function bind() {
      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('pointercancel', onPointerUp);
      // keyboard fallback (space = slice at random fruit)
      window.addEventListener('keydown', onKey);
    }
    function onPointerDown(e) {
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) * (canvas.width / r.width);
      const y = (e.clientY - r.top) * (canvas.height / r.height);
      onDown(x, y);
    }
    function onPointerMove(e) {
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) * (canvas.width / r.width);
      const y = (e.clientY - r.top) * (canvas.height / r.height);
      if (pointerDown && lastPt) onMove(x, y, lastPt.x, lastPt.y);
      lastPt = { x: x, y: y };
    }
    function onPointerUp() { onUp(); }
    let lastPt = null;
    function onKey(e) {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        // slice every fruit (keyboard cheat-mode slice)
        for (const f of throws) if (!f.sliced && f.kind !== 'bomb') f.sliced = true;
        score += 10; onScore(score);
      }
    }

    function unbind() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKey);
    }

    bind();
    raf = requestAnimationFrame(loop);

    return {
      start: function () {
        // hub calls start() after boot — resume loop if paused, else ensure running
        if (raf === null && !gameOver) raf = requestAnimationFrame(loop);
      },
      setInput: function (touches, keys) { /* hub legacy input — we bind our own touch */ },
      setDifficulty: function (level) { setDiff(level); },
      destroy: function () {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        unbind();
        throws = []; slices = [];
      },
      resize: function (w, h) {
        // canvas W/H handled by hub DPR; nothing extra needed
      },
      pause: function () { if (raf) cancelAnimationFrame(raf); raf = null; },
      resume: function () { if (!raf) raf = requestAnimationFrame(loop); },
      getScore: function () { return score; },
      end: function () { endGame(); }
    };
  }

  window.gameFruitFury = gameFruitFury;
})();