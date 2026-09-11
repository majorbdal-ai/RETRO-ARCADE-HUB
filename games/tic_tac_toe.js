function ticTacToe(canvas, ctx, onScore, onGameOver, onCoins) {
  'use strict';
  var W = 800, H = 450;
let diffMul = 1;  // v7.20 difficulty ramp
  var CS = 116, OX = (W - 3 * CS) / 2, OY = 74;
  var raf = null, last = 0, running = false, over = false;
  var keys = {}, touches = {};
  var score = 0, coins = 0;
  var board = [], turn = 'X', cursor = 4, botTimer = 0;
  var matchOver = false, result = '', winLine = null;
  var time = 0, prevDirs = {}, prevAct = false;

  function idx(r, c) { return r * 3 + c; }

  function down(name, k) {
    return !!((touches && touches[name]) || (keys && k.some(function (x) { return !!keys[x]; })));
  }

  function winner(b) {
    var L = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    for (var i = 0; i < L.length; i++) {
      var a = L[i][0], bb = L[i][1], cc = L[i][2];
      if (b[a] && b[a] === b[bb] && b[bb] === b[cc]) return { who: b[a], cells: L[i] };
    }
    var full = true;
    for (var j = 0; j < 9; j++) if (!b[j]) { full = false; break; }
    return full ? { who: 'draw', cells: null } : null;
  }

  function empties(b) {
    var out = [];
    for (var i = 0; i < 9; i++) if (!b[i]) out.push(i);
    return out;
  }

  function minimax(b, player, depth) {
    var w = winner(b);
    if (w) {
      if (w.who === 'X') return { s: 10 - depth, m: -1 };
      if (w.who === 'O') return { s: depth - 10, m: -1 };
      return { s: 0, m: -1 };
    }
    var cells = empties(b);
    if (player === 'O') {
      var best = { s: -Infinity, m: -1 };
      for (var i = 0; i < cells.length; i++) {
        b[cells[i]] = 'O';
        var r = minimax(b, 'X', depth + 1);
        b[cells[i]] = '';
        if (r.s > best.s) best = { s: r.s, m: cells[i] };
      }
      return best;
    } else {
      var best2 = { s: Infinity, m: -1 };
      for (var j = 0; j < cells.length; j++) {
        b[cells[j]] = 'X';
        var r2 = minimax(b, 'O', depth + 1);
        b[cells[j]] = '';
        if (r2.s < best2.s) best2 = { s: r2.s, m: cells[j] };
      }
      return best2;
    }
  }

  function botMove() {
    var cells = empties(board);
    if (!cells.length) return -1;
    if (Math.random() < 0.12) return cells[Math.floor(Math.random() * cells.length)];
    var r = minimax(board.slice(), 'O', 0);
    return r.m >= 0 ? r.m : cells[0];
  }

  function endMatch(res) {
    if (matchOver) return;
    matchOver = true;
    result = res;
    if (res === 'win') {
      score++;
      coins = score * 2;
      if (onScore) onScore(score);
      if (onCoins) onCoins(coins);
    }
    if (typeof window.playSfx === 'function') {
      try {
        if (res === 'win') window.playSfx('win2');
        else if (res === 'draw') window.playSfx('move');
        else window.playSfx('error');
      } catch (e) {}
    }
    if (res === 'win' && typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(60); } catch (e) {}
    }
    if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
    over = true;
    if (onGameOver) if (typeof gameFX !== 'undefined') { try { var __r = canvas.getBoundingClientRect(); gameFX.burst(__r.left + (W/2) * __r.width / canvas.width, __r.top + (H/2) * __r.height / canvas.height, '#ff4444', 16); } catch(e){} gameFX.shake(5); }
      onGameOver(score, coins);
  }

  function checkEnd() {
    var w = winner(board);
    if (!w) return;
    if (w.who === 'X' || w.who === 'O') {
      winLine = w.cells;
      endMatch(w.who === 'X' ? 'win' : 'lose');
    } else {
      endMatch('draw');
    }
  }

  function place() {
    if (turn !== 'X' || matchOver) return;
    if (board[cursor]) return;
    board[cursor] = 'X';
    turn = 'O';
    botTimer = 0;
    if (typeof window.playSfx === 'function') { try { window.playSfx('click'); } catch (e) {} }
    checkEnd();
  }

  function moveCursor(c, dx, dy) {
    var rr = Math.floor(c / 3), cc = c % 3;
    rr = Math.max(0, Math.min(2, rr + dy));
    cc = Math.max(0, Math.min(2, cc + dx));
    return idx(rr, cc);
  }

  function reset() {
    board = ['', '', '', '', '', '', '', '', ''];
    turn = 'X'; cursor = 4; botTimer = 0;
    matchOver = false; result = ''; winLine = null;
    time = 0; prevDirs = {}; prevAct = false;
  }

  function update(dt) {
    time += dt;
    if (matchOver) return;
    var l = down('left', ['ArrowLeft', 'KeyA']);
    var r = down('right', ['ArrowRight', 'KeyD']);
    var u = down('up', ['ArrowUp', 'KeyW']);
    var d = down('down', ['ArrowDown', 'KeyS']);
    var act = down('action', ['Space', 'Enter']);
    var steer = ((r ? 1 : 0) - (l ? 1 : 0)) + ':' + ((d ? 1 : 0) - (u ? 1 : 0));
    if (prevDirs[steer] !== true && (l || r || u || d)) {
      if (r) cursor = moveCursor(cursor, 1, 0);
      else if (l) cursor = moveCursor(cursor, -1, 0);
      else if (u) cursor = moveCursor(cursor, 0, -1);
      else if (d) cursor = moveCursor(cursor, 0, 1);
    }
    prevDirs = {};
    if (l || r || u || d) prevDirs[steer] = true;
    if (act && !prevAct) place();
    prevAct = act;
    if (turn === 'O' && !matchOver) {
      botTimer += dt;
      if (botTimer > 0.45) {
        var m = botMove();
        if (m >= 0) {
          board[m] = 'O';
          turn = 'X';
          checkEnd();
        }
        botTimer = 0;
      }
    }
  }

  function draw() {
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#05070f');
    grad.addColorStop(1, '#0b1024');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.strokeStyle = '#3bc9ff';
    ctx.shadowColor = '#3bc9ff'; ctx.shadowBlur = 12;
    ctx.lineWidth = 3;
    for (var i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(OX + i * CS, OY);
      ctx.lineTo(OX + i * CS, OY + 3 * CS);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(OX, OY + i * CS);
      ctx.lineTo(OX + 3 * CS, OY + i * CS);
      ctx.stroke();
    }
    ctx.restore();
    var cr = Math.floor(cursor / 3), cc = cursor % 3;
    ctx.save();
    ctx.strokeStyle = '#ffd23b';
    ctx.shadowColor = '#ffd23b'; ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    var pad = 6;
    ctx.strokeRect(OX + cc * CS + pad, OY + cr * CS + pad, CS - pad * 2, CS - pad * 2);
    ctx.restore();
    for (var m = 0; m < 9; m++) {
      if (!board[m]) continue;
      var mr = Math.floor(m / 3), mc = m % 3;
      var cx = OX + mc * CS + CS / 2, cy = OY + mr * CS + CS / 2;
      if (board[m] === 'X') {
        ctx.save();
        ctx.strokeStyle = '#2bff88';
        ctx.shadowColor = '#2bff88'; ctx.shadowBlur = 12;
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        var r2 = CS * 0.28;
        ctx.beginPath();
        ctx.moveTo(cx - r2, cy - r2); ctx.lineTo(cx + r2, cy + r2);
        ctx.moveTo(cx + r2, cy - r2); ctx.lineTo(cx - r2, cy + r2);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.save();
        ctx.strokeStyle = '#ff3b6b';
        ctx.shadowColor = '#ff3b6b'; ctx.shadowBlur = 12;
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(cx, cy, CS * 0.26, 0, 6.283); ctx.stroke();
        ctx.restore();
      }
    }
    if (winLine) {
      var a = winLine[0], b = winLine[2];
      var x1 = OX + (a % 3) * CS + CS / 2, y1 = OY + Math.floor(a / 3) * CS + CS / 2;
      var x2 = OX + (b % 3) * CS + CS / 2, y2 = OY + Math.floor(b / 3) * CS + CS / 2;
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.shadowColor = '#ffd23b'; ctx.shadowBlur = 16;
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#3bc9ff'; ctx.shadowColor = '#3bc9ff'; ctx.shadowBlur = 10;
    ctx.font = 'bold 17px monospace';
    ctx.fillText('NEON TIC TAC TOE', 12, 24);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#7f92b8';
    ctx.font = '11px monospace';
    ctx.fillText('ARROWS MOVE · TAP / SPACE PLACES X · YOU ARE X', 12, 42);
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd23b'; ctx.shadowColor = '#ffd23b'; ctx.shadowBlur = 8;
    ctx.font = 'bold 14px monospace';
    ctx.fillText('WINS ' + score, W - 14, 22);
    ctx.fillStyle = '#3bc9ff';
    ctx.fillText('TURN: ' + (turn === 'X' ? 'YOU' : 'BOT'), W - 14, 42);
    ctx.restore();
    if (matchOver) {
      ctx.save();
      ctx.fillStyle = 'rgba(3,5,12,0.82)';
      ctx.fillRect(0, H / 2 - 56, W, 112);
      ctx.textAlign = 'center';
      var col = result === 'win' ? '#2bff88' : (result === 'draw' ? '#ffd23b' : '#ff3b6b');
      ctx.fillStyle = col;
      ctx.shadowColor = col; ctx.shadowBlur = 14;
      ctx.font = 'bold 30px monospace';
      ctx.fillText(result === 'win' ? 'YOU WIN!' : (result === 'draw' ? 'DRAW' : 'BOT WINS'), W / 2, H / 2 + 6);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#e8f4ff';
      ctx.font = '13px monospace';
      ctx.fillText(result === 'win' ? 'PERFECT 3-IN-A-ROW' : 'PLAY AGAIN TO RISE', W / 2, H / 2 + 30);
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
    setDifficulty: function(lvl){ diffMul = [1,1.15,1.3,1.5,1.75,2][Math.min(5,Math.floor(lvl)||0)]||1; }
  };
}