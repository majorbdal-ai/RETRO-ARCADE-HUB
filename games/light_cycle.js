/* ============================================================
   Light Cycle — Tron Grid Duel
   Canvas 800x450, 20x12 grid
   Player cyan cycle, AI pink cycle
   Turn with arrows/swipe, leave glowing trails
   Hit trail/wall = lose. First survivor wins.
   ============================================================ */
function lightCycle(canvas, ctx, onScore, onGameOver, onCoins) {
  // ---- state ----
  const W = 800, H = 450;
  let raf = null, last = 0, running = false;
  let score = 0, coins = 0;
  let over = false;

  // grid
  const GRID_COLS = 20;
  const GRID_ROWS = 12;
  const CELL_W = W / GRID_COLS;
  const CELL_H = (H - 40) / GRID_ROWS; // leave 40px for HUD at top
  const OFFSET_Y = 40;

  // cycles
  const CYAN = { col: 5, row: 6, dir: 'right', trail: [], color: '#00FFFF', glow: 14, alive: true };
  const PINK = { col: 14, row: 5, dir: 'left', trail: [], color: '#FF10F0', glow: 14, alive: true, aiTimer: 0, aiTurn: null };

  let playerWins = 0;
  let aiWins = 0;
  let roundActive = false;
  let roundDelay = 0;
  let gameTime = 0;
  let lastTurnTime = 0;
  const TURN_COOLDOWN = 0.08;

  // grid occupied cells: { col, row, color }
  let grid = [];

  // input
  let touches = { left: false, right: false, up: false, down: false };
  let keys = {};
  let pendingTurn = null;

  // ---- helpers ----
  function cellKey(c, r) { return c + ',' + r; }

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

  function resetGrid() {
    grid = [];
  }

  function setCell(c, r, color) {
    grid[cellKey(c, r)] = color;
  }

  function getCell(c, r) {
    return grid[cellKey(c, r)] || null;
  }

  function cycleCenter(cycle) {
    return {
      x: cycle.col * CELL_W + CELL_W / 2,
      y: cycle.row * CELL_H + OFFSET_Y + CELL_H / 2
    };
  }

  function resetRound() {
    CYAN.col = 3; CYAN.row = 5; CYAN.dir = 'right';
    CYAN.trail = [{ col: CYAN.col, row: CYAN.row }];
    CYAN.alive = true;

    PINK.col = 16; PINK.row = 6; PINK.dir = 'left';
    PINK.trail = [{ col: PINK.col, row: PINK.row }];
    PINK.alive = true;
    PINK.aiTimer = 0;
    PINK.aiTurn = null;

    resetGrid();
    setCell(CYAN.col, CYAN.row, CYAN.color);
    setCell(PINK.col, PINK.row, PINK.color);

    pendingTurn = null;
    roundActive = true;
  }

  function reset() {
    score = 0; coins = 0; over = false;
    gameTime = 0;
    playerWins = 0; aiWins = 0;
    roundDelay = 1.5;
    roundActive = false;
    resetRound();
  }

  // ---- direction vectors ----
  const DIRS = {
    right: { dc: 1, dr: 0 },
    left: { dc: -1, dr: 0 },
    up: { dc: 0, dr: -1 },
    down: { dc: 0, dr: 1 }
  };

  const OPPOSITE = { right: 'left', left: 'right', up: 'down', down: 'up' };

  function turnCycle(cycle, newDir) {
    if (!cycle.alive) return;
    if (OPPOSITE[newDir] === cycle.dir) return; // can't reverse
    cycle.dir = newDir;
  }

  function moveCycle(cycle) {
    if (!cycle.alive) return;
    const d = DIRS[cycle.dir];
    const nc = cycle.col + d.dc;
    const nr = cycle.row + d.dr;

    // wall collision
    if (nc < 0 || nc >= GRID_COLS || nr < 0 || nr >= GRID_ROWS) {
      cycle.alive = false;
      return;
    }

    // trail/self collision
    if (getCell(nc, nr)) {
      cycle.alive = false;
      return;
    }

    cycle.col = nc;
    cycle.row = nr;
    cycle.trail.push({ col: nc, row: nr });
    setCell(nc, nr, cycle.color);
  }

  // ---- AI ----
  function aiTurn(cycle) {
    const d = DIRS[cycle.dir];
    const nc = cycle.col + d.dc;
    const nr = cycle.row + d.dr;

    // check if current direction is safe
    const aheadSafe = nc >= 0 && nc < GRID_COLS && nr >= 0 && nr < GRID_ROWS && !getCell(nc, nr);

    if (aheadSafe && Math.random() < 0.85) return; // keep going most of the time

    // find safe turns
    const options = [];
    for (const dirName of ['right', 'left', 'up', 'down']) {
      if (dirName === OPPOSITE[cycle.dir]) continue;
      const dd = DIRS[dirName];
      const tc = cycle.col + dd.dc;
      const tr = cycle.row + dd.dr;
      if (tc >= 0 && tc < GRID_COLS && tr >= 0 && tr < GRID_ROWS && !getCell(tc, tr)) {
        // prefer directions with more open space
        let space = 0;
        let sc = tc, sr = tr;
        for (let i = 0; i < 6; i++) {
          const snc = sc + dd.dc;
          const snr = sr + dd.dr;
          if (snc >= 0 && snc < GRID_COLS && snr >= 0 && snr < GRID_ROWS && !getCell(snc, snr)) {
            space++;
            sc = snc;
            sr = snr;
          } else break;
        }
        options.push({ dir: dirName, space: space });
      }
    }

    if (options.length > 0) {
      // sort by space, pick best
      options.sort((a, b) => b.space - a.space);
      // slight randomness
      const pick = options[Math.floor(Math.random() * Math.min(2, options.length))];
      turnCycle(cycle, pick.dir);
    }
  }

  // ---- update ----
  function update(dt) {
    if (over || !running) return;

    gameTime += dt;

    // round delay
    if (!roundActive) {
      roundDelay -= dt;
      if (roundDelay <= 0) {
        resetRound();
      }
      return;
    }

    // player turn input
    if (lastTurnTime > 0) lastTurnTime -= dt;
    if (lastTurnTime <= 0) {
      if (keys.ArrowRight || touches.left === 'right') {
        turnCycle(CYAN, 'right');
        lastTurnTime = TURN_COOLDOWN;
      } else if (keys.ArrowLeft || touches.left === 'left') {
        turnCycle(CYAN, 'left');
        lastTurnTime = TURN_COOLDOWN;
      } else if (keys.ArrowUp || touches.left === 'up') {
        turnCycle(CYAN, 'up');
        lastTurnTime = TURN_COOLDOWN;
      } else if (keys.ArrowDown || touches.left === 'down') {
        turnCycle(CYAN, 'down');
        lastTurnTime = TURN_COOLDOWN;
      }
    }

    // handle swipe-based turns from touches (the core sends directional booleans)
    // Map: touches.left=true means user swiped/tapped left direction
    // We detect direction based on which touch is active
    // The wrapper sets: touches.left = swipeLeft OR touch on left side
    // For proper direction from joystick-style input, we detect from keys

    // AI turn
    PINK.aiTimer += dt;
    if (PINK.aiTimer > 0.15) {
      PINK.aiTimer = 0;
      aiTurn(PINK);
    }

    // move both cycles
    moveCycle(CYAN);
    moveCycle(PINK);

    // check if they collide with each other simultaneously
    if (CYAN.col === PINK.col && CYAN.row === PINK.row) {
      CYAN.alive = false;
      PINK.alive = false;
    }

    // check outcomes
    if (!CYAN.alive && !PINK.alive) {
      // draw - both lose, no winner
      roundActive = false;
      roundDelay = 2.0;
      aiWins++; // slight AI advantage on draw
    } else if (!CYAN.alive) {
      // player lost this round
      aiWins++;
      roundActive = false;
      roundDelay = 2.0;
      if (aiWins >= 3) {
        gameOver();
        return;
      }
    } else if (!PINK.alive) {
      // player won this round
      playerWins++;
      score += 200;
      onScore(score);
      coins += 5;
      onCoins(5);
      roundActive = false;
      roundDelay = 2.0;
      if (playerWins >= 3) {
        // player wins match!
        score += 500;
        onScore(score);
        gameOver();
        return;
      }
    }

    // score = seconds survived * 10
    score = Math.floor(gameTime * 10) + (playerWins * 200);
    onScore(score);
  }

  // ---- render ----
  function render() {
    // bg
    ctx.fillStyle = '#05070A';
    ctx.fillRect(0, 0, W, H);

    // grid background
    ctx.fillStyle = '#080C16';
    ctx.fillRect(0, OFFSET_Y, W, H - OFFSET_Y);

    // grid lines
    ctx.strokeStyle = 'rgba(0,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= GRID_COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL_W, OFFSET_Y);
      ctx.lineTo(c * CELL_W, H);
      ctx.stroke();
    }
    for (let r = 0; r <= GRID_ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL_H + OFFSET_Y);
      ctx.lineTo(W, r * CELL_H + OFFSET_Y);
      ctx.stroke();
    }

    // outer border glow
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00FFFF';
    ctx.strokeRect(1, OFFSET_Y, W - 2, H - OFFSET_Y - 1);
    ctx.shadowBlur = 0;

    // draw trails
    for (const key in grid) {
      const color = grid[key];
      const parts = key.split(',');
      const c = parseInt(parts[0]);
      const r = parseInt(parts[1]);
      const x = c * CELL_W + 2;
      const y = r * CELL_H + OFFSET_Y + 2;
      const w = CELL_W - 4;
      const h = CELL_H - 4;
      ctx.shadowBlur = 8;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    // draw cycles (heads) - brighter than trails
    if (CYAN.alive && roundActive) {
      const cc = cycleCenter(CYAN);
      circle(cc.x, cc.y, Math.min(CELL_W, CELL_H) / 2 - 2, '#00FFFF', 20);
      // inner bright
      circle(cc.x, cc.y, Math.min(CELL_W, CELL_H) / 4, '#FFFFFF', 10);
    }
    if (PINK.alive && roundActive) {
      const pc = cycleCenter(PINK);
      circle(pc.x, pc.y, Math.min(CELL_W, CELL_H) / 2 - 2, '#FF10F0', 20);
      circle(pc.x, pc.y, Math.min(CELL_W, CELL_H) / 4, '#FFFFFF', 10);
    }

    // HUD
    ctx.shadowBlur = 10;

    // Player (cyan) label
    ctx.shadowColor = '#00FFFF';
    ctx.fillStyle = '#00FFFF';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('YOU', 20, 26);

    // AI (pink) label
    ctx.shadowColor = '#FF10F0';
    ctx.fillStyle = '#FF10F0';
    ctx.fillText('CPU', W - 70, 26);

    // Wins display
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#00FFFF';
    ctx.fillStyle = '#00FFFF';
    ctx.font = '14px monospace';
    ctx.fillText('WINS: ' + playerWins + '/3', 80, 26);

    ctx.shadowColor = '#FF10F0';
    ctx.fillStyle = '#FF10F0';
    ctx.fillText('WINS: ' + aiWins + '/3', W - 180, 26);

    // Timer
    ctx.shadowColor = '#FFE600';
    ctx.fillStyle = '#FFE600';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(Math.floor(gameTime) + 's', W / 2, 26);
    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;

    // round status
    if (!roundActive && !over) {
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#FFE600';
      ctx.fillStyle = '#FFE600';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      if (playerWins >= 3) {
        ctx.fillText('VICTORY!', W / 2, H / 2);
      } else if (aiWins >= 3) {
        ctx.fillText('DEFEATED!', W / 2, H / 2);
      } else {
        ctx.fillText('ROUND ' + (playerWins + aiWins + 1), W / 2, H / 2);
      }
      ctx.textAlign = 'left';
      ctx.shadowBlur = 0;
    }

    // game over overlay
    if (over) {
      ctx.fillStyle = 'rgba(5,7,10,0.85)';
      ctx.fillRect(0, 0, W, H);
      ctx.shadowBlur = 20;
      ctx.shadowColor = playerWins >= 3 ? '#39FF88' : '#FF10F0';
      ctx.fillStyle = playerWins >= 3 ? '#39FF88' : '#FF10F0';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(playerWins >= 3 ? 'YOU WIN!' : 'GAME OVER', W / 2, H / 2 - 30);
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
    controls: { joystick: false, boost: false, action: false, drift: false }
  };
}
