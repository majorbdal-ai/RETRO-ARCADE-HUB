function checkers(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  let keys = {}, touches = {};

  const CELL = 50;
  const BOARD_X = 150;
  const BOARD_Y = 25;
  const ROWS = 8, COLS = 8;
  let board = [];
  let selected = null;
  let currentPlayer = 'red';
  let mustCapture = null;
  let lastMove = null;
  let pieceCount = { red: 12, black: 12 };
  let aiThinking = 0;
  let gameStarted = false;
  let aiDelay = 0;
  let moveLog = [];

  const COLORS = {
    dark: '#1a1a44',
    light: '#2a2a55',
    red: '#ff3366',
    black: '#33ccff',
    selected: '#ffff00',
    highlight: '#00ffff'
  };

  function initBoard() {
    board = [];
    for (let r = 0; r < ROWS; r++) {
      board[r] = [];
      for (let c = 0; c < COLS; c++) {
        const isDark = (r + c) % 2 === 0;
        board[r][c] = { dark: isDark, piece: null };
      }
    }
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < COLS; c++) {
        if ((r + c) % 2 === 0) {
          board[r][c].piece = { color: 'black', king: false };
          pieceCount.black++;
        }
      }
    }
    for (let r = 5; r < 8; r++) {
      for (let c = 0; c < COLS; c++) {
        if ((r + c) % 2 === 0) {
          board[r][c].piece = { color: 'red', king: false };
          pieceCount.red++;
        }
      }
    }
    selected = null;
    currentPlayer = 'red';
    mustCapture = null;
    lastMove = null;
  }

  function reset() {
    pieceCount = { red: 0, black: 0 };
    initBoard();
    score = 0;
    coins = 0;
    over = false;
    aiDelay = 0;
    gameStarted = true;
    onScore(score);
  }

  function getLegalMoves(r, c) {
    const moves = [];
    const piece = board[r][c].piece;
    if (!piece || piece.color !== currentPlayer) return moves;

    const dirs = piece.color === 'red' ? [-1] : [1];
    const allDirs = piece.king ? [-1, 1] : dirs;

    // Simple moves
    for (const dr of allDirs) {
      for (const dc of [-1, 1]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
        if (!board[nr][nc].piece) moves.push({ r: nr, c: nc, captures: [] });
      }
    }

    // Captures
    for (const dr of allDirs) {
      for (const dc of [-1, 1]) {
        const mr = r + dr, mc = c + dc;
        const nr = r + 2 * dr, nc = c + 2 * dc;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
        const mid = board[mr][mc].piece;
        if (mid && mid.color !== piece.color && !board[nr][nc].piece) {
          moves.push({ r: nr, c: nc, captures: [{ r: mr, c: mc }] });
        }
      }
    }
    return moves;
  }

  function hasAnyCapture(color) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c].piece && board[r][c].piece.color === color) {
          for (const m of getLegalMoves(r, c)) {
            if (m.captures.length > 0) return true;
          }
        }
      }
    }
    return false;
  }

  function applyMove(fromR, fromC, toR, toC, captures) {
    const piece = board[fromR][fromC].piece;
    board[fromR][fromC].piece = null;
    for (const cap of captures) {
      const p = board[cap.r][cap.c].piece;
      if (p) {
        if (p.color === 'black') pieceCount.black--;
        if (p.color === 'red') pieceCount.red--;
        score += 5;
        if (p.king) score += 5;
        onScore(score);
        board[cap.r][cap.c].piece = null;
        if (typeof window.playSfx === 'function') { try { window.playSfx('pop'); } catch (e) {} }
      }
    }
    // Promotion
    if (piece.color === 'red' && toR === 0) piece.king = true;
    if (piece.color === 'black' && toR === 7) piece.king = true;
    board[toR][toC].piece = piece;
    lastMove = { fromR, fromC, toR, toC };
    if (typeof window.playSfx === 'function') { try { window.playSfx('click'); } catch (e) {} }

    if (captures.length > 0) {
      // Check for chain capture
      const chainMoves = getLegalMoves(toR, toC);
      const chainCaptures = chainMoves.filter(m => m.captures.length > 0);
      if (chainCaptures.length > 0) {
        mustCapture = { r: toR, c: toC };
        return;
      }
    }
    mustCapture = null;
    currentPlayer = currentPlayer === 'red' ? 'black' : 'red';
  }

  function checkGameOver() {
    if (pieceCount.red <= 0 || pieceCount.black <= 0) return true;
    // Check if current player has no legal moves
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c].piece && board[r][c].piece.color === currentPlayer) {
          if (getLegalMoves(r, c).length > 0) return false;
        }
      }
    }
    return true;
  }

  function handleClick(x, y) {
    if (over || !gameStarted) return;
    // Handle both mouse configs
    const col = Math.floor((x - BOARD_X) / CELL);
    const row = Math.floor((y - BOARD_Y) / CELL);
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;
    if (!board[row][col].dark) { selected = null; return; }

    // If must capture and this isn't the mandatory piece, ignore
    if (mustCapture) {
      if (board[row][col].piece && board[row][col].piece.color === currentPlayer &&
          row === mustCapture.r && col === mustCapture.c) {
        selected = { r: row, c: col };
        return;
      }
      // dest-based
      if (selected && row === mustCapture.r && col === mustCapture.c) {
        selected = { r: row, c: col };
        return;
      }
      // Movement from the must-capture piece
      const piece = board[row][col].piece;
      if (piece && piece.color === currentPlayer &&
          (row === mustCapture.r && col === mustCapture.c)) {
        selected = { r: row, c: col };
        return;
      }
      return;
    }

    const piece = board[row][col].piece;
    if (piece && piece.color === currentPlayer) {
      selected = { r: row, c: col };
      return;
    }

    if (selected) {
      const moves = getLegalMoves(selected.r, selected.c);
      const valid = moves.find(m => m.r === row && m.c === col);
      if (valid) {
        applyMove(selected.r, selected.c, row, col, valid.captures);
        selected = null;
        if (currentPlayer === 'black') aiDelay = 0.5;
      } else {
        selected = null;
      }
    }
  }

  function update(dt) {
    // Player input
    if ((keys.Space || keys.Enter || touches.action) && touches.lastTapX !== undefined) {
      handleClick(touches.lastTapX, touches.lastTapY);
      touches.lastTapX = undefined;
      touches.lastTapY = undefined;
    }

    // AI turn
    if (currentPlayer === 'black' && !over) {
      aiDelay -= dt;
      if (aiDelay <= 0) {
        aiMove();
        aiDelay = 0.5;
      }
    }

    // Check win/lose
    if (checkGameOver() && !over) {
      // Wait until AI movie done
      const redCaptured = 12 - pieceCount.red;
      if (pieceCount.red >= pieceCount.black && currentPlayer === 'black' && aiDelay < 0.4) {
        // AI has no move
      }
    }
  }

  function aiMove() {
    let candidates = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c].piece && board[r][c].piece.color === 'black') {
          const moves = getLegalMoves(r, c);
          for (const m of moves) candidates.push({ r, c, move: m });
        }
      }
    }
    if (candidates.length === 0) {
      // AI cannot move
      currentPlayer = 'red';
      gameOver();
      return;
    }
    // Prefer captures; otherwise random
    const hasCaptures = candidates.some(c2 => c2.move.captures.length > 0);
    const pool = hasCaptures ? candidates.filter(c2 => c2.move.captures.length > 0) : candidates;
    const choice = pool[Math.floor(Math.random() * pool.length)];
    applyMove(choice.r, choice.c, choice.move.r, choice.move.c, choice.move.captures);
    // If mustCapture chain, continue
    if (mustCapture) {
      aiDelay = 0.2;
    }
    if (currentPlayer !== 'red' && pieceCount.black > 0 && checkGameOver()) {
      gameOver();
    }
  }

  function gameOver() {
    if (over) return;
    over = true;
    running = false;
    cancelAnimationFrame(raf);
    // Player wins if black has no moves or captured all red
    const playerWon = pieceCount.red > 0 && (pieceCount.black <= 0 || currentPlayer === 'black');
    if (playerWon) {
      score += 50;
      coins += 3;
      onScore(score);
    }
    if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
    onGameOver(score, coins);
  }

  function draw() {
    ctx.fillStyle = '#050515';
    ctx.fillRect(0, 0, W, H);

    // Board
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        ctx.fillStyle = board[r][c].dark ? COLORS.dark : COLORS.light;
        ctx.fillRect(BOARD_X + c * CELL, BOARD_Y + r * CELL, CELL, CELL);
      }
    }

    // Valid moves highlight
    if (selected) {
      for (const m of getLegalMoves(selected.r, selected.c)) {
        ctx.fillStyle = m.captures.length > 0 ? '#ff000066' : COLORS.highlight + '66';
        ctx.fillRect(BOARD_X + m.c * CELL, BOARD_Y + m.r * CELL, CELL, CELL);
      }
    }

    // Pieces
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = board[r][c].piece;
        if (p) drawPiece(ctx, r, c, p.color, p.king, selected && selected.r === r && selected.c === c);
      }
    }

    // Score panel
    ctx.save();
    ctx.font = 'bold 18px Orbitron, monospace';
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 10;
    ctx.fillText('CHECKERS', 12, 28);
    ctx.shadowBlur = 0;
    ctx.font = '12px monospace';
    ctx.fillStyle = '#8888aa';
    ctx.fillText('Red: You  Blue: CPU', 12, 48);
    ctx.fillText('Tap piece → tap destination', 12, 66);

    ctx.fillStyle = COLORS.red;
    ctx.fillText(`You: ${pieceCount.red}`, W - 120, 28);
    ctx.fillStyle = COLORS.black;
    ctx.fillText(`CPU: ${pieceCount.black}`, W - 120, 48);
    ctx.fillStyle = '#ffcc00';
    ctx.fillText(`Score: ${score}  Coins: ${coins}`, W - 220, 68);
    ctx.restore();
  }

  function drawPiece(ctx, r, c, color, king, isSelected) {
    const x = BOARD_X + c * CELL + CELL / 2;
    const y = BOARD_Y + r * CELL + CELL / 2;
    ctx.save();
    if (isSelected) {
      ctx.strokeStyle = COLORS.selected;
      ctx.lineWidth = 3;
      ctx.shadowColor = COLORS.selected;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(x, y, CELL / 2 - 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    const grad = ctx.createRadialGradient(x - 4, y - 4, 0, x, y, CELL / 2 - 6);
    grad.addColorStop(0, color === 'red' ? '#ff6699' : '#66ddff');
    grad.addColorStop(1, color === 'red' ? '#cc0033' : '#0088cc');
    ctx.fillStyle = grad;
    ctx.shadowColor = color === 'red' ? '#ff3366' : '#33ccff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(x, y, CELL / 2 - 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (king) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', x, y);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }

  function loop(ts) {
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    update(dt);
    draw();
    if (!over) raf = requestAnimationFrame(loop);
  }

  function start() {
    reset();
    if (!running) { running = true; last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
  }
  function pause() { running = false; cancelAnimationFrame(raf); }
  function resume() { if (!over && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); } }
  function destroy() { running = false; cancelAnimationFrame(raf); }
  return { start, pause, resume, destroy, setInput: (t, k) => { touches = t; keys = k; } };
}