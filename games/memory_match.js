function memoryMatch(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  let keys = {}, touches = {};

  const ROWS = 3, COLS = 4;
  const TOTAL = ROWS * COLS;
  const CELL_W = W / COLS;
  const CELL_H = (H - 80) / ROWS;
  const TOP = 60;
  let cards = [];
  let flippedIndex = -1;
  let moves = 0;
  let matched = 0;
  let lock = false;
  let matchTimer = 0;
  let matchedTimer = 0;
  let solvedPairs = 0;
  // difficulty ramp (levels)
  let level = 1, levelShown = -1, levelTimer = 0, flipDelayBase = 0.8;
  let bestStreak = 0, streak = 0;
  let sparkles = []; // mini canvas particles

  const EMOJIS = ['🐟', '🚀', '⚡', '🐙', '🍕', '🛸', '💎', '🎯',
    '🐢', '🍒', '🌵', '🔥', '🍩', '👾', '🏆', '🍉',
    '⚽', '🐉', '🎲', '🍄', '🦄', '⭐', '🚗', '🍭'];
  const COLOR_POOL = ['#ff3366', '#33ccff', '#ffcc00', '#66ff66', '#cc66ff', '#ff9933'];

  function sfx(name) { if (typeof window.playSfx === 'function') { try { window.playSfx(name); } catch (e) {} } }
  function vibe(pattern) { if (typeof window.hapticVibe === 'function') { try { window.hapticVibe(pattern); } catch (e) {} } }
  function fxBurst(x, y, color, count) { if (window.gameFX && window.gameFX.burst) { try { window.gameFX.burst(x, y, color, count); } catch (e) {} } }
  function fxShake(intensity) { if (window.gameFX && window.gameFX.shake) { try { window.gameFX.shake(intensity); } catch (e) {} } }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function reset() {
    const pairs = shuffle([...EMOJIS]).slice(0, TOTAL / 2);
    const deck = shuffle([...pairs, ...pairs]);
    cards = [];
    for (let i = 0; i < TOTAL; i++) {
      const row = Math.floor(i / COLS);
      const col = i % COLS;
      cards.push({
        emoji: deck[i],
        color: COLOR_POOL[i % COLOR_POOL.length],
        row, col,
        x: col * CELL_W + CELL_W / 2,
        y: TOP + row * CELL_H + CELL_H / 2,
        faceUp: false,
        matched: false,
        flipAnim: 0
      });
    }
    flippedIndex = -1;
    moves = 0;
    matched = 0;
    lock = false;
    matchTimer = 0;
    matchedTimer = 0;
    solvedPairs = 0;
    score = 0;
    coins = 0;
    over = false;
    level = 1; levelShown = -1; levelTimer = 0; flipDelayBase = 0.8;
    streak = 0; bestStreak = 0;
    sparkles = [];
    onScore(score);
  }

  function update(dt) {
    if (matchTimer > 0) matchTimer -= dt;
    if (matchedTimer > 0) matchedTimer -= dt;
    if (levelTimer > 0) levelTimer -= dt;

    // sparkles
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const s = sparkles[i];
      s.life -= dt;
      if (s.life <= 0) { sparkles.splice(i, 1); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.vy += 240 * dt;
    }

    for (const card of cards) {
      if (card.faceUp && card.flipAnim < 1) card.flipAnim = Math.min(1, card.flipAnim + dt * 8);
      if (!card.faceUp && !card.matched && card.flipAnim > 0) card.flipAnim = Math.max(0, card.flipAnim - dt * 8);
    }

    if (lock && matchTimer <= 0) {
      lock = false;
      if (flippedIndex >= 0) {
        cards[flippedIndex].faceUp = false;
        flippedIndex = -1;
      }
    }

    if ((keys.Space || keys.Enter || touches.action) && touches.lastTapX !== undefined) {
      handleTap(touches.lastTapX, touches.lastTapY);
      touches.lastTapX = undefined;
      touches.lastTapY = undefined;
    }
  }

  function handleTap(x, y) {
    if (lock || over) return;
    const n = cards.length;
    const rows = n <= 12 ? 3 : 4;
    const cols = n / rows;
    const cellW = W / cols;
    const cellH = (H - 80) / rows;
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      if (Math.abs(x - c.x) < cellW / 2 && Math.abs(y - c.y) < cellH / 2) {
        if (c.faceUp || c.matched) continue;
        sfx('click');
        vibe('tap');
        executeFlip(i);
        break;
      }
    }
  }

  function executeFlip(i) {
    moves++;
    cards[i].faceUp = true;
    cards[i].flipAnim = 0;

    if (flippedIndex < 0) {
      flippedIndex = i;
    } else {
      const first = cards[flippedIndex];
      const second = cards[i];
      if (first.emoji === second.emoji) {
        // Match!
        first.matched = true;
        second.matched = true;
        matched += 2;
        solvedPairs++;
        streak++;
        bestStreak = Math.max(bestStreak, streak);
        score += 10;
        if (streak >= 2) score += 5; // streak bonus
        if (solvedPairs % 3 === 0) coins++;
        if (moves % 8 === 0) coins++;
        onScore(score);
        fxBurst(first.x, first.y, first.color, 2);
        fxBurst(second.x, second.y, second.color, 2);
        sparkles.push({ x: first.x, y: first.y, vx: -60, vy: -120, life: 0.6, max: 0.6 });
        sparkles.push({ x: second.x, y: second.y, vx: 60, vy: -120, life: 0.6, max: 0.6 });
        sfx('pop');
        vibe('tap');
        wrappedFlip(first);
        wrappedFlip(second);
        flippedIndex = -1;
        lock = false;
        if (matched >= cards.length) {
          if (level >= 3) {
            gameOver();
          } else {
            // Level clear → bigger grid (difficulty ramp)
            level++;
            coinWon();
            levelShown = level;
            levelTimer = 1.6;
            sfx('win2');
            vibe('win');
            makeGrid();
          }
        }
      } else {
        // No match — streak broken, flip both back after brief delay (ramps with level)
        streak = 0;
        lock = true;
        const delay = Math.max(0.45, flipDelayBase - (level - 1) * 0.05);
        matchTimer = delay;
        sfx('error');
        vibe('err');
        wrappedFlip(first);
        setTimeout(() => {
          first.faceUp = false;
          second.faceUp = false;
          flippedIndex = -1;
          lock = false;
        }, delay * 1000);
      }
    }
  }

  function wrappedFlip(card) {
    card.faceUp = true;
  }

  function coinWon() {
    coins++;
    callCoins();
    fxBurst(W / 2, TOP + 20, '#ffcc00', 6);
  }

  function callCoins() {
    if (typeof onCoins === 'function') onCoins(coins);
  }

  // Difficulty ramp — new grid each level with MORE cards
  function makeGrid() {
    const nPairs = Math.min(6 + level * 2, 14); // 8 → 10 → 12 → 14
    const nCards = nPairs * 2;
    const rows = nCards <= 12 ? 3 : 4;
    const cols = nCards / rows;
    const cellW = W / cols;
    const cellH = (H - 80) / rows;
    const pairs = shuffle([...EMOJIS]).slice(0, nPairs);
    const deck = shuffle([...pairs, ...pairs]);
    cards = [];
    for (let i = 0; i < nCards; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      cards.push({
        emoji: deck[i],
        color: COLOR_POOL[i % COLOR_POOL.length],
        row: r, col: c,
        x: c * cellW + cellW / 2,
        y: TOP + r * cellH + cellH / 2,
        faceUp: false,
        matched: false,
        flipAnim: 0
      });
    }
    flippedIndex = -1; lock = false; matchTimer = 0; matched = 0; solvedPairs = 0;
  }

  function gameOver() {
    if (over) return;
    over = true;
    running = false;
    cancelAnimationFrame(raf);
    onScore(score);
    sfx('win2');
    vibe('win');
    onGameOver(score, coins);
  }

  function draw() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    // grid lines per current layout
    if (cards.length) {
      const n = cards.length;
      const rows = n <= 12 ? 3 : 4;
      const cols = n / rows;
      const cellW = W / cols;
      const cellH = (H - 80) / rows;
      ctx.strokeStyle = 'rgba(90,90,170,0.25)';
      ctx.lineWidth = 1;
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath(); ctx.moveTo(0, 60 + r * cellH); ctx.lineTo(W, 60 + r * cellH); ctx.stroke();
      }
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath(); ctx.moveTo(c * cellW, 60); ctx.lineTo(c * cellW, 60 + rows * cellH); ctx.stroke();
      }
    }

    for (const card of cards) {
      drawCard(ctx, card);
    }

    // sparkle particles
    for (const s of sparkles) {
      ctx.globalAlpha = Math.max(0, s.life / s.max);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 6;
      ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.font = 'bold 18px Orbitron, monospace';
    ctx.fillStyle = '#ffcc00';
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur = 10;
    ctx.fillText('MEMORY MATCH', 12, 28);
    ctx.shadowBlur = 0;
    ctx.font = '12px monospace';
    ctx.fillStyle = '#8888aa';
    ctx.fillText('Tap cards to flip / Space+Tap', 12, 48);
    ctx.fillText(`Moves: ${moves}  Score: ${score}  Coins: ${coins}`, W - 300, 48);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#66ff66';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('LEVEL ' + level, W - 12, 28);
    ctx.fillStyle = '#8888aa';
    ctx.font = '12px monospace';
    ctx.fillText('BEST STREAK ' + bestStreak, W - 12, 46);
    ctx.textAlign = 'left';

    if (levelTimer > 0 && levelShown >= 0 && !over) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 30px Orbitron, monospace';
      ctx.fillStyle = '#00ffcc';
      ctx.shadowColor = '#00ffcc';
      ctx.shadowBlur = 18;
      ctx.globalAlpha = Math.min(1, levelTimer / 0.6);
      ctx.fillText('LEVEL ' + levelShown, W / 2, H / 2 - 120);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }

    if (over) {
      ctx.font = 'bold 36px Orbitron, monospace';
      ctx.fillStyle = '#00ffcc';
      ctx.shadowColor = '#00ffcc';
      ctx.shadowBlur = 20;
      ctx.textAlign = 'center';
      ctx.fillText('ALL MATCHED!', W / 2, H / 2);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }

  function drawCard(ctx, card) {
    const { x, y } = card;
    const n = cards.length;
    const rows = n <= 12 ? 3 : 4;
    const cols = n / rows;
    const cellW = W / cols;
    const cellH = (H - 80) / rows;
    const w = cellW - 16;
    const h = cellH - 16;
    const flip = card.flipAnim;
    const scaleX = Math.cos(flip * Math.PI);
    const isFront = scaleX > 0;

    ctx.save();
    ctx.translate(x, y);

    // Back face
    if (isFront && !card.faceUp) {
      ctx.rotate((1 - flip) * Math.PI / 2);
      ctx.fillStyle = '#1a1a44';
      ctx.shadowColor = '#3333ff';
      ctx.shadowBlur = 8;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#4444ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = '#3333ff';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('?', 0, 8);
      ctx.textAlign = 'left';
    } else if (card.faceUp) {
      // Front face
      ctx.scale(Math.max(scaleX, 0.01), 1);
      if (card.matched) {
        ctx.fillStyle = card.color;
        ctx.shadowColor = card.color;
        ctx.shadowBlur = 20;
      } else {
        ctx.fillStyle = '#222244';
        ctx.shadowColor = '#5555ff';
        ctx.shadowBlur = 6;
      }
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = card.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = card.color;
      ctx.shadowBlur = 12;
      ctx.font = `${Math.min(w, h) * 0.5}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(card.emoji, 0, 0);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.shadowBlur = 0;
    } else if (card.matched) {
      // Matched front (rotating back)
      ctx.rotate((1 - flip) * Math.PI / 2);
      ctx.fillStyle = card.color;
      ctx.shadowColor = card.color;
      ctx.shadowBlur = 20;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.min(w, h) * 0.5}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(card.emoji, 0, 0);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
    } else {
      // Back face during flip back
      ctx.rotate((1 - flip) * Math.PI / 2);
      ctx.fillStyle = '#1a1a44';
      ctx.shadowColor = '#3333ff';
      ctx.shadowBlur = 8;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#4444ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = '#3333ff';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('?', 0, 8);
      ctx.textAlign = 'left';
    }
    ctx.restore();
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
    if (!running) { running = true; last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
  }
  function pause() { running = false; cancelAnimationFrame(raf); }
  function resume() { if (!over && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); } }
  function destroy() { running = false; cancelAnimationFrame(raf); }
  return { start, pause, resume, destroy, setInput: (t, k) => { touches = t; keys = k; } };
}