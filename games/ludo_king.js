/* ============================================================
   Ludo King — Neon Ludo Arcade Game
   Canvas 800x450, 2 players: human RED vs bot BLUE
   Simplified 15-cell shared track + 3-cell home column each
   Tap dice / ACTION button to roll, 6 = extra turn + base exit
   Capture opponent = send back to base. Exact roll to enter home.
   ============================================================ */
function ludoKing(canvas, ctx, onScore, onGameOver, onCoins) {
  // ---- state ----
  const W = 800, H = 450;
  let raf = null, last = 0, running = false;
  let score = 0, coins = 0, over = false;
  let gameT = 0;

  // ---- board geometry ----
  const CX = 400, CY = 225, R = 185, NCELLS = 15, HOME_LEN = 3;
  const TRACK = [];
  for (let i = 0; i < NCELLS; i++) {
    const a = (90 - 24 * i) * Math.PI / 180;
    TRACK.push({ x: CX + Math.cos(a) * R, y: CY + Math.sin(a) * R });
  }
  const RED_START = 0, BLUE_START = 7;
  const RED_HOME = [], BLUE_HOME = [];
  for (let h = 0; h < HOME_LEN; h++) {
    const r = R - 52 - h * 41;
    const ar = 114 * Math.PI / 180, ab = -54 * Math.PI / 180;
    RED_HOME.push({ x: CX + Math.cos(ar) * r, y: CY + Math.sin(ar) * r });
    BLUE_HOME.push({ x: CX + Math.cos(ab) * r, y: CY + Math.sin(ab) * r });
  }
  const RED_BASE = { x: 665, y: 385 };
  const BLUE_BASE = { x: 665, y: 65 };
  const BASE_OFF = [[-26, -26], [26, -26], [-26, 26], [26, 26]];
  function baseSlot(base, i) {
    return { x: base.x + BASE_OFF[i][0], y: base.y + BASE_OFF[i][1] };
  }
  function doneSpot(player, n) {
    return { x: CX - 36 + n * 24, y: player === 'red' ? CY + 34 : CY - 34 };
  }
  const DICE = { x: 105, y: 82 };

    let mobile = false;

// ---- players ----
  const players = { red: { tokens: [], captures: 0, homeCount: 0 }, blue: { tokens: [], captures: 0, homeCount: 0 } };
  for (const c of ['red', 'blue']) {
    for (let i = 0; i < 4; i++) {
      const t = { color: c, idx: i, state: 'base', cell: -1, done: false, x: 0, y: 0 };
      t.x = baseSlot(c === 'red' ? RED_BASE : BLUE_BASE, i).x;
      t.y = baseSlot(c === 'red' ? RED_BASE : BLUE_BASE, i).y;
      players[c].tokens.push(t);
    }
  }

  // ---- game flow ----
  let turn = 'red';
  let phase = 'roll'; // roll | dice | move | anim | switch
  let rollValue = 0, diceAnim = 0;
  let pendingMoves = [];
  let moveAnim = null;
  let switchT = 0, botTimer = 0;
  let botDelayScale = 1.0; // multiplied with base delay (difficulty ramp)
  let diffLevel = 0;
  let msg = '', msgT = 0, msgColor = '#FFFFFF';
  let flash = [];
  let actEdge = false, tapPt = null, kp = {};
  let prevKeys = {}, prevTx = -1, prevTy = -1, prevAct = false;

  // ---- input ----
  let touches = {}, keys = {};

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
  function tokenXY(tk) { return { x: tk.x, y: tk.y }; }
  function flashMsg(s, c) { msg = s; msgColor = c || '#FFFFFF'; msgT = 1.1; }

  function updateScore() {
    score = players.red.homeCount * 1000 + players.red.captures * 100;
    onScore(score);
  }

  // ---- rules ----
  function validMoves(player, roll) {
    const res = [];
    const start = player === 'red' ? RED_START : BLUE_START;
    players[player].tokens.forEach(function (tk, idx) {
      if (tk.done) return;
      if (tk.state === 'base') {
        if (roll === 6) res.push({ idx: idx, result: { state: 'track', cell: start } });
        return;
      }
      const stepsLeft = tk.state === 'track' ? (14 - tk.cell) + (HOME_LEN + 1) : (HOME_LEN - tk.cell);
      if (roll > stepsLeft) return; // overshoot: exact roll needed to enter home
      let result;
      if (roll === stepsLeft) result = { done: true };
      else if (tk.state === 'track') {
        const np = tk.cell + roll;
        result = np <= 14 ? { state: 'track', cell: np } : { state: 'home', cell: np - 15 };
      } else result = { state: 'home', cell: tk.cell + roll };
      res.push({ idx: idx, result: result });
    });
    return res;
  }

  function doRoll(v) { rollValue = v; diceAnim = 0.6; phase = 'dice'; if (typeof window.playSfx === 'function') { try { window.playSfx('click'); } catch (e) {} } }

  function finalizeRoll() {
    const mvs = validMoves(turn, rollValue);
    if (mvs.length === 0) {
      flashMsg('NO VALID MOVE', '#FF4444');
      phase = 'switch'; switchT = 0.9;
    } else if (turn === 'red') {
      if (mvs.length === 1) startMove(mvs[0]);
      else { pendingMoves = mvs; phase = 'move'; flashMsg('TAP A TOKEN', '#00FFFF'); }
    } else {
      startMove(mvs[Math.floor(Math.random() * mvs.length)]);
    }
  }

  function startMove(m) {
    const tk = players[turn].tokens[m.idx];
    let to;
    if (m.result.done) to = doneSpot(turn, players[turn].homeCount);
    else if (m.result.state === 'track') to = TRACK[m.result.cell];
    else to = turn === 'red' ? RED_HOME[m.result.cell] : BLUE_HOME[m.result.cell];
    moveAnim = { tk: tk, m: m, from: { x: tk.x, y: tk.y }, to: to, t: 0, dur: 0.28 };
    phase = 'anim';
  }

  function finishMove() {
    const m = moveAnim.m, tk = moveAnim.tk;
    moveAnim = null;
    if (typeof window.playSfx === 'function') { try { window.playSfx('move'); } catch (e) {} }
    tk.x = m.result.done ? doneSpot(turn, players[turn].homeCount).x : (m.result.state === 'track' ? TRACK[m.result.cell].x : (turn === 'red' ? RED_HOME[m.result.cell].x : BLUE_HOME[m.result.cell].x));
    tk.y = m.result.done ? doneSpot(turn, players[turn].homeCount).y : (m.result.state === 'track' ? TRACK[m.result.cell].y : (turn === 'red' ? RED_HOME[m.result.cell].y : BLUE_HOME[m.result.cell].y));
    if (m.result.done) {
      tk.done = true; tk.state = 'home'; tk.cell = HOME_LEN;
      players[turn].homeCount++;
      if (turn === 'red') { updateScore(); flashMsg('TOKEN HOME!', '#FFE600'); }
      if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
      if (players[turn].homeCount === 4) { endGame(); return; }
    } else {
      tk.state = m.result.state; tk.cell = m.result.cell;
      if (tk.state === 'track') {
        const opp = turn === 'red' ? players.blue : players.red;
        let captured = 0;
        for (const ot of opp.tokens) {
          if (!ot.done && ot.state === 'track' && ot.cell === tk.cell) {
            ot.state = 'base'; ot.cell = -1;
            const bs = baseSlot(turn === 'red' ? BLUE_BASE : RED_BASE, ot.idx);
            ot.x = bs.x; ot.y = bs.y;
            captured++;
            flash.push({ x: TRACK[tk.cell].x, y: TRACK[tk.cell].y, t: 0.5, c: turn === 'red' ? '#00FFFF' : '#FF10F0' });
          }
        }
        if (captured > 0) {
          players[turn].captures += captured;
          if (turn === 'red') { coins += 10 * captured; onCoins(10 * captured); updateScore(); flashMsg('CAPTURE! +' + captured * 100, '#FFE600'); }
          if (typeof window.playSfx === 'function') { try { window.playSfx('error'); } catch (e) {} }
          if (navigator.vibrate) { try { navigator.vibrate(60); } catch (e) {} }
        }
      }
    }
    afterMove();
  }

  function afterMove() {
    if (rollValue === 6) {
      flashMsg('EXTRA TURN!', '#39FF88');
      phase = 'roll';
      if (turn === 'blue') botTimer = 0.8 * botDelayScale;
    } else {
      switchTurn();
    }
  }

  function switchTurn() {
    turn = turn === 'red' ? 'blue' : 'red';
    pendingMoves = [];
    phase = 'roll';
    if (turn === 'blue') { botTimer = 0.7 * botDelayScale; flashMsg('BOT TURN', '#FF10F0'); }
    else flashMsg('YOUR TURN', '#FF4444');
  }

  function endGame() {
    over = true;
    running = false;
    if (raf) cancelAnimationFrame(raf);
    if (navigator.vibrate) { try { navigator.vibrate([120, 60, 120]); } catch (e) {} }
    if (players.red.homeCount === 4) { coins += 100; onCoins(100); }
    if (typeof gameFX !== 'undefined') { try { var __r = canvas.getBoundingClientRect(); gameFX.burst(__r.left + (W/2) * __r.width / canvas.width, __r.top + (H/2) * __r.height / canvas.height, '#ff4444', 16); } catch(e){} gameFX.shake(5); }
      onGameOver(score, coins);
  }

  function reset() {
    score = 0; coins = 0; over = false; gameT = 0;
    players.red.captures = 0; players.red.homeCount = 0;
    players.blue.captures = 0; players.blue.homeCount = 0;
    for (const c of ['red', 'blue']) {
      for (const t of players[c].tokens) {
        t.state = 'base'; t.cell = -1; t.done = false;
        const bs = baseSlot(c === 'red' ? RED_BASE : BLUE_BASE, t.idx);
        t.x = bs.x; t.y = bs.y;
      }
    }
    turn = 'red'; phase = 'roll';
    rollValue = 0; diceAnim = 0; pendingMoves = []; moveAnim = null;
    switchT = 0; botTimer = 0; flash = [];
    msg = ''; msgT = 0; actEdge = false; tapPt = null; kp = {};
    prevKeys = {}; prevTx = -1; prevTy = -1; prevAct = false;
  }

  // ---- update ----
  function update(dt) {
    if (over || !running) return;
    gameT += dt;
    if (msgT > 0) { msgT -= dt; if (msgT <= 0) msg = ''; }
    for (const f of flash) f.t -= dt;
    flash = flash.filter(function (f) { return f.t > 0; });

    if (phase === 'dice') {
      diceAnim -= dt;
      if (diceAnim <= 0) { diceAnim = 0; finalizeRoll(); }
    } else if (phase === 'anim') {
      moveAnim.t += dt;
      if (moveAnim.t >= moveAnim.dur) finishMove();
    } else if (phase === 'switch') {
      switchT -= dt;
      if (switchT <= 0) switchTurn();
    } else if (phase === 'roll') {
      if (turn === 'blue') {
        botTimer -= dt;
        if (botTimer <= 0) { botTimer = 9999; doRoll(1 + Math.floor(Math.random() * 6)); }
      } else {
        if (actEdge || kp.Space || kp.Enter || kp.KeyR) {
          doRoll(1 + Math.floor(Math.random() * 6));
        } else if (tapPt) {
          if (Math.abs(tapPt.x - DICE.x) < 60 && Math.abs(tapPt.y - DICE.y) < 60) {
            doRoll(1 + Math.floor(Math.random() * 6));
          }
          tapPt = null;
        }
      }
    } else if (phase === 'move') {
      let sel = -1;
      for (let i = 0; i < 4; i++) {
        if (kp['Digit' + (i + 1)] || kp['Numpad' + (i + 1)]) sel = i;
      }
      if (sel < 0 && tapPt) {
        let bestD = 60;
        for (let i = 0; i < 4; i++) {
          const tk = players.red.tokens[i];
          if (tk.done) continue;
          const d = Math.hypot(tapPt.x - tk.x, tapPt.y - tk.y);
          if (d < bestD) { bestD = d; sel = i; }
        }
      }
      if (tapPt) tapPt = null;
      if (sel >= 0) {
        for (const mv of pendingMoves) {
          if (mv.idx === sel) { pendingMoves = []; startMove(mv); break; }
        }
      }
    }
    actEdge = false;
    kp = {};
  }

  // ---- render ----
  function drawDice(x, y, s, val) {
    const bx = x - s / 2, by = y - s / 2;
    // die body
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#FFFFFF';
    ctx.fillStyle = '#0E1420';
    ctx.fillRect(bx, by, s, s);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#39FF88';
    ctx.lineWidth = 3;
    ctx.strokeRect(bx, by, s, s);
    // pips
    const pip = s * 0.13;
    const off = s * 0.24;
    const locs = {
      1: [[0, 0]],
      2: [[-1, -1], [1, 1]],
      3: [[-1, -1], [0, 0], [1, 1]],
      4: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
      5: [[-1, -1], [-1, 1], [0, 0], [1, -1], [1, 1]],
      6: [[-1, -1], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 1]]
    };
    const pts = locs[val] || [];
    for (const p of pts) {
      circle(x + p[0] * off, y + p[1] * off, pip, '#39FF88', 8);
    }
  }

  function render() {
    // bg
    ctx.fillStyle = '#05070A';
    ctx.fillRect(0, 0, W, H);
    // subtle grid
    ctx.strokeStyle = 'rgba(0,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (let gy = 0; gy < H; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

    // track cells
    for (let i = 0; i < NCELLS; i++) {
      const c = TRACK[i];
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#00FFFF';
      ctx.fillStyle = i === RED_START ? '#3A0A12' : (i === BLUE_START ? '#0A123A' : '#0B0F1A');
      ctx.fillRect(c.x - 15, c.y - 15, 30, 30);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#00FFFF';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(c.x - 15, c.y - 15, 30, 30);
    }
    // home columns
    for (let h = 0; h < HOME_LEN; h++) {
      const rc = RED_HOME[h], bc = BLUE_HOME[h];
      ctx.fillStyle = '#3A0A12';
      ctx.strokeStyle = '#FF4444';
      ctx.fillRect(rc.x - 13, rc.y - 13, 26, 26);
      ctx.strokeRect(rc.x - 13, rc.y - 13, 26, 26);
      ctx.fillStyle = '#0A123A';
      ctx.strokeStyle = '#4488FF';
      ctx.fillRect(bc.x - 13, bc.y - 13, 26, 26);
      ctx.strokeRect(bc.x - 13, bc.y - 13, 26, 26);
    }
    // center home
    ctx.shadowBlur = 22;
    ctx.shadowColor = '#FFE600';
    ctx.fillStyle = '#1A1405';
    ctx.beginPath();
    ctx.arc(CX, CY, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#FFE600';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#FFE600';
    ctx.fillStyle = '#FFE600';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('HOME', CX, CY + 4);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';

    // bases
    for (const b of [{ b: RED_BASE, c: '#FF4444' }, { b: BLUE_BASE, c: '#4488FF' }]) {
      ctx.shadowBlur = 16;
      ctx.shadowColor = b.c;
      ctx.strokeStyle = b.c;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(b.b.x, b.b.y, 44, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fill();
      for (let i = 0; i < 4; i++) {
        const s = baseSlot(b.b, i);
        ctx.fillStyle = '#0E1420';
        ctx.beginPath(); ctx.arc(s.x, s.y, 14, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = b.c;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(s.x, s.y, 14, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // tokens
    const pulse = 0.5 + 0.5 * Math.sin(gameT * 6);
    for (const c of ['red', 'blue']) {
      for (const tk of players[c].tokens) {
        if (tk.done) {
          circle(tk.x, tk.y, 9, c === 'red' ? '#FF4444' : '#4488FF', 10);
          continue;
        }
        const movable = phase === 'move' && c === 'red' && pendingMoves.some(function (m) { return m.idx === tk.idx && !tk.done; });
        const rr = movable ? 15 + pulse * 3 : 13;
        circle(tk.x, tk.y, rr, c === 'red' ? '#FF4444' : '#4488FF', mobile ? 18 : (movable ? 20 : 14));
        circle(tk.x, tk.y, 5, '#FFFFFF', 6);
      }
    }

    // capture flashes
    for (const f of flash) {
      circle(f.x, f.y, 26 * (1 - f.t / 0.5) + 4, f.c, 20);
    }

    // dice
    const showVal = phase === 'dice' ? 1 + Math.floor(Math.random() * 6) : (phase === 'roll' || phase === 'move' ? (rollValue || 0) : rollValue);
    const ds = phase === 'dice' ? 66 + Math.sin(gameT * 40) * 4 : 66;
    drawDice(DICE.x, DICE.y, ds, showVal);
    ctx.fillStyle = '#39FF88';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ROLL', DICE.x, DICE.y - 40);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px monospace';
    ctx.fillText('SPACE / TAP', DICE.x, DICE.y + 46);
    ctx.textAlign = 'left';

    // turn banner
    const tc = turn === 'red' ? '#FF4444' : '#4488FF';
    ctx.shadowBlur = 10;
    ctx.shadowColor = tc;
    ctx.fillStyle = tc;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(turn === 'red' ? 'YOUR TURN' : 'BOT TURN', CX, 24);
    ctx.shadowBlur = 0;
    // home progress
    ctx.fillStyle = '#FF4444';
    ctx.font = '12px monospace';
    ctx.fillText('RED ' + players.red.homeCount + '/4', CX - 70, 42);
    ctx.fillStyle = '#4488FF';
    ctx.fillText('BLUE ' + players.blue.homeCount + '/4', CX + 70, 42);
    ctx.textAlign = 'left';

    // HUD score
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00FFFF';
    ctx.fillStyle = '#00FFFF';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('SCORE ' + score, 12, 26);
    ctx.shadowColor = '#FFE600';
    ctx.fillStyle = '#FFE600';
    ctx.fillText('COINS ' + coins, 12, 46);
    ctx.shadowBlur = 0;

    // toast
    if (msg && msgT > 0) {
      ctx.shadowBlur = 18;
      ctx.shadowColor = msgColor;
      ctx.fillStyle = msgColor;
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(msg, CX, H - 26);
      ctx.textAlign = 'left';
      ctx.shadowBlur = 0;
    }

    // game over overlay
    if (over) {
      ctx.fillStyle = 'rgba(5,7,10,0.85)';
      ctx.fillRect(0, 0, W, H);
      ctx.shadowBlur = 20;
      ctx.shadowColor = players.red.homeCount === 4 ? '#FFE600' : '#FF10F0';
      ctx.fillStyle = players.red.homeCount === 4 ? '#FFE600' : '#FF4444';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(players.red.homeCount === 4 ? 'VICTORY!' : 'DEFEAT', W / 2, H / 2 - 30);
      ctx.shadowColor = '#00FFFF';
      ctx.fillStyle = '#00FFFF';
      ctx.font = '18px monospace';
      ctx.fillText('SCORE: ' + score, W / 2, H / 2 + 10);
      ctx.fillText('COINS: ' + coins, W / 2, H / 2 + 38);
      ctx.textAlign = 'left';
      ctx.shadowBlur = 0;
    }
  }

  // ---- loop ----
  function loop(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    update(dt);
    render();
    raf = requestAnimationFrame(loop);
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
      touches = t || {}; keys = k || {};
      if (touches.action && !prevAct) actEdge = true;
      prevAct = !!touches.action;
      kp = {};
      for (const kk in keys) {
        if (keys[kk] && !prevKeys[kk]) kp[kk] = true;
      }
      prevKeys = Object.assign({}, keys);
      if (typeof touches.x === 'number' && typeof touches.y === 'number') {
        if (touches.x !== prevTx || touches.y !== prevTy) tapPt = { x: touches.x, y: touches.y };
        prevTx = touches.x; prevTy = touches.y;
      }
    },
    // which controls this game needs
    controls: { joystick: false, boost: false, action: true, drift: false },
    setDifficulty: function(level) {
      const l = Math.max(0, Math.min(5, Math.floor(level) || 0));
      diffLevel = l;
      // Bot delay multiplier: at level 5 bot thinks at ~30% of normal time
      botDelayScale = [1.0, 0.85, 0.7, 0.55, 0.4, 0.3][l];
    }
  };
}