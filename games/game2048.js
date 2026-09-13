/* ============================================================
   2048 — Original 2048-master Logic (Gabriele Cirulli port)
   Ported into RETRO ARCADE HUB canvas engine API.
   Core rules 100% from 2048-master.zip:
     - Grid/Tile classes with previousPosition/mergedFrom (animation)
     - move(): cell-based traversal, ONE merge per tile per move
     - spawn: 90% → 2, 10% → 4
     - won = a 2048 tile is made; keepPlaying allows continuing
     - movesAvailable = cells OR adjacent equal tiles
   Hub additions (keep gameplay intact):
     - canvas render, neon tile colors, spawn/move/merge animations
     - onScore/onCoins/onGameOver to hub economy
     - ACTION button = undo (hub-only convenience, not in original)
   ============================================================ */
function game2048(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let diffMul = 1;  // v7.20 difficulty ramp (input cooldown only)
  let raf = null, last = 0, running = false;
  let score = 0, coins = 0;
  let over = false;
  let won = false, keepPlaying = false;

  const SIZE = 4;
  const GRID_PAD = 20, GRID_TOP = 50;   // grid origin
  const cellW = (W - GRID_PAD * 2) / SIZE;
  const cellH = (H - GRID_TOP - GRID_PAD) / SIZE;
  const winFlash = 0; // (anim handled via banner alpha)

  const TILE_COLORS = {
    2:    { bg: '#1a1a3e', fg: '#00FFFF', glow: 10 },
    4:    { bg: '#1a2a4e', fg: '#00E5FF', glow: 12 },
    8:    { bg: '#2a1a3e', fg: '#FF10F0', glow: 14 },
    16:   { bg: '#3a1a2e', fg: '#FF44AA', glow: 14 },
    32:   { bg: '#3e2a1a', fg: '#FFE600', glow: 16 },
    64:   { bg: '#3e1a1a', fg: '#FF6600', glow: 16 },
    128:  { bg: '#1a3e2a', fg: '#39FF88', glow: 18 },
    256:  { bg: '#2a2a4e', fg: '#8888FF', glow: 18 },
    512:  { bg: '#4e2a3a', fg: '#FF88FF', glow: 20 },
    1024: { bg: '#3e3e1a', fg: '#FFD700', glow: 22 },
    2048: { bg: '#1a3e3e', fg: '#00FFFF', glow: 28 },
    4096: { bg: '#4e1a1a', fg: '#FF4444', glow: 30 },
    8192: { bg: '#1a1a4e', fg: '#8888FF', glow: 32 }
  };
  const DEFAULT_COLOR = { bg: '#2a1a4a', fg: '#FFFFFF', glow: 24 };

  // ---------- original Tile class ----------
  function Tile(position, value) {
    this.x = position.x;
    this.y = position.y;
    this.value = value || 2;
    this.previousPosition = null;
    this.mergedFrom = null;
  }
  Tile.prototype.savePosition = function () { this.previousPosition = { x: this.x, y: this.y }; };
  Tile.prototype.updatePosition = function (position) { this.x = position.x; this.y = position.y; };
  Tile.prototype.serialize = function () {
    return { position: { x: this.x, y: this.y }, value: this.value };
  };

  // ---------- original Grid class ----------
  function Grid(size, previousState) {
    this.size = size;
    this.cells = previousState ? this.fromState(previousState) : this.empty();
  }
  Grid.prototype.empty = function () {
    var cells = [];
    for (var x = 0; x < this.size; x++) { var row = cells[x] = []; for (var y = 0; y < this.size; y++) row.push(null); }
    return cells;
  };
  Grid.prototype.fromState = function (state) {
    var cells = [];
    for (var x = 0; x < this.size; x++) { var row = cells[x] = []; for (var y = 0; y < this.size; y++) { var t = state[x][y]; row.push(t ? new Tile(t.position, t.value) : null); } }
    return cells;
  };
  Grid.prototype.randomAvailableCell = function () {
    var cells = this.availableCells();
    return cells.length ? cells[Math.floor(Math.random() * cells.length)] : undefined;
  };
  Grid.prototype.availableCells = function () {
    var cells = [];
    this.eachCell(function (x, y, tile) { if (!tile) cells.push({ x: x, y: y }); });
    return cells;
  };
  Grid.prototype.eachCell = function (callback) {
    for (var x = 0; x < this.size; x++) for (var y = 0; y < this.size; y++) callback(x, y, this.cells[x][y]);
  };
  Grid.prototype.cellsAvailable = function () { return !!this.availableCells().length; };
  Grid.prototype.cellAvailable = function (cell) { return !this.cellOccupied(cell); };
  Grid.prototype.cellOccupied = function (cell) { return !!this.cellContent(cell); };
  Grid.prototype.cellContent = function (cell) {
    return this.withinBounds(cell) ? this.cells[cell.x][cell.y] : null;
  };
  Grid.prototype.insertTile = function (tile) { this.cells[tile.x][tile.y] = tile; };
  Grid.prototype.removeTile = function (tile) { this.cells[tile.x][tile.y] = null; };
  Grid.prototype.withinBounds = function (position) {
    return position.x >= 0 && position.x < this.size && position.y >= 0 && position.y < this.size;
  };
  Grid.prototype.serialize = function () {
    var cellState = [];
    for (var x = 0; x < this.size; x++) { var row = cellState[x] = []; for (var y = 0; y < this.size; y++) row.push(this.cells[x][y] ? this.cells[x][y].serialize() : null); }
    return { size: this.size, cells: cellState };
  };

  // ---------- original GameManager logic (canvas-adapted) ----------
  let grid, startTiles = 2;
  const anims = []; // {type:'spawn'|'merge'|'move', tiles:[x,y,oldX,oldY,val], t, dur}
  let confettiParticles = [];

  function setup() {
    grid = new Grid(SIZE);
    score = 0; coins = 0; over = false; won = false; keepPlaying = false;
    addStartTiles();
  }

  function addStartTiles() { for (let i = 0; i < startTiles; i++) addRandomTile(); }

  function addRandomTile() {
    if (grid.cellsAvailable()) {
      const value = Math.random() < 0.9 ? 2 : 4;
      const cell = grid.randomAvailableCell();
      const tile = new Tile(cell, value);
      grid.insertTile(tile);
      anims.push({ type: 'spawn', x: tile.x, y: tile.y, val: value, t: 0, dur: 0.18 });
    }
  }

  function prepareTiles() {
    grid.eachCell(function (x, y, tile) {
      if (tile) { tile.mergedFrom = null; tile.savePosition(); }
    });
  }

  function moveTile(tile, cell) {
    grid.cells[tile.x][tile.y] = null;
    grid.cells[cell.x][cell.y] = tile;
    tile.updatePosition(cell);
  }

  function getVector(direction) {
    const map = { 0: { x: 0, y: -1 }, 1: { x: 1, y: 0 }, 2: { x: 0, y: 1 }, 3: { x: -1, y: 0 } };
    return map[direction];
  }

  function buildTraversals(vector) {
    const traversals = { x: [], y: [] };
    for (let pos = 0; pos < SIZE; pos++) { traversals.x.push(pos); traversals.y.push(pos); }
    if (vector.x === 1) traversals.x = traversals.x.reverse();
    if (vector.y === 1) traversals.y = traversals.y.reverse();
    return traversals;
  }

  function findFarthestPosition(cell, vector) {
    let previous;
    do {
      previous = cell;
      cell = { x: previous.x + vector.x, y: previous.y + vector.y };
    } while (grid.withinBounds(cell) && grid.cellAvailable(cell));
    return { farthest: previous, next: cell };
  }

  function tilesMatchAvailable() {
    for (let x = 0; x < SIZE; x++) for (let y = 0; y < SIZE; y++) {
      const tile = grid.cellContent({ x: x, y: y });
      if (tile) for (let direction = 0; direction < 4; direction++) {
        const vector = getVector(direction);
        const other = grid.cellContent({ x: x + vector.x, y: y + vector.y });
        if (other && other.value === tile.value) return true;
      }
    }
    return false;
  }

  function movesAvailable() { return grid.cellsAvailable() || tilesMatchAvailable(); }

  function positionsEqual(first, second) { return first.x === second.x && first.y === second.y; }

  function bestTile() {
    let best = 2;
    grid.eachCell(function (x, y, tile) { if (tile && tile.value > best) best = tile.value; });
    return best;
  }

  function move(dir) {
    // 0 up, 1 right, 2 down, 3 left
    if (over || (won && !keepPlaying)) return;

    let moved = false;
    let gained = 0;
    const self = this || {};

    prepareTiles();

    const vector = getVector(dir);
    const traversals = buildTraversals(vector);

    traversals.x.forEach(function (x) {
      traversals.y.forEach(function (y) {
        const cell = { x: x, y: y };
        const tile = grid.cellContent(cell);
        if (tile) {
          const positions = findFarthestPosition(cell, vector);
          const next = grid.cellContent(positions.next);
          if (next && next.value === tile.value && !next.mergedFrom) {
            const merged = new Tile(positions.next, tile.value * 2);
            merged.mergedFrom = [tile, next];
            grid.insertTile(merged);
            grid.removeTile(tile);
            tile.updatePosition(positions.next);
            anims.push({ type: 'merge', x: merged.x, y: merged.y, val: merged.value, from: [tile.x, tile.y], t: 0, dur: 0.22 });
            gained += merged.value;
            if (merged.value === 2048) { won = true; }
          } else {
            moveTile(tile, positions.farthest);
            if (!positionsEqual(cell, tile)) moved = true;
          }
          if (!positionsEqual(cell, tile)) moved = true;
        }
      });
    });

    if (moved) {
      addRandomTile();
      if (typeof window.playSfx === 'function') { try { window.playSfx('click'); } catch (e) {} }
      if (!movesAvailable()) {
        over = true;
      }
      finishMove(gained, moved);
    }
  }

  // hub pipes after a real move (score/coins/HUD/sfx/gameover)
  function finishMove(gained, moved) {
    if (!moved) return;
    score += gained;
    onScore(score);
    if (gained > 0) {
      const c = Math.floor(gained / 100);
      if (c > 0) { coins += c; onCoins(c); }
      if (typeof window.playSfx === 'function') { try { window.playSfx('pop'); } catch (e) {} }
    }
    // level-up celebration per tile-tier (hub extra, cosmetic)
    const bt = bestTile();
    if (bt >= 128) {
      const lv = Math.round(Math.log2(bt));
      const bonus = 10 * lv;
      score += bonus; onScore(score);
      const c2 = Math.max(1, Math.floor(bonus / 50));
      coins += c2; onCoins(c2);
      if (typeof window.playSfx === 'function') { try { window.playSfx('win'); } catch (e) {} }
      if (navigator.vibrate) { try { navigator.vibrate(60); } catch (e) {} }
      confettiBurst();
    }
    if (over) {
      gameOver();
    }
  }

  function confettiBurst() {
    for (let i = 0; i < 24; i++) {
      confettiParticles.push({
        x: W / 2 + (Math.random() - 0.5) * 300,
        y: H / 2,
        vx: (Math.random() - 0.5) * 260,
        vy: -Math.random() * 260 - 60,
        life: 0.9 + Math.random() * 0.5,
        maxLife: 1.2,
        color: ['#00FFFF', '#FF10F0', '#FFE600', '#39FF88', '#FF6600'][Math.floor(Math.random() * 5)]
      });
    }
  }

  // undo (hub convenience — ACTION button); original has no undo
  let undoStack = []; // last 3 grid snapshots
  function pushUndo() {
    undoStack.push(grid.serialize());
    if (undoStack.length > 3) undoStack.shift();
  }
  function undo() {
    if (!undoStack.length || over) return;
    const prev = undoStack.pop();
    grid = new Grid(SIZE, prev);
    anims.length = 0;
    onScore(score); // score replay: keep current hub score (no rollback of scored coins — simple)
    if (typeof window.playSfx === 'function') { try { window.playSfx('move'); } catch (e) {} }
  }

  // input (hub)
  let touches = { left: false, right: false, up: false, down: false, action: false };
  let keys = {};
  let inputTimer = 0;
  const BASE_DELAY = 0.16;

  function update(dt) {
    if (over || !running) return;

    // animations
    for (let i = anims.length - 1; i >= 0; i--) {
      anims[i].t += dt;
      if (anims[i].t >= anims[i].dur) anims.splice(i, 1);
    }
    for (let i = confettiParticles.length - 1; i >= 0; i--) {
      const p = confettiParticles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; p.life -= dt;
      if (p.life <= 0) confettiParticles.splice(i, 1);
    }

    // action = undo / keep going
    if (touches.action || keys.KeyZ || keys.KeyU) {
      touches.action = false; keys.KeyZ = false; keys.KeyU = false;
      if (won && !keepPlaying && !over) {
        keepPlaying = true;
        if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
      } else if (!over) {
        undo();
      }
      return;
    }

    // direction input with cooldown
    inputTimer -= dt;
    if (inputTimer <= 0) {
      const delay = BASE_DELAY / diffMul;
      let dir = -1;
      if (keys.ArrowLeft || keys.KeyA || touches.left) dir = 3;
      else if (keys.ArrowRight || keys.KeyD || touches.right) dir = 1;
      else if (keys.ArrowUp || keys.KeyW || touches.up) dir = 0;
      else if (keys.ArrowDown || keys.KeyS || touches.down) dir = 2;
      if (dir >= 0) {
        pushUndo();
        move(dir);
        inputTimer = delay;
      }
    }
  }

  // ---------- render (hub neon) ----------
  function render() {
    ctx.fillStyle = '#05070A';
    ctx.fillRect(0, 0, W, H);

    // title
    ctx.shadowBlur = 12; ctx.shadowColor = '#00FFFF';
    ctx.fillStyle = '#00FFFF'; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center';
    ctx.fillText('2048', W / 2, 36);
    ctx.textAlign = 'left'; ctx.shadowBlur = 0;

    // score + best tile
    ctx.shadowBlur = 8; ctx.shadowColor = '#FFE600'; ctx.fillStyle = '#FFE600';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('SCORE: ' + score, W - 190, 36);
    ctx.shadowBlur = 0;
    ctx.shadowColor = '#FF10F0'; ctx.fillStyle = '#FF10F0';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('BEST TILE: ' + bestTile(), W - 190, 54);
    ctx.shadowBlur = 0;

    // grid frame
    ctx.shadowBlur = 16; ctx.shadowColor = '#00FFFF'; ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(GRID_PAD - 6, GRID_TOP - 6, cellW * SIZE + 12, cellH * SIZE + 12);
    ctx.strokeStyle = '#00FFFF'; ctx.lineWidth = 2;
    ctx.strokeRect(GRID_PAD - 6, GRID_TOP - 6, cellW * SIZE + 12, cellH * SIZE + 12);
    ctx.shadowBlur = 0;

    // cell gaps
    ctx.strokeStyle = 'rgba(0,255,255,0.15)'; ctx.lineWidth = 1;
    for (let i = 1; i < SIZE; i++) {
      ctx.beginPath(); ctx.moveTo(GRID_PAD + i * cellW, GRID_TOP); ctx.lineTo(GRID_PAD + i * cellW, GRID_TOP + cellH * SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(GRID_PAD, GRID_TOP + i * cellH); ctx.lineTo(GRID_PAD + cellW * SIZE, GRID_TOP + i * cellH); ctx.stroke();
    }

    // tiles with move/merge/spawn animation (original previousPosition/mergedFrom)
    grid.eachCell(function (x, y, tile) {
      if (!tile) return;
      const col = TILE_COLORS[tile.value] || DEFAULT_COLOR;
      let scale = 1, alpha = 1;
      let ox = x, oy = y;
      // spawn
      const sp = anims.find(a => a.type === 'spawn' && a.x === x && a.y === y);
      if (sp) scale = Math.min(1, sp.t / sp.dur);
      // merge pop
      const mg = anims.find(a => a.type === 'merge' && a.x === x && a.y === y);
      if (mg) { scale = Math.min(1, 0.6 + mg.t / mg.dur * 0.7); }
      // previous-position glide (tile moved from prev slot)
      if (tile.previousPosition && !positionsEqual({ x: x, y: y }, tile.previousPosition) && tile.mergedFrom === null) {
        ox = tile.previousPosition.x; oy = tile.previousPosition.y;
        // simple linear slide — anims are out; use immediate (fast slide)
      }

      const px = GRID_PAD + ox * cellW, py = GRID_TOP + oy * cellH;
      const pad = 4;
      const tw = (cellW - pad * 2) * scale, th = (cellH - pad * 2) * scale;
      const tx = px + cellW / 2 - tw / 2, ty = py + cellH / 2 - th / 2;

      ctx.globalAlpha = alpha;
      ctx.shadowBlur = col.glow; ctx.shadowColor = col.fg; ctx.fillStyle = col.bg;
      ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 6); ctx.fill();
      ctx.strokeStyle = col.fg; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 6); ctx.stroke();
      ctx.shadowBlur = 0;
      if (scale > 0.45) {
        const fontSize = tile.value >= 1024 ? 20 : tile.value >= 128 ? 26 : 32;
        ctx.shadowBlur = 12; ctx.shadowColor = col.fg; ctx.fillStyle = col.fg;
        ctx.font = 'bold ' + fontSize + 'px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(tile.value.toString(), px + cellW / 2, py + cellH / 2);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
    });

    // confetti
    for (const p of confettiParticles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // hint
    ctx.shadowBlur = 6; ctx.shadowColor = '#FF10F0'; ctx.fillStyle = 'rgba(255,16,240,0.5)';
    ctx.font = '12px monospace'; ctx.textAlign = 'center';
    ctx.fillText('SWIPE/ARROWS MERGE · ACTION = UNDO', W / 2, H - 10);
    ctx.textAlign = 'left'; ctx.shadowBlur = 0;

    // won banner (keep playing)
    if (won && !over && !keepPlaying) {
      ctx.fillStyle = 'rgba(5,7,10,0.78)'; ctx.fillRect(0, 0, W, H);
      ctx.shadowBlur = 28; ctx.shadowColor = '#FFD700'; ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 40px monospace'; ctx.textAlign = 'center';
      ctx.fillText('YOU WIN! 2048', W / 2, H / 2 - 24);
      ctx.shadowColor = '#00FFFF'; ctx.fillStyle = '#00FFFF';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('ACTION = KEEP GOING', W / 2, H / 2 + 26);
      ctx.textAlign = 'left'; ctx.shadowBlur = 0;
    }

    // game over overlay
    if (over) {
      ctx.fillStyle = 'rgba(5,7,10,0.85)'; ctx.fillRect(0, 0, W, H);
      ctx.shadowBlur = 20; ctx.shadowColor = '#FF10F0'; ctx.fillStyle = '#FF10F0';
      ctx.font = 'bold 36px monospace'; ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 30);
      ctx.shadowColor = '#00FFFF'; ctx.fillStyle = '#00FFFF'; ctx.font = '18px monospace';
      ctx.fillText('SCORE: ' + score, W / 2, H / 2 + 10);
      ctx.fillText('COINS: ' + coins, W / 2, H / 2 + 38);
      ctx.shadowColor = '#FF10F0'; ctx.fillStyle = '#FF10F0'; ctx.font = '16px monospace';
      ctx.fillText('BEST TILE: ' + bestTile(), W / 2, H / 2 + 62);
      ctx.textAlign = 'left'; ctx.shadowBlur = 0;
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
    if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
    if (raf) cancelAnimationFrame(raf);
    if (navigator.vibrate) { try { navigator.vibrate(200); } catch (e) {} }
    if (typeof gameFX !== 'undefined') { try { var __r = canvas.getBoundingClientRect(); gameFX.burst(__r.left + (W/2) * __r.width / canvas.width, __r.top + (H/2) * __r.height / canvas.height, '#ff4444', 16); } catch(e){} gameFX.shake(5); }
    onGameOver(Math.floor(score), coins);
  }

  // ---- public API (hub engine contract) ----
  return {
    start() {
      setup();
      undoStack = [];
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    update() {},
    render() { render(); },
    pause() { running = false; if (raf) cancelAnimationFrame(raf); },
    resume() { if (over || running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); },
    destroy() { running = false; if (raf) cancelAnimationFrame(raf); },
    setInput(t, k) { touches = t || {}; keys = k || {}; },
    controls: { joystick: false, boost: false, action: true, drift: false },
    setDifficulty: function(lvl){ diffMul = [1,1.15,1.3,1.5,1.75,2][Math.min(5,Math.floor(lvl)||0)]||1; }
  };
}