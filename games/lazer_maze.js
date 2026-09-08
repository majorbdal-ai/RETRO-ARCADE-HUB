function lazerMaze(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, overSent = false;
  let score = 0, coins = 0, keys = {}, touches = {};
  let time = 0, state = 'play', shake = 0;

  // Level grid
  const COLS = 16, ROWS = 9;
  let grid = [];          // 2D array: 0 empty, 1 wall, 2 mirror, 3 target, 4 block
  let laser = null;       // {x, y, dir}
  let beam = [];          // beam segments
  let target = null;      // {x, y}
  let allMirrors = [];
  let level = 1;
  let moves = 0;
  let autoRotate = 0;
  let lights = [];

  const DIRS = [
    { x: 1, y: 0 },   // right
    { x: -1, y: 0 },  // left
    { x: 0, y: 1 },   // down
    { x: 0, y: -1 }   // up
  ];

  function key(n) { return !!keys[n]; }
  function t(n) { return !!touches[n]; }

  function reset() {
    over = false; overSent = false;
    score = 0; coins = 0; time = 0; shake = 0;
    state = 'play'; level = 1; moves = 0; autoRotate = 0;
    buildLevel(1);
  }

  function callScore() { if (typeof onScore === 'function') onScore(score); }
  function callCoins() { if (typeof onCoins === 'function') onCoins(coins); }

  function die() {
    if (overSent) return;
    overSent = true; over = true; state = 'over';
    callScore();
    if (typeof onGameOver === 'function') onGameOver(score, coins);
  }

  function buildLevel(lv) {
    grid = [];
    for (let r = 0; r < ROWS; r++) {
      grid.push([]);
      for (let c = 0; c < COLS; c++) {
        grid[r].push(0);
      }
    }
    // border walls
    for (let c = 0; c < COLS; c++) { grid[0][c] = 1; grid[ROWS-1][c] = 1; }
    for (let r = 0; r < ROWS; r++) { grid[r][0] = 1; grid[r][COLS-1] = 1; }

    // Level generation
    if (lv === 1) {
      // simple: laser → target straight
      grid[3][4] = 1; grid[3][5] = 1; grid[3][6] = 1;
      grid[5][6] = 1; grid[5][5] = 1;
      grid[4][8] = 2; // mirror
      laser = { x: 3, y: 4, dir: 1, color: '#FF3B6B' };
      target = { x: 13, y: 4 };
    } else if (lv === 2) {
      grid[4][5] = 2; grid[4][6] = 2;
      grid[3][8] = 1; grid[5][8] = 1; grid[4][8] = 1;
      laser = { x: 2, y: 4, dir: 1, color: '#00FFFF' };
      target = { x: 13, y: 4 };
    } else if (lv === 3) {
      grid[2][5] = 2; grid[4][5] = 2;
      grid[3][7] = 1; grid[4][7] = 1; grid[5][7] = 1;
      grid[4][10] = 2;
      laser = { x: 2, y: 4, dir: 1, color: '#39FF88' };
      target = { x: 13, y: 6 };
    } else {
      // procedural random
      for (let r = 1; r < ROWS-1; r++) {
        for (let c = 1; c < COLS-1; c++) {
          if (Math.random() < 0.12) grid[r][c] = 1;
        }
      }
      // ensure path
      const startR = Math.floor(ROWS/2);
      grid[startR][1] = 0; grid[startR][2] = 0; grid[startR][3] = 0;
      grid[startR][4] = 0;
      // place mirrors
      grid[2][6] = 2; grid[5][9] = 2; grid[3][11] = 2;
      laser = { x: 2, y: startR, dir: 1, color: '#FF8A00' };
      target = { x: 13, y: Math.floor(Math.random()*(ROWS-2))+1 };
    }

    // collect mirror positions
    allMirrors = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] === 2) allMirrors.push({ r, c, rot: 0 });
      }
    }

    lights = [];
    for (let i = 0; i < 24; i++) {
      lights.push({ x: Math.random()*W, y: Math.random()*H, speed: 0.5+Math.random(), r: 1 });
    }

    moves = 0;
    computeBeam();
  }

  function cellCenter(c, r) {
    const cw = (W - 40) / COLS;
    const ch = (H - 40) / ROWS;
    return { x: 20 + c * cw + cw/2, y: 20 + r * ch + ch/2 };
  }

  function mirrorDir(normal, dir) {
    // mirror reflects
    if (normal === 0) {
      // "/" mirror: (1,0) ↔ (0,-1), (-1,0) ↔ (0,1)
      if (dir === 0) return 3;
      if (dir === 1) return 2;
      if (dir === 2) return 1;
      return 0;
    } else {
      // "\" mirror
      if (dir === 0) return 2;
      if (dir === 1) return 3;
      if (dir === 2) return 0;
      return 1;
    }
  }

  function computeBeam() {
    beam = [];
    if (!laser) return;
    const cw = (W - 40) / COLS;
    const ch = (H - 40) / ROWS;
    let x = laser.x, y = laser.y, dir = laser.dir;
    let start = cellCenter(x, y);
    let curX = start.x, curY = start.y;
    let steps = 0;
    beam.push({ x1: curX, y1: curY, x2: curX, y2: curY, color: laser.color });

    let hit = false;
    while (steps < 60) {
      // next cell
      let nx = x + DIRS[dir].x;
      let ny = y + DIRS[dir].y;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) break;
      const cell = grid[ny][nx];
      if (cell === 0) {
        // continue to next cell
        const nc = cellCenter(nx, ny);
        const lastSeg = beam[beam.length - 1];
        lastSeg.x2 = nc.x; lastSeg.y2 = nc.y;
        x = nx; y = ny;
        steps++;
      } else if (cell === 1) {
        // wall — stop at edge of that cell
        const nc = cellCenter(nx, ny);
        const lastSeg = beam[beam.length - 1];
        // endpoint at boundary
        if (dir === 0) { lastSeg.x2 = nc.x - cw/2; lastSeg.y2 = nc.y; }
        else if (dir === 1) { lastSeg.x2 = nc.x + cw/2; lastSeg.y2 = nc.y; }
        else if (dir === 2) { lastSeg.x2 = nc.x; lastSeg.y2 = nc.y + ch/2; }
        else { lastSeg.x2 = nc.x; lastSeg.y2 = nc.y - ch/2; }
        break;
      } else if (cell === 2) {
        // mirror — reflect
        const nc = cellCenter(nx, ny);
        const lastSeg = beam[beam.length - 1];
        lastSeg.x2 = nc.x; lastSeg.y2 = nc.y;
        // find mirror rotation
        const mir = allMirrors.find(m => m.r === ny && m.c === nx);
        const normal = mir ? (mir.rot % 2) : 0;
        dir = mirrorDir(normal, dir);
        x = nx; y = ny;
        // spawn new segment
        beam.push({ x1: nc.x, y1: nc.y, x2: nc.x + DIRS[dir].x * cw/4, y2: nc.y + DIRS[dir].y * ch/4, color: laser.color });
        steps++;
      } else if (cell === 3) {
        // target hit!
        const nc = cellCenter(nx, ny);
        const lastSeg = beam[beam.length - 1];
        lastSeg.x2 = nc.x; lastSeg.y2 = nc.y;
        hit = true;
        break;
      }
    }
    return { hit };
  }

  function rotateMirrorAt(r, c, delta) {
    const mir = allMirrors.find(m => m.r === r && m.c === c);
    if (mir) {
      mir.rot = (mir.rot + delta + 4) % 4;
      moves++;
      checkWin();
    }
  }

  function checkWin() {
    const { hit } = computeBeam();
    if (hit) {
      score += 100 + Math.max(0, 50 - moves * 5);
      callScore();
      coins += 3;
      callCoins();
      if (typeof window.playSfx === 'function') { try { window.playSfx('win'); } catch (e) {} }
      // next level
      setTimeout(() => {
        level++;
        buildLevel(level);
      }, 600);
    }
  }

  function input() {
    // tap on canvas handled by engine touch → find mirror near tap
    if (touches.pointerX !== undefined && touches.pointerJustTap) {
      const cw = (W - 40) / COLS, ch = (H - 40) / ROWS;
      const c = Math.floor((touches.pointerX - 20) / cw);
      const r = Math.floor((touches.pointerY - 20) / ch);
      if (c >= 0 && c < COLS && r >= 0 && r < ROWS && grid[r][c] === 2) {
        rotateMirrorAt(r, c, 1);
      }
      touches.pointerJustTap = false;
    }
    // keyboard rotate nearest
    if (key('KeyR') || t('action')) {
      if (allMirrors.length) {
        const m = allMirrors[0];
        rotateMirrorAt(m.r, m.c, key('ShiftLeft') || key('ShiftRight') ? -1 : 1);
      }
      // debounce to prevent spam
      keys['KeyR'] = false;
    }
  }

  function update(dt) {
    time += dt;
    if (shake > 0) shake -= dt;
    input();
    // animate lights
    for (const l of lights) {
      l.x += l.speed * 0.4 * dt * 60;
      l.y += Math.sin(time + l.speed * 3) * 0.3;
      if (l.x > W) l.x = 0;
    }
    render();
  }

  function drawGrid() {
    const cw = (W - 40) / COLS, ch = (H - 40) / ROWS;
    // floor
    ctx.fillStyle = '#060612';
    ctx.fillRect(20, 20, W - 40, H - 40);
    ctx.strokeStyle = 'rgba(0,255,255,.08)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(20 + c*cw, 20); ctx.lineTo(20 + c*cw, H - 20); ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(20, 20 + r*ch); ctx.lineTo(W - 20, 20 + r*ch); ctx.stroke();
    }

    // cells
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = 20 + c*cw, y = 20 + r*ch;
        const cell = grid[r][c];
        if (cell === 1) {
          ctx.fillStyle = '#1A1A2E';
          ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
        } else if (cell === 2) {
          // mirror
          const mir = allMirrors.find(m => m.r === r && m.c === c);
          const rot = mir ? mir.rot : 0;
          ctx.save();
          ctx.translate(x + cw/2, y + ch/2);
          ctx.rotate(rot * Math.PI/2 + (rot >= 2 ? Math.PI : 0));
          ctx.fillStyle = '#FFE600';
          ctx.shadowColor = '#FFE600';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(-cw*0.3, -ch*0.15);
          ctx.lineTo(cw*0.3, -ch*0.15);
          ctx.lineTo(cw*0.15, ch*0.2);
          ctx.lineTo(-cw*0.15, ch*0.2);
          ctx.closePath();
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#000';
          ctx.font = '10px Orbitron';
          ctx.textAlign = 'center';
          ctx.fillText('↻', 0, 4);
          ctx.restore();
        } else if (cell === 3) {
          // target
          ctx.fillStyle = '#FF3B6B';
          ctx.shadowColor = '#FF3B6B';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(x + cw/2, y + ch/2, cw*0.3, 0, Math.PI*2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#FFF';
          ctx.font = '12px "Press Start 2P"';
          ctx.textAlign = 'center';
          ctx.fillText('◎', x + cw/2, y + ch/2 + 4);
        }
      }
    }
  }

  function drawBeam() {
    for (const seg of beam) {
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = 4;
      ctx.shadowColor = seg.color;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();
      // glow pulse
      ctx.strokeStyle = 'rgba(255,255,255,.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  function drawLaser() {
    if (!laser) return;
    const c = cellCenter(laser.x, laser.y);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.fillStyle = laser.color;
    ctx.shadowColor = laser.color;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = '10px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText('▲', 0, 4);
    ctx.restore();
  }

  function drawLights() {
    for (const l of lights) {
      ctx.globalAlpha = 0.15 + Math.sin(time * 2 + l.speed * 10) * 0.1;
      ctx.fillStyle = '#ffE600';
      ctx.beginPath();
      ctx.arc(l.x, l.y, l.r, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawUI() {
    // HUD
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, 48);
    ctx.font = 'bold 22px Orbitron';
    ctx.fillStyle = '#FFE600';
    ctx.textAlign = 'left';
    ctx.shadowColor = '#FFE600';
    ctx.shadowBlur = 8;
    ctx.fillText('SCORE: ' + score.toLocaleString(), 16, 34);
    ctx.shadowBlur = 0;

    ctx.font = '14px Orbitron';
    ctx.fillStyle = '#00FFFF';
    ctx.textAlign = 'center';
    ctx.fillText('LEVEL ' + level, W/2, 30);

    ctx.font = '14px Orbitron';
    ctx.fillStyle = '#FFE600';
    ctx.textAlign = 'right';
    ctx.fillText('COINS: ' + coins, W - 16, 30);

    // moves
    ctx.font = '12px Space Grotesk';
    ctx.fillStyle = '#8A93A6';
    ctx.textAlign = 'center';
    ctx.fillText('MOVES: ' + moves, W/2, H - 8);
    ctx.textAlign = 'left';
  }

  function render() {
    // bg
    ctx.fillStyle = '#04040C';
    ctx.fillRect(0, 0, W, H);

    drawLights();
    drawGrid();
    drawBeam();
    drawLaser();
    drawUI();

    if (state === 'over') {
      ctx.fillStyle = 'rgba(0,0,10,0.9)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.font = 'bold 42px "Press Start 2P"';
      ctx.fillStyle = '#FF3B6B';
      ctx.shadowColor = '#FF3B6B';
      ctx.shadowBlur = 20;
      ctx.fillText('NO POWER!', W/2, H/2 - 50);
      ctx.shadowBlur = 0;
      ctx.font = '22px Orbitron';
      ctx.fillStyle = '#FFE600';
      ctx.fillText('SCORE: ' + score.toLocaleString(), W/2, H/2);
      ctx.fillStyle = '#00FFFF';
      ctx.fillText('LEVELS: ' + level, W/2, H/2 + 35);
      ctx.font = '14px Space Grotesk';
      ctx.fillStyle = '#8A93A6';
      ctx.fillText('TAP TO RETRY', W/2, H/2 + 80);
      ctx.textAlign = 'left';
    }
  }

  function loop(ts) {
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    if (running && !over) update(dt);
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
  function destroy() { running = false; over = true; cancelAnimationFrame(raf); }
  function setInput(ts, ks) { touches = ts || {}; keys = ks || {}; }
  function getHelp() { return 'TAP MIRROR TO ROTATE · ROTATE MIRRORS TO REFLECT LASER TO TARGET'; }

  return { start, pause, resume, destroy, setInput, getHelp };
}