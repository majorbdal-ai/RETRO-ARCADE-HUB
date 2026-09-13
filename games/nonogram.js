function nonogram(canvas, ctx, onScore, onGameOver, onCoins) {
  var W = 800, H = 450;
  var raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  var keys = {}, touches = {};
  var SIZE = 10;
  var cellSize = 30;
  var maxClueRows = 3;
  var maxClueCols = 3;
  var offsetX = 160;
  var offsetY = 120;
  var solution = [];
  var board = []; // 0=empty, 1=filled, 2=marked X
  var selectedRow = -1, selectedCol = -1;
  var timer = 0;
  var penaltyTime = 0;
  var diffLevel = 0;
  var message = 'NONOGRAM — Tap = fill, Hold = mark X';
  var msgTimer = 3;

  // ==== VISUAL JUICE (gameFX) — discrete events only ====
  function fx_toScreen(gx, gy) {
    var r = canvas.getBoundingClientRect();
    return { x: r.left + r.width * (gx / W), y: r.top + r.height * (gy / H) };
  }
  function fx_shake(intensity) {
    if (window.gameFX && window.gameFX.shake) { try { window.gameFX.shake(intensity); } catch (e) {} }
  }
  function fx_burst(x, y, color, count) {
    if (window.gameFX && window.gameFX.burst) { try { window.gameFX.burst(x, y, color, count); } catch (e) {} }
  }
  function fx_burstAt(gx, gy, color, count) {
    var p = fx_toScreen(gx, gy);
    fx_burst(p.x, p.y, color, count);
  }

  // Pre-made 10x10 puzzles
  var puzzles = [
    {
      solution: [
        [1,1,1,1,1,0,0,0,0,0],
        [1,0,0,0,1,0,0,0,0,0],
        [1,0,0,0,1,0,0,0,0,0],
        [1,1,1,1,1,0,0,0,0,0],
        [1,0,0,0,1,0,0,0,0,0],
        [1,0,0,0,1,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0],
        [0,1,1,1,0,0,0,0,0,0],
        [0,1,0,1,0,0,0,0,0,0],
        [0,1,1,1,0,0,0,0,0,0]
      ]
    },
    {
      solution: [
        [1,0,1,0,1,0,1,0,1,0],
        [0,1,0,1,0,1,0,1,0,1],
        [1,1,1,1,1,1,1,1,1,1],
        [0,0,0,0,0,0,0,0,0,0],
        [1,1,0,0,1,1,0,0,1,1],
        [1,1,0,0,1,1,0,0,1,1],
        [0,0,0,0,0,0,0,0,0,0],
        [1,1,1,1,1,1,1,1,1,1],
        [0,1,0,1,0,1,0,1,0,1],
        [1,0,1,0,1,0,1,0,1,0]
      ]
    },
    {
      solution: [
        [1,1,1,1,1,1,1,1,1,1],
        [1,0,0,0,0,0,0,0,0,1],
        [1,0,1,1,1,1,1,1,0,1],
        [1,0,1,0,0,0,0,1,0,1],
        [1,0,1,0,1,1,0,1,0,1],
        [1,0,1,0,1,1,0,1,0,1],
        [1,0,1,0,0,0,0,1,0,1],
        [1,0,1,1,1,1,1,1,0,1],
        [1,0,0,0,0,0,0,0,0,1],
        [1,1,1,1,1,1,1,1,1,1]
      ]
    },
    {
      solution: [
        [0,0,0,1,1,1,0,0,0,0],
        [0,0,1,1,1,1,1,0,0,0],
        [0,1,1,0,0,0,1,1,0,0],
        [1,1,0,0,0,0,0,1,1,0],
        [1,1,0,0,0,0,0,1,1,0],
        [0,1,1,0,0,0,1,1,0,0],
        [0,0,1,1,1,1,1,0,0,0],
        [0,0,0,1,1,1,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0]
      ]
    }
  ];

  function computeClues(sol) {
    var rowClues = [];
    var colClues = [];
    for (var r = 0; r < SIZE; r++) {
      var clue = [], count = 0;
      for (var c = 0; c < SIZE; c++) {
        if (sol[r][c] === 1) count++;
        else if (count > 0) { clue.push(count); count = 0; }
      }
      if (count > 0) clue.push(count);
      rowClues.push(clue.length > 0 ? clue : [0]);
    }
    for (var c = 0; c < SIZE; c++) {
      var clue = [], count = 0;
      for (var r = 0; r < SIZE; r++) {
        if (sol[r][c] === 1) count++;
        else if (count > 0) { clue.push(count); count = 0; }
      }
      if (count > 0) clue.push(count);
      colClues.push(clue.length > 0 ? clue : [0]);
    }
    return { rowClues: rowClues, colClues: colClues };
  }

  var clues = { rowClues: [], colClues: [] };

  function reset() {
    score = 0; coins = 0; timer = 0; penaltyTime = 0;
    selectedRow = -1; selectedCol = -1;
    var p = puzzles[Math.floor(Math.random() * puzzles.length)];
    solution = p.solution;
    clues = computeClues(solution);
    board = [];
    for (var r = 0; r < SIZE; r++) {
      board[r] = [];
      for (var c = 0; c < SIZE; c++) {
        board[r][c] = 0;
      }
    }
    message = 'NONOGRAM — Tap = fill, Hold = mark X';
    msgTimer = 3;
  }

  function checkWin() {
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (solution[r][c] === 1 && board[r][c] !== 1) return false;
      }
    }
    return true;
  }

  function toggleCell(r, c, mark) {
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return;
    if (mark) {
      // Mark with X
      board[r][c] = board[r][c] === 2 ? 0 : 2;
    } else {
      // Fill
      board[r][c] = board[r][c] === 1 ? 0 : 1;
    }
    if (typeof window.playSfx === 'function') { try { window.playSfx('click'); } catch (e) {} }
    // Row / column complete detection — burst at the completed line
    if (!mark && board[r][c] === 1) {
      var rowDone = true, colDone = true;
      for (var i = 0; i < SIZE; i++) {
        if (solution[r][i] === 1 && board[r][i] !== 1) rowDone = false;
        if (solution[i][c] === 1 && board[i][c] !== 1) colDone = false;
      }
      if (rowDone) fx_burstAt(offsetX + SIZE * cellSize / 2, offsetY + r * cellSize + cellSize / 2, '#0ff', 8);
      if (colDone) fx_burstAt(offsetX + c * cellSize + cellSize / 2, offsetY + SIZE * cellSize / 2, '#0ff', 8);
    }
    // Check win
    if (checkWin()) {
      over = true;
      score = 1000 - Math.floor(timer) * 2;
      if (score < 100) score = 100;
      coins = Math.floor(score / 100);
      onScore(score);
      if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
      fx_burstAt(W / 2, H / 2, '#0f0', 12);
      onGameOver(score, coins);
    }
  }

  function handleClick(mx, my) {
    if (over) return;
    var c = Math.floor((mx - offsetX) / cellSize);
    var r = Math.floor((my - offsetY) / cellSize);
    if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) {
      toggleCell(r, c, false);
    }
  }

  var holdTimer = 0;
  var holdTarget = { r: -1, c: -1 };
  var isHolding = false;

  function update(dt) {
    if (over) return;
    timer += dt + penaltyTime * dt;
    if (msgTimer > 0) msgTimer -= dt;

    // Mouse/touch click
    if (touches.clickX !== undefined) {
      var c = Math.floor((touches.clickX - offsetX) / cellSize);
      var r = Math.floor((touches.clickY - offsetY) / cellSize);
      if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) {
        selectedRow = r;
        selectedCol = c;
        // Simple tap = fill, we'll use hold for X
        holdTarget.r = r;
        holdTarget.c = c;
        holdTimer = 0;
        isHolding = false;
      }
      touches.clickX = undefined;
      touches.clickY = undefined;
    }

    // Detect hold for mark X
    if (touches.hold) {
      isHolding = true;
    }

    if (touches.holdEnd) {
      if (holdTarget.r >= 0 && holdTarget.c >= 0) {
        toggleCell(holdTarget.r, holdTarget.c, true);
      }
      holdTarget.r = -1;
      holdTarget.c = -1;
      touches.holdEnd = false;
    }

    // Simple: if clicking and hold ended quickly, toggle fill
    if (touches.toggleR !== undefined) {
      toggleCell(touches.toggleR, touches.toggleC, false);
      touches.toggleR = undefined;
    }

    // Keyboard
    if (selectedRow >= 0 && selectedCol >= 0) {
      if (keys.KeyX) {
        toggleCell(selectedRow, selectedCol, true);
        keys.KeyX = false;
      }
      if (keys.Enter || keys.Space) {
        toggleCell(selectedRow, selectedCol, false);
        keys.Enter = false;
        keys.Space = false;
      }
      if (keys.ArrowUp && selectedRow > 0) { selectedRow--; keys.ArrowUp = false; }
      if (keys.ArrowDown && selectedRow < SIZE - 1) { selectedRow++; keys.ArrowDown = false; }
      if (keys.ArrowLeft && selectedCol > 0) { selectedCol--; keys.ArrowLeft = false; }
      if (keys.ArrowRight && selectedCol < SIZE - 1) { selectedCol++; keys.ArrowRight = false; }
    }
  }

  function draw() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.save();
    ctx.shadowColor = '#f0f';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#f0f';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('NONOGRAM', 10, 25);
    ctx.fillStyle = '#888';
    ctx.font = '12px monospace';
    ctx.fillText('Tap cell = fill | Hold = mark X | X key = mark', 10, 42);
    ctx.restore();

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText('Score: ' + score + '  Time: ' + Math.floor(timer) + 's', W - 250, 25);

    // Row clues
    ctx.save();
    ctx.shadowColor = '#0ff';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#0ff';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'right';
    for (var r = 0; r < SIZE; r++) {
      var clueText = clues.rowClues[r].join(' ');
      ctx.fillText(clueText, offsetX - 10, offsetY + r * cellSize + cellSize / 2 + 4);
    }
    ctx.restore();

    // Column clues
    ctx.save();
    ctx.shadowColor = '#0ff';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#0ff';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    for (var c = 0; c < SIZE; c++) {
      var clueLines = clues.colClues[c];
      for (var l = 0; l < clueLines.length; l++) {
        ctx.fillText(clueLines[l], offsetX + c * cellSize + cellSize / 2, offsetY - 10 - (clueLines.length - 1 - l) * 14);
      }
    }
    ctx.restore();

    // Grid
    ctx.save();
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var cx = offsetX + c * cellSize;
        var cy = offsetY + r * cellSize;

        // Cell bg
        if (selectedRow === r && selectedCol === c) {
          ctx.fillStyle = 'rgba(255,0,255,0.2)';
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
        }
        ctx.fillRect(cx, cy, cellSize, cellSize);

        // Cell border
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        if (c % 5 === 0) {
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.lineWidth = 2;
        }
        if (r % 5 === 0) {
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.lineWidth = 2;
        }
        ctx.strokeRect(cx, cy, cellSize, cellSize);

        // Content
        var val = board[r][c];
        if (val === 1) {
          ctx.save();
          ctx.shadowColor = '#f0f';
          ctx.shadowBlur = 8;
          ctx.fillStyle = '#f0f';
          ctx.fillRect(cx + 2, cy + 2, cellSize - 4, cellSize - 4);
          ctx.restore();
        } else if (val === 2) {
          ctx.save();
          ctx.shadowColor = '#f00';
          ctx.shadowBlur = 5;
          ctx.strokeStyle = '#f00';
          ctx.lineWidth = 2;
          var pad = 6;
          ctx.beginPath();
          ctx.moveTo(cx + pad, cy + pad);
          ctx.lineTo(cx + cellSize - pad, cy + cellSize - pad);
          ctx.moveTo(cx + cellSize - pad, cy + pad);
          ctx.lineTo(cx + pad, cy + cellSize - pad);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
    ctx.restore();

    // Outer border
    ctx.save();
    ctx.shadowColor = '#f0f';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = '#f0f';
    ctx.lineWidth = 2;
    ctx.strokeRect(offsetX, offsetY, SIZE * cellSize, SIZE * cellSize);
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
      ctx.fillText(message, W / 2, 90);
      ctx.restore();
    }

    // Game over
    if (over) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.shadowColor = '#0f0';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#0f0';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('★ PUZZLE COMPLETE ★', W / 2, H / 2 - 30);
      ctx.fillStyle = '#fff';
      ctx.font = '18px monospace';
      ctx.fillText('Score: ' + score + '  Coins: ' + coins + '  Time: ' + Math.floor(timer) + 's', W / 2, H / 2 + 10);
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
    },
    setDifficulty: function(level) {
      var l = Math.max(0, Math.min(5, Math.floor(level) || 0));
      diffLevel = l;
      // timer pressure: harder levels accelerate the clock
      penaltyTime = [0, 0.1, 0.2, 0.35, 0.5, 0.7][l];
    }
  };
}
