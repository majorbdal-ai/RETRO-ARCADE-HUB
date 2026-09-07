function mineSweeper(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  let keys = {}, touches = {};
  let gameOverSent = false;
  const ROWS = 9, COLS = 9, MINES = 10;
  const CELL = 40, PAD_X = (W - COLS * CELL) / 2, PAD_Y = (H - ROWS * CELL) / 2 + 10;
  let grid = [], revealed = [], flagged = [], gameOver = false, gameWon = false;
  let firstClick = true, flagCount = 0;
  let mouseX = -1, mouseY = -1, mouseDown = false;
  let holdTimer = 0, holdThreshold = 0.4, isHolding = false;

  function reset() {
    over = false; gameOverSent = false; score = 0; coins = 0;
    gameOver = false; gameWon = false; firstClick = true; flagCount = 0;
    holdTimer = 0; isHolding = false;
    // Init empty grid
    grid = [];
    revealed = [];
    flagged = [];
    for (let r = 0; r < ROWS; r++) {
      grid[r] = [];
      revealed[r] = [];
      flagged[r] = [];
      for (let c = 0; c < COLS; c++) {
        grid[r][c] = 0;
        revealed[r][c] = false;
        flagged[r][c] = false;
      }
    }
  }

  function placeMines(safeR, safeC) {
    let placed = 0;
    while (placed < MINES) {
      const r = Math.floor(Math.random() * ROWS);
      const c = Math.floor(Math.random() * COLS);
      // Keep safe zone around first click
      if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;
      if (grid[r][c] === -1) continue;
      grid[r][c] = -1;
      placed++;
    }
    // Calculate numbers
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] === -1) continue;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && grid[nr][nc] === -1) count++;
          }
        }
        grid[r][c] = count;
      }
    }
  }

  function countAdjacentFlags(r, c) {
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && flagged[nr][nc]) count++;
      }
    }
    return count;
  }

  function revealCell(r, c) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
    if (revealed[r][c] || flagged[r][c]) return;
    revealed[r][c] = true;
    score++;
    onScore(score);

    if (grid[r][c] === 0) {
      // Flood fill
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          revealCell(r + dr, c + dc);
        }
      }
    }
  }

  function revealAll() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        revealed[r][c] = true;
      }
    }
  }

  function checkWin() {
    let safeCells = 0, revealedSafe = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] !== -1) {
          safeCells++;
          if (revealed[r][c]) revealedSafe++;
        }
      }
    }
    return safeCells === revealedSafe;
  }

  function flagCell(r, c) {
    if (revealed[r][c]) return;
    flagged[r][c] = !flagged[r][c];
    flagCount += flagged[r][c] ? 1 : -1;
    score = Math.max(0, score);
    onScore(score);
  }

  function handleClick(r, c) {
    if (gameOver || gameWon) return;
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;

    if (flagged[r][c]) return;

    if (firstClick) {
      firstClick = false;
      placeMines(r, c);
    }

    if (grid[r][c] === -1) {
      // Hit a mine
      gameOver = true;
      revealAll();
      if (!gameOverSent) {
        gameOverSent = true;
        over = true;
        onGameOver(score, coins);
      }
      return;
    }

    revealCell(r, c);

    if (checkWin()) {
      gameWon = true;
      coins += 50;
      score += MINES * 5;
      onScore(score);
      revealAll();
      if (!gameOverSent) {
        gameOverSent = true;
        over = true;
        onGameOver(score, coins);
      }
    }
  }

  const NUM_COLORS = ['#000000', '#0066ff', '#00cc00', '#ff0044', '#6600cc', '#cc6600', '#00cccc', '#333333'];

  function draw() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    // Grid
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = PAD_X + c * CELL;
        const y = PAD_Y + r * CELL;

        if (revealed[r][c]) {
          if (grid[r][c] === -1) {
            // Mine
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#ff0044';
            ctx.fillStyle = '#330011';
            ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
            ctx.fillStyle = '#ff0044';
            ctx.font = '20px "Courier New"';
            ctx.fillText('💣', x + CELL / 2 - 10, y + CELL / 2 + 7);
            ctx.shadowBlur = 0;
          } else {
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#111133';
            ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
            if (grid[r][c] > 0) {
              ctx.shadowBlur = 8;
              ctx.shadowColor = NUM_COLORS[grid[r][c]] || '#fff';
              ctx.fillStyle = NUM_COLORS[grid[r][c]] || '#fff';
              ctx.font = 'bold 20px "Courier New"';
              ctx.textAlign = 'center';
              ctx.fillText(grid[r][c], x + CELL / 2, y + CELL / 2 + 7);
              ctx.textAlign = 'left';
              ctx.shadowBlur = 0;
            }
          }
        } else {
          // Unrevealed
          const isHover = mouseX >= x && mouseX < x + CELL && mouseY >= y && mouseY < y + CELL;
          ctx.shadowBlur = isHover ? 8 : 0;
          ctx.shadowColor = '#00ffff';
          ctx.fillStyle = flagged[r][c] ? '#220033' : (isHover ? '#1a1a3a' : '#111128');
          ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
          ctx.strokeStyle = '#333355';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
          ctx.shadowBlur = 0;

          if (flagged[r][c]) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ff00ff';
            ctx.fillStyle = '#ff00ff';
            ctx.font = '18px "Courier New"';
            ctx.textAlign = 'center';
            ctx.fillText('🚩', x + CELL / 2, y + CELL / 2 + 6);
            ctx.textAlign = 'left';
            ctx.shadowBlur = 0;
          }
        }
      }
    }

    // UI
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ff00ff';
    ctx.fillStyle = '#ff00ff';
    ctx.font = '18px "Courier New", monospace';
    ctx.fillText('MINE SWEEPER', 10, 22);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#666688';
    ctx.font = '11px "Courier New", monospace';
    ctx.fillText('Tap=reveal, Hold=flag | 9×9 grid, 10 mines', 10, 40);

    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff0044';
    ctx.fillStyle = '#ff0044';
    ctx.font = '14px "Courier New"';
    ctx.fillText('💣 ' + (MINES - flagCount), PAD_X + COLS * CELL + 15, PAD_Y + 30);
    ctx.shadowColor = '#00ff88';
    ctx.fillStyle = '#00ff88';
    ctx.fillText('✓ ' + score, PAD_X + COLS * CELL + 15, PAD_Y + 55);
    ctx.shadowBlur = 0;

    if (gameWon) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#00ff00';
      ctx.fillStyle = '#00ff00';
      ctx.font = 'bold 28px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText('YOU WIN!', W / 2, PAD_Y - 10);
      ctx.textAlign = 'left';
      ctx.shadowBlur = 0;
    }
  }

  function getGridPos(mx, my) {
    const c = Math.floor((mx - PAD_X) / CELL);
    const r = Math.floor((my - PAD_Y) / CELL);
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) return { r: r, c: c };
    return null;
  }

  function update(dt) {
    // Hold timer for flagging
    if (mouseDown) {
      holdTimer += dt;
    } else {
      if (holdTimer > 0 && holdTimer < holdThreshold) {
        // Short tap = reveal
        const pos = getGridPos(mouseX, mouseY);
        if (pos) handleClick(pos.r, pos.c);
      }
      holdTimer = 0;
    }
  }

  function loop(ts) {
    if (!running) return;
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    update(dt);
    draw();
    if (!over) raf = requestAnimationFrame(loop);
  }

  // Track mouse position for hover and click
  function handlePointerMove(x, y) {
    mouseX = x;
    mouseY = y;
  }

  function handlePointerDown(x, y) {
    mouseX = x; mouseY = y;
    mouseDown = true;
    holdTimer = 0;
  }

  function handlePointerUp(x, y) {
    mouseX = x; mouseY = y;
    if (holdTimer >= holdThreshold) {
      // Long press = flag
      const pos = getGridPos(x, y);
      if (pos) flagCell(pos.r, pos.c);
    }
    // Short tap handled in update
    mouseDown = false;
  }

  // Map touch/mouse position from touches
  function processInput() {
    if (touches.action || keys['Space']) {
      touches.action = false; keys['Space'] = false;
      const pos = getGridPos(W / 2, H / 2);
      if (pos) handleClick(pos.r, pos.c);
    }
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
  function destroy() { running = false; cancelAnimationFrame(raf); }

  return {
    start: start,
    pause: pause,
    resume: resume,
    destroy: destroy,
    setInput: function(t, k) { touches = t || {}; keys = k || {}; }
  };
}
