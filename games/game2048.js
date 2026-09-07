/* ============================================================
   2048 — Neon Tile Merging Puzzle
   Canvas 800x450, 4x4 grid, swipe/arrow to merge tiles
   Merge 2+2=4, 4+4=8... up to 2048
   ============================================================ */
function game2048(canvas, ctx, onScore, onGameOver, onCoins) {
  // ---- state ----
  const W = 800, H = 450;
  let raf = null, last = 0, running = false;
  let score = 0, coins = 0;
  let over = false;

  const SIZE = 4;
  const GRID_PAD = 20;
  const GRID_TOP = 50;
  const cellW = (W - GRID_PAD * 2) / SIZE;
  const cellH = (H - GRID_TOP - GRID_PAD) / SIZE;

  let grid = [];
  let prevGrid = null;
  let prevScore = 0;

  // tile color map by value
  const TILE_COLORS = {
    2:    { bg: '#1a1a3e', fg: '#00FFFF', glow: 10 },
    4:    { bg: '#1a2a4e', fg: '#00E5FF', glow: 12 },
    8:    { bg: '#2a1a3e', fg: '#FF10F0', glow: 14 },
    16:   { bg: '#3a1a2e', fg: '#FF44AA', glow: 14 },
    32:   { bg: '#3e2a1a', fg: '#FFE600', glow: 16 },
    64:   { bg: '#3e1a1a', fg: '#FF6600', glow: 16 },
    128:  { bg: '#1a3e2a', fg: '#39FF88', glow: 18 },
    256:  { bg: '#2a2a4e', fg: '#8888FF', glow: 18 },
    512:  { bg: '#4e2a3a', fg: '#FF88FF', glow: 20 },
    1024: { bg: '#3e3e1a', fg: '#FFD700', glow: 22 },
    2048: { bg: '#1a3e3e', fg: '#00FFFF', glow: 28 }
  };
  const DEFAULT_COLOR = { bg: '#2a1a4a', fg: '#FFFFFF', glow: 24 };

  // input
  let touches = { left: false, right: false, up: false, down: false, action: false };
  let keys = {};

  // tile animations
  let animations = [];
  let confettiParticles = [];

  // ---- helpers ----
  function rect(x, y, w, h, color, glow) {
    ctx.shadowBlur = glow || 12;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
  }

  function circle(x, y, r, color, glow) {
    ctx.shadowBlur = glow || 14;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function emptyGrid() {
    const g = [];
    for (let r = 0; r < SIZE; r++) {
      g[r] = [];
      for (let c = 0; c < SIZE; c++) {
        g[r][c] = 0;
      }
    }
    return g;
  }

  function cloneGrid(g) {
    return g.map(row => row.slice());
  }

  function emptyCells() {
    const cells = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) cells.push({ r, c });
      }
    }
    return cells;
  }

  function addRandomTile() {
    const cells = emptyCells();
    if (cells.length === 0) return;
    const cell = cells[Math.floor(Math.random() * cells.length)];
    grid[cell.r][cell.c] = Math.random() < 0.9 ? 2 : 4;
    animations.push({ r: cell.r, c: cell.c, type: 'spawn', time: 0, duration: 0.2 });
  }

  function hasMoves() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) return true;
        if (c < SIZE - 1 && grid[r][c] === grid[r][c + 1]) return true;
        if (r < SIZE - 1 && grid[r][c] === grid[r + 1][c]) return true;
      }
    }
    return false;
  }

  function reset() {
    score = 0; coins = 0; over = false;
    grid = emptyGrid();
    prevGrid = null;
    prevScore = 0;
    animations = [];
    confettiParticles = [];
    addRandomTile();
    addRandomTile();
  }

  // ---- slide logic ----
  function slideRow(row) {
    // remove zeros, merge, pad
    let filtered = row.filter(v => v !== 0);
    let merged = [];
    let mergeScore = 0;
    let i = 0;
    while (i < filtered.length) {
      if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
        const val = filtered[i] * 2;
        merged.push(val);
        mergeScore += val;
        i += 2;
      } else {
        merged.push(filtered[i]);
        i++;
      }
    }
    while (merged.length < SIZE) merged.push(0);
    return { row: merged, score: mergeScore };
  }

  function move(dir) {
    if (over) return;

    prevGrid = cloneGrid(grid);
    prevScore = score;

    let moved = false;
    let totalScore = 0;

    if (dir === 'left') {
      for (let r = 0; r < SIZE; r++) {
        const result = slideRow(grid[r]);
        if (grid[r].join(',') !== result.row.join(',')) moved = true;
        grid[r] = result.row;
        totalScore += result.score;
      }
    } else if (dir === 'right') {
      for (let r = 0; r < SIZE; r++) {
        const reversed = grid[r].slice().reverse();
        const result = slideRow(reversed);
        const newRow = result.row.slice().reverse();
        if (grid[r].join(',') !== newRow.join(',')) moved = true;
        grid[r] = newRow;
        totalScore += result.score;
      }
    } else if (dir === 'up') {
      for (let c = 0; c < SIZE; c++) {
        const col = [];
        for (let r = 0; r < SIZE; r++) col.push(grid[r][c]);
        const result = slideRow(col);
        if (col.join(',') !== result.row.join(',')) moved = true;
        for (let r = 0; r < SIZE; r++) grid[r][c] = result.row[r];
        totalScore += result.score;
      }
    } else if (dir === 'down') {
      for (let c = 0; c < SIZE; c++) {
        const col = [];
        for (let r = 0; r < SIZE; r++) col.push(grid[r][c]);
        const reversed = col.reverse();
        const result = slideRow(reversed);
        const newCol = result.row.slice().reverse();
        if (col.join(',') !== newCol.join(',')) moved = true;
        for (let r = 0; r < SIZE; r++) grid[r][c] = newCol[r];
        totalScore += result.score;
      }
    }

    if (moved) {
      score += totalScore;
      onScore(score);
      if (totalScore > 0) {
        coins += Math.floor(totalScore / 100);
        onCoins(Math.floor(totalScore / 100));
      }
      addRandomTile();
      if (!hasMoves()) {
        gameOver();
      }
    } else {
      prevGrid = null;
    }
  }

  function undo() {
    if (prevGrid) {
      grid = prevGrid;
      score = prevScore;
      prevGrid = null;
      onScore(score);
    }
  }

  // ---- input processing ----
  let inputTimer = 0;
  const INPUT_DELAY = 0.15;
  let lastDir = null;

  // touch tracking
  let touchStartX = 0, touchStartY = 0;
  let touchActive = false;

  // ---- update ----
  function update(dt) {
    if (over || !running) return;

    // update animations
    for (let i = animations.length - 1; i >= 0; i--) {
      animations[i].time += dt;
      if (animations[i].time >= animations[i].duration) {
        animations.splice(i, 1);
      }
    }

    // update confetti
    for (let i = confettiParticles.length - 1; i >= 0; i--) {
      const p = confettiParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt;
      p.life -= dt;
      if (p.life <= 0) confettiParticles.splice(i, 1);
    }

    // process keyboard input with cooldown
    inputTimer -= dt;
    if (inputTimer <= 0) {
      if (keys.ArrowLeft || keys.KeyA) {
        move('left');
        inputTimer = INPUT_DELAY;
      } else if (keys.ArrowRight || keys.KeyD) {
        move('right');
        inputTimer = INPUT_DELAY;
      } else if (keys.ArrowUp || keys.KeyW) {
        move('up');
        inputTimer = INPUT_DELAY;
      } else if (keys.ArrowDown || keys.KeyS) {
        move('down');
        inputTimer = INPUT_DELAY;
      } else if (touches.left) {
        move('left');
        inputTimer = INPUT_DELAY;
      } else if (touches.right) {
        move('right');
        inputTimer = INPUT_DELAY;
      } else if (touches.up) {
        move('up');
        inputTimer = INPUT_DELAY;
      } else if (touches.down) {
        move('down');
        inputTimer = INPUT_DELAY;
      }
    }

    // action key = undo
    if (touches.action || keys.KeyZ || keys.KeyU) {
      undo();
      touches.action = false;
      keys.KeyZ = false;
      keys.KeyU = false;
    }
  }

  // ---- render ----
  function render() {
    // bg
    ctx.fillStyle = '#05070A';
    ctx.fillRect(0, 0, W, H);

    // title
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#00FFFF';
    ctx.fillStyle = '#00FFFF';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('2048', W / 2, 36);
    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;

    // score display
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#FFE600';
    ctx.fillStyle = '#FFE600';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('SCORE: ' + score, W - 180, 36);
    ctx.shadowBlur = 0;

    // grid background
    ctx.shadowBlur = 16;
    ctx.shadowColor = '#00FFFF';
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(GRID_PAD - 6, GRID_TOP - 6, cellW * SIZE + 12, cellH * SIZE + 12);
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(GRID_PAD - 6, GRID_TOP - 6, cellW * SIZE + 12, cellH * SIZE + 12);
    ctx.shadowBlur = 0;

    // draw grid lines
    ctx.strokeStyle = 'rgba(0,255,255,0.15)';
    ctx.lineWidth = 1;
    for (let i = 1; i < SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(GRID_PAD + i * cellW, GRID_TOP);
      ctx.lineTo(GRID_PAD + i * cellW, GRID_TOP + cellH * SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(GRID_PAD, GRID_TOP + i * cellH);
      ctx.lineTo(GRID_PAD + cellW * SIZE, GRID_TOP + i * cellH);
      ctx.stroke();
    }

    // draw tiles
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const val = grid[r][c];
        if (val === 0) continue;

        const x = GRID_PAD + c * cellW;
        const y = GRID_TOP + r * cellH;
        const tileColor = TILE_COLORS[val] || DEFAULT_COLOR;

        // check spawn animation
        let scale = 1;
        const anim = animations.find(a => a.r === r && a.c === c && a.type === 'spawn');
        if (anim) {
          scale = anim.time / anim.duration;
          scale = Math.min(1, scale);
        }

        const pad = 4;
        const tw = (cellW - pad * 2) * scale;
        const th = (cellH - pad * 2) * scale;
        const tx = x + cellW / 2 - tw / 2;
        const ty = y + cellH / 2 - th / 2;

        // tile bg
        ctx.shadowBlur = tileColor.glow;
        ctx.shadowColor = tileColor.fg;
        ctx.fillStyle = tileColor.bg;
        ctx.beginPath();
        ctx.roundRect(tx, ty, tw, th, 6);
        ctx.fill();

        // tile border
        ctx.strokeStyle = tileColor.fg;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(tx, ty, tw, th, 6);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // tile text
        if (scale > 0.5) {
          const fontSize = val >= 1024 ? 20 : val >= 128 ? 26 : 32;
          ctx.shadowBlur = 12;
          ctx.shadowColor = tileColor.fg;
          ctx.fillStyle = tileColor.fg;
          ctx.font = 'bold ' + fontSize + 'px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(val.toString(), x + cellW / 2, y + cellH / 2);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
          ctx.shadowBlur = 0;
        }
      }
    }

    // confetti particles
    for (const p of confettiParticles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // hint
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#FF10F0';
    ctx.fillStyle = 'rgba(255,16,240,0.5)';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ARROWS/SWIPE: Merge | ACTION: Undo', W / 2, H - 10);
    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;

    // game over overlay
    if (over) {
      ctx.fillStyle = 'rgba(5,7,10,0.85)';
      ctx.fillRect(0, 0, W, H);
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#FF10F0';
      ctx.fillStyle = '#FF10F0';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 30);
      ctx.shadowColor = '#00FFFF';
      ctx.fillStyle = '#00FFFF';
      ctx.font = '18px monospace';
      ctx.fillText('SCORE: ' + score, W / 2, H / 2 + 10);
      ctx.fillText('COINS: ' + coins, W / 2, H / 2 + 38);
      ctx.textAlign = 'left';
      ctx.shadowBlur = 0;
    }
  }

  function loop(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    update(dt);
    render();
    raf = requestAnimationFrame(loop);
  }

  function gameOver() {
    over = true;
    running = false;
    if (raf) cancelAnimationFrame(raf);
    if (navigator.vibrate) { try { navigator.vibrate(200); } catch (e) {} }
    onGameOver(Math.floor(score), coins);
  }

  // ---- public API ----
  return {
    start() {
      reset();
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    update() {/* handled internally */},
    render() { render(); },
    pause() { running = false; if (raf) cancelAnimationFrame(raf); },
    resume() { if (over || running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); },
    destroy() { running = false; if (raf) cancelAnimationFrame(raf); },
    setInput(t, k) { touches = t || {}; keys = k || {}; },
    controls: { joystick: false, boost: false, action: true, drift: false }
  };
}
