function mastermind(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
let diffMul = 1;  // v7.20 difficulty ramp
  let raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  let keys = {}, touches = {};
  let secret = [];
  let guesses = [];
  let currentGuess = [];
  let selected = 0;
  let maxTries = 10;
  let colors = ['#ff0044', '#00ff88', '#00ccff', '#ffcc00', '#ff8800', '#cc44ff'];
  let win = false;
  // code master level: every solved code → next round, harder
  let level = 1, levelFlash = 0, roundMsg = '', roundMsgT = 0;

  function reset() {
    secret = [];
    guesses = [];
    currentGuess = [0, 0, 0, 0];
    selected = 0;
    score = 0;
    coins = 0;
    over = false;
    win = false;
    level = 1; levelFlash = 0; roundMsg = ''; roundMsgT = 0;
    onScore(0);
    for (let i = 0; i < 4; i++) {
      secret.push(Math.floor(Math.random() * colors.length));
    }
  }

  function submitGuess() {
    if (over) return;
    if (typeof window.playSfx === 'function') { try { window.playSfx('pop'); } catch (e) {} }
    const guess = currentGuess.slice();
    guesses.push({ guess: guess, result: evaluate(guess) });
    score += guess[0] === secret[0] ? 20 : 0;
    score += guess[1] === secret[1] ? 20 : 0;
    score += guess[2] === secret[2] ? 20 : 0;
    score += guess[3] === secret[3] ? 20 : 0;
    onScore(score);

    const exact = guess.filter((c, i) => c === secret[i]).length;
    if (exact === 4) {
      // ---- code master: solved! next round ----
      level++;
      levelFlash = 1.4;
      const lvBonus = 50 * level;
      score += lvBonus;
      coins += 2 + level;
      if (typeof onCoins === 'function') onCoins(coins);
      if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
      win = true;
      roundMsg = 'CODE ' + (level - 1) + ' CRACKED! ROUND ' + level;
      roundMsgT = 1.8;
      guesses = [];
      currentGuess = [0, 0, 0, 0];
      selected = 0;
      secret = [];
      const colorCount = Math.min(6 + Math.floor(level / 2), 8);
      for (let i = 0; i < 4; i++) {
        secret.push(Math.floor(Math.random() * colorCount));
      }
      if (typeof onScore === 'function') onScore(score);
      return;
    }

  if (guesses.length >= maxTries) {
    if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
    over = true;
    onGameOver(score, coins);
    return;
  }

  currentGuess = [0, 0, 0, 0];
  selected = 0;
}

  function evaluate(guess) {
    const s = secret.slice();
    const g = guess.slice();
    let exact = 0;
    for (let i = 0; i < 4; i++) {
      if (g[i] === s[i]) {
        exact++;
        g[i] = -1;
        s[i] = -2;
      }
    }
    let partial = 0;
    for (let i = 0; i < 4; i++) {
      const idx = s.indexOf(g[i]);
      if (idx >= 0) {
        partial++;
        s[idx] = -2;
      }
    }
    return { exact: exact, partial: partial };
  }

  function update(dt) {
    if (over) return;
    if (roundMsgT > 0) roundMsgT -= dt;

    if (keys.ArrowLeft || touches.left) {
      selected = Math.max(0, selected - 1);
      clearKeys();
    }
    if (keys.ArrowRight || touches.right) {
      selected = Math.min(3, selected + 1);
      clearKeys();
    }
    if (keys.ArrowUp || touches.up || keys.KeyW) {
      currentGuess[selected] = (currentGuess[selected] + 1) % colors.length;
      if (typeof window.playSfx === 'function') { try { window.playSfx('click'); } catch (e) {} }
      clearKeys();
    }
    if (keys.ArrowDown || touches.down) {
      currentGuess[selected] = (currentGuess[selected] - 1 + colors.length) % colors.length;
      if (typeof window.playSfx === 'function') { try { window.playSfx('click'); } catch (e) {} }
      clearKeys();
    }
    if (keys.Space || touches.action || touches.gas) {
      submitGuess();
      clearKeys();
    }
  }

  function clearKeys() {
    keys.ArrowLeft = false;
    keys.ArrowRight = false;
    keys.ArrowUp = false;
    keys.ArrowDown = false;
    keys.KeyW = false;
    keys.Space = false;
    touches.left = false;
    touches.right = false;
    touches.up = false;
    touches.down = false;
    touches.action = false;
    touches.gas = false;
  }

  function draw() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    // Secret code (hidden until game over)
    ctx.fillStyle = '#222';
    ctx.fillRect(340, 20, 120, 36);
    if (over) {
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = colors[secret[i]];
        ctx.shadowColor = colors[secret[i]];
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(355 + i * 28, 38, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    } else {
      ctx.fillStyle = '#555';
      ctx.font = '14px monospace';
      ctx.fillText('????', 360, 44);
    }

    // Guess history
    for (let g = 0; g < guesses.length; g++) {
      const y = 70 + g * 36;
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = colors[guesses[g].guess[i]];
        ctx.shadowColor = colors[guesses[g].guess[i]];
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(160 + i * 60, y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      const r = guesses[g].result;
      ctx.fillStyle = '#ff0044';
      for (let i = 0; i < r.exact; i++) {
        ctx.beginPath();
        ctx.arc(430 + i * 18, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffcc00';
      for (let i = 0; i < r.partial; i++) {
        ctx.beginPath();
        ctx.arc(460 + i * 18, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Current guess
    if (!over) {
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = i === selected ? '#ffffff' : '#555555';
        ctx.lineWidth = i === selected ? 3 : 1;
        ctx.strokeRect(130 + i * 60, 80 + guesses.length * 36 - 13, 60, 26);
        ctx.fillStyle = colors[currentGuess[i]];
        ctx.shadowColor = colors[currentGuess[i]];
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(160 + i * 60, 93 + guesses.length * 36, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 5;
    ctx.font = '14px monospace';
    ctx.fillText('MASTERMIND', 10, 20);
    // code master level badge
    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = '#ffd700';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('CODE LV ' + level, W - 90, 34);
    ctx.shadowBlur = 0;
    // round-clear banner
    if (roundMsgT > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.012);
      ctx.globalAlpha = Math.min(1, roundMsgT) * (0.7 + 0.3 * pulse);
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 14;
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(roundMsg, W / 2, 55);
      ctx.textAlign = 'left';
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
    ctx.fillText('LEFT/RIGHT PICK | UP/DOWN COLOR | SPACE GUESS | ' + guesses.length + '/' + maxTries, 10, 40);
    ctx.shadowBlur = 0;

    if (win) {
      ctx.fillStyle = '#00ff88';
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 20;
      ctx.font = '30px monospace';
      ctx.fillText('CODE CRACKED!', 280, 250);
      ctx.shadowBlur = 0;
    } else if (over) {
      ctx.fillStyle = '#ff0044';
      ctx.shadowColor = '#ff0044';
      ctx.shadowBlur = 20;
      ctx.font = '30px monospace';
      ctx.fillText('OUT OF TRIES', 290, 250);
      ctx.shadowBlur = 0;
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
    if (!running) {
      running = true;
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    }
  }

  function pause() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function resume() {
    if (!over && !running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }

  function destroy() {
    running = false;
    cancelAnimationFrame(raf);
  }

  return {
    start,
    pause,
    resume,
    destroy,
    setInput: (t, k) => { touches = t; keys = k; },
    setDifficulty: function(lvl){ diffMul = [1,1.15,1.3,1.5,1.75,2][Math.min(5,Math.floor(lvl)||0)]||1; }
  };
}