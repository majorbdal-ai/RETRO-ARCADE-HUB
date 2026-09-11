/* ============================================================
   Candy Crush — Neon Match-3 Puzzle
   Canvas 800x450, 8x8 grid, drag to swap adjacent candies
   3+ match = blast, 4 = line bomb, 5 = color bomb
   ============================================================ */
function candyCrush(canvas, ctx, onScore, onGameOver, onCoins) {
  // ---- state ----
  const W = 800, H = 450;
let diffMul = 1;  // v7.20 difficulty ramp
  let raf = null, last = 0, running = false;
  let score = 0, coins = 0;
  let over = false;
  let comboCount = 0;
  function sfx(key) { if (typeof window.playSfx === 'function') { try { window.playSfx(key); } catch (e) {} } }

  const ROWS = 8, COLS = 8;
  const GRID_LEFT = 100;
  const GRID_TOP = 60;
  const cellSize = 42;
  const GAP = 3;

  // candy types
  const CANDY_TYPES = [
    { name: 'red',    color: '#FF10F0', glow: 14 },
    { name: 'blue',   color: '#00FFFF', glow: 14 },
    { name: 'green',  color: '#39FF88', glow: 14 },
    { name: 'yellow', color: '#FFE600', glow: 14 },
    { name: 'purple', color: '#AA88FF', glow: 14 },
    { name: 'orange', color: '#FF8844', glow: 14 }
  ];

  let grid = [];
  let scoreAnimals = []; // floating score texts
  let confetti = [];

  // selection / drag state
  let selectedCell = null;
  let dragStart = null;
  let dragDir = null;

  // level
  let level = 1;
  let targetScore = 500;
  let movesLeft = 25;
  let processing = false; // true when matches being resolved

  // input
  let touches = { left: false, right: false, up: false, down: false };
  let keys = {};

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

  function randomType() {
    return Math.floor(Math.random() * CANDY_TYPES.length);
  }

  function cellX(c) { return GRID_LEFT + c * (cellSize + GAP); }
  function cellY(r) { return GRID_TOP + r * (cellSize + GAP); }

  function initGrid() {
    grid = [];
    for (let r = 0; r < ROWS; r++) {
      grid[r] = [];
      for (let c = 0; c < COLS; c++) {
        let type;
        do {
          type = randomType();
        } while (wouldMatch(r, c, type));
        grid[r][c] = { type, bomb: null, dropY: 0, matched: false };
      }
    }
  }

  function wouldMatch(r, c, type) {
    // check horizontal
    if (c >= 2 && grid[r][c - 1] && grid[r][c - 2] &&
        grid[r][c - 1].type === type && grid[r][c - 2].type === type) return true;
    // check vertical
    if (r >= 2 && grid[r - 1] && grid[r - 2] &&
        grid[r - 1][c] && grid[r - 2][c] &&
        grid[r - 1][c].type === type && grid[r - 2][c].type === type) return true;
    return false;
  }

  function reset() {
    score = 0; coins = 0; over = false;
    level = 1;
    targetScore = 500;
    movesLeft = 25;
    processing = false;
    selectedCell = null;
    dragStart = null;
    scoreAnimals = [];
    confetti = [];
    initGrid();
  }

  // ---- match finding ----
  function findMatches() {
    const matched = [];

    // horizontal
    for (let r = 0; r < ROWS; r++) {
      let run = 1;
      for (let c = 1; c < COLS; c++) {
        if (grid[r][c] && grid[r][c - 1] &&
            grid[r][c].type === grid[r][c - 1].type &&
            grid[r][c].type >= 0) {
          run++;
        } else {
          if (run >= 3) {
            const startC = c - run;
            const matchLen = run;
            for (let i = 0; i < run; i++) {
              matched.push({ r, c: startC + i, len: matchLen, dir: 'h' });
            }
          }
          run = 1;
        }
      }
      if (run >= 3) {
        const startC = COLS - run;
        for (let i = 0; i < run; i++) {
          matched.push({ r, c: startC + i, len: run, dir: 'h' });
        }
      }
    }

    // vertical
    for (let c = 0; c < COLS; c++) {
      let run = 1;
      for (let r = 1; r < ROWS; r++) {
        if (grid[r][c] && grid[r - 1][c] &&
            grid[r][c].type === grid[r - 1][c].type &&
            grid[r][c].type >= 0) {
          run++;
        } else {
          if (run >= 3) {
            const startR = r - run;
            for (let i = 0; i < run; i++) {
              matched.push({ r: startR + i, c, len: run, dir: 'v' });
            }
          }
          run = 1;
        }
      }
      if (run >= 3) {
        const startR = ROWS - run;
        for (let i = 0; i < run; i++) {
          matched.push({ r: startR + i, c, len: run, dir: 'v' });
        }
      }
    }

    return matched;
  }

  function processMatches() {
    const matches = findMatches();
    if (matches.length === 0) return false;

    comboCount++;
    if (comboCount <= 3) sfx('pop');
    let hasBigCombo = false;
    let matchScore = 0;
    const processed = new Set();

    for (const m of matches) {
      const key = m.r + ',' + m.c;
      if (processed.has(key)) continue;
      processed.add(key);

      const cell = grid[m.r][m.c];
      if (!cell) continue;

      // score: 3=30, 4=line bomb, 5=color bomb
      if (m.len >= 5) {
        matchScore += 50;
        hasBigCombo = true;
        // create color bomb effect: remove all of same type
        const targetType = cell.type;
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (grid[r][c] && grid[r][c].type === targetType) {
              const cx = cellX(c) + cellSize / 2;
              const cy = cellY(r) + cellSize / 2;
              spawnConfetti(cx, cy, CANDY_TYPES[targetType].color);
              grid[r][c] = null;
            }
          }
        }
      } else if (m.len === 4) {
        matchScore += 40;
        // line bomb: clear entire row or column
        if (m.dir === 'h') {
          for (let cc = 0; cc < COLS; cc++) {
            if (grid[m.r][cc]) {
              const cx = cellX(cc) + cellSize / 2;
              const cy = cellY(m.r) + cellSize / 2;
              spawnConfetti(cx, cy, CANDY_TYPES[grid[m.r][cc].type].color);
              grid[m.r][cc] = null;
            }
          }
        } else {
          for (let rr = 0; rr < ROWS; rr++) {
            if (grid[rr][m.c]) {
              const cx = cellX(m.c) + cellSize / 2;
              const cy = cellY(rr) + cellSize / 2;
              spawnConfetti(cx, cy, CANDY_TYPES[grid[rr][m.c].type].color);
              grid[rr][m.c] = null;
            }
          }
        }
      } else {
        matchScore += 30;
        // normal 3-match: just blast
        const cx = cellX(m.c) + cellSize / 2;
        const cy = cellY(m.r) + cellSize / 2;
        spawnConfetti(cx, cy, CANDY_TYPES[cell.type].color);
        grid[m.r][m.c] = null;
      }
    }

    if (matchScore > 0) {
      score += matchScore;
      onScore(score);
      // big combo (5+): win sound + vibrate
      if (hasBigCombo) {
        sfx('win2');
        if (navigator.vibrate) { try { navigator.vibrate(80); } catch (e) {} }
      }
      // floating score
      scoreAnimals.push({
        text: '+' + matchScore,
        x: W / 2,
        y: GRID_TOP + ROWS * (cellSize + GAP) + 20,
        life: 1.0
      });
    }

    return true;
  }

  function spawnConfetti(cx, cy, color) {
    for (let i = 0; i < 8; i++) {
      confetti.push({
        x: cx, y: cy,
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 200 - 80,
        color: color,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0,
        size: 2 + Math.random() * 3
      });
    }
  }

  function dropTiles() {
    // drop tiles down to fill gaps
    for (let c = 0; c < COLS; c++) {
      let emptyRow = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (grid[r][c] !== null) {
          if (r !== emptyRow) {
            grid[emptyRow][c] = grid[r][c];
            grid[emptyRow][c].dropY = -(emptyRow - r) * (cellSize + GAP);
            grid[r][c] = null;
          }
          emptyRow--;
        }
      }
      // fill top with new tiles
      for (let r = emptyRow; r >= 0; r--) {
        const type = randomType();
        grid[r][c] = { type, bomb: null, dropY: -(emptyRow + 1 - r) * (cellSize + GAP), matched: false };
      }
    }
  }

  function animateDrops(dt) {
    let stillDropping = false;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] && grid[r][c].dropY !== 0) {
          grid[r][c].dropY += 600 * dt;
          if (grid[r][c].dropY >= 0) {
            grid[r][c].dropY = 0;
          } else {
            stillDropping = true;
          }
        }
      }
    }
    return stillDropping;
  }

  // ---- swap logic ----
  function swapCells(r1, c1, r2, c2) {
    const tmp = grid[r1][c1];
    grid[r1][c1] = grid[r2][c2];
    grid[r2][c2] = tmp;
  }

  function trySwap(r1, c1, r2, c2) {
    if (processing) return;
    if (r1 < 0 || r1 >= ROWS || c1 < 0 || c1 >= COLS) return;
    if (r2 < 0 || r2 >= ROWS || c2 < 0 || c2 >= COLS) return;
    if (!grid[r1][c1] || !grid[r2][c2]) return;

    // must be adjacent
    const dr = Math.abs(r1 - r2);
    const dc = Math.abs(c1 - c2);
    if (dr + dc !== 1) return;

    processing = true;
    swapCells(r1, c1, r2, c2);

    // check if this creates a match
    const matches = findMatches();
    if (matches.length > 0) {
      comboCount = 0;
      sfx('click');
      movesLeft--;
      // process cascade
      cascadeResolve();
    } else {
      // swap back
      swapCells(r1, c1, r2, c2);
      sfx('error');
      processing = false;
    }
  }

  async function cascadeResolve() {
    processing = true;
    let hasMatches = true;
    while (hasMatches) {
      hasMatches = processMatches();
      if (hasMatches) {
        dropTiles();
        // brief pause for animation
        await sleep(150);
      }
    }
    processing = false;

    // check level complete
    if (score >= targetScore) {
      coins += 10;
      onCoins(10);
      level++;
      targetScore = targetScore + 300 + level * 100;
      movesLeft = Math.max(15, 30 - level * 2);
    }

    // check game over (no moves left)
    if (movesLeft <= 0) {
      gameOver();
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ---- input ----
  function handleCellInput(row, col) {
    if (processing) return;
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;

    if (selectedCell) {
      const sr = selectedCell.r;
      const sc = selectedCell.c;
      // if clicking same cell, deselect
      if (sr === row && sc === col) {
        selectedCell = null;
        return;
      }
      // if adjacent, try swap
      const dr = Math.abs(sr - row);
      const dc = Math.abs(sc - col);
      if (dr + dc === 1) {
        trySwap(sr, sc, row, col);
        selectedCell = null;
        return;
      }
      // otherwise reselect
      selectedCell = { r: row, c: col };
    } else {
      selectedCell = { r: row, c: col };
    }
  }

  function coordsToCell(x, y) {
    const c = Math.floor((x - GRID_LEFT) / (cellSize + GAP));
    const r = Math.floor((y - GRID_TOP) / (cellSize + GAP));
    if (c >= 0 && c < COLS && r >= 0 && r < ROWS) {
      // check we're not in the gap
      const cx = (x - GRID_LEFT) % (cellSize + GAP);
      const cy = (y - GRID_TOP) % (cellSize + GAP);
      if (cx < cellSize && cy < cellSize) {
        return { r, c };
      }
    }
    return null;
  }

  // ---- update ----
  let cascadeResolveRunning = false;

  function update(dt) {
    if (over || !running) return;

    // update floating scores
    for (let i = scoreAnimals.length - 1; i >= 0; i--) {
      scoreAnimals[i].y -= 40 * dt;
      scoreAnimals[i].life -= dt;
      if (scoreAnimals[i].life <= 0) scoreAnimals.splice(i, 1);
    }

    // update confetti
    for (let i = confetti.length - 1; i >= 0; i--) {
      const p = confetti[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * diffMul * dt;
      p.life -= dt;
      if (p.life <= 0) confetti.splice(i, 1);
    }
  }

  // ---- render ----
  function render() {
    // bg
    ctx.fillStyle = '#05070A';
    ctx.fillRect(0, 0, W, H);

    // title
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#FF10F0';
    ctx.fillStyle = '#FF10F0';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CANDY CRUSH', W / 2, 30);
    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;

    // level / moves / target
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#00FFFF';
    ctx.fillStyle = '#00FFFF';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LEVEL ' + level + '  |  TARGET: ' + targetScore + '  |  MOVES: ' + movesLeft, W / 2, 50);
    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;

    // score
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#FFE600';
    ctx.fillStyle = '#FFE600';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('SCORE: ' + score, GRID_LEFT, H - 10);
    ctx.fillStyle = '#39FF88';
    ctx.fillText('COINS: ' + coins, GRID_LEFT + 200, H - 10);
    ctx.shadowBlur = 0;

    // grid background
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#00FFFF';
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(GRID_LEFT - 6, GRID_TOP - 6,
      COLS * (cellSize + GAP) + GAP + 12,
      ROWS * (cellSize + GAP) + GAP + 12);
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(GRID_LEFT - 6, GRID_TOP - 6,
      COLS * (cellSize + GAP) + GAP + 12,
      ROWS * (cellSize + GAP) + GAP + 12);
    ctx.shadowBlur = 0;

    // draw candies
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = grid[r][c];
        if (!cell) continue;

        const ct = CANDY_TYPES[cell.type];
        if (!ct) continue;

        const x = cellX(c);
        const y = cellY(r) + (cell.dropY || 0);
        const isSelected = selectedCell && selectedCell.r === r && selectedCell.c === c;

        // candy bg
        ctx.shadowBlur = isSelected ? 20 : ct.glow;
        ctx.shadowColor = ct.color;
        ctx.fillStyle = isSelected ? '#1a1a3e' : '#0d0d2a';
        ctx.beginPath();
        ctx.roundRect(x, y, cellSize, cellSize, 8);
        ctx.fill();

        // candy body
        ctx.fillStyle = ct.color;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.roundRect(x + 3, y + 3, cellSize - 6, cellSize - 6, 6);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        // selection highlight
        if (isSelected) {
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(x - 1, y - 1, cellSize + 2, cellSize + 2, 9);
          ctx.stroke();
        }

        // candy shine
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.arc(x + cellSize * 0.35, y + cellSize * 0.35, cellSize * 0.15, 0, Math.PI * 2);
        ctx.fill();

        // bomb indicator
        if (cell.bomb === 'line') {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('LTRB'[Math.floor(Math.random() * 4)], x + cellSize / 2, y + cellSize / 2 + 4);
          ctx.textAlign = 'left';
        } else if (cell.bomb === 'color') {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 14px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('★', x + cellSize / 2, y + cellSize / 2 + 5);
          ctx.textAlign = 'left';
        }
      }
    }

    // confetti
    for (const p of confetti) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 4;
      ctx.shadowColor = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // floating scores
    for (const fa of scoreAnimals) {
      ctx.globalAlpha = Math.max(0, fa.life);
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#FFE600';
      ctx.fillStyle = '#FFE600';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(fa.text, fa.x, fa.y);
      ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // controls hint
    ctx.fillStyle = 'rgba(255,16,240,0.4)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DRAG/TAP to swap adjacent candies | 3+ match to blast', W / 2, H - 30);
    ctx.textAlign = 'left';

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
      ctx.fillText('LEVEL: ' + level + '  |  SCORE: ' + score, W / 2, H / 2 + 10);
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
    sfx('over');
    if (navigator.vibrate) { try { navigator.vibrate(200); } catch (e) {} }
    if (typeof gameFX !== 'undefined') { try { var __r = canvas.getBoundingClientRect(); gameFX.burst(__r.left + (W/2) * __r.width / canvas.width, __r.top + (H/2) * __r.height / canvas.height, '#ff4444', 16); } catch(e){} gameFX.shake(5); }
      onGameOver(Math.floor(score), coins);
  }

  // ---- pointer / touch input ----
  let pointerDown = false;
  let pointerStartCell = null;

  function handlePointerStart(x, y) {
    if (processing || over) return;
    const cell = coordsToCell(x, y);
    if (!cell) return;
    pointerDown = true;
    pointerStartCell = cell;
    dragStart = { x, y };
  }

  function handlePointerMove(x, y) {
    if (!pointerDown || !pointerStartCell || processing) return;
    if (!dragStart) return;

    const dx = x - dragStart.x;
    const dy = y - dragStart.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > cellSize * 0.4) {
      // determine direction
      let r2 = pointerStartCell.r;
      let c2 = pointerStartCell.c;
      if (Math.abs(dx) > Math.abs(dy)) {
        c2 += dx > 0 ? 1 : -1;
      } else {
        r2 += dy > 0 ? 1 : -1;
      }
      trySwap(pointerStartCell.r, pointerStartCell.c, r2, c2);
      pointerDown = false;
      pointerStartCell = null;
      dragStart = null;
    }
  }

  function handlePointerEnd(x, y) {
    if (pointerDown && pointerStartCell && !processing) {
      // tap: select or swap
      const cell = coordsToCell(x, y);
      if (cell) {
        handleCellInput(cell.r, cell.c);
      }
    }
    pointerDown = false;
    pointerStartCell = null;
    dragStart = null;
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
    destroy() { running = false; if (raf) cancelAnimationFrame(raf); },
    resume() { if (over || running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); },
    destroy() { running = false; if (raf) cancelAnimationFrame(raf); },
    setInput(t, k) {
      touches = t || {};
      keys = k || {};
      // if touches has a pointerDown/pointerMove/pointerEnd
      if (t && t.pointerDown) handlePointerStart(t.pointerDown.x, t.pointerDown.y);
      if (t && t.pointerMove) handlePointerMove(t.pointerMove.x, t.pointerMove.y);
      if (t && t.pointerEnd) handlePointerEnd(t.pointerEnd.x, t.pointerEnd.y);
    },
    controls: { joystick: false, boost: false, action: false, drift: false },
    setDifficulty: function(lvl){ diffMul = [1,1.15,1.3,1.5,1.75,2][Math.min(5,Math.floor(lvl)||0)]||1; }
  };
}
