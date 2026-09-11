function flowFree(canvas, ctx, onScore, onGameOver, onCoins) {
  'use strict';
  var W = 800, H = 450;
  var N = 5, CS = 72;
  var GX = (W - N * CS) / 2, GY = 64;
  var raf = null, last = 0, running = false, over = false;
  var keys = {}, touches = {};
  var score = 0, coins = 0, level = 1;
  var levelSkip = 0; // bonus levels advanced on completion (difficulty ramp)
  var diffLevel = 0;
  var docks = [], used = [], locks = [], owner = [], path = [], active = -1;
  var time = 0, prevDirs = {}, prevAct = false, prevSpace = false;

  var LEVELS = [
    ['R....', 'R.B.B', '.....', 'G....', 'G....'],
    ['RB...', 'RBG..', '.....', '...G.', 'R....'],
    ['R...R', 'G....', 'Y..Y.', 'G....', 'B...B'],
    ['R....', 'B....', 'G.G..', 'Y.Y..', 'B...R'],
    ['RB...', '.B...', '....R', 'G....', 'G....'],
    ['R....', 'R.G.G', '.B.B.', '.Y.Y.', '.....'],
    ['B.RG.', 'B.RG.', '.....', '.....', '..R..'],
    ['R....', 'B...R', 'B...G', 'Y..Y.', 'G....'],
    ['R....', 'B...R', '....G', '.G...', 'B.Y.Y'],
    ['R...R', 'GY..P', '..Y..', 'G.P..', 'B...B']
  ];
  var LETTERS = { R: 0, B: 1, G: 2, Y: 3, P: 4, C: 5 };
  var PALETTE = ['#ff3b6b', '#3bc9ff', '#2bff88', '#ffd23b', '#b06bff', '#ff8c3b'];

  function down(name, k) {
    return !!((touches && touches[name]) || (keys && k.some(function (x) { return !!keys[x]; })));
  }

  function loadLevel(lv) {
    var map = LEVELS[lv - 1];
    docks = []; used = [];
    for (var r = 0; r < N; r++) {
      for (var c = 0; c < N; c++) {
        var ch = map[r].charAt(c);
        if (ch !== '.') {
          var ci = LETTERS[ch];
          docks.push({ c: ci, r: r, col: c });
          if (used.indexOf(ci) === -1) used.push(ci);
        }
      }
    }
    locks = []; owner = [];
    for (var i = 0; i < N; i++) {
      locks.push([-1, -1, -1, -1, -1]);
      owner.push([-1, -1, -1, -1, -1]);
    }
    path = [];
    active = used.length ? used[0] : -1;
  }

  function dockAt(r, c) {
    for (var i = 0; i < docks.length; i++) {
      if (docks[i].r === r && docks[i].col === c) return docks[i];
    }
    return null;
  }

  function completeColor(ci) {
    var n = 0;
    for (var i = 0; i < docks.length; i++) {
      if (docks[i].c === ci && locks[docks[i].r][docks[i].col] === ci) n++;
    }
    return n === 2;
  }

  function nextUnfinished(from) {
    for (var i = 1; i <= used.length; i++) {
      var ci = used[(from + i) % used.length];
      if (!completeColor(ci)) return ci;
    }
    return -1;
  }

  function resetPath() {
    for (var i = 0; i < path.length; i++) owner[path[i].r][path[i].col] = -1;
    path = [];
  }

  function levelComplete() {
    score += 100;
    if (onScore) onScore(score);
    var nc = Math.floor(score / 200);
    if (nc !== coins) { coins = nc; if (onCoins) onCoins(coins); }
    level += 1 + levelSkip;
    if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
    if (level > LEVELS.length) {
      over = true;
      if (onGameOver) if (typeof gameFX !== 'undefined') { try { var __r = canvas.getBoundingClientRect(); gameFX.burst(__r.left + (W/2) * __r.width / canvas.width, __r.top + (H/2) * __r.height / canvas.height, '#ff4444', 16); } catch(e){} gameFX.shake(5); }
      onGameOver(score, coins);
    } else {
      loadLevel(level);
    }
  }

  function tryMove(dr, dc) {
    if (path.length === 0) {
      for (var i = 0; i < docks.length; i++) {
        var d0 = docks[i];
        if (d0.c === active) {
          path.push({ r: d0.r, col: d0.col });
          break;
        }
      }
      if (path.length === 0) return;
    }
    var tip = path[path.length - 1];
    var nr = tip.r + dr, nc = tip.col + dc;
    if (nr < 0 || nr >= N || nc < 0 || nc >= N) return;
    var dk = dockAt(nr, nc);
    if (dk) {
      if (dk.c === active) {
        if (nr === path[0].r && nc === path[0].col) return;
        for (var j = 0; j < path.length; j++) {
          locks[path[j].r][path[j].col] = active;
          owner[path[j].r][path[j].col] = -1;
        }
        locks[nr][nc] = active;
        path = [];
        if (typeof window.playSfx === 'function') { try { window.playSfx('click'); } catch (e) {} }
        var nx = nextUnfinished(active);
        if (nx === -1) levelComplete();
        else active = nx;
      }
      return;
    }
    if (locks[nr][nc] !== -1) return;
    if (owner[nr][nc] !== -1) return;
    path.push({ r: nr, col: nc });
    owner[nr][nc] = active;
  }

  function update(dt) {
    time += dt;
    var actRaw = !!(touches && touches.action) || !!(keys && keys.Enter);
    var spRaw = !!(keys && keys.Space);
    if (actRaw && !prevAct) {
      var nxA = nextUnfinished(active);
      if (nxA !== -1) { resetPath(); active = nxA; }
    }
    prevAct = actRaw;
    if (spRaw && !prevSpace) resetPath();
    prevSpace = spRaw;
    var dl = down('left', ['ArrowLeft', 'KeyA']);
    var drr = down('right', ['ArrowRight', 'KeyD']);
    var du = down('up', ['ArrowUp', 'KeyW']);
    var dd = down('down', ['ArrowDown', 'KeyS']);
    var dX = (drr ? 1 : 0) - (dl ? 1 : 0);
    var dY = (dd ? 1 : 0) - (du ? 1 : 0);
    if (dX !== 0 && dY !== 0) { dX = 0; dY = 0; }
    if ((dX !== 0 || dY !== 0) && prevDirs[dX + ':' + dY] !== true) tryMove(dX, dY);
    prevDirs = {};
    if (dX !== 0 || dY !== 0) prevDirs[dX + ':' + dY] = true;
  }

  function draw() {
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#05070f');
    grad.addColorStop(1, '#0b1024');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.strokeStyle = 'rgba(120,140,190,0.25)';
    ctx.lineWidth = 1;
    for (var i = 0; i <= N; i++) {
      ctx.beginPath();
      ctx.moveTo(GX + i * CS, GY);
      ctx.lineTo(GX + i * CS, GY + N * CS);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(GX, GY + i * CS);
      ctx.lineTo(GX + N * CS, GY + i * CS);
      ctx.stroke();
    }
    ctx.restore();
    for (var r = 0; r < N; r++) {
      for (var c = 0; c < N; c++) {
        var lc = locks[r][c];
        if (lc !== -1) {
          ctx.save();
          ctx.shadowColor = PALETTE[lc]; ctx.shadowBlur = 10;
          ctx.fillStyle = PALETTE[lc];
          ctx.fillRect(GX + c * CS + 3, GY + r * CS + 3, CS - 6, CS - 6);
          ctx.restore();
        }
      }
    }
    for (var r2 = 0; r2 < N; r2++) {
      for (var c2 = 0; c2 < N; c2++) {
        var oc = owner[r2][c2];
        if (oc !== -1 && locks[r2][c2] === -1) {
          ctx.save();
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = PALETTE[oc];
          ctx.fillRect(GX + c2 * CS + 3, GY + r2 * CS + 3, CS - 6, CS - 6);
          ctx.restore();
        }
      }
    }
    ctx.save();
    ctx.lineCap = 'round';
    for (var i2 = 1; i2 < path.length; i2++) {
      var a = path[i2 - 1], b = path[i2];
      ctx.strokeStyle = PALETTE[active];
      ctx.shadowColor = PALETTE[active]; ctx.shadowBlur = 8;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(GX + a.col * CS + CS / 2, GY + a.r * CS + CS / 2);
      ctx.lineTo(GX + b.col * CS + CS / 2, GY + b.r * CS + CS / 2);
      ctx.stroke();
    }
    ctx.restore();
    for (var d = 0; d < docks.length; d++) {
      var dk = docks[d];
      var isLocked = locks[dk.r][dk.col] === dk.c;
      var isActive = dk.c === active && !isLocked;
      var cx = GX + dk.col * CS + CS / 2, cy = GY + dk.r * CS + CS / 2;
      ctx.save();
      ctx.shadowColor = PALETTE[dk.c]; ctx.shadowBlur = 16;
      if (isActive) {
        ctx.strokeStyle = PALETTE[dk.c];
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, cy, 12 + Math.sin(time * 5) * 2, 0, 6.283); ctx.stroke();
        ctx.fillStyle = PALETTE[dk.c];
        ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 6.283); ctx.fill();
      } else {
        ctx.fillStyle = isLocked ? PALETTE[dk.c] : '#ffffff';
        ctx.beginPath(); ctx.arc(cx, cy, 11, 0, 6.283); ctx.fill();
        if (!isLocked) {
          ctx.fillStyle = PALETTE[dk.c];
          ctx.beginPath(); ctx.arc(cx, cy, 6.5, 0, 6.283); ctx.fill();
        }
      }
      ctx.restore();
    }
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#3bc9ff'; ctx.shadowColor = '#3bc9ff'; ctx.shadowBlur = 10;
    ctx.font = 'bold 17px monospace';
    ctx.fillText('NEON FLOW', 12, 24);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#7f92b8';
    ctx.font = '11px monospace';
    ctx.fillText('TAP = SWITCH COLOR · ARROWS = DRAW · SPACE = UNDO PATH', 12, 42);
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd23b'; ctx.shadowColor = '#ffd23b'; ctx.shadowBlur = 8;
    ctx.font = 'bold 15px monospace';
    ctx.fillText('LEVEL ' + level + ' / ' + LEVELS.length, W - 14, 24);
    ctx.fillStyle = '#2bff88';
    ctx.fillText('SCORE ' + score, W - 14, 46);
    ctx.restore();
    var names = ['R', 'G', 'B', 'Y', 'P', 'C'];
    if (active >= 0 && active < names.length) {
      ctx.save();
      ctx.textAlign = 'right';
      ctx.fillStyle = PALETTE[active];
      ctx.shadowColor = PALETTE[active]; ctx.shadowBlur = 8;
      ctx.font = 'bold 12px monospace';
      ctx.fillText('DRAWING: ' + names[active], W - 14, 66);
      ctx.restore();
    }
    if (over) {
      ctx.save();
      ctx.fillStyle = 'rgba(3,5,12,0.82)';
      ctx.fillRect(0, H / 2 - 46, W, 92);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#2bff88'; ctx.shadowColor = '#2bff88'; ctx.shadowBlur = 14;
      ctx.font = 'bold 30px monospace';
      ctx.fillText('ALL LEVELS CLEARED!', W / 2, H / 2 + 8);
      ctx.fillStyle = '#e8f4ff'; ctx.shadowBlur = 0;
      ctx.font = '13px monospace';
      ctx.fillText('SCORE ' + score + '  ·  COINS ' + coins, W / 2, H / 2 + 32);
      ctx.restore();
    }
  }

  function loop(ts) {
    var dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    update(dt);
    draw();
    if (!over) raf = requestAnimationFrame(loop);
  }

  function reset() {
    score = 0; coins = 0; over = false; time = 0;
    loadLevel(level);
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
    if (!over && !running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }

  function destroy() { running = false; over = true; cancelAnimationFrame(raf); }

  return {
    start: start,
    pause: pause,
    resume: resume,
    destroy: destroy,
    setInput: function (t, k) { touches = t || {}; keys = k || {}; },
    setDifficulty: function(level) {
      var l = Math.max(0, Math.min(5, Math.floor(level) || 0));
      diffLevel = l;
      // Higher difficulty skips ahead through levels faster
      levelSkip = [0, 0, 1, 1, 2, 2][l];
    }
  };
}