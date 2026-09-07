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

  const EMOJIS = ['🐟', '🚀', '⚡', '🐙', '🍕', '🛸', '💎', '🎯',
    '🐢', '🍒', '🌵', '🔥', '🍩', '👾', '🏆', '🍉',
    '⚽', '🐉', '🎲', '🍄', '🦄', '⭐', '🚗', '🍭'];
  const COLOR_POOL = ['#ff3366', '#33ccff', '#ffcc00', '#66ff66', '#cc66ff', '#ff9933'];

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
    onScore(score);
  }

  function update(dt) {
    if (matchTimer > 0) matchTimer -= dt;
    if (matchedTimer > 0) matchedTimer -= dt;

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
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      if (Math.abs(x - c.x) < CELL_W / 2 && Math.abs(y - c.y) < CELL_H / 2) {
        if (c.faceUp || c.matched) continue;
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
        score += 10;
        if (solvedPairs % 3 === 0) coins++;
        if (moves % 8 === 0) coins++;
        onScore(score);
        wrappedFlip(first);
        wrappedFlip(second);
        flippedIndex = -1;
        lock = false;
        if (matched >= TOTAL) gameOver();
      } else {
        // No match, flip both back after brief delay
        lock = true;
        matchTimer = 0.8;
        wrappedFlip(first);
        setTimeout(() => {
          first.faceUp = false;
          second.faceUp = false;
          flippedIndex = -1;
          lock = false;
        }, 800);
      }
    }
  }

  function wrappedFlip(card) {
    card.faceUp = true;
  }

  function gameOver() {
    if (over) return;
    over = true;
    running = false;
    cancelAnimationFrame(raf);
    onGameOver(score, coins);
  }

  function draw() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    for (const card of cards) {
      drawCard(ctx, card);
    }

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
    ctx.fillText(`Moves: ${moves}  Score: ${score}  Coins: ${coins}`, W - 240, 48);
    if (matched >= TOTAL) {
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
    const w = CELL_W - 16;
    const h = CELL_H - 16;
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