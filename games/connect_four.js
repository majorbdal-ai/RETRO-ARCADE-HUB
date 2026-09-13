function connectFour(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  let keys = {}, touches = {};
  const ROWS = 6, COLS = 7;
  const BX = 100, BY = 60, CS = 52;
  const NULL = 0, PLAYER = 1, BOT = 2;
  const BOT_THINK = 0.65;
  let botThinkMul = 1.0; // multiplied with BOT_THINK (difficulty ramp)
  let diffLevel = 0;
  let board = [], playerTurn = true, winner = 0, winCells = [];
  let botTimer = BOT_THINK, dropAnim = null, msg = '', msgTimer = 0;
  let curCol = 3, pressed = false, pressEdge = false, gameEndSent = false;

  function reset() {
    board = [];
    for (let r = 0; r < ROWS; r++) board.push(new Array(COLS).fill(NULL));
    playerTurn = true;
    winner = 0;
    winCells = [];
    botTimer = BOT_THINK * botThinkMul;
    dropAnim = null;
    msg = '';
    msgTimer = 0;
    curCol = 3;
    pressed = false;
    pressEdge = false;
    gameEndSent = false;
    score = 0;
    coins = 0;
    over = false;
    onScore(0);
  }

  function colX(c) { return BX + c * CS + CS / 2; }
  function rowY(r) { return BY + r * CS + CS / 2; }

  function dropRow(c) {
    if (board[0][c] !== NULL) return null;
    let r = ROWS - 1;
    while (r >= 0 && board[r][c] !== NULL) r--;
    return r;
  }

  function hasWon(player, b) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (b[r][c] !== player) continue;
        const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
        for (const [dr, dc] of dirs) {
          const cells = [[r, c]];
          let rr = r + dr, cc = c + dc;
          while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && b[rr][cc] === player) {
            cells.push([rr, cc]);
            rr += dr;
            cc += dc;
          }
          if (cells.length >= 4) return cells;
        }
      }
    }
    return null;
  }

  function boardFull(b) {
    for (let c = 0; c < COLS; c++) if (b[0][c] === NULL) return false;
    return true;
  }

  function placeDisc(col, player) {
    const r = dropRow(col);
    if (r === null) return false;
    board[r][col] = player;
    if (typeof window.playSfx === 'function') { try { window.playSfx('click'); } catch (e) {} }
    dropAnim = { r, c: col, y: BY - 20, targetY: rowY(r), player };
    const w = hasWon(player, board);
    if (w) {
      winner = player;
      winCells = w;
    }
    return true;
  }

  function scoreBoard(b, player) {
    let v = 0;
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        for (const [dr, dc] of dirs) {
          const line = [];
          for (let s = 0; s < 4; s++) {
            const rr = r + dr * s, cc = c + dc * s;
            if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) break;
            line.push(b[rr][cc]);
          }
          if (line.length < 4) continue;
          const mine = line.filter(x => x === player).length;
          const theirs = line.filter(x => x !== NULL && x !== player).length;
          if (theirs > 0) continue;
          if (mine === 4) v += 1000;
          else if (mine === 3) v += 80;
          else if (mine === 2) v += 5;
          else if (mine === 1) v += 1;
        }
      }
    }
    return v;
  }

  function botMove() {
    let best = -1, bestScore = -Infinity;
    for (let c = 0; c < COLS; c++) {
      if (board[0][c] !== NULL) continue;
      const r = dropRow(c);
      board[r][c] = BOT;
      let s = scoreBoard(board, BOT) + Math.random() * 0.5;
      if (hasWon(BOT, board)) s += 2000;
      for (let c2 = 0; c2 < COLS; c2++) {
        if (board[0][c2] !== NULL) continue;
        const r2 = dropRow(c2);
        board[r2][c2] = PLAYER;
        if (hasWon(PLAYER, board)) s -= 1500;
        else s -= scoreBoard(board, PLAYER) * 0.55;
        board[r2][c2] = NULL;
      }
      board[r][c] = NULL;
      if (s > bestScore) { bestScore = s; best = c; }
    }
    if (best === -1) {
      for (let c = 0; c < COLS; c++) if (board[0][c] === NULL) { best = c; break; }
    }
    if (best >= 0) placeDisc(best, BOT);
  }

  function endGame() {
    if (gameEndSent || over) return;
    over = true;
    if (winner === PLAYER) {
      score += 100;
      coins += 20;
      onScore(score);
      msg = 'YOU WIN!';
      if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
    } else if (winner === BOT) {
      msg = 'BOT WINS';
      if (typeof window.playSfx === 'function') { try { window.playSfx('error'); } catch (e) {} }
    } else {
      score += 25;
      coins += 5;
      onScore(score);
      msg = 'DRAW';
      if (typeof window.playSfx === 'function') { try { window.playSfx('move'); } catch (e) {} }
    }
    msgTimer = 2;
    if (typeof gameFX !== 'undefined') { try { var __r = canvas.getBoundingClientRect(); gameFX.burst(__r.left + (W/2) * __r.width / canvas.width, __r.top + (H/2) * __r.height / canvas.height, '#ff4444', 16); } catch(e){} gameFX.shake(5); }
      onGameOver(score, coins);
  }

  function update(dt) {
    if (over) return;
    if (msgTimer > 0) msgTimer -= dt;

    const held = !!(touches.action || keys.Space || keys.KeyW);
    pressEdge = held && !pressed;
    pressed = held;

    if (dropAnim) {
      dropAnim.y += (dropAnim.targetY - dropAnim.y) * Math.min(1, dt * 14);
      if (Math.abs(dropAnim.targetY - dropAnim.y) < 1.5) {
        dropAnim.y = dropAnim.targetY;
        dropAnim = null;
        if (winner !== 0) { endGame(); return; }
        if (boardFull(board)) { endGame(); return; }
        if (!playerTurn) botTimer = 0;
      }
    }

    if (!playerTurn && !dropAnim && !over) {
      if (botTimer <= 0) {
        botMove();
        if (winner !== 0) { endGame(); return; }
        if (boardFull(board)) { endGame(); return; }
        playerTurn = true;
      } else {
        botTimer -= dt;
      }
    } else if (playerTurn && !dropAnim && !over) {
      if (touches.left || keys.ArrowLeft) curCol = Math.max(0, curCol - 1);
      if (touches.right || keys.ArrowRight) curCol = Math.min(COLS - 1, curCol + 1);
      if (pressEdge && board[0][curCol] !== NULL) {
        let c = curCol;
        while (c >= 0 && board[0][c] !== NULL) c--;
        if (c < 0) {
          c = curCol;
          while (c < COLS && board[0][c] !== NULL) c++;
        }
        if (c >= 0 && c < COLS) curCol = c;
      }
      if (pressEdge && board[0][curCol] === NULL) {
        playerTurn = false;
        botTimer = BOT_THINK * botThinkMul;
        placeDisc(curCol, PLAYER);
      }
    }
  }

  function draw() {
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#111133';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    ctx.shadowBlur = 14;
    ctx.shadowColor = '#0044ff';
    ctx.strokeStyle = '#2255ff';
    ctx.lineWidth = 3;
    ctx.strokeRect(BX - 8, BY - 8, COLS * CS + 16, ROWS * CS + 16);
    ctx.shadowBlur = 0;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cx = colX(c), cy = rowY(r);
        const v = board[r][c];
        let discY = cy;
        if (dropAnim && dropAnim.r === r && dropAnim.c === c) discY = dropAnim.y;

        ctx.fillStyle = '#0d0d1a';
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#0022aa';
        ctx.beginPath();
        ctx.arc(cx, cy, CS / 2 - 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        if (v !== NULL) {
          const color = v === PLAYER ? '#ffdd00' : '#ff0055';
          const glow = v === PLAYER ? '#ffaa00' : '#ff0044';
          ctx.shadowBlur = 14;
          ctx.shadowColor = glow;
          const grad = ctx.createRadialGradient(cx - 7, discY - 7, 0, cx, discY, CS / 2 - 6);
          grad.addColorStop(0, color);
          grad.addColorStop(1, glow);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, discY, CS / 2 - 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    }

    for (const [r, c] of winCells) {
      const cx = colX(c), cy = rowY(r);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, CS / 2 - 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    if (playerTurn && !dropAnim && !over) {
      const cx = colX(curCol);
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 140);
      ctx.globalAlpha = pulse;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#00ffff';
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 12, BY - 22);
      ctx.lineTo(cx + 12, BY - 22);
      ctx.lineTo(cx, BY - 10);
      ctx.closePath();
      ctx.fillStyle = '#00ffff22';
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    if (msgTimer > 0) {
      ctx.globalAlpha = Math.min(1, msgTimer);
      ctx.font = 'bold 36px Orbitron, monospace';
      const mColor = winner === PLAYER ? '#00ff88' : winner === BOT ? '#ff0055' : '#ffff00';
      ctx.fillStyle = mColor;
      ctx.shadowBlur = 22;
      ctx.shadowColor = mColor;
      const tw = ctx.measureText(msg).width;
      ctx.fillText(msg, W / 2 - tw / 2, H / 2 - 10);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    ctx.font = 'bold 18px Orbitron, monospace';
    ctx.fillStyle = '#ffdd00';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ffdd00';
    ctx.fillText('CONNECT FOUR', 16, 28);
    ctx.font = '12px Orbitron, monospace';
    ctx.fillStyle = '#ffee88';
    ctx.fillText('←/→ Pick column | TAP/SPACE Drop | 4-in-a-row vs BOT', 16, 46);
    ctx.shadowBlur = 0;

    ctx.font = 'bold 20px Orbitron, monospace';
    ctx.fillStyle = '#00ffff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ffff';
    ctx.fillText('SCORE: ' + score, W - 190, 36);
    ctx.shadowBlur = 0;
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
    if (!running) {
      running = true;
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    }
  }

  function pause() { running = false; cancelAnimationFrame(raf); }
  function resume() { if (!over && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); } }
  function destroy() { running = false; cancelAnimationFrame(raf); }

  return { start, pause, resume, destroy, setInput: (t, k) => { touches = t; keys = k; },
  setDifficulty: (level) => {
    const l = Math.max(0, Math.min(5, Math.floor(level) || 0));
    diffLevel = l;
    // Bot reacts faster at higher difficulty
    botThinkMul = [1.0, 0.85, 0.7, 0.55, 0.4, 0.25][l];
  } };
}