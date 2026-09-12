function slidePuzzle(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
let diffMul = 1;  // v7.20 difficulty ramp
  let raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  let keys = {}, touches = {};
  let gameOverSent = false;
  const SIZE = 4, CELL = 90, PAD_X = (W - SIZE * CELL) / 2, PAD_Y = (H - SIZE * CELL) / 2 + 15;
  let grid = [], emptyR = 3, emptyC = 3;
  let moves = 0, startTime = 0, solved = false;
  let level = 1, nextTimer = 0, chainFlash = 0;
  let animating = false, animR = 0, animC = 0, animDR = 0, animDC = 0, animT = 0, animDur = 0.15;
  let mouseX = -1, mouseY = -1, mouseDown = false;

  function reset() {
    over = false; gameOverSent = false; score = 0; coins = 0;
    moves = 0; startTime = 0; solved = false;
    level = 1; nextTimer = 0; chainFlash = 0;
    animating = false;

    // Initialize solved state
    grid = [];
    let n = 1;
    for (let r = 0; r < SIZE; r++) {
      grid[r] = [];
      for (let c = 0; c < SIZE; c++) {
        if (r === SIZE - 1 && c === SIZE - 1) {
          grid[r][c] = 0; // empty
        } else {
          grid[r][c] = n++;
        }
      }
    }
    emptyR = SIZE - 1;
    emptyC = SIZE - 1;

    // Shuffle with legal moves
    shufflePuzzle(500);
    startTime = performance.now();
  }

  function shufflePuzzle(moves_count) {
    for (let i = 0; i < moves_count; i++) {
      const neighbors = getNeighbors(emptyR, emptyC);
      const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
      // Swap
      grid[emptyR][emptyC] = grid[pick.r][pick.c];
      grid[pick.r][pick.c] = 0;
      emptyR = pick.r;
      emptyC = pick.c;
    }
    // Ensure it's not already solved
    if (isSolved()) shufflePuzzle(moves_count);
  }

  function getNeighbors(r, c) {
    const n = [];
    if (r > 0) n.push({ r: r - 1, c: c });
    if (r < SIZE - 1) n.push({ r: r + 1, c: c });
    if (c > 0) n.push({ r: r, c: c - 1 });
    if (c < SIZE - 1) n.push({ r: r, c: c + 1 });
    return n;
  }

  function isSolved() {
    let n = 1;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (r === SIZE - 1 && c === SIZE - 1) {
          if (grid[r][c] !== 0) return false;
        } else {
          if (grid[r][c] !== n) return false;
          n++;
        }
      }
    }
    return true;
  }

  function trySlide(r, c) {
    if (animating || solved) return;
    // Check if adjacent to empty
    const dr = r - emptyR, dc = c - emptyC;
    if (Math.abs(dr) + Math.abs(dc) !== 1) return;

    // Animate
    animating = true;
    animR = r; animC = c;
    animDR = -dr; animDC = -dc;
    animT = 0;
    moves++;

    // Update score as moves count down (efficiency reward)
    score = Math.max(0, 500 - moves);
    onScore(score);
    if (typeof window.playSfx === 'function') { try { window.playSfx('click'); } catch (e) {} }

    // Swap in grid
    grid[emptyR][emptyC] = grid[r][c];
    grid[r][c] = 0;
    const prevER = emptyR, prevEC = emptyC;
    emptyR = r; emptyC = c;
  }

  function draw() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#00ffff';
    ctx.fillStyle = '#00ffff';
    ctx.font = '18px "Courier New", monospace';
    ctx.fillText('SLIDE PUZZLE', 10, 22);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#666688';
    ctx.font = '11px "Courier New", monospace';
    ctx.fillText('Tap tile adjacent to empty to slide', 10, 40);

    // Draw grid border
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00ffff';
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(PAD_X - 3, PAD_Y - 3, SIZE * CELL + 6, SIZE * CELL + 6);
    ctx.shadowBlur = 0;

    // Draw tiles
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const val = grid[r][c];
        if (val === 0 && !(animating && emptyR === r && emptyC === c)) continue;

        let tx = PAD_X + c * CELL;
        let ty = PAD_Y + r * CELL;

        // Animation offset
        if (animating) {
          if (r === animR && c === animC) {
            // This tile is being animated
            tx += animDC * CELL * (animT / animDur);
            ty += animDR * CELL * (animT / animDur);
          }
        }

        // Color based on value
        const hue = ((val - 1) / 15) * 280;
        const tileColor = `hsl(${hue}, 80%, 30%)`;
        const borderColor = `hsl(${hue}, 90%, 60%)`;

        ctx.shadowBlur = 8;
        ctx.shadowColor = borderColor;
        ctx.fillStyle = tileColor;
        ctx.fillRect(tx + 2, ty + 2, CELL - 4, CELL - 4);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(tx + 2, ty + 2, CELL - 4, CELL - 4);
        ctx.shadowBlur = 0;

        // Number
        ctx.shadowBlur = 6;
        ctx.shadowColor = borderColor;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px "Courier New"';
        ctx.textAlign = 'center';
        ctx.fillText(val, tx + CELL / 2, ty + CELL / 2 + 10);
        ctx.textAlign = 'left';
        ctx.shadowBlur = 0;
      }
    }

    // Stats
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00ff88';
    ctx.fillStyle = '#00ff88';
    ctx.font = '14px "Courier New"';
    ctx.fillText('Moves: ' + moves, 10, H - 20);
    ctx.shadowColor = '#ffff00';
    ctx.fillStyle = '#ffff00';
    const elapsed = solved ? 0 : Math.floor((performance.now() - startTime) / 1000);
    ctx.fillText('Time: ' + formatTime(elapsed), 120, H - 20);
    ctx.shadowColor = '#ff00ff';
    ctx.fillStyle = '#ff00ff';
    ctx.fillText('Score: ' + score, 260, H - 20);
    ctx.shadowBlur = 0;

    // Win message
    if (solved) {
      ctx.shadowBlur = 25;
      ctx.shadowColor = '#00ff00';
      ctx.fillStyle = '#00ff00';
      ctx.font = 'bold 32px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText('SOLVED! 🎉', W / 2, PAD_Y - 15);
      ctx.font = '16px "Courier New"';
      ctx.fillStyle = '#ffff00';
      ctx.fillText(moves + ' moves in ' + formatTime(Math.floor((performance.now() - startTime) / 1000)), W / 2, PAD_Y + 5);
      if (nextTimer > 0) {
        const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.01);
        ctx.globalAlpha = pulse;
        ctx.font = 'bold 20px "Courier New"';
        ctx.fillStyle = '#ffd700';
        ctx.fillText('⭐ PUZZLE ' + level + ' NEXT...', W / 2, PAD_Y + 32);
        ctx.globalAlpha = 1;
      }
      ctx.textAlign = 'left';
      ctx.shadowBlur = 0;
    }
    // HUD: puzzle level badge (top-left)
    ctx.shadowColor = '#ffd700';
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 14px "Courier New"';
    ctx.fillText('PUZZLE ' + level, 14, 24);
    ctx.shadowBlur = 0;
  }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  function update(dt) {
    // chain countdown: after solving, briefly show banner then auto-next
    if (nextTimer > 0) {
      nextTimer -= dt;
      chainFlash = Math.max(0, chainFlash - dt);
      if (nextTimer <= 0) {
        nextTimer = 0;
        solved = false;
        moves = 0;
        startTime = performance.now();
        shufflePuzzle(500);
        if (typeof window.playSfx === 'function') { try { window.playSfx('launch'); } catch (e) {} }
      }
    }
    if (animating) {
      animT += dt;
      if (animT >= animDur) {
        animating = false;
        animT = 0;
        // Check if solved
        if (isSolved()) {
          solved = true;
          coins += Math.max(10, 100 - moves);
          const solveBonus = 200 + level * 50;
          score += solveBonus;
          onScore(score);
          if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate(100); } catch (e) {}
          }
          // ---- PUZZLE CHAIN: level up, then auto-next only after delay ----
          nextTimer = nextTimer || 0;
          if (!nextTimer) {
            nextTimer = 1.6; // delay before next puzzle
            level++;
            if (typeof window.playSfx === 'function') { try { window.playSfx('win'); } catch (e) {} }
          }
        } else {
          // game-over path (shouldn't normally happen; keep safe)
          if (!gameOverSent) {
            gameOverSent = true;
            over = true;
            if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
            if (typeof gameFX !== 'undefined') { try { var __r = canvas.getBoundingClientRect(); gameFX.burst(__r.left + (W/2) * __r.width / canvas.width, __r.top + (H/2) * __r.height / canvas.height, '#ff4444', 16); } catch(e){} gameFX.shake(5); }
            onGameOver(score, coins);
          }
        }
      }
    }

    // Keyboard input
    if (!animating && !solved) {
      if (keys['ArrowUp'] || keys['KeyW']) {
        keys['ArrowUp'] = false; keys['KeyW'] = false;
        // Slide tile from above into empty
        if (emptyR < SIZE - 1) trySlide(emptyR + 1, emptyC);
      }
      if (keys['ArrowDown'] || keys['KeyS']) {
        keys['ArrowDown'] = false; keys['KeyS'] = false;
        if (emptyR > 0) trySlide(emptyR - 1, emptyC);
      }
      if (keys['ArrowLeft'] || keys['KeyA']) {
        keys['ArrowLeft'] = false; keys['KeyA'] = false;
        if (emptyC < SIZE - 1) trySlide(emptyR, emptyC + 1);
      }
      if (keys['ArrowRight'] || keys['KeyD']) {
        keys['ArrowRight'] = false; keys['KeyD'] = false;
        if (emptyC > 0) trySlide(emptyR, emptyC - 1);
      }
      if (touches.left) {
        touches.left = false;
        if (emptyC < SIZE - 1) trySlide(emptyR, emptyC + 1);
      }
      if (touches.right) {
        touches.right = false;
        if (emptyC > 0) trySlide(emptyR, emptyC - 1);
      }
      if (touches.up) {
        touches.up = false;
        if (emptyR < SIZE - 1) trySlide(emptyR + 1, emptyC);
      }
      if (touches.down) {
        touches.down = false;
        if (emptyR > 0) trySlide(emptyR - 1, emptyC);
      }
    }
  }

  function handleClick(mx, my) {
    if (animating || solved) return;
    const c = Math.floor((mx - PAD_X) / CELL);
    const r = Math.floor((my - PAD_Y) / CELL);
    if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) {
      trySlide(r, c);
    }
  }

  // Simple event tracking for mouse position
  let listeners = [];

  function loop(ts) {
    if (!running) return;
    const dt = Math.min((ts - last) / 1000, 0.05);
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
  function destroy() {
    running = false;
    cancelAnimationFrame(raf);
    for (const l of listeners) {
      canvas.removeEventListener(l.type, l.fn);
    }
    listeners = [];
  }

  function addListener(type, fn) {
    canvas.addEventListener(type, fn);
    listeners.push({ type: type, fn: fn });
  }

  // Set up click/tap handling on canvas
  addListener('click', function(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    handleClick(mx, my);
  });

  addListener('touchstart', function(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const touch = e.touches[0];
    const mx = (touch.clientX - rect.left) * scaleX;
    const my = (touch.clientY - rect.top) * scaleY;
    handleClick(mx, my);
  }, { passive: false });

  return {
    start: start,
    pause: pause,
    resume: resume,
    destroy: destroy,
    setInput: function(t, k) { touches = t || {}; keys = k || {}; },
    setDifficulty: function(lvl){ diffMul = [1,1.15,1.3,1.5,1.75,2][Math.min(5,Math.floor(lvl)||0)]||1; }
  };
}
