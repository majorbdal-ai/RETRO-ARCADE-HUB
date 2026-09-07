function wordSearch(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  let keys = {}, touches = {};
  let board = [], words = [], foundWords = [];
  let dragging = false, dragPath = [];
  let foundFlash = null, timer = 0, timeLimit = 120;
  let finished = false, bound = false;
  const GRID_SIZE = 8;
  const GRID_X = 210, GRID_Y = 70;
  const GRID_SPACING = 40;
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const WORD_POOL = [
    'NEON', 'ARCADE', 'RETRO', 'PIXEL', 'LASER', 'GAME', 'GLOW',
    'SCORE', 'HIGH', 'BONUS', 'BLAZE', 'COMBO', 'LEVEL', 'PONG',
    'RADAR', 'VOLT', 'ZAP', 'NOVA', 'STAR', 'LUCK'
  ];
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1], [-1, 1]];

  function reset() {
    board = [];
    words = [];
    foundWords = [];
    dragging = false;
    dragPath = [];
    foundFlash = null;
    finished = false;
    score = 0;
    coins = 0;
    over = false;
    timer = timeLimit;
    generateBoard();
    onScore(0);
  }

  function generateBoard() {
    const grid = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      const row = [];
      for (let c = 0; c < GRID_SIZE; c++) row.push('.');
      grid.push(row);
    }

    words = WORD_POOL.slice().sort(() => Math.random() - 0.5).slice(0, 5);

    for (const word of words) {
      let placed = false;
      for (let attempt = 0; attempt < 150 && !placed; attempt++) {
        const r0 = Math.floor(Math.random() * GRID_SIZE);
        const c0 = Math.floor(Math.random() * GRID_SIZE);
        const dir = DIRS[Math.floor(Math.random() * DIRS.length)];
        const [dr, dc] = dir;
        const rEnd = r0 + dr * (word.length - 1);
        const cEnd = c0 + dc * (word.length - 1);
        if (rEnd < 0 || rEnd >= GRID_SIZE || cEnd < 0 || cEnd >= GRID_SIZE) continue;
        let ok = true;
        const prev = [];
        for (let l = 0; l < word.length; l++) {
          const char = grid[r0 + dr * l][c0 + dc * l];
          if (char !== '.' && char !== word[l]) { ok = false; break; }
          prev.push([r0 + dr * l, c0 + dc * l, char]);
        }
        if (!ok) continue;
        for (let l = 0; l < word.length; l++) {
          grid[r0 + dr * l][c0 + dc * l] = word[l];
        }
        placed = true;
      }
      if (!placed) {
        for (let l = 0; l < Math.min(word.length, GRID_SIZE); l++) {
          grid[0][l] = word[l];
        }
      }
    }

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (grid[r][c] === '.') grid[r][c] = LETTERS[Math.floor(Math.random() * 26)];
      }
    }

    board = grid;
  }

  function cellIndex(px, py) {
    const r = Math.floor((py - GRID_Y) / GRID_SPACING);
    const c = Math.floor((px - GRID_X) / GRID_SPACING);
    if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) return { r, c };
    return null;
  }

  function pointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (W / rect.width),
      y: (e.clientY - rect.top) * (H / rect.height)
    };
  }

  function pointerDown(e) {
    if (over) return;
    const pos = pointerPos(e);
    const cell = cellIndex(pos.x, pos.y);
    if (cell) {
      dragging = true;
      dragPath = [cell];
    }
  }

  function pointerMove(e) {
    if (!dragging || over) return;
    const pos = pointerPos(e);
    const cell = cellIndex(pos.x, pos.y);
    if (!cell) return;
    const lastCell = dragPath[dragPath.length - 1];
    if (lastCell.r === cell.r && lastCell.c === cell.c) return;
    const dr = cell.r - lastCell.r, dc = cell.c - lastCell.c;
    if (Math.abs(dr) > 1 || Math.abs(dc) > 1) {
      dragPath = [cell];
      return;
    }
    if (Math.abs(dr) === 1 && Math.abs(dc) === 1 && dr !== dc && dr !== -dc) {
      dragPath = [cell];
      return;
    }
    dragPath.push(cell);
  }

  function pointerUp() {
    if (dragging) {
      tryFindWord(dragPath);
      dragging = false;
      dragPath = [];
    }
  }

  function attach() {
    if (bound) return;
    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerUp);
    bound = true;
  }

  function tryFindWord(cells) {
    if (!cells.length) return;
    let word = '';
    for (const cell of cells) word += board[cell.r][cell.c];
    const reverse = word.split('').reverse().join('');
    const wl = words.findIndex(w => w === word || w === reverse);
    if (wl >= 0 && !foundWords.includes(words[wl])) {
      foundWords.push(words[wl]);
      score += 50;
      coins += 5;
      foundFlash = { cells: cells.slice(), timer: 1.2 };
      onScore(score);
      if (foundWords.length >= words.length) {
        setTimeout(() => {
          if (!finished) {
            finished = true;
            over = true;
            onGameOver(score, coins);
          }
        }, 900);
      }
    }
  }

  function update(dt) {
    if (over) return;
    timer -= dt;
    if (timer <= 0) {
      over = true;
      onGameOver(score, coins);
      return;
    }
    if (foundFlash) {
      foundFlash.timer -= dt;
      if (foundFlash.timer <= 0) foundFlash = null;
    }
  }

  function draw() {
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#111133';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const px = GRID_X + c * GRID_SPACING;
        const py = GRID_Y + r * GRID_SPACING;
        const cx = px + GRID_SPACING / 2;
        const cy = py + GRID_SPACING / 2;

        let hl = false;
        for (const cell of dragPath) if (cell.r === r && cell.c === c) hl = true;
        if (foundFlash) for (const cell of foundFlash.cells) if (cell.r === r && cell.c === c) hl = true;

        if (hl) {
          ctx.fillStyle = '#003333';
          ctx.shadowBlur = 14;
          ctx.shadowColor = '#00ffff';
          ctx.fillRect(px, py, GRID_SPACING, GRID_SPACING);
        }

        ctx.strokeStyle = '#333355';
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, GRID_SPACING, GRID_SPACING);
        ctx.shadowBlur = 0;

        ctx.font = 'bold 16px Orbitron, monospace';
        ctx.fillStyle = hl ? '#00ffff' : '#ccccdd';
        if (hl) { ctx.shadowBlur = 10; ctx.shadowColor = '#00ffff'; }
        ctx.fillText(board[r][c], cx - 6, cy + 6);
        ctx.shadowBlur = 0;
      }
    }

    ctx.font = 'bold 18px Orbitron, monospace';
    ctx.fillStyle = '#00ffff';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00ffff';
    ctx.fillText('WORD SEARCH', 16, 28);
    ctx.font = '12px Orbitron, monospace';
    ctx.fillStyle = '#88ffff';
    ctx.fillText('Drag over letters to find hidden words', 16, 46);
    ctx.shadowBlur = 0;

    ctx.font = 'bold 20px Orbitron, monospace';
    ctx.fillStyle = '#ffff00';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffff00';
    ctx.fillText('SCORE: ' + score, W - 180, 36);
    ctx.shadowBlur = 0;

    ctx.font = 'bold 14px Orbitron, monospace';
    ctx.fillStyle = '#ff00ff';
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#ff00ff';
    ctx.fillText('WORDS', 24, 100);
    ctx.shadowBlur = 0;

    ctx.font = '13px Orbitron, monospace';
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const f = foundWords.includes(w);
      ctx.fillStyle = f ? '#00ff88' : '#aaaaaa';
      if (f) { ctx.shadowBlur = 8; ctx.shadowColor = '#00ff88'; }
      ctx.fillText((f ? '✓ ' : '') + w, 24, 122 + i * 22);
      ctx.shadowBlur = 0;
    }

    const secs = Math.max(0, Math.ceil(timer));
    ctx.font = 'bold 14px Orbitron, monospace';
    ctx.fillStyle = timer < 30 ? '#ff4444' : '#cccccc';
    if (timer < 30) { ctx.shadowBlur = 10; ctx.shadowColor = '#ff4444'; }
    ctx.fillText('TIME: 0:' + String(secs).padStart(2, '0'), 24, 235);
    ctx.shadowBlur = 0;

    if (foundFlash) {
      ctx.globalAlpha = Math.min(1, foundFlash.timer);
      ctx.font = 'bold 28px Orbitron, monospace';
      ctx.fillStyle = '#00ff88';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#00ff88';
      ctx.fillText('FOUND!', W - 210, H / 2);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
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
    attach();
    if (!running) {
      running = true;
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    }
  }

  function pause() { running = false; cancelAnimationFrame(raf); }
  function resume() { if (!over && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); } }
  function destroy() {
    running = false;
    cancelAnimationFrame(raf);
    if (bound) {
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerUp);
      bound = false;
    }
  }

  return { start, pause, resume, destroy, setInput: (t, k) => { touches = t; keys = k; } };
}