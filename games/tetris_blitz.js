/* ============================================================
   Tetris Blitz — Neon Tetris Arcade Game
   Canvas 800x450, 10x20 grid, standard 7 tetrominoes
   Swipe L/R move, tap/action rotate, swipe down hard drop
   ============================================================ */
function tetrisBlitz(canvas, ctx, onScore, onGameOver, onCoins) {
  // ---- state ----
  const W = 800, H = 450;
  let raf = null, last = 0, running = false;
  let score = 0, coins = 0;
  let over = false;

  // grid
  const COLS = 10, ROWS = 20;
  const CELL = 22;
  const GRID_W = COLS * CELL;
  const GRID_H = ROWS * CELL;
  const GRID_X = (W - GRID_W) / 2;
  const GRID_Y = (H - GRID_H) / 2;

  // tetrominos (standard 7, each is array of rotations, each rotation is array of [row, col] offsets)
  const TETROMINOS = {
    I: { color: '#00FFFF', shapes: [[[0,0],[0,1],[0,2],[0,3]],[[0,0],[1,0],[2,0],[3,0]],[[0,0],[0,1],[0,2],[0,3]],[[0,0],[1,0],[2,0],[3,0]]] },
    O: { color: '#FFE600', shapes: [[[0,0],[0,1],[1,0],[1,1]],[[0,0],[0,1],[1,0],[1,1]],[[0,0],[0,1],[1,0],[1,1]],[[0,0],[0,1],[1,0],[1,1]]] },
    T: { color: '#CC88FF', shapes: [[[0,1],[1,0],[1,1],[1,2]],[[0,0],[1,0],[1,1],[2,0]],[[0,0],[0,1],[0,2],[1,1]],[[0,1],[1,0],[1,1],[2,1]]] },
    S: { color: '#39FF88', shapes: [[[0,1],[0,2],[1,0],[1,1]],[[0,0],[1,0],[1,1],[2,1]],[[0,1],[0,2],[1,0],[1,1]],[[0,0],[1,0],[1,1],[2,1]]] },
    Z: { color: '#FF4444', shapes: [[[0,0],[0,1],[1,1],[1,2]],[[0,1],[1,0],[1,1],[2,0]],[[0,0],[0,1],[1,1],[1,2]],[[0,1],[1,0],[1,1],[2,0]]] },
    J: { color: '#4488FF', shapes: [[[0,0],[1,0],[1,1],[1,2]],[[0,0],[0,1],[1,0],[2,0]],[[0,0],[0,1],[0,2],[1,2]],[[0,0],[1,0],[2,0],[2,-1]]] },
    L: { color: '#FF8800', shapes: [[[0,2],[1,0],[1,1],[1,2]],[[0,0],[1,0],[2,0],[2,1]],[[0,0],[0,1],[0,2],[1,0]],[[0,0],[0,1],[1,1],[2,1]]] }
  };
  const PIECE_NAMES = ['I','O','T','S','Z','J','L'];

  // game state
  let grid = []; // ROWS x COLS, null or color string
  let current = null; // { type, rotation, row, col }
  let nextPiece = null;
  let fallTimer = 0;
  let fallInterval = 0.8; // seconds per fall
  let level = 1;
  let linesCleared = 0;
  let lineClearAnim = 0; // rows being cleared (for flash)
  let lineClearRows = [];

  // input
  let touches = { left: false, right: false, boost: false, action: false, drift: false };
  let keys = {};

  // swipe tracking
  let swipeStartX = 0, swipeStartY = 0, swipeActive = false;

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

  function reset() {
    score = 0; coins = 0; over = false;
    grid = [];
    for (let r = 0; r < ROWS; r++) {
      grid.push(new Array(COLS).fill(null));
    }
    current = null;
    nextPiece = null;
    fallTimer = 0;
    fallInterval = 0.8;
    level = 1;
    linesCleared = 0;
    lineClearAnim = 0;
    lineClearRows = [];
    spawnPiece();
    nextPiece = randomPiece();
  }

  function randomPiece() {
    const name = PIECE_NAMES[Math.floor(Math.random() * PIECE_NAMES.length)];
    return name;
  }

  function spawnPiece() {
    if (nextPiece === null) nextPiece = randomPiece();
    const name = nextPiece;
    const t = TETROMINOS[name];
    current = {
      type: name,
      rotation: 0,
      row: 0,
      col: Math.floor((COLS - 4) / 2),
      color: t.color
    };
    nextPiece = randomPiece();
    // check game over immediately
    if (!isValidPosition(current.row, current.col, current.rotation, current.type)) {
      gameOver();
    }
  }

  function getShape(type, rotation) {
    return TETROMINOS[type].shapes[rotation];
  }

  function isValidPosition(row, col, rotation, type) {
    const shape = getShape(type, rotation);
    for (let i = 0; i < shape.length; i++) {
      const r = row + shape[i][0];
      const c = col + shape[i][1];
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
      if (grid[r][c] !== null) return false;
    }
    return true;
  }

  function lockPiece() {
    const shape = getShape(current.type, current.rotation);
    for (let i = 0; i < shape.length; i++) {
      const r = current.row + shape[i][0];
      const c = current.col + shape[i][1];
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        grid[r][c] = current.color;
      }
    }
    clearLines();
    spawnPiece();
    fallTimer = 0;
  }

  function clearLines() {
    let cleared = 0;
    lineClearRows = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      let full = true;
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] === null) { full = false; break; }
      }
      if (full) {
        lineClearRows.push(r);
        cleared++;
      }
    }
    if (cleared > 0) {
      // scoring: 100 per line, 4 lines = tetris 800
      let pts = cleared * 100;
      if (cleared === 4) pts = 800;
      score += pts;
      onScore(score);
      // coin bonus for tetrises
      if (cleared >= 4) { coins += 50; onCoins(50); }
      else if (cleared >= 2) { coins += 10; onCoins(10); }
      // remove rows top-down
      for (let i = 0; i < lineClearRows.length; i++) {
        const r = lineClearRows[i];
        grid.splice(r, 1);
        grid.unshift(new Array(COLS).fill(null));
      }
      linesCleared += cleared;
      // level up every 10 lines
      level = Math.floor(linesCleared / 10) + 1;
      // increase speed with level
      fallInterval = Math.max(0.05, 0.8 - (level - 1) * 0.07);
      lineClearAnim = 0.25;
    }
  }

  function moveLeft() {
    if (!current || over) return;
    if (isValidPosition(current.row, current.col - 1, current.rotation, current.type)) {
      current.col--;
    }
  }

  function moveRight() {
    if (!current || over) return;
    if (isValidPosition(current.row, current.col + 1, current.rotation, current.type)) {
      current.col++;
    }
  }

  function rotatePiece() {
    if (!current || over) return;
    const newRot = (current.rotation + 1) % 4;
    if (isValidPosition(current.row, current.col, newRot, current.type)) {
      current.rotation = newRot;
    } else {
      // wall kick: try left/right 1, then 2
      for (const kick of [-1, 1, -2, 2]) {
        if (isValidPosition(current.row, current.col + kick, newRot, current.type)) {
          current.col += kick;
          current.rotation = newRot;
          return;
        }
      }
    }
  }

  function hardDrop() {
    if (!current || over) return;
    let dropDist = 0;
    while (isValidPosition(current.row + 1, current.col, current.rotation, current.type)) {
      current.row++;
      dropDist++;
    }
    score += dropDist * 2;
    onScore(score);
    lockPiece();
  }

  function getGhostRow() {
    if (!current) return 0;
    let r = current.row;
    while (isValidPosition(r + 1, current.col, current.rotation, current.type)) {
      r++;
    }
    return r;
  }

  // ---- update ----
  function update(dt) {
    if (over || !running) return;

    // line clear animation timer
    if (lineClearAnim > 0) {
      lineClearAnim -= dt;
      return; // pause during flash
    }

    // joystick input for movement
    if (touches.left || keys.ArrowLeft) {
      moveLeft();
      touches.left = false; // one-shot
      keys.ArrowLeft = false;
    }
    if (touches.right || keys.ArrowRight) {
      moveRight();
      touches.right = false;
      keys.ArrowRight = false;
    }

    // action/rotate
    if (touches.action || keys.Space || keys.KeyZ) {
      rotatePiece();
      touches.action = false;
      keys.Space = false;
      keys.KeyZ = false;
    }

    // hard drop (down arrow)
    if (touches.down || keys.ArrowDown) {
      hardDrop();
      touches.down = false;
      keys.ArrowDown = false;
    }

    // fall timer
    if (current) {
      fallTimer += dt;
      if (fallTimer >= fallInterval) {
        fallTimer = 0;
        if (isValidPosition(current.row + 1, current.col, current.rotation, current.type)) {
          current.row++;
        } else {
          lockPiece();
        }
      }
    }
  }

  // ---- render ----
  function render() {
    // bg
    ctx.fillStyle = '#05070A';
    ctx.fillRect(0, 0, W, H);

    // grid background
    ctx.fillStyle = '#0A0E18';
    ctx.fillRect(GRID_X, GRID_Y, GRID_W, GRID_H);

    // grid lines
    ctx.strokeStyle = 'rgba(0,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(GRID_X, GRID_Y + r * CELL);
      ctx.lineTo(GRID_X + GRID_W, GRID_Y + r * CELL);
      ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(GRID_X + c * CELL, GRID_Y);
      ctx.lineTo(GRID_X + c * CELL, GRID_Y + GRID_H);
      ctx.stroke();
    }

    // grid border (neon)
    rect(GRID_X - 3, GRID_Y - 3, GRID_W + 6, 3, '#00FFFF', 10);
    rect(GRID_X - 3, GRID_Y + GRID_H, GRID_W + 6, 3, '#00FFFF', 10);
    rect(GRID_X - 3, GRID_Y, 3, GRID_H, '#00FFFF', 10);
    rect(GRID_X + GRID_W, GRID_Y, 3, GRID_H, '#00FFFF', 10);

    // line clear flash
    if (lineClearAnim > 0 && lineClearRows.length > 0) {
      for (const r of lineClearRows) {
        ctx.fillStyle = 'rgba(255,255,255,' + (lineClearAnim * 4) + ')';
        ctx.fillRect(GRID_X, GRID_Y + r * CELL, GRID_W, CELL);
      }
    }

    // placed blocks
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] !== null) {
          const bx = GRID_X + c * CELL;
          const by = GRID_Y + r * CELL;
          ctx.shadowBlur = 8;
          ctx.shadowColor = grid[r][c];
          ctx.fillStyle = grid[r][c];
          ctx.fillRect(bx + 1, by + 1, CELL - 2, CELL - 2);
          ctx.shadowBlur = 0;
          // inner highlight
          ctx.fillStyle = 'rgba(255,255,255,0.15)';
          ctx.fillRect(bx + 1, by + 1, CELL - 2, 3);
        }
      }
    }

    // ghost piece
    if (current && !over) {
      const ghostRow = getGhostRow();
      const shape = getShape(current.type, current.rotation);
      for (let i = 0; i < shape.length; i++) {
        const r = ghostRow + shape[i][0];
        const c = current.col + shape[i][1];
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
          const bx = GRID_X + c * CELL;
          const by = GRID_Y + r * CELL;
          ctx.strokeStyle = 'rgba(255,255,255,0.25)';
          ctx.lineWidth = 1;
          ctx.strokeRect(bx + 1, by + 1, CELL - 2, CELL - 2);
        }
      }
    }

    // current piece
    if (current && !over) {
      const shape = getShape(current.type, current.rotation);
      for (let i = 0; i < shape.length; i++) {
        const r = current.row + shape[i][0];
        const c = current.col + shape[i][1];
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
          const bx = GRID_X + c * CELL;
          const by = GRID_Y + r * CELL;
          ctx.shadowBlur = 12;
          ctx.shadowColor = current.color;
          ctx.fillStyle = current.color;
          ctx.fillRect(bx + 1, by + 1, CELL - 2, CELL - 2);
          ctx.shadowBlur = 0;
          // inner highlight
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fillRect(bx + 1, by + 1, CELL - 2, 3);
        }
      }
    }

    // side panel - right side
    const panelX = GRID_X + GRID_W + 30;

    // level
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#FF10F0';
    ctx.fillStyle = '#FF10F0';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('LEVEL', panelX, GRID_Y + 20);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('' + level, panelX, GRID_Y + 52);
    ctx.shadowBlur = 0;

    // lines
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#39FF88';
    ctx.fillStyle = '#39FF88';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('LINES', panelX, GRID_Y + 90);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('' + linesCleared, panelX, GRID_Y + 114);
    ctx.shadowBlur = 0;

    // score
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00FFFF';
    ctx.fillStyle = '#00FFFF';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('SCORE', panelX, GRID_Y + 155);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('' + score, panelX, GRID_Y + 179);
    ctx.shadowBlur = 0;

    // next piece preview
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#FFE600';
    ctx.fillStyle = '#FFE600';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('NEXT', panelX, GRID_Y + 230);
    ctx.shadowBlur = 0;

    // draw next piece
    if (nextPiece) {
      const shape = getShape(nextPiece, 0);
      const nc = TETROMINOS[nextPiece].color;
      for (let i = 0; i < shape.length; i++) {
        const bx = panelX + shape[i][1] * (CELL - 2);
        const by = GRID_Y + 240 + shape[i][0] * (CELL - 2);
        ctx.shadowBlur = 8;
        ctx.shadowColor = nc;
        ctx.fillStyle = nc;
        ctx.fillRect(bx, by, CELL - 4, CELL - 4);
        ctx.shadowBlur = 0;
      }
    }

    // coins
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#FFE600';
    ctx.fillStyle = '#FFE600';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('COINS', panelX, GRID_Y + 340);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('' + coins, panelX, GRID_Y + 362);
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
      ctx.fillText('LINES: ' + linesCleared, W / 2, H / 2 + 38);
      ctx.fillText('COINS: ' + coins, W / 2, H / 2 + 66);
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
    // which controls this game needs
    controls: { joystick: true, boost: false, action: true, drift: false }
  };
}
