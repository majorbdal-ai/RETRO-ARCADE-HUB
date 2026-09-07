/* ============================================================
   Pac Runner — Pac-Man Style Maze Arcade Game
   Canvas 800x450, grid ~19x11, 4 ghosts, power pellets, levels
   ============================================================ */
function pacRunner(canvas, ctx, onScore, onGameOver, onCoins) {
  // ---- state ----
  const W = 800, H = 450;
  let raf = null, last = 0, running = false;
  let score = 0, coins = 0;
  let over = false;

  // maze grid
  const COLS = 19, ROWS = 11;
  const CELL_W = W / COLS;
  const CELL_H = H / ROWS;
  let maze = [];
  let dots = [];
  let powerPellets = [];

  // player
  const P = { col: 9, row: 9, x: 0, y: 0, r: 14, dir: 'right', nextDir: 'right', speed: 180 };
  const PLAYER_COLOR = '#FFE600';
  const PLAYER_GLOW = '#FFE600';

  // ghosts
  const GHOST_COLORS = ['#FF10F0', '#00FFFF', '#FF8800', '#FF4444'];
  let ghosts = [];
  const GHOST_SPEED = 120;
  let ghostMode = 'chase'; // 'chase', 'frightened', 'eaten'
  let frightTimer = 0;
  const FRIGHT_DURATION = 5;
  let eatenCount = 0; // for scoring chain 200/400/800/1600

  // lives
  let lives = 3;

  // level
  let level = 1;

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

  // maze layout: 1=wall, 0=corridor, 2=power pellet spot
  const MAZE_TEMPLATE = [
    '1111111111111111111',
    '1000000001000000001',
    '1011101111111011101',
    '1011101111111011101',
    '1000000000000000001',
    '1011101011101011101',
    '1000001000001000001',
    '1111101111111011111',
    '1000001000001000001',
    '1011101011101011101',
    '1000000001000000001',
  ];

  function buildMaze() {
    maze = [];
    dots = [];
    powerPellets = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      const line = MAZE_TEMPLATE[r];
      for (let c = 0; c < COLS; c++) {
        const ch = line[c];
        row.push(ch === '1' ? 1 : 0);
        if (ch === '0') {
          dots.push({ col: c, row: r, eaten: false });
        }
      }
      maze.push(row);
    }
    // place 4 power pellets at corners
    const pelletPositions = [
      { col: 1, row: 1 },
      { col: 17, row: 1 },
      { col: 1, row: 9 },
      { col: 17, row: 9 },
    ];
    for (const pos of pelletPositions) {
      if (maze[pos.row][pos.col] === 0) {
        // replace dot with power pellet
        const dotIdx = dots.findIndex(d => d.col === pos.col && d.row === pos.row);
        if (dotIdx >= 0) dots.splice(dotIdx, 1);
        powerPellets.push({ col: pos.col, row: pos.row, eaten: false });
      }
    }
  }

  function getCellCenter(col, row) {
    return { x: col * CELL_W + CELL_W / 2, y: row * CELL_H + CELL_H / 2 };
  }

  function isWall(col, row) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
    return maze[row][col] === 1;
  }

  function canMove(col, row, dir) {
    let nc = col, nr = row;
    if (dir === 'left') nc--;
    else if (dir === 'right') nc++;
    else if (dir === 'up') nr--;
    else if (dir === 'down') nr++;
    return !isWall(nc, nr);
  }

  function getValidDirs(col, row, excludeDir = null) {
    const dirs = [];
    const allDirs = ['left', 'right', 'up', 'down'];
    for (const d of allDirs) {
      if (d === excludeDir) continue;
      if (canMove(col, row, d)) dirs.push(d);
    }
    return dirs;
  }

  function reset() {
    score = 0; coins = 0; over = false;
    lives = 3;
    level = 1;
    ghostMode = 'chase';
    frightTimer = 0;
    eatenCount = 0;
    P.col = 9; P.row = 9; P.dir = 'right'; P.nextDir = 'right';
    const center = getCellCenter(P.col, P.row);
    P.x = center.x; P.y = center.y;
    buildMaze();
    spawnGhosts();
  }

  function spawnGhosts() {
    ghosts = [];
    const ghostStarts = [
      { col: 9, row: 4, color: GHOST_COLORS[0] }, // red
      { col: 8, row: 4, color: GHOST_COLORS[1] }, // cyan
      { col: 10, row: 4, color: GHOST_COLORS[2] }, // orange
      { col: 9, row: 5, color: GHOST_COLORS[3] }, // pink
    ];
    for (const gs of ghostStarts) {
      const center = getCellCenter(gs.col, gs.row);
      ghosts.push({
        col: gs.col, row: gs.row, x: center.x, y: center.y,
        dir: 'left', targetDir: 'left', speed: GHOST_SPEED + level * 10,
        color: gs.color, mode: 'chase', eaten: false, respawnTimer: 0
      });
    }
  }

  function startFright() {
    ghostMode = 'frightened';
    frightTimer = FRIGHT_DURATION;
    eatenCount = 0;
    for (const g of ghosts) {
      if (!g.eaten) g.mode = 'frightened';
    }
  }

  function endFright() {
    ghostMode = 'chase';
    frightTimer = 0;
    for (const g of ghosts) {
      if (!g.eaten) g.mode = 'chase';
    }
  }

  // ---- update ----
  function update(dt) {
    if (over || !running) return;

    // fright timer
    if (ghostMode === 'frightened') {
      frightTimer -= dt;
      if (frightTimer <= 0) endFright();
    }

    // player input - queue next direction
    if ((touches.left || keys.ArrowLeft || keys.KeyA) && canMove(P.col, P.row, 'left')) P.nextDir = 'left';
    if ((touches.right || keys.ArrowRight || keys.KeyD) && canMove(P.col, P.row, 'right')) P.nextDir = 'right';
    if ((touches.up || keys.ArrowUp || keys.KeyW) && canMove(P.col, P.row, 'up')) P.nextDir = 'up';
    if ((touches.down || keys.ArrowDown || keys.KeyS) && canMove(P.col, P.row, 'down')) P.nextDir = 'down';

    // move player
    const moveDist = P.speed * dt;
    const center = getCellCenter(P.col, P.row);
    const targetX = center.x;
    const targetY = center.y;

    // try to turn at center of cell
    const atCenter = Math.abs(P.x - targetX) < 2 && Math.abs(P.y - targetY) < 2;
    if (atCenter && canMove(P.col, P.row, P.nextDir)) {
      P.dir = P.nextDir;
    }

    // move in current direction
    if (P.dir === 'left') P.x -= moveDist;
    else if (P.dir === 'right') P.x += moveDist;
    else if (P.dir === 'up') P.y -= moveDist;
    else if (P.dir === 'down') P.y += moveDist;

    // clamp to cell center if overshot
    const nextCenter = getCellCenter(P.col, P.row);
    if (P.dir === 'left' && P.x <= nextCenter.x) P.x = nextCenter.x;
    if (P.dir === 'right' && P.x >= nextCenter.x) P.x = nextCenter.x;
    if (P.dir === 'up' && P.y <= nextCenter.y) P.y = nextCenter.y;
    if (P.dir === 'down' && P.y >= nextCenter.y) P.y = nextCenter.y;

    // update grid position
    P.col = Math.round(P.x / CELL_W);
    P.row = Math.round(P.y / CELL_H);
    P.col = Math.max(0, Math.min(COLS - 1, P.col));
    P.row = Math.max(0, Math.min(ROWS - 1, P.row));

    // eat dots
    for (const dot of dots) {
      if (!dot.eaten && dot.col === P.col && dot.row === P.row) {
        dot.eaten = true;
        score += 10;
        onScore(score);
        coins += 1;
        onCoins(1);
      }
    }
    dots = dots.filter(d => !d.eaten);

    // eat power pellets
    for (const pp of powerPellets) {
      if (!pp.eaten && pp.col === P.col && pp.row === P.row) {
        pp.eaten = true;
        score += 50;
        onScore(score);
        coins += 5;
        onCoins(5);
        startFright();
      }
    }
    powerPellets = powerPellets.filter(p => !p.eaten);

    // check level complete
    if (dots.length === 0 && powerPellets.length === 0) {
      levelComplete();
      return;
    }

    // update ghosts
    for (const g of ghosts) {
      updateGhost(g, dt);
    }

    // ghost-player collisions
    for (const g of ghosts) {
      if (g.eaten) continue;
      const dx = Math.abs(P.x - g.x);
      const dy = Math.abs(P.y - g.y);
      if (dx < CELL_W * 0.6 && dy < CELL_H * 0.6) {
        if (g.mode === 'frightened') {
          eatGhost(g);
        } else {
          loseLife();
        }
        return;
      }
    }

    // respawn eaten ghosts
    for (const g of ghosts) {
      if (g.eaten) {
        g.respawnTimer -= dt;
        if (g.respawnTimer <= 0) {
          respawnGhost(g);
        }
      }
    }
  }

  function updateGhost(g, dt) {
    const moveDist = g.speed * dt;
    const center = getCellCenter(g.col, g.row);

    // try to turn at center of cell
    const atCenter = Math.abs(g.x - center.x) < 2 && Math.abs(g.y - center.y) < 2;
    if (atCenter) {
      g.dir = g.targetDir;
      // choose next target direction
      const validDirs = getValidDirs(g.col, g.row, oppositeDir(g.dir));
      if (validDirs.length === 0) {
        // dead end, must reverse
        g.targetDir = oppositeDir(g.dir);
      } else if (validDirs.length === 1) {
        g.targetDir = validDirs[0];
      } else {
        // intersection - choose based on mode
        if (g.mode === 'frightened') {
          // random
          g.targetDir = validDirs[Math.floor(Math.random() * validDirs.length)];
        } else if (g.mode === 'eaten') {
          // head to ghost house (center)
          g.targetDir = dirToTarget(g.col, g.row, 9, 4);
        } else {
          // chase - move toward player
          g.targetDir = dirToTarget(g.col, g.row, P.col, P.row);
          // if not valid, pick random valid
          if (!validDirs.includes(g.targetDir)) {
            g.targetDir = validDirs[Math.floor(Math.random() * validDirs.length)];
          }
        }
      }
    }

    // move in current direction
    if (g.dir === 'left') g.x -= moveDist;
    else if (g.dir === 'right') g.x += moveDist;
    else if (g.dir === 'up') g.y -= moveDist;
    else if (g.dir === 'down') g.y += moveDist;

    // clamp to cell center
    const nextCenter = getCellCenter(g.col, g.row);
    if (g.dir === 'left' && g.x <= nextCenter.x) g.x = nextCenter.x;
    if (g.dir === 'right' && g.x >= nextCenter.x) g.x = nextCenter.x;
    if (g.dir === 'up' && g.y <= nextCenter.y) g.y = nextCenter.y;
    if (g.dir === 'down' && g.y >= nextCenter.y) g.y = nextCenter.y;

    g.col = Math.round(g.x / CELL_W);
    g.row = Math.round(g.y / CELL_H);
    g.col = Math.max(0, Math.min(COLS - 1, g.col));
    g.row = Math.max(0, Math.min(ROWS - 1, g.row));
  }

  function oppositeDir(dir) {
    if (dir === 'left') return 'right';
    if (dir === 'right') return 'left';
    if (dir === 'up') return 'down';
    return 'up';
  }

  function dirToTarget(c, r, tc, tr) {
    const dc = tc - c;
    const dr = tr - r;
    const validDirs = getValidDirs(c, r);
    if (validDirs.length === 0) return g.dir;

    // prioritize direction toward target
    if (Math.abs(dc) > Math.abs(dr)) {
      if (dc > 0 && validDirs.includes('right')) return 'right';
      if (dc < 0 && validDirs.includes('left')) return 'left';
    } else {
      if (dr > 0 && validDirs.includes('down')) return 'down';
      if (dr < 0 && validDirs.includes('up')) return 'up';
    }
    // fallback to any valid
    return validDirs[0];
  }

  function eatGhost(g) {
    g.mode = 'eaten';
    g.eaten = true;
    g.speed = GHOST_SPEED * 3; // fast return
    g.targetDir = dirToTarget(g.col, g.row, 9, 4);
    eatenCount++;
    const points = 200 * Math.pow(2, eatenCount - 1);
    score += points;
    onScore(score);
    coins += points / 10;
    onCoins(points / 10);
  }

  function respawnGhost(g) {
    const center = getCellCenter(9, 4);
    g.col = 9; g.row = 4; g.x = center.x; g.y = center.y;
    g.eaten = false;
    g.mode = ghostMode;
    g.speed = GHOST_SPEED + level * 10;
    g.dir = 'left'; g.targetDir = 'left';
  }

  function loseLife() {
    lives--;
    if (navigator.vibrate) { try { navigator.vibrate(200); } catch (e) {} }
    if (lives <= 0) {
      gameOver();
      return;
    }
    // reset positions
    const center = getCellCenter(9, 9);
    P.col = 9; P.row = 9; P.x = center.x; P.y = center.y;
    P.dir = 'right'; P.nextDir = 'right';
    for (const g of ghosts) {
      const gsCenter = getCellCenter(g.col, g.row);
      // reset to start positions
      const startPositions = [
        { col: 9, row: 4 }, { col: 8, row: 4 }, { col: 10, row: 4 }, { col: 9, row: 5 }
      ];
      const idx = ghosts.indexOf(g);
      if (idx >= 0 && idx < startPositions.length) {
        const sp = startPositions[idx];
        const sc = getCellCenter(sp.col, sp.row);
        g.col = sp.col; g.row = sp.row; g.x = sc.x; g.y = sc.y;
        g.eaten = false;
        g.mode = 'chase';
        g.speed = GHOST_SPEED + level * 10;
        g.dir = 'left'; g.targetDir = 'left';
      }
    }
    ghostMode = 'chase';
    frightTimer = 0;
    eatenCount = 0;
  }

  function levelComplete() {
    level++;
    // reset maze with more dots (but same layout for simplicity)
    buildMaze();
    // reset player
    const center = getCellCenter(9, 9);
    P.col = 9; P.row = 9; P.x = center.x; P.y = center.y;
    P.dir = 'right'; P.nextDir = 'right';
    // respawn ghosts faster
    for (const g of ghosts) {
      const startPositions = [
        { col: 9, row: 4 }, { col: 8, row: 4 }, { col: 10, row: 4 }, { col: 9, row: 5 }
      ];
      const idx = ghosts.indexOf(g);
      if (idx >= 0 && idx < startPositions.length) {
        const sp = startPositions[idx];
        const sc = getCellCenter(sp.col, sp.row);
        g.col = sp.col; g.row = sp.row; g.x = sc.x; g.y = sc.y;
        g.eaten = false;
        g.mode = 'chase';
        g.speed = GHOST_SPEED + level * 15;
        g.dir = 'left'; g.targetDir = 'left';
      }
    }
    ghostMode = 'chase';
    frightTimer = 0;
    eatenCount = 0;
  }

  // ---- render ----
  function render() {
    // bg
    ctx.fillStyle = '#05070A';
    ctx.fillRect(0, 0, W, H);

    // maze walls
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (maze[r][c] === 1) {
          const x = c * CELL_W;
          const y = r * CELL_H;
          // neon wall
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#00FFFF';
          ctx.fillStyle = '#003344';
          ctx.fillRect(x, y, CELL_W, CELL_H);
          ctx.shadowBlur = 0;
          // border glow
          ctx.strokeStyle = '#00FFFF';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2);
        }
      }
    }

    // dots
    for (const dot of dots) {
      if (!dot.eaten) {
        const center = getCellCenter(dot.col, dot.row);
        circle(center.x, center.y, 3, '#FFE600', 8);
      }
    }

    // power pellets
    const pulse = Math.sin(performance.now() * 0.005) * 0.5 + 0.5;
    for (const pp of powerPellets) {
      if (!pp.eaten) {
        const center = getCellCenter(pp.col, pp.row);
        circle(center.x, center.y, 8 + pulse * 4, '#FF10F0', 16);
      }
    }

    // ghosts
    for (const g of ghosts) {
      if (g.eaten) {
        // draw eyes only
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(g.x - 5, g.y - 2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(g.x + 5, g.y - 2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#00FFFF';
        ctx.beginPath();
        ctx.arc(g.x - 5, g.y - 2, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(g.x + 5, g.y - 2, 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      const ghostColor = g.mode === 'frightened' ? '#0088FF' : g.color;
      const ghostGlow = g.mode === 'frightened' ? '#0088FF' : g.color;

      // ghost body
      ctx.shadowBlur = 16;
      ctx.shadowColor = ghostGlow;
      ctx.fillStyle = ghostColor;
      ctx.beginPath();
      // rounded top
      ctx.arc(g.x, g.y - P.r * 0.5, P.r, Math.PI, 0);
      // bottom wavy
      ctx.lineTo(g.x + P.r, g.y + P.r);
      const waveCount = 3;
      for (let i = 0; i < waveCount; i++) {
        const wx = g.x + P.r - (i + 0.5) * (2 * P.r / waveCount);
        const wy = g.y + P.r + Math.sin(performance.now() * 0.01 + i) * 4;
        ctx.lineTo(wx, wy);
      }
      ctx.lineTo(g.x - P.r, g.y + P.r);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // eyes
      const eyeOffset = g.dir === 'left' ? -3 : g.dir === 'right' ? 3 : 0;
      const eyeYOffset = g.dir === 'up' ? -2 : g.dir === 'down' ? 2 : 0;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(g.x - 5 + eyeOffset, g.y - 4 + eyeYOffset, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(g.x + 5 + eyeOffset, g.y - 4 + eyeYOffset, 5, 0, Math.PI * 2);
      ctx.fill();
      // pupils
      ctx.fillStyle = '#00FFFF';
      ctx.beginPath();
      ctx.arc(g.x - 5 + eyeOffset, g.y - 4 + eyeYOffset, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(g.x + 5 + eyeOffset, g.y - 4 + eyeYOffset, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // player (pac-man)
    const mouthAngle = Math.sin(performance.now() * 0.015) * 0.4 + 0.2;
    ctx.shadowBlur = 16;
    ctx.shadowColor = PLAYER_GLOW;
    ctx.fillStyle = PLAYER_COLOR;
    ctx.beginPath();
    const startAngle = mouthAngle;
    const endAngle = Math.PI * 2 - mouthAngle;
    if (P.dir === 'right') {
      ctx.arc(P.x, P.y, P.r, startAngle, endAngle);
    } else if (P.dir === 'left') {
      ctx.arc(P.x, P.y, P.r, Math.PI + startAngle, Math.PI + endAngle);
    } else if (P.dir === 'up') {
      ctx.arc(P.x, P.y, P.r, Math.PI * 1.5 + startAngle, Math.PI * 1.5 + endAngle);
    } else {
      ctx.arc(P.x, P.y, P.r, Math.PI * 0.5 + startAngle, Math.PI * 0.5 + endAngle);
    }
    ctx.lineTo(P.x, P.y);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // HUD - lives
    ctx.shadowBlur = 10;
    ctx.shadowColor = PLAYER_GLOW;
    ctx.fillStyle = PLAYER_COLOR;
    ctx.font = 'bold 18px monospace';
    ctx.fillText('LIVES: ' + '♥'.repeat(lives), 16, 30);
    ctx.shadowBlur = 0;

    // level
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#FF10F0';
    ctx.fillStyle = '#FF10F0';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('LEVEL ' + level, W - 16, 30);
    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;

    // fright timer bar
    if (ghostMode === 'frightened') {
      const barW = 200;
      const barH = 6;
      const barX = W / 2 - barW / 2;
      const barY = H - 20;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = '#0088FF';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#0088FF';
      ctx.fillRect(barX, barY, barW * (frightTimer / FRIGHT_DURATION), barH);
      ctx.shadowBlur = 0;
    }

    // game over overlay
    if (over) {
      ctx.fillStyle = 'rgba(5,7,10,0.9)';
      ctx.fillRect(0, 0, W, H);
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#FF10F0';
      ctx.fillStyle = '#FF10F0';
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 40);
      ctx.shadowColor = '#00FFFF';
      ctx.fillStyle = '#00FFFF';
      ctx.font = '24px monospace';
      ctx.fillText('SCORE: ' + score, W / 2, H / 2 + 10);
      ctx.fillText('COINS: ' + coins, W / 2, H / 2 + 45);
      ctx.fillText('LEVEL: ' + level, W / 2, H / 2 + 80);
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
    if (navigator.vibrate) { try { navigator.vibrate([200, 100, 200]); } catch (e) {} }
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
    update() { /* handled internally */ },
    render() { render(); },
    pause() { running = false; if (raf) cancelAnimationFrame(raf); },
    resume() { if (over || running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); },
    destroy() { running = false; if (raf) cancelAnimationFrame(raf); },
    setInput(t, k) { touches = t || {}; keys = k || {}; },
    controls: { joystick: false, boost: false, action: false, drift: false }
  };
}