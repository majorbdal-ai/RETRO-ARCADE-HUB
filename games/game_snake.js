/**
 * Neon Snake — classic snake arcade with neon glow
 * Contract: window.gameSnake(canvas, ctx, W, H, input, state)
 *   state = { onScore(s), onGameOver(s), onCoins(n) }
 *   return { start, destroy, pause, resume, setInput, setDifficulty, getScore, end, resize }
 */
;(function () {
  function gameSnake(canvas, ctx, W, H, input, state) {
    W = 800; H = 450;

    // === CONFIG ===
    var CELL = 18;                     // grid cell size
    var COLS = Math.floor(W / CELL);   // ~44
    var ROWS = Math.floor(H / CELL);   // ~25
    var BASE_SPEED = 0.14;             // seconds per move (easy)
    var MIN_SPEED = 0.05;              // hardest
    var FOOD_TYPES = [
      { color: '#22D3EE', glow: '#22D3EE', points: 1, label: '●' },   // cyan normal
      { color: '#A855F7', glow: '#A855F7', points: 3, label: '★' },   // purple star
      { color: '#EC4899', glow: '#EC4899', points: 5, label: '♥' },   // pink heart (rare)
    ];
    var FOOD_WEIGHTS = [0.7, 0.22, 0.08]; // probabilities

    // === STATE ===
    var raf = null, alive = false, isOver = false;
    var lastTs = 0, diff = 0;
    var snake, dir, nextDir, food, score, moveAcc, overTime;
    var foodFlash = 0; // food pulse timer
    var dirQueue = []; // queue up to 2 direction changes to prevent 180° turns on fast input

    function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

    // === GRID HELPERS ===
    function cellCenter(cx, cy) {
      return { x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2 };
    }

    function spawnFood() {
      // pick type
      var r = Math.random(), cum = 0, typeIdx = 0;
      for (var i = 0; i < FOOD_WEIGHTS.length; i++) {
        cum += FOOD_WEIGHTS[i];
        if (r < cum) { typeIdx = i; break; }
      }
      // find empty cell
      var tries = 0;
      while (tries < 200) {
        var fx = (Math.random() * COLS) | 0;
        var fy = (Math.random() * ROWS) | 0;
        var blocked = false;
        for (var s = 0; s < snake.length; s++) {
          if (snake[s].x === fx && snake[s].y === fy) { blocked = true; break; }
        }
        if (!blocked) {
          food = { x: fx, y: fy, type: FOOD_TYPES[typeIdx], age: 0, pulse: 0 };
          return;
        }
        tries++;
      }
      // fallback: place at (1,1)
      food = { x: 1, y: 1, type: FOOD_TYPES[typeIdx], age: 0, pulse: 0 };
    }

    function speed() {
      return Math.max(MIN_SPEED, BASE_SPEED - diff * 0.015);
    }

    // === DIRECTION QUEUE (prevents 180° and missed fast inputs) ===
    function queueDir(d) {
      if (dirQueue.length >= 2) return;
      var last = dirQueue.length > 0 ? dirQueue[dirQueue.length - 1] : dir;
      // prevent 180° reversal
      if ((d === 'up' && last === 'down') || (d === 'down' && last === 'up') ||
          (d === 'left' && last === 'right') || (d === 'right' && last === 'left')) return;
      if (d !== last) dirQueue.push(d);
    }

    function applyNextDir() {
      if (dirQueue.length > 0) {
        var nd = dirQueue.shift();
        // double-check against CURRENT dir (not last queued)
        if ((nd === 'up' && dir !== 'down') || (nd === 'down' && dir !== 'up') ||
            (nd === 'left' && dir !== 'right') || (nd === 'right' && dir !== 'left')) {
          dir = nd;
        }
      }
    }

    // === UPDATE ===
    function update(dt) {
      if (isOver) {
        overTime += dt;
        if (overTime > 0.8) {
          try { state.onGameOver(score); } catch (e) {}
          try { state.onCoins(Math.max(1, Math.floor(score / 5))); } catch (e) {}
          isOver = false;
        }
        return;
      }

      foodFlash += dt;
      moveAcc += dt;
      var sp = speed();
      while (moveAcc >= sp) {
        moveAcc -= sp;
        applyNextDir();
        // move head
        var head = snake[0];
        var nx = head.x, ny = head.y;
        if (dir === 'up') ny--;
        else if (dir === 'down') ny++;
        else if (dir === 'left') nx--;
        else if (dir === 'right') nx++;

        // wall collision → wrap around (Nokia style)
        if (nx < 0) nx = COLS - 1;
        else if (nx >= COLS) nx = 0;
        if (ny < 0) ny = ROWS - 1;
        else if (ny >= ROWS) ny = 0;

        // self collision
        for (var i = 0; i < snake.length; i++) {
          if (snake[i].x === nx && snake[i].y === ny) {
            die(); return;
          }
        }

        var newHead = { x: nx, y: ny };
        snake.unshift(newHead);

        // food check
        if (food && nx === food.x && ny === food.y) {
          var pts = food.type.points;
          score += pts;
          try { state.onScore(score); } catch (e) {}
          try { if (window.playSfx) window.playSfx('coin'); } catch (_) {}
          if (navigator.vibrate) { try { navigator.vibrate([30, 20, 60]); } catch (_) {} }
          // grow: don't pop tail
          spawnFood();
        } else {
          snake.pop();
        }
      }
    }

    function die() {
      isOver = true;
      overTime = 0;
      try { if (window.playSfx) window.playSfx('error'); } catch (_) {}
      if (navigator.vibrate) { try { navigator.vibrate([80, 30, 120]); } catch (_) {} }
    }

    // === DRAW ===
    function draw() {
      try {
        ctx.clearRect(0, 0, W, H);

        // background
        var bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#080818');
        bg.addColorStop(0.5, '#0c0c24');
        bg.addColorStop(1, '#06060f');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // subtle grid
        ctx.strokeStyle = 'rgba(34,211,238,0.04)';
        ctx.lineWidth = 0.5;
        for (var gx = 0; gx <= W; gx += CELL) {
          ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
        }
        for (var gy = 0; gy <= H; gy += CELL) {
          ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
        }

        // === FOOD ===
        if (food) {
          var fp = cellCenter(food.x, food.y);
          var pulse = 0.8 + 0.2 * Math.sin(food.pulse * 6);
          food.pulse += 0.03;
          // glow
          ctx.shadowColor = food.type.glow;
          ctx.shadowBlur = 12 * pulse;
          ctx.fillStyle = food.type.color;
          ctx.beginPath();
          ctx.arc(fp.x, fp.y, CELL * 0.4 * pulse, 0, 6.28);
          ctx.fill();
          ctx.shadowBlur = 0;
          // inner bright dot
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.beginPath();
          ctx.arc(fp.x - 2, fp.y - 2, 3, 0, 6.28);
          ctx.fill();
          // rare food label
          if (food.type.points > 1) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px Arial,sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(food.type.label, fp.x, fp.y);
          }
        }

        // === SNAKE ===
        for (var i = snake.length - 1; i >= 0; i--) {
          var seg = snake[i];
          var sp2 = cellCenter(seg.x, seg.y);
          var t = i / Math.max(1, snake.length - 1); // 0=head, 1=tail

          // head = bright cyan, tail fades to purple
          var r2 = Math.round(34 + t * 100);
          var g2 = Math.round(211 - t * 120);
          var b2 = Math.round(238 - t * 60);
          var segColor = 'rgb(' + r2 + ',' + g2 + ',' + b2 + ')';

          // glow on head
          if (i === 0) {
            ctx.shadowColor = '#22D3EE';
            ctx.shadowBlur = 10;
          }

          ctx.fillStyle = segColor;
          // rounded rect for each segment
          var pad = 1;
          var rx = seg.x * CELL + pad;
          var ry = seg.y * CELL + pad;
          var rw = CELL - pad * 2;
          var rh = CELL - pad * 2;
          var cr = 4;
          ctx.beginPath();
          ctx.moveTo(rx + cr, ry);
          ctx.lineTo(rx + rw - cr, ry);
          ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + cr);
          ctx.lineTo(rx + rw, ry + rh - cr);
          ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - cr, ry + rh);
          ctx.lineTo(rx + cr, ry + rh);
          ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - cr);
          ctx.lineTo(rx, ry + cr);
          ctx.quadraticCurveTo(rx, ry, rx + cr, ry);
          ctx.closePath();
          ctx.fill();

          ctx.shadowBlur = 0;

          // eyes on head
          if (i === 0) {
            var ex1, ey1, ex2, ey2;
            var cx2 = sp2.x, cy2 = sp2.y;
            if (dir === 'up') { ex1 = cx2 - 3; ey1 = cy2 - 3; ex2 = cx2 + 3; ey2 = cy2 - 3; }
            else if (dir === 'down') { ex1 = cx2 - 3; ey1 = cy2 + 3; ex2 = cx2 + 3; ey2 = cy2 + 3; }
            else if (dir === 'left') { ex1 = cx2 - 4; ey1 = cy2 - 3; ex2 = cx2 - 4; ey2 = cy2 + 3; }
            else { ex1 = cx2 + 4; ey1 = cy2 - 3; ex2 = cx2 + 4; ey2 = cy2 + 3; }
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(ex1, ey1, 2.2, 0, 6.28); ctx.fill();
            ctx.beginPath(); ctx.arc(ex2, ey2, 2.2, 0, 6.28); ctx.fill();
            ctx.fillStyle = '#111';
            ctx.beginPath(); ctx.arc(ex1, ey1, 1, 0, 6.28); ctx.fill();
            ctx.beginPath(); ctx.arc(ex2, ey2, 1, 0, 6.28); ctx.fill();
          }
        }

        // === SCORE HUD ===
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px Arial,sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('SCORE ' + score, 14, 10);

        // length
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '14px Arial,sans-serif';
        ctx.fillText('LEN ' + snake.length, 14, 36);

        // === DEATH FLASH ===
        if (isOver && overTime < 0.3) {
          ctx.fillStyle = 'rgba(255,50,50,' + (0.3 * (1 - overTime / 0.3)) + ')';
          ctx.fillRect(0, 0, W, H);
        }

        // === GAME OVER TEXT ===
        if (isOver) {
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          ctx.fillRect(W / 2 - 120, H / 2 - 30, 240, 60);
          ctx.strokeStyle = '#EC4899';
          ctx.lineWidth = 2;
          ctx.strokeRect(W / 2 - 120, H / 2 - 30, 240, 60);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 22px Arial,sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('GAME OVER', W / 2, H / 2 - 6);
          ctx.fillStyle = '#22D3EE';
          ctx.font = '14px Arial,sans-serif';
          ctx.fillText('SCORE: ' + score, W / 2, H / 2 + 14);
        }

      } catch (e) {
        if (!draw._logged) { draw._logged = true; try { console.error('Snake draw error:', e); } catch (_) {} }
      }
    }

    // === LOOP ===
    function loop(ts) {
      if (!alive) return;
      var nowTs = typeof ts === 'number' ? ts : now();
      var raw = (nowTs - lastTs) / 1000;
      var dt = (raw > 0 && raw < 0.15) ? raw : 0.016;
      lastTs = nowTs;
      try { update(dt); draw(); } catch (e) {
        if (!loop._logged) { loop._logged = true; try { console.error('Snake loop error:', e); } catch (_) {} }
      }
      raf = requestAnimationFrame(loop);
    }

    // === INPUT ===
    var _swipeStart = null;
    function canvasXY(e) {
      var r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
    }

    function pDown(e) {
      if (isOver || !alive) return;
      e.preventDefault();
      _swipeStart = canvasXY(e);
    }
    function pMove(e) {
      if (!_swipeStart || isOver) return;
      e.preventDefault();
      var p = canvasXY(e);
      if (!p) return;
      var dx = p.x - _swipeStart.x;
      var dy = p.y - _swipeStart.y;
      var THRESHOLD = 20;
      if (Math.abs(dx) > THRESHOLD || Math.abs(dy) > THRESHOLD) {
        if (Math.abs(dx) > Math.abs(dy)) {
          queueDir(dx > 0 ? 'right' : 'left');
        } else {
          queueDir(dy > 0 ? 'down' : 'up');
        }
        _swipeStart = p; // reset for continuous swipe
      }
    }
    function pUp(e) { _swipeStart = null; }

    function onKeyDown(e) {
      if (!alive || isOver) return;
      var k = e.code || e.key;
      if (k === 'ArrowUp' || k === 'KeyW') { e.preventDefault(); queueDir('up'); }
      else if (k === 'ArrowDown' || k === 'KeyS') { e.preventDefault(); queueDir('down'); }
      else if (k === 'ArrowLeft' || k === 'KeyA') { e.preventDefault(); queueDir('left'); }
      else if (k === 'ArrowRight' || k === 'KeyD') { e.preventDefault(); queueDir('right'); }
    }

    function bind() {
      canvas.addEventListener('pointerdown', pDown);
      canvas.addEventListener('pointermove', pMove);
      canvas.addEventListener('pointerup', pUp);
      canvas.addEventListener('pointercancel', pUp);
      window.addEventListener('keydown', onKeyDown);
    }
    function unbind() {
      canvas.removeEventListener('pointerdown', pDown);
      canvas.removeEventListener('pointermove', pMove);
      canvas.removeEventListener('pointerup', pUp);
      canvas.removeEventListener('pointercancel', pUp);
      window.removeEventListener('keydown', onKeyDown);
    }

    // === PUBLIC API ===
    return {
      start: function () {
        alive = true; isOver = false;
        score = 0; diff = 0; moveAcc = 0; overTime = 0; foodFlash = 0;
        lastTs = now();
        dir = 'right'; nextDir = 'right'; dirQueue = [];
        // snake starts in the middle-left
        var startX = Math.floor(COLS * 0.25);
        var startY = Math.floor(ROWS / 2);
        snake = [];
        for (var i = 0; i < 4; i++) snake.push({ x: startX - i, y: startY });
        spawnFood();
        try { state.onScore(0); } catch (_) {}
        raf = requestAnimationFrame(loop);
      },
      destroy: function () { alive = false; if (raf) cancelAnimationFrame(raf); raf = null; unbind(); snake = []; food = null; },
      pause: function () { alive = false; if (raf) cancelAnimationFrame(raf); raf = null; },
      resume: function () { if (!alive && !isOver) { alive = true; lastTs = now(); raf = requestAnimationFrame(loop); } },
      setInput: function () {},
      setDifficulty: function (l) { diff = l; },
      getScore: function () { return score; },
      end: function () { isOver = true; overTime = 0; },
      resize: function () {}
    };
  }
  window.gameSnake = gameSnake;
})();
