/* ============================================================
   BANTUMI — Nokia Classic Mancala Tribute
   2-player Mancala: 6 pits per side + stores, tap to sow.
   AI opponent (medium difficulty). 800×450 canvas.
   Wooden / brown aesthetic with neon Nokia accents.
   ============================================================ */
window.engines = window.engines || {};
window.engines.bantumi = function(canvas, ctx, W, H, input, state) {
  'use strict';

  // ── Constants ──
  const PIT_RADIUS   = 28;
  const STONE_R      = 5;
  const BOARD_LEFT   = 120;
  const BOARD_RIGHT  = 680;
  const PIT_SPACING  = (BOARD_RIGHT - BOARD_LEFT) / 5;
  const TOP_Y        = 145;
  const BOT_Y        = 305;
  const STORE_CX_AI  = 58;
  const STORE_CX_PL  = 742;
  const STORE_CY     = (TOP_Y + BOT_Y) / 2;
  const STORE_W      = 56;
  const STORE_H      = 130;
  const SOW_DELAY    = 0.055;
  const AI_THINK     = 0.55;

  // ── Palette ──
  const C_BG         = '#120a04';
  const C_BOARD      = '#5a3518';
  const C_BOARD_LT   = '#7a4e2a';
  const C_BOARD_DK   = '#3c220e';
  const C_PIT        = '#2a1608';
  const C_PIT_PLAYER = '#00ff88';
  const C_PIT_AI     = '#ff3366';
  const C_STORE_BG   = '#3e2210';
  const C_STONE      = '#f0e8d8';
  const C_STONE_HI   = '#ffffff';
  const C_GOLD       = '#ffcc00';
  const C_GREEN      = '#00ff88';
  const C_RED        = '#ff3366';
  const C_CYAN       = '#00ccff';
  const C_DIM        = '#886644';

  // ── State ──
  let board, currentPlayer, phase, score, winner;
  let sowPos, sowIdx, sowTimer, sowSource, sowPlayer, sowCount, sowLast;
  let aiTimer, aiMove;
  let particles, overSent;
  let hoverPit, mx, my;
  let raf, lastTime;
  let clickQueue;          // buffered clicks from events

  // ── Helpers ──
  const rand   = (a, b) => Math.random() * (b - a) + a;
  const randI  = (a, b) => Math.floor(rand(a, b + 1));

  function pitXY(i) {
    if (i === 6)  return { x: STORE_CX_PL, y: STORE_CY };
    if (i === 13) return { x: STORE_CX_AI, y: STORE_CY };
    if (i <= 5)   return { x: BOARD_LEFT + i * PIT_SPACING, y: BOT_Y };
    return { x: BOARD_LEFT + (12 - i) * PIT_SPACING, y: TOP_Y };
  }

  function oppositePit(p) { return 12 - p; }

  function nextPos(pos, player) {
    let n = (pos + 1) % 14;
    if (player === 0 && n === 13) n = 0;   // skip AI store
    if (player === 1 && n === 6)  n = 7;   // skip player store
    return n;
  }

  function ownSide(p, player) {
    return player === 0 ? (p >= 0 && p <= 5) : (p >= 7 && p <= 12);
  }

  // ── Board Init ──
  function initBoard() {
    board = new Array(14).fill(0);
    for (let i = 0; i < 6; i++) { board[i] = 4; board[7 + i] = 4; }
  }

  function sideEmpty(player) {
    const s = player === 0 ? 0 : 7;
    for (let i = s; i < s + 6; i++) if (board[i] > 0) return false;
    return true;
  }

  function anySideEmpty() { return sideEmpty(0) || sideEmpty(1); }

  function cleanupBoard() {
    for (let i = 0; i < 6; i++) { board[6] += board[i]; board[i] = 0; }
    for (let i = 0; i < 6; i++) { board[13] += board[7 + i]; board[7 + i] = 0; }
  }

  // ── Sowing ──
  function sow(pit) {
    const stones = board[pit];
    board[pit] = 0;
    sowSource = pit;
    sowPlayer = currentPlayer;
    sowCount = stones;
    sowPos = [];
    let p = pit;
    for (let i = 0; i < stones; i++) { p = nextPos(p, sowPlayer); sowPos.push(p); }
    sowLast = sowPos[sowPos.length - 1];
    sowIdx = 0;
    sowTimer = 0;
    phase = 'sowing';
  }

  function sowStep() {
    if (sowIdx >= sowPos.length) return false;
    const pos = sowPos[sowIdx];
    board[pos]++;
    sowLast = pos;
    sowIdx++;
    const c = pitXY(pos);
    if (typeof window.playSfx === 'function') { try { window.playSfx('move'); } catch (e) {} }
    spawnBurst(c.x, c.y, sowPlayer === 0 ? C_GREEN : C_CYAN, 2);
    return true;
  }

  function afterSow() {
    const p = sowPlayer;
    // Extra turn?
    if ((p === 0 && sowLast === 6) || (p === 1 && sowLast === 13)) {
      if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
      phase = p === 0 ? 'playerTurn' : 'aiThink';
      if (p === 1) { aiTimer = 0; }
      return;
    }
    // Capture?
    if (ownSide(sowLast, p) && board[sowLast] === 1) {
      const opp = oppositePit(sowLast);
      if (board[opp] > 0) {
        const store = p === 0 ? 6 : 13;
        board[store] += 1 + board[opp];
        const cp1 = pitXY(sowLast), cp2 = pitXY(opp);
        spawnBurst(cp1.x, cp1.y, C_GOLD, 10);
        spawnBurst(cp2.x, cp2.y, C_GOLD, 10);
        if (typeof window.playSfx === 'function') { try { window.playSfx('coin'); } catch (e) {} }
        board[sowLast] = 0;
        board[opp] = 0;
      }
    }
    // Game over?
    if (anySideEmpty()) { finishGame(); return; }
    // Switch turn
    if (p === 0) { currentPlayer = 1; phase = 'aiThink'; aiTimer = 0; }
    else         { currentPlayer = 0; phase = 'playerTurn'; }
  }

  function finishGame() {
    cleanupBoard();
    const ps = board[6], ais = board[13];
    if (ps > ais)      { winner = 0; score = ps; if (typeof window.playSfx === 'function') { try { window.playSfx('win'); } catch (e) {} } }
    else if (ais > ps) { winner = 1; score = ps; if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} } }
    else               { winner = 2; score = ps; if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} } }
    phase = 'over';
    // report score to core once (core's endGame hooks: XP/missions/stars)
    if (typeof window.endGame === 'function' && !window._bantumiReported) {
      window._bantumiReported = true;
      window.endGame(score, 0);
    }
  }

  // ── AI (Medium) ──
  function aiBestMove() {
    const moves = [];
    for (let i = 7; i <= 12; i++) if (board[i] > 0) moves.push(i);
    if (moves.length === 0) return -1;

    let best = -1, bestS = -Infinity;
    for (const m of moves) {
      let s = 0;
      const saved = board.slice();
      // Simulate
      const stones = board[m];
      board[m] = 0;
      let p = m;
      let last = -1;
      for (let i = 0; i < stones; i++) { p = nextPos(p, 1); board[p]++; last = p; }

      const extraTurn = (last === 13);
      if (extraTurn) s += 160;

      const landedOwn = ownSide(last, 1) && board[last] === 1;
      if (landedOwn) {
        const opp = oppositePit(last);
        s += 90 + board[opp] * 25;
      }

      // Reward landing near store (pit 7 → lots of paths to store)
      // Pit 7 needs 6 stones to reach store; pit 12 needs 1 stone
      if (last === 13) s += 50;
      else if (ownSide(last, 1)) {
        // Prefer positions that chain into other non-empty pits
        if (board[last] > 1) s += 15;
      }

      // Penalize leaving own pit empty if opponent can capture
      // (simple heuristic: don't leave 1 stone in a pit with empty opposite)
      if (ownSide(last, 1) && board[last] === 1) {
        const opp = oppositePit(last);
        if (board[opp] > 0) s -= 30; // risky, opponent could capture
      }

      // Restore
      board.splice(0, 14, ...saved);

      s += rand(-8, 8); // mild randomness for medium difficulty
      if (s > bestS) { bestS = s; best = m; }
    }
    return best;
  }

  // ── Particles ──
  function spawnBurst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(20, 80);
      particles.push({ x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp,
        life: rand(0.2, 0.5), ml: 0.5, sz: rand(1, 3), color });
    }
  }
  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }
  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.ml);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ── Hit testing ──
  function hitPit(x, y) {
    for (let i = 0; i < 6; i++) {
      const c = pitXY(i);
      if ((x-c.x)**2 + (y-c.y)**2 <= (PIT_RADIUS+6)**2) return i;
    }
    return -1;
  }

  // ── Click handling ──
  function handleClick(x, y) {
    if (phase === 'title' || phase === 'over') {
      if (typeof window.playSfx === 'function') { try { window.playSfx('click'); } catch (e) {} }
      launchGame(); return;
    }
    if (phase !== 'playerTurn') return;
    const pit = hitPit(x, y);
    if (pit >= 0 && board[pit] > 0) {
      if (typeof window.playSfx === 'function') { try { window.playSfx('click'); } catch (e) {} }
      sow(pit);
    }
  }

  // ── Canvas events ──
  let _clk, _tch, _mov;
  function bindEvents() {
    unbindEvents();
    _clk = e => {
      const r = canvas.getBoundingClientRect();
      const sx = W / r.width, sy = H / r.height;
      clickQueue.push({ x: (e.clientX - r.left)*sx, y: (e.clientY - r.top)*sy });
    };
    _tch = e => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const t = e.touches[0];
      const sx = W / r.width, sy = H / r.height;
      clickQueue.push({ x: (t.clientX - r.left)*sx, y: (t.clientY - r.top)*sy });
    };
    _mov = e => {
      const r = canvas.getBoundingClientRect();
      const sx = W / r.width, sy = H / r.height;
      mx = (e.clientX - r.left)*sx; my = (e.clientY - r.top)*sy;
      hoverPit = hitPit(mx, my);
    };
    canvas.addEventListener('click', _clk);
    canvas.addEventListener('touchstart', _tch, { passive: false });
    canvas.addEventListener('mousemove', _mov);
  }
  function unbindEvents() {
    if (_clk) canvas.removeEventListener('click', _clk);
    if (_tch) canvas.removeEventListener('touchstart', _tch);
    if (_mov) canvas.removeEventListener('mousemove', _mov);
    _clk = _tch = _mov = null;
  }

  // ── Drawing ──
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w,y, x+w,y+h, r);
    ctx.arcTo(x+w,y+h, x,y+h, r);
    ctx.arcTo(x,y+h, x,y, r);
    ctx.arcTo(x,y, x+w,y, r);
    ctx.closePath();
  }

  function drawBoard() {
    // Background
    ctx.fillStyle = C_BG;
    ctx.fillRect(0, 0, W, H);

    // Board surface
    const bx = BOARD_LEFT - 58, by = 55;
    const bw = BOARD_RIGHT - BOARD_LEFT + 116;
    const bh = BOT_Y - TOP_Y + 140;

    ctx.fillStyle = C_BOARD_DK;
    roundRect(bx+4, by+4, bw, bh, 14); ctx.fill();

    ctx.fillStyle = C_BOARD;
    roundRect(bx, by, bw, bh, 14); ctx.fill();

    // Wood grain
    ctx.save(); ctx.clip();
    ctx.strokeStyle = C_BOARD_LT; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.25;
    for (let y2 = by; y2 < by+bh; y2 += 7) {
      ctx.beginPath(); ctx.moveTo(bx, y2);
      ctx.bezierCurveTo(bx+bw*0.33, y2+rand(-2,2), bx+bw*0.66, y2+rand(-2,2), bx+bw, y2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // Board border
    ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 2.5;
    roundRect(bx, by, bw, bh, 14); ctx.stroke();

    // Stores
    drawStore(13, 'CPU', C_RED);
    drawStore(6,  'YOU', C_GREEN);

    // Centre divider
    ctx.strokeStyle = 'rgba(255,204,0,0.15)'; ctx.lineWidth = 1;
    ctx.setLineDash([5,4]);
    ctx.beginPath();
    ctx.moveTo(BOARD_LEFT-15, STORE_CY);
    ctx.lineTo(BOARD_RIGHT+15, STORE_CY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Pits
    for (let i = 0; i < 14; i++) { if (i===6||i===13) continue; drawPit(i); }
  }

  function drawStore(i, label, accent) {
    const c = pitXY(i);
    ctx.fillStyle = C_STORE_BG;
    roundRect(c.x - STORE_W/2, c.y - STORE_H/2, STORE_W, STORE_H, 8);
    ctx.fill();

    // Neon border
    ctx.shadowColor = accent; ctx.shadowBlur = 10;
    ctx.strokeStyle = accent; ctx.lineWidth = 2;
    roundRect(c.x - STORE_W/2, c.y - STORE_H/2, STORE_W, STORE_H, 8);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Count
    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(board[i], c.x, c.y - 8);

    // Label
    ctx.fillStyle = accent; ctx.font = 'bold 11px monospace';
    ctx.fillText(label, c.x, c.y + 22);
  }

  function drawPit(i) {
    const c = pitXY(i);
    const isP = i <= 5;
    const stones = board[i];
    const hl = phase === 'playerTurn' && hoverPit === i && stones > 0;

    // Glow when hovered
    if (hl) { ctx.shadowColor = C_GOLD; ctx.shadowBlur = 14; }

    // Pit
    ctx.fillStyle = C_PIT;
    ctx.beginPath(); ctx.arc(c.x, c.y, PIT_RADIUS, 0, Math.PI*2); ctx.fill();

    // Rim
    ctx.strokeStyle = isP ? C_PIT_PLAYER : C_PIT_AI;
    ctx.lineWidth = hl ? 3 : 2;
    ctx.beginPath(); ctx.arc(c.x, c.y, PIT_RADIUS, 0, Math.PI*2); ctx.stroke();
    ctx.shadowBlur = 0;

    // Stones
    if (stones > 0) drawStones(c.x, c.y, stones);
  }

  function drawStones(cx, cy, n) {
    const sr = Math.min(STONE_R, PIT_RADIUS * 0.32);
    if (n <= 6) {
      const ar = PIT_RADIUS * 0.48;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        drawStone(cx + Math.cos(a)*ar, cy + Math.sin(a)*ar, sr);
      }
    } else {
      const cols = Math.min(4, Math.ceil(Math.sqrt(n)));
      const rows = Math.ceil(n / cols);
      const gap = sr * 2.4;
      const ox = cx - (cols-1)*gap/2, oy = cy - (rows-1)*gap/2;
      let idx = 0;
      for (let r = 0; r < rows && idx < n; r++)
        for (let c2 = 0; c2 < cols && idx < n; c2++, idx++)
          drawStone(ox + c2*gap, oy + r*gap, sr*0.8);
    }
  }

  function drawStone(x, y, r) {
    const g = ctx.createRadialGradient(x-r*0.3, y-r*0.3, 0, x, y, r);
    g.addColorStop(0, C_STONE_HI);
    g.addColorStop(0.4, C_STONE);
    g.addColorStop(1, '#8a7a60');
    ctx.fillStyle = g;
    ctx.shadowColor = 'rgba(255,255,220,0.4)'; ctx.shadowBlur = 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawTitle() {
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    // Neon title
    ctx.shadowColor = C_GREEN; ctx.shadowBlur = 24;
    ctx.fillStyle = C_GREEN;
    ctx.font = 'bold 52px monospace';
    ctx.fillText('BANTUMI', W/2, H/2-70);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.fillStyle = C_GOLD;
    ctx.font = '15px monospace';
    ctx.fillText('Nokia Classic Tribute', W/2, H/2-24);

    // How to play
    ctx.fillStyle = '#bbb'; ctx.font = '13px monospace';
    ctx.fillText('Tap a pit to sow stones counter-clockwise', W/2, H/2+22);
    ctx.fillText('Land in your store → extra turn', W/2, H/2+44);
    ctx.fillText('Capture opponent stones when you land empty', W/2, H/2+66);

    // Blink prompt
    if (Math.sin(Date.now()/320) > 0) {
      ctx.fillStyle = C_GREEN; ctx.font = 'bold 15px monospace';
      ctx.fillText('TAP OR PRESS ENTER TO START', W/2, H/2+110);
    }
  }

  function drawOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    let txt, col;
    if (winner === 0)      { txt = 'YOU WIN!'; col = C_GREEN; }
    else if (winner === 1) { txt = 'CPU WINS'; col = C_RED; }
    else                   { txt = 'DRAW';     col = C_GOLD; }

    ctx.shadowColor = col; ctx.shadowBlur = 22;
    ctx.fillStyle = col;
    ctx.font = 'bold 50px monospace';
    ctx.fillText(txt, W/2, H/2-70);
    ctx.shadowBlur = 0;

    // Scores
    ctx.font = '22px monospace';
    ctx.fillStyle = C_GREEN;
    ctx.fillText('You: ' + board[6], W/2 - 100, H/2-10);
    ctx.fillStyle = C_RED;
    ctx.fillText('CPU: ' + board[13], W/2 + 100, H/2-10);

    // Coins
    const coins = winner===0?50:winner===2?25:10;
    ctx.fillStyle = C_GOLD; ctx.font = '18px monospace';
    ctx.fillText('+' + coins + ' coins', W/2, H/2+35);

    // Replay
    if (Math.sin(Date.now()/320) > 0) {
      ctx.fillStyle = '#aaa'; ctx.font = '14px monospace';
      ctx.fillText('TAP OR PRESS ENTER TO PLAY AGAIN', W/2, H/2+80);
    }
  }

  function drawHUD() {
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';

    if (phase === 'playerTurn') {
      ctx.fillStyle = C_GREEN; ctx.font = 'bold 13px monospace';
      ctx.fillText('● YOUR TURN', W/2, 8);
    } else if (phase === 'aiThink') {
      ctx.fillStyle = C_RED; ctx.font = 'bold 13px monospace';
      const dots = '.'.repeat(1 + Math.floor(Date.now()/300) % 3);
      ctx.fillText('● CPU THINKING' + dots, W/2, 8);
    } else if (phase === 'sowing') {
      ctx.fillStyle = sowPlayer===0?C_GREEN:C_CYAN;
      ctx.font = 'bold 13px monospace';
      ctx.fillText('● SOWING', W/2, 8);
    }

    // Footer brand
    ctx.fillStyle = C_DIM; ctx.font = '12px monospace';
    ctx.textBaseline = 'bottom';
    ctx.fillText('BANTUMI', W/2, H - 6);
  }

  // ── Game flow ──
  function launchGame() {
    initBoard();
    currentPlayer = 0;
    phase = 'playerTurn';
    score = 0; winner = -1; overSent = false;
    particles = [];
    hoverPit = -1;
    window._bantumiReported = false;   // allow endGame report for this run
  }

  // ── Public API ──
  function start() {
    // Cancel any prior loop
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    initBoard();
    phase = 'title';
    clickQueue = [];
    particles = [];
    hoverPit = -1; mx = my = 0;
    overSent = false;
    bindEvents();
    lastTime = performance.now();
    loop();
  }

  function pause() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    unbindEvents();
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    update(dt);
    draw();
  }

  function update(dt) {
    // Drain click queue
    while (clickQueue.length) {
      const c = clickQueue.shift();
      handleClick(c.x, c.y);
    }

    // Keyboard shortcuts
    if (input && input.pressed) {
      if (input.pressed('enter') || input.pressed(' ')) {
        if (phase === 'title' || phase === 'over') launchGame();
      }
    }

    updateParticles(dt);

    if (phase === 'sowing') {
      sowTimer += dt;
      while (sowTimer >= SOW_DELAY) {
        sowTimer -= SOW_DELAY;
        if (!sowStep()) { afterSow(); break; }
      }
    }

    if (phase === 'aiThink') {
      aiTimer += dt;
      if (aiTimer >= AI_THINK) {
        const m = aiBestMove();
        if (m >= 0) sow(m);
        else { currentPlayer = 0; phase = 'playerTurn'; }
      }
    }
  }

  function draw() {
    drawBoard();
    drawParticles();
    if (phase === 'title') drawTitle();
    else if (phase === 'over') drawOver();
    else drawHUD();
  }

  return { start, update, draw, pause };
};

// core.js compatibility: expose as window.bantumi
if (window.engines && window.engines.bantumi) window.bantumi = window.engines.bantumi;
