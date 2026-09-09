window.engines = window.engines || {};
window.engines.reversi = function(canvas, ctx, onScore, onGameOver, onCoins) {
  'use strict';

  // ── Constants ──
  const W = 800, H = 450;
  const ROWS = 8, COLS = 8;
  const CELL = 45;
  const BOARD_W = COLS * CELL;  // 360
  const BOARD_H = ROWS * CELL;  // 360
  const BOARD_X = (W - BOARD_W) / 2;  // 220
  const BOARD_Y = (H - BOARD_H) / 2;  // 45

  const EMPTY = 0, PLAYER = 1, AI = 2;

  // Directions: 8 neighbors
  const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

  // ── State ──
  let board, validMoves, currentPlayer, gameOver, gameOverResult;
  let score, coins, phase;  // phase: 'title' | 'play' | 'aiThink' | 'gameOver'
  let aiThinkTimer, lastTime;
  let raf, running, paused;
  let touches, keys;
  let hoverCell;  // {r, c} or null
  let flipAnimations;  // [{r, c, progress, from, to}]
  let moveHistory;
  let passMessage, passTimer;
  let lastPlaceEffect;  // {r, c, time}
  let stats;  // { playerDiscs, aiDiscs }

  // ── Colors ──
  const COL = {
    felt:       '#0a5e2a',
    feltDark:   '#084a22',
    gridLine:   'rgba(0,0,0,0.25)',
    playerDisc: '#ffffff',
    aiDisc:     '#111111',
    playerGlow: 'rgba(255,255,255,0.3)',
    aiGlow:     'rgba(0,255,100,0.25)',
    validGhost: 'rgba(0,255,120,0.20)',
    validBorder:'rgba(0,255,120,0.5)',
    scoreBg:    'rgba(0,0,0,0.6)',
    scoreText:  '#00ff88',
    titleText:  '#00ffaa',
    accent:     '#00ff88',
    danger:     '#ff3366',
    winGold:    '#ffd700',
    neonBlue:   '#00ddff',
  };

  // ── Helpers ──
  // roundRect polyfill for older browsers
  const _roundRect = ctx.roundRect
    ? (x, y, w, h, r) => ctx.roundRect(x, y, w, h, r)
    : (x, y, w, h, r) => {
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
      };

  function clone(board) { return board.map(r => [...r]); }
  function inBounds(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }
  function opponent(p) { return p === PLAYER ? AI : PLAYER; }

  function countDiscs(b) {
    let p = 0, a = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        if (b[r][c] === PLAYER) p++;
        else if (b[r][c] === AI) a++;
      }
    return { player: p, ai: a };
  }

  // ── Reversi Logic ──
  function getFlipsInDir(b, r, c, dr, dc, player) {
    const opp = opponent(player);
    const flips = [];
    let nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc) && b[nr][nc] === opp) {
      flips.push({ r: nr, c: nc });
      nr += dr; nc += dc;
    }
    if (flips.length > 0 && inBounds(nr, nc) && b[nr][nc] === player) {
      return flips;
    }
    return [];
  }

  function getFlips(b, r, c, player) {
    if (b[r][c] !== EMPTY) return [];
    const all = [];
    for (const [dr, dc] of DIRS) {
      const f = getFlipsInDir(b, r, c, dr, dc, player);
      all.push(...f);
    }
    return all;
  }

  function isValidMove(b, r, c, player) {
    if (b[r][c] !== EMPTY) return false;
    for (const [dr, dc] of DIRS) {
      if (getFlipsInDir(b, r, c, dr, dc, player).length > 0) return true;
    }
    return false;
  }

  function getValidMoves(b, player) {
    const moves = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (isValidMove(b, r, c, player)) moves.push({ r, c });
    return moves;
  }

  function makeMove(b, r, c, player) {
    const flips = getFlips(b, r, c, player);
    if (flips.length === 0) return [];
    b[r][c] = player;
    for (const f of flips) b[f.r][f.c] = player;
    return flips;
  }

  function initBoard() {
    const b = [];
    for (let r = 0; r < ROWS; r++) {
      b[r] = [];
      for (let c = 0; c < COLS; c++) b[r][c] = EMPTY;
    }
    // Standard starting position (center 4)
    b[3][3] = PLAYER; b[4][4] = PLAYER;
    b[3][4] = AI;     b[4][3] = AI;
    return b;
  }

  // ── AI: Minimax with Alpha-Beta (depth 2) ──
  // Board evaluation heuristic
  function evaluate(b) {
    const discs = countDiscs(b);
    const total = discs.player + discs.ai;
    if (total === 0) return 0;

    // Weighted position tables
    const WEIGHTS = [
      [120, -20,  20,   5,   5,  20, -20, 120],
      [-20, -40,  -5,  -5,  -5,  -5, -40, -20],
      [ 20,  -5,  15,   3,   3,  15,  -5,  20],
      [  5,  -5,   3,   3,   3,   3,  -5,   5],
      [  5,  -5,   3,   3,   3,   3,  -5,   5],
      [ 20,  -5,  15,   3,   3,  15,  -5,  20],
      [-20, -40,  -5,  -5,  -5,  -5, -40, -20],
      [120, -20,  20,   5,   5,  20, -20, 120]
    ];

    let posScore = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        if (b[r][c] === AI) posScore += WEIGHTS[r][c];
        else if (b[r][c] === PLAYER) posScore -= WEIGHTS[r][c];
      }

    // Mobility: number of moves available
    const aiMoves = getValidMoves(b, AI).length;
    const playerMoves = getValidMoves(b, PLAYER).length;
    const mobility = (aiMoves - playerMoves) * 8;

    // Corner occupancy
    let cornerScore = 0;
    const corners = [[0,0],[0,7],[7,0],[7,7]];
    for (const [cr, cc] of corners) {
      if (b[cr][cc] === AI) cornerScore += 50;
      else if (b[cr][cc] === PLAYER) cornerScore -= 50;
    }

    // Disc count (less important early, more late)
    const discRatio = (discs.ai - discs.player) / Math.max(total, 1);
    const endgameBonus = total > 50 ? discRatio * 40 : discRatio * 10;

    return posScore + mobility + cornerScore + endgameBonus;
  }

  function minimax(b, depth, alpha, beta, maximizing) {
    const player = maximizing ? AI : PLAYER;
    const moves = getValidMoves(b, player);

    if (depth === 0) return { score: evaluate(b) };

    // No moves — check if opponent has moves (pass or game over)
    if (moves.length === 0) {
      const oppMoves = getValidMoves(b, opponent(player));
      if (oppMoves.length === 0) {
        // Game over
        const d = countDiscs(b);
        const diff = d.ai - d.player;
        return { score: diff > 0 ? 10000 + diff : diff - 10000 };
      }
      // Pass — opponent plays again at same depth
      return minimax(b, depth - 1, alpha, beta, !maximizing);
    }

    let best = null;
    for (const move of moves) {
      const nb = clone(b);
      makeMove(nb, move.r, move.c, player);
      const result = minimax(nb, depth - 1, alpha, beta, !maximizing);
      const score = result.score;

      if (maximizing) {
        if (!best || score > best.score) best = { score, move };
        alpha = Math.max(alpha, score);
      } else {
        if (!best || score < best.score) best = { score, move };
        beta = Math.min(beta, score);
      }
      if (beta <= alpha) break;
    }
    return best || { score: maximizing ? -10000 : 10000 };
  }

  function aiChooseMove() {
    const moves = getValidMoves(board, AI);
    if (moves.length === 0) return null;

    // Use minimax depth 2
    let bestMove = moves[0];
    let bestScore = -Infinity;
    for (const move of moves) {
      const nb = clone(board);
      makeMove(nb, move.r, move.c, AI);
      const result = minimax(nb, 1, -Infinity, Infinity, false);
      const score = result.score;
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    return bestMove;
  }

  // ── Game Flow ──
  function startGame() {
    board = initBoard();
    currentPlayer = PLAYER;  // Player goes first
    gameOver = false;
    gameOverResult = null;
    flipAnimations = [];
    moveHistory = [];
    passMessage = '';
    passTimer = 0;
    lastPlaceEffect = null;

    const d = countDiscs(board);
    score = 0;
    stats = { playerDiscs: d.player, aiDiscs: d.ai };
    onScore(`${d.player} - ${d.ai}`);

    validMoves = getValidMoves(board, PLAYER);
    if (validMoves.length === 0) {
      // Player has no moves; AI goes first
      currentPlayer = AI;
      scheduleAITurn();
    }
    phase = 'play';
  }

  function scheduleAITurn() {
    phase = 'aiThink';
    aiThinkTimer = 0.5;  // 0.5s delay
  }

  function doAITurn() {
    const move = aiChooseMove();
    if (!move) {
      // AI has no moves; check player
      currentPlayer = PLAYER;
      validMoves = getValidMoves(board, PLAYER);
      if (validMoves.length === 0) {
        endGame();
        return;
      }
      phase = 'play';
      showPass('AI passes — your turn');
      return;
    }

    const flips = makeMove(board, move.r, move.c, AI);
    if (flips.length > 0) {
      startFlipAnimations(flips, AI);
      lastPlaceEffect = { r: move.r, c: move.c, time: 0 };
      playSound('place');
    }

    moveHistory.push({ r: move.r, c: move.c, player: AI, flips: flips.length });

    const d = countDiscs(board);
    stats = { playerDiscs: d.player, aiDiscs: d.ai };
    score = d.player * 10 + (d.ai < 10 ? 100 : 0) * Math.max(0, d.player - d.ai);
    onScore(`${d.player} - ${d.ai}`);

    currentPlayer = PLAYER;
    validMoves = getValidMoves(board, PLAYER);
    if (validMoves.length === 0) {
      // Player has no moves; check AI
      const aiMoves = getValidMoves(board, AI);
      if (aiMoves.length === 0) {
        endGame();
        return;
      }
      currentPlayer = AI;
      scheduleAITurn();
      showPass('No valid moves — AI continues');
      return;
    }
    phase = 'play';
  }

  function endGame() {
    const d = countDiscs(board);
    gameOver = true;
    phase = 'gameOver';
    stats = { playerDiscs: d.player, aiDiscs: d.ai };

    if (d.player > d.ai) {
      gameOverResult = 'win';
      score = 100 + (d.player - d.ai) * 10;
      coins = Math.floor((d.player - d.ai) * 2);
    } else if (d.ai > d.player) {
      gameOverResult = 'lose';
      score = Math.max(0, d.player * 5);
      coins = 0;
    } else {
      gameOverResult = 'draw';
      score = 50;
      coins = 25;
    }

    onScore(`${d.player} - ${d.ai}`);
  }

  function handlePlayerMove(r, c) {
    if (phase !== 'play' || currentPlayer !== PLAYER || gameOver) return;
    if (!isValidMove(board, r, c, PLAYER)) {
      playSound('invalid');
      return;
    }

    const flips = makeMove(board, r, c, PLAYER);
    if (flips.length > 0) {
      startFlipAnimations(flips, PLAYER);
      lastPlaceEffect = { r, c, time: 0 };
      playSound('place');
    }

    moveHistory.push({ r, c, player: PLAYER, flips: flips.length });

    const d = countDiscs(board);
    stats = { playerDiscs: d.player, aiDiscs: d.ai };
    score = d.player * 10 + (d.ai < 10 ? 100 : 0) * Math.max(0, d.player - d.ai);
    onScore(`${d.player} - ${d.ai}`);

    currentPlayer = AI;
    validMoves = getValidMoves(board, AI);
    if (validMoves.length === 0) {
      currentPlayer = PLAYER;
      validMoves = getValidMoves(board, PLAYER);
      if (validMoves.length === 0) {
        endGame();
        return;
      }
      showPass('AI passes — your turn');
      return;
    }
    scheduleAITurn();
  }

  function showPass(msg) {
    passMessage = msg;
    passTimer = 2.0;
  }

  // ── Flip Animation ──
  function startFlipAnimations(flips, player) {
    for (let i = 0; i < flips.length; i++) {
      flipAnimations.push({
        r: flips[i].r,
        c: flips[i].c,
        progress: 0,
        delay: i * 0.04,
        from: opponent(player),
        to: player
      });
    }
  }

  function updateFlipAnimations(dt) {
    for (let i = flipAnimations.length - 1; i >= 0; i--) {
      const a = flipAnimations[i];
      if (a.delay > 0) { a.delay -= dt; continue; }
      a.progress += dt * 4;
      if (a.progress >= 1) {
        flipAnimations.splice(i, 1);
      }
    }
  }

  // ── Sound ──
  function playSound(type) {
    try {
      if (typeof window.playSfx === 'function') {
        if (type === 'place') window.playSfx('click');
        else if (type === 'invalid') window.playSfx('over');
      }
    } catch(e) {}
  }

  // ── Drawing ──
  function draw() {
    ctx.clearRect(0, 0, W, H);

    if (phase === 'title') { drawTitle(); return; }
    drawBoard();
    drawDiscs();
    drawValidMoveHints();
    drawScorePanel();
    if (passTimer > 0) drawPassMessage();
    if (phase === 'gameOver') drawGameOver();
  }

  function drawTitle() {
    // Dark background with subtle felt pattern
    ctx.fillStyle = '#061a0e';
    ctx.fillRect(0, 0, W, H);

    // Decorative disc patterns
    const t = performance.now() / 1000;
    for (let i = 0; i < 6; i++) {
      const x = 100 + i * 120;
      const y = 80 + Math.sin(t + i * 0.8) * 15;
      const isWhite = i % 2 === 0;
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fillStyle = isWhite ? 'rgba(255,255,255,0.15)' : 'rgba(0,255,136,0.12)';
      ctx.fill();
    }

    // Title
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 48px "Courier New", monospace';
    ctx.fillStyle = COL.accent;
    ctx.shadowColor = COL.accent;
    ctx.shadowBlur = 20;
    ctx.fillText('REVERSI', W / 2, H / 2 - 60);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.font = '16px "Courier New", monospace';
    ctx.fillStyle = '#88ccaa';
    ctx.fillText('NOKIA CLASSIC', W / 2, H / 2 - 20);

    // Decorative discs
    ctx.beginPath();
    ctx.arc(W / 2 - 35, H / 2 + 30, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(W / 2 + 35, H / 2 + 30, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#222';
    ctx.fill();
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Instruction
    const blink = Math.sin(t * 3) > 0;
    if (blink) {
      ctx.font = '14px "Courier New", monospace';
      ctx.fillStyle = COL.accent;
      ctx.fillText('TAP TO START', W / 2, H / 2 + 80);
    }

    // Rules
    ctx.font = '11px "Courier New", monospace';
    ctx.fillStyle = '#557766';
    ctx.fillText('You: White  ·  CPU: Black  ·  Flip discs to win', W / 2, H / 2 + 120);
    ctx.textAlign = 'left';
  }

  function drawBoard() {
    // Felt background
    ctx.fillStyle = COL.felt;
    ctx.fillRect(0, 0, W, H);

    // Subtle felt texture
    for (let i = 0; i < 60; i++) {
      const x = (i * 137.5) % W;
      const y = (i * 89.3) % H;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)';
      ctx.fillRect(x, y, 2, 2);
    }

    // Board area (slightly darker)
    ctx.fillStyle = COL.feltDark;
    ctx.fillRect(BOARD_X - 4, BOARD_Y - 4, BOARD_W + 8, BOARD_H + 8);

    // Grid
    ctx.strokeStyle = COL.gridLine;
    ctx.lineWidth = 1;
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(BOARD_X, BOARD_Y + r * CELL);
      ctx.lineTo(BOARD_X + BOARD_W, BOARD_Y + r * CELL);
      ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(BOARD_X + c * CELL, BOARD_Y);
      ctx.lineTo(BOARD_X + c * CELL, BOARD_Y + BOARD_H);
      ctx.stroke();
    }

    // Corner dots (fiducials)
    const dotR = 3;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (const [cr, cc] of [[0,0],[0,7],[7,0],[7,7]]) {
      const x = BOARD_X + cc * CELL + CELL / 2;
      const y = BOARD_Y + cr * CELL + CELL / 2;
      ctx.beginPath();
      ctx.arc(x, y, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawDiscs() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] === EMPTY) continue;

        const x = BOARD_X + c * CELL + CELL / 2;
        const y = BOARD_Y + r * CELL + CELL / 2;
        const radius = CELL * 0.38;

        // Check flip animation
        let scaleX = 1;
        for (const a of flipAnimations) {
          if (a.r === r && a.c === c) {
            scaleX = Math.abs(Math.cos(a.progress * Math.PI));
            break;
          }
        }

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scaleX, 1);

        // Disc shadow
        ctx.beginPath();
        ctx.arc(1.5, 2, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();

        // Disc body
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);

        if (board[r][c] === PLAYER) {
          // White disc with subtle gradient
          const grad = ctx.createRadialGradient(-3, -3, 2, 0, 0, radius);
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.7, '#e8e8e8');
          grad.addColorStop(1, '#cccccc');
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.strokeStyle = '#aaaaaa';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Highlight
          ctx.beginPath();
          ctx.arc(-3, -4, radius * 0.35, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fill();
        } else {
          // Black disc with gradient
          const grad = ctx.createRadialGradient(-3, -3, 2, 0, 0, radius);
          grad.addColorStop(0, '#444444');
          grad.addColorStop(0.5, '#222222');
          grad.addColorStop(1, '#0a0a0a');
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.strokeStyle = '#333333';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Highlight
          ctx.beginPath();
          ctx.arc(-3, -4, radius * 0.3, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fill();
        }

        ctx.restore();

        // Placement effect
        if (lastPlaceEffect && lastPlaceEffect.r === r && lastPlaceEffect.c === c && lastPlaceEffect.time < 0.5) {
          const t = lastPlaceEffect.time / 0.5;
          const alpha = 1 - t;
          const expandR = radius + t * 15;
          ctx.beginPath();
          ctx.arc(x, y, expandR, 0, Math.PI * 2);
          ctx.strokeStyle = board[r][c] === PLAYER
            ? `rgba(255,255,255,${alpha * 0.6})`
            : `rgba(0,255,136,${alpha * 0.4})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }
  }

  function drawValidMoveHints() {
    if (phase !== 'play' || currentPlayer !== PLAYER || gameOver) return;
    for (const m of validMoves) {
      const x = BOARD_X + m.c * CELL + CELL / 2;
      const y = BOARD_Y + m.r * CELL + CELL / 2;
      const radius = CELL * 0.36;

      // Ghost circle
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = COL.validGhost;
      ctx.fill();
      ctx.strokeStyle = COL.validBorder;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // If hovering, show preview disc
      if (hoverCell && hoverCell.r === m.r && hoverCell.c === m.c) {
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.globalAlpha = 1;

        // Show flip preview
        const previewFlips = getFlips(board, m.r, m.c, PLAYER);
        for (const f of previewFlips) {
          const fx = BOARD_X + f.c * CELL + CELL / 2;
          const fy = BOARD_Y + f.r * CELL + CELL / 2;
          ctx.beginPath();
          ctx.arc(fx, fy, 4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fill();
        }
      }
    }
  }

  function drawScorePanel() {
    // Left panel — Player score
    const panelW = BOARD_X - 30;
    const panelX = 15;
    const panelY = BOARD_Y;

    ctx.fillStyle = COL.scoreBg;
    ctx.beginPath();
    _roundRect(panelX, panelY, panelW, 80, 8);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Player label
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('YOU', panelX + panelW / 2, panelY + 18);

    // Player disc icon
    ctx.beginPath();
    ctx.arc(panelX + panelW / 2, panelY + 40, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Player count
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.fillStyle = COL.scoreText;
    ctx.shadowColor = COL.scoreText;
    ctx.shadowBlur = 8;
    ctx.fillText(String(stats ? stats.playerDiscs : 2), panelX + panelW / 2, panelY + 66);
    ctx.shadowBlur = 0;

    // Right panel — AI score
    const rPanelX = BOARD_X + BOARD_W + 15;
    ctx.fillStyle = COL.scoreBg;
    ctx.beginPath();
    _roundRect(rPanelX, panelY, panelW, 80, 8);
    ctx.fill();

    // AI label
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('CPU', rPanelX + panelW / 2, panelY + 18);

    // AI disc icon
    ctx.beginPath();
    ctx.arc(rPanelX + panelW / 2, panelY + 40, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#222';
    ctx.fill();
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.stroke();

    // AI count
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.fillStyle = COL.neonBlue;
    ctx.shadowColor = COL.neonBlue;
    ctx.shadowBlur = 8;
    ctx.fillText(String(stats ? stats.aiDiscs : 2), rPanelX + panelW / 2, panelY + 66);
    ctx.shadowBlur = 0;

    // Turn indicator
    const turnY = BOARD_Y + BOARD_H - 30;
    if (!gameOver && phase !== 'title') {
      ctx.font = 'bold 12px "Courier New", monospace';
      if (phase === 'aiThink') {
        ctx.fillStyle = COL.neonBlue;
        ctx.textAlign = 'center';
        ctx.fillText('● CPU THINKING...', W / 2, turnY);
      } else if (currentPlayer === PLAYER) {
        ctx.fillStyle = COL.scoreText;
        ctx.textAlign = 'center';
        ctx.fillText('● YOUR TURN', W / 2, turnY);
      }
    }

    // Move count
    ctx.font = '10px "Courier New", monospace';
    ctx.fillStyle = '#446655';
    ctx.textAlign = 'center';
    ctx.fillText('MOVE ' + (moveHistory.length + 1), W / 2, BOARD_Y + BOARD_H + 22);

    ctx.textAlign = 'left';
  }

  function drawPassMessage() {
    if (passTimer <= 0) return;
    const alpha = Math.min(1, passTimer);
    const t = performance.now() / 1000;
    const y = H / 2 + Math.sin(t * 4) * 5;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    _roundRect(W / 2 - 140, y - 18, 280, 36, 8);
    ctx.fill();

    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillStyle = COL.accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(passMessage, W / 2, y);
    ctx.restore();
  }

  function drawGameOver() {
    // Overlay
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Result text
    let resultText, resultColor;
    if (gameOverResult === 'win') {
      resultText = 'YOU WIN!';
      resultColor = COL.winGold;
    } else if (gameOverResult === 'lose') {
      resultText = 'CPU WINS';
      resultColor = COL.danger;
    } else {
      resultText = 'DRAW';
      resultColor = COL.neonBlue;
    }

    ctx.font = 'bold 42px "Courier New", monospace';
    ctx.fillStyle = resultColor;
    ctx.shadowColor = resultColor;
    ctx.shadowBlur = 25;
    ctx.fillText(resultText, W / 2, H / 2 - 40);
    ctx.shadowBlur = 0;

    // Score summary
    ctx.font = '18px "Courier New", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${stats.playerDiscs}  vs  ${stats.aiDiscs}`, W / 2, H / 2 + 10);

    // Disc icons for final count
    const discY = H / 2 + 50;
    for (let i = 0; i < Math.min(stats.playerDiscs, 10); i++) {
      ctx.beginPath();
      ctx.arc(W / 2 - 50 + i * 10, discY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    for (let i = 0; i < Math.min(stats.aiDiscs, 10); i++) {
      ctx.beginPath();
      ctx.arc(W / 2 - 50 + i * 10, discY + 14, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#333';
      ctx.fill();
    }

    // Coins
    if (coins > 0) {
      ctx.font = 'bold 14px "Courier New", monospace';
      ctx.fillStyle = COL.winGold;
      ctx.fillText('+' + coins + ' COINS', W / 2, H / 2 + 80);
    }

    // Restart hint
    const blink = Math.sin(performance.now() / 300) > 0;
    if (blink) {
      ctx.font = '13px "Courier New", monospace';
      ctx.fillStyle = '#88ccaa';
      ctx.fillText('TAP TO PLAY AGAIN', W / 2, H / 2 + 110);
    }

    ctx.textAlign = 'left';
  }

  // ── Input Handling ──
  function canvasToBoard(mx, my) {
    const c = Math.floor((mx - BOARD_X) / CELL);
    const r = Math.floor((my - BOARD_Y) / CELL);
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) return { r, c };
    return null;
  }

  function handleClick(mx, my) {
    if (phase === 'title') {
      startGame();
      return;
    }
    if (phase === 'gameOver') {
      // Award coins before restarting
      if (coins > 0) onCoins(coins);
      coins = 0;
      startGame();
      return;
    }
    if (phase === 'play' && currentPlayer === PLAYER) {
      const cell = canvasToBoard(mx, my);
      if (cell) handlePlayerMove(cell.r, cell.c);
    }
  }

  function handleMove(mx, my) {
    if (phase === 'play' && currentPlayer === PLAYER) {
      hoverCell = canvasToBoard(mx, my);
    } else {
      hoverCell = null;
    }
  }

  // ── Game Loop ──
  function update(dt) {
    if (paused || gameOver) return;

    // Flip animations
    updateFlipAnimations(dt);

    // Placement effect
    if (lastPlaceEffect) {
      lastPlaceEffect.time += dt;
      if (lastPlaceEffect.time > 0.5) lastPlaceEffect = null;
    }

    // Pass message
    if (passTimer > 0) passTimer -= dt;

    // AI thinking
    if (phase === 'aiThink') {
      aiThinkTimer -= dt;
      if (aiThinkTimer <= 0) {
        doAITurn();
      }
    }
  }

  let lastTs = 0;
  function loop(ts) {
    if (!running) return;
    const dt = Math.min((ts - lastTs) / 1000, 0.1);
    lastTs = ts;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  // ── Public API ──
  function start() {
    phase = 'title';
    stats = { playerDiscs: 2, aiDiscs: 2 };
    flipAnimations = [];
    hoverCell = null;
    lastPlaceEffect = null;
    passMessage = '';
    passTimer = 0;
    moveHistory = [];
    gameOver = false;
    gameOverResult = null;
    coins = 0;

    // Draw initial title frame
    draw();
  }

  function setInput(t, k) {
    touches = t;
    keys = k;
  }

  function pause() {
    paused = true;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  function resume() {
    if (paused && !gameOver) {
      paused = false;
      running = true;
      lastTs = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }

  function destroy() {
    running = false;
    paused = true;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  // ── Canvas Interaction ──
  function onCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    handleClick(mx, my);
  }

  function onCanvasMove(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    handleMove(mx, my);
  }

  function onCanvasTouchStart(e) {
    e.preventDefault();
    if (e.touches.length > 0) {
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      const mx = (t.clientX - rect.left) * scaleX;
      const my = (t.clientY - rect.top) * scaleY;
      handleClick(mx, my);
    }
  }

  function onCanvasTouchMove(e) {
    e.preventDefault();
    if (e.touches.length > 0) {
      const t = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      const mx = (t.clientX - rect.left) * scaleX;
      const my = (t.clientY - rect.top) * scaleY;
      handleMove(mx, my);
    }
  }

  function onCanvasTouchEnd(e) {
    hoverCell = null;
  }

  // Bind events
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('mousemove', onCanvasMove);
  canvas.addEventListener('mouseleave', () => { hoverCell = null; });
  canvas.addEventListener('touchstart', onCanvasTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onCanvasTouchMove, { passive: false });
  canvas.addEventListener('touchend', onCanvasTouchEnd);

  // Auto-start the loop
  running = true;
  lastTs = performance.now();
  raf = requestAnimationFrame(loop);

  // Start with title screen
  start();

  return { start, pause, resume, destroy, setInput };
};
