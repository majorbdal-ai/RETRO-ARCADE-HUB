function sudoku(canvas, ctx, onScore, onGameOver, onCoins) {
  var W = 800, H = 450;
  var raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  var keys = {}, touches = {};
  var GRID = 9;
  var cellSize = 36;
  var offsetX = (W - GRID * cellSize) / 2 - 40;
  var offsetY = (H - GRID * cellSize) / 2 + 10;
  var board = [];
  var solution = [];
  var given = [];
  var selectedCell = -1;
  var hintsLeft = 3;
  var mistakes = 0;
  var cellsFilled = 0;
  var totalGivens = 0;
  var timer = 0;
  var message = '';
  var msgTimer = 0;

  // Simple puzzle generator (pre-made patterns)
  var puzzles = [
    { given: [
      [5,3,0,0,7,0,0,0,0],[6,0,0,1,9,5,0,0,0],[0,9,8,0,0,0,0,6,0],
      [8,0,0,0,6,0,0,0,3],[4,0,0,8,0,3,0,0,1],[7,0,0,0,2,0,0,0,6],
      [0,6,0,0,0,0,2,8,0],[0,0,0,4,1,9,0,0,5],[0,0,0,0,8,0,0,7,9]
    ], solution: [
      [5,3,4,6,7,8,9,1,2],[6,7,2,1,9,5,3,4,8],[1,9,8,3,4,2,5,6,7],
      [8,5,9,7,6,1,4,2,3],[4,2,6,8,5,3,7,9,1],[7,1,3,9,2,4,8,5,6],
      [9,6,1,5,3,7,2,8,4],[2,8,7,4,1,9,6,3,5],[3,4,5,2,8,6,1,7,9]
    ]},
    { given: [
      [0,0,0,2,6,0,7,0,1],[6,8,0,0,7,0,0,9,0],[1,9,0,0,0,4,5,0,0],
      [8,2,0,1,0,0,0,4,0],[0,0,4,6,0,2,9,0,0],[0,5,0,0,0,3,0,2,8],
      [0,0,9,3,0,0,0,7,4],[0,4,0,0,5,0,0,3,6],[7,0,3,0,1,8,0,0,0]
    ], solution: [
      [4,3,5,2,6,9,7,8,1],[6,8,2,5,7,1,4,9,3],[1,9,7,8,3,4,5,6,2],
      [8,2,6,1,9,5,3,4,7],[3,7,4,6,8,2,9,1,5],[9,5,1,7,4,3,6,2,8],
      [5,1,9,3,2,6,8,7,4],[2,4,8,9,5,7,1,3,6],[7,6,3,4,1,8,2,5,9]
    ]},
    { given: [
      [0,0,0,0,0,0,0,0,0],[0,0,0,0,0,3,0,8,5],[0,0,1,0,2,0,0,0,0],
      [0,0,0,5,0,7,0,0,0],[0,0,4,0,0,0,1,0,0],[0,9,0,0,0,0,0,0,0],
      [5,0,0,0,0,0,0,7,3],[0,0,2,0,1,0,0,0,0],[0,0,0,0,4,0,0,0,9]
    ], solution: [
      [9,8,7,6,5,4,3,2,1],[2,4,6,1,7,3,9,8,5],[3,5,1,9,2,8,7,4,6],
      [1,2,8,5,3,7,6,9,4],[6,3,4,8,9,2,1,5,7],[7,9,5,4,6,1,8,3,2],
      [5,1,9,2,8,6,4,7,3],[4,7,2,3,1,9,5,6,8],[8,6,3,7,4,5,2,1,9]
    ]}
  ];

  function generatePuzzle() {
    var p = puzzles[Math.floor(Math.random() * puzzles.length)];
    board = [];
    solution = [];
    given = [];
    totalGivens = 0;
    cellsFilled = 0;
    for (var r = 0; r < 9; r++) {
      board[r] = [];
      solution[r] = [];
      given[r] = [];
      for (var c = 0; c < 9; c++) {
        solution[r][c] = p.solution[r][c];
        if (p.given[r][c] !== 0) {
          board[r][c] = p.given[r][c];
          given[r][c] = true;
          totalGivens++;
          cellsFilled++;
        } else {
          board[r][c] = 0;
          given[r][c] = false;
        }
      }
    }
  }

  function reset() {
    score = 0; coins = 0; hintsLeft = 3; mistakes = 0;
    timer = 0; selectedCell = -1;
    message = 'SUDOKU — Tap cell, then tap number 1-9';
    msgTimer = 3;
    generatePuzzle();
  }

  function isValid(r, c, num) {
    for (var i = 0; i < 9; i++) {
      if (board[r][i] === num && i !== c) return false;
      if (board[i][c] === num && i !== r) return false;
    }
    var br = Math.floor(r / 3) * 3;
    var bc = Math.floor(c / 3) * 3;
    for (var dr = 0; dr < 3; dr++) {
      for (var dc = 0; dc < 3; dc++) {
        if (board[br + dr][bc + dc] === num && (br + dr !== r || bc + dc !== c)) return false;
      }
    }
    return true;
  }

  function placeNumber(num) {
    if (selectedCell < 0 || over) return;
    var r = Math.floor(selectedCell / 9);
    var c = selectedCell % 9;
    if (given[r][c]) return;
    if (num === 0) {
      // Clear
      if (board[r][c] !== 0) {
        board[r][c] = 0;
        cellsFilled--;
      }
      return;
    }
    if (solution[r][c] === num) {
      if (board[r][c] === 0) cellsFilled++;
      board[r][c] = num;
      var pts = 50 + hintsLeft * 10;
      score += pts;
      coins += 1;
      onScore(score);
      message = '✓ Correct! +' + pts;
      msgTimer = 1;

      // Check win
      if (cellsFilled === 81) {
        over = true;
        var timeBonus = Math.max(0, 500 - Math.floor(timer));
        score += timeBonus;
        coins += 10;
        onScore(score);
        onGameOver(score, coins);
      }
    } else {
      mistakes++;
      score = Math.max(0, score - 20);
      onScore(score);
      message = '✗ Wrong! (mistakes: ' + mistakes + ')';
      msgTimer = 1;
    }
  }

  function useHint() {
    if (hintsLeft <= 0 || over) return;
    // Find a random empty cell and fill it
    var emptyCells = [];
    for (var r = 0; r < 9; r++) {
      for (var c = 0; c < 9; c++) {
        if (board[r][c] === 0) emptyCells.push([r, c]);
      }
    }
    if (emptyCells.length === 0) return;
    var idx = Math.floor(Math.random() * emptyCells.length);
    var cell = emptyCells[idx];
    board[cell[0]][cell[1]] = solution[cell[0]][cell[1]];
    cellsFilled++;
    hintsLeft--;
    score += 10;
    onScore(score);
    message = 'Hint used! (' + hintsLeft + ' left)';
    msgTimer = 1.5;
    selectedCell = cell[0] * 9 + cell[1];
    if (cellsFilled === 81) {
      over = true;
      onGameOver(score, coins);
    }
  }

  function handleClick(mx, my) {
    if (over) return;

    // Check number pad (bottom area)
    var numPadY = offsetY + GRID * cellSize + 20;
    for (var n = 1; n <= 9; n++) {
      var nx = offsetX + (n - 1) * 38;
      var ny = numPadY;
      if (mx >= nx && mx <= nx + 34 && my >= ny && my <= ny + 34) {
        placeNumber(n);
        return;
      }
    }

    // Clear button
    var clearX = offsetX + 9 * 38;
    var clearY = numPadY;
    if (mx >= clearX && mx <= clearX + 34 && my >= clearY && my <= clearY + 34) {
      placeNumber(0);
      return;
    }

    // Hint button
    var hintX = offsetX + 10 * 38;
    if (mx >= hintX && mx <= hintX + 50 && my >= clearY && my <= clearY + 34) {
      useHint();
      return;
    }

    // Grid cell
    for (var r = 0; r < 9; r++) {
      for (var c = 0; c < 9; c++) {
        var cx = offsetX + c * cellSize;
        var cy = offsetY + r * cellSize;
        if (mx >= cx && mx <= cx + cellSize && my >= cy && my <= cy + cellSize) {
          selectedCell = r * 9 + c;
          return;
        }
      }
    }
  }

  function update(dt) {
    if (over) return;
    timer += dt;
    if (msgTimer > 0) msgTimer -= dt;

    // Keyboard input
    if (selectedCell >= 0) {
      for (var k = 1; k <= 9; k++) {
        if (keys['Digit' + k]) {
          placeNumber(k);
          keys['Digit' + k] = false;
        }
      }
    }
    if (keys.KeyH) { useHint(); keys.KeyH = false; }
    if (keys.Backspace || keys.Delete) { placeNumber(0); keys.Backspace = false; keys.Delete = false; }

    // Mouse/touch
    if (touches.clickX !== undefined) {
      handleClick(touches.clickX, touches.clickY);
      touches.clickX = undefined;
      touches.clickY = undefined;
    }
  }

  function draw() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.save();
    ctx.shadowColor = '#0ff';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#0ff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('SUDOKU', 10, 25);
    ctx.fillStyle = '#888';
    ctx.font = '12px monospace';
    ctx.fillText('Tap cell + number | H = hint | Del = clear', 10, 42);
    ctx.restore();

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText('Score: ' + score + '  Hints: ' + hintsLeft + '  Mistakes: ' + mistakes + '  Time: ' + Math.floor(timer) + 's', W - 400, 25);

    // Grid
    ctx.save();
    for (var r = 0; r < 9; r++) {
      for (var c = 0; c < 9; c++) {
        var cx = offsetX + c * cellSize;
        var cy = offsetY + r * cellSize;
        var val = board[r][c];

        // Cell background
        if (selectedCell === r * 9 + c) {
          ctx.fillStyle = 'rgba(0,255,255,0.15)';
        } else if ((r + c) % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
        }
        ctx.fillRect(cx, cy, cellSize, cellSize);

        // Cell border
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx, cy, cellSize, cellSize);

        // Thick 3x3 borders
        if (c % 3 === 0) {
          ctx.strokeStyle = 'rgba(0,255,255,0.5)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx, cy + cellSize);
          ctx.stroke();
        }
        if (r % 3 === 0) {
          ctx.strokeStyle = 'rgba(0,255,255,0.5)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + cellSize, cy);
          ctx.stroke();
        }

        // Number
        if (val !== 0) {
          ctx.save();
          ctx.font = 'bold 20px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          if (given[r][c]) {
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 5;
            ctx.fillStyle = '#fff';
          } else if (val === solution[r][c]) {
            ctx.shadowColor = '#0f0';
            ctx.shadowBlur = 8;
            ctx.fillStyle = '#0f0';
          } else {
            ctx.shadowColor = '#f00';
            ctx.shadowBlur = 8;
            ctx.fillStyle = '#f00';
          }
          ctx.fillText(val, cx + cellSize / 2, cy + cellSize / 2);
          ctx.restore();
        }
      }
    }
    ctx.restore();

    // Number pad
    var numPadY = offsetY + GRID * cellSize + 20;
    for (var n = 1; n <= 9; n++) {
      var nx = offsetX + (n - 1) * 38;
      ctx.save();
      ctx.shadowColor = '#0ff';
      ctx.shadowBlur = 8;
      ctx.fillStyle = 'rgba(0,255,255,0.1)';
      ctx.fillRect(nx, numPadY, 34, 34);
      ctx.strokeStyle = '#0ff';
      ctx.lineWidth = 1;
      ctx.strokeRect(nx, numPadY, 34, 34);
      ctx.fillStyle = '#0ff';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n, nx + 17, numPadY + 17);
      ctx.restore();
    }

    // Clear button
    var clearX = offsetX + 9 * 38;
    ctx.save();
    ctx.shadowColor = '#f80';
    ctx.shadowBlur = 8;
    ctx.fillStyle = 'rgba(255,136,0,0.1)';
    ctx.fillRect(clearX, numPadY, 34, 34);
    ctx.strokeStyle = '#f80';
    ctx.lineWidth = 1;
    ctx.strokeRect(clearX, numPadY, 34, 34);
    ctx.fillStyle = '#f80';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CLR', clearX + 17, numPadY + 17);
    ctx.restore();

    // Hint button
    var hintX = offsetX + 10 * 38;
    ctx.save();
    ctx.shadowColor = '#ff0';
    ctx.shadowBlur = 8;
    ctx.fillStyle = 'rgba(255,255,0,0.1)';
    ctx.fillRect(hintX, numPadY, 50, 34);
    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = 1;
    ctx.strokeRect(hintX, numPadY, 50, 34);
    ctx.fillStyle = '#ff0';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HINT', hintX + 25, numPadY + 17);
    ctx.restore();

    // Message
    if (msgTimer > 0 && message) {
      ctx.save();
      ctx.shadowColor = '#ff0';
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#ff0';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, msgTimer);
      ctx.fillText(message, W / 2, 65);
      ctx.restore();
    }

    // Game over overlay
    if (over) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.shadowColor = '#0f0';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#0f0';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PUZZLE COMPLETE!', W / 2, H / 2 - 30);
      ctx.fillStyle = '#fff';
      ctx.font = '18px monospace';
      ctx.fillText('Score: ' + score + '  Coins: ' + coins + '  Mistakes: ' + mistakes + '  Time: ' + Math.floor(timer) + 's', W / 2, H / 2 + 10);
      ctx.fillText('Tap/Space to play again', W / 2, H / 2 + 40);
      ctx.restore();

      if (touches.action || keys.Space) {
        touches.action = false;
        keys.Space = false;
        over = false;
        reset();
      }
    }
  }

  function loop(ts) {
    var dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
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
    if (!running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }

  function destroy() {
    running = false;
    over = true;
    cancelAnimationFrame(raf);
  }

  return {
    start: start,
    pause: pause,
    resume: resume,
    destroy: destroy,
    setInput: function(t, k) {
      touches = t || {};
      keys = k || {};
    }
  };
}
