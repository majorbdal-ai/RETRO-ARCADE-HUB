function bubbleShooter(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  let keys = {}, touches = {};

  const BUBBLE_R = 18;
  const ROWS = 10;
  const COLS = 14;
  const COLORS = ['#ff3366', '#33ccff', '#ffcc00', '#66ff66', '#cc66ff', '#ff9933'];
  let grid = [];
  let shooter = { x: W / 2, y: H - 40, angle: -Math.PI / 2 };
  let currentBubble = null;
  let nextBubble = null;
  let bubbles = [];
  let shake = 0;
  let combo = 0;
  let difficultyMult = 1;   // v7.18 difficulty ramp

  function randomColor() { return COLORS[Math.floor(Math.random() * COLORS.length)]; }

  function reset() {
    grid = [];
    for (let r = 0; r < ROWS; r++) {
      grid[r] = [];
      for (let c = 0; c < COLS; c++) {
        if (r < 5) grid[r][c] = { color: randomColor(), x: 0, y: 0, r: BUBBLE_R, pop: 0 };
        else grid[r][c] = null;
      }
    }
    shooter.angle = -Math.PI / 2;
    currentBubble = { color: randomColor(), x: shooter.x, y: shooter.y, vx: 0, vy: 0, r: BUBBLE_R, flying: false };
    nextBubble = { color: randomColor(), x: W - 40, y: H - 40, r: BUBBLE_R };
    bubbles = [];
    score = 0;
    coins = 0;
    combo = 0;
    shake = 0;
    difficultyMult = 1;
    over = false;
    onScore(score);
  }

  function gridToPos(r, c) {
    const offsetX = (r % 2) * BUBBLE_R;
    return { x: 100 + c * BUBBLE_R * 2 + offsetX, y: 50 + r * BUBBLE_R * 1.7 };
  }

  function posToGrid(x, y) {
    const relY = y - 50;
    const r = Math.round(relY / (BUBBLE_R * 1.7));
    if (r < 0) return null;
    const offsetX = (r % 2) * BUBBLE_R;
    const relX = x - 100 - offsetX;
    const c = Math.round(relX / (BUBBLE_R * 2));
    if (c < 0 || c >= COLS || r >= ROWS) return null;
    return { r, c };
  }

  function getNeighbors(r, c) {
    const dirs = r % 2 === 0
      ? [[-1,0],[-1,1],[0,-1],[0,1],[1,0],[1,1]]
      : [[-1,-1],[-1,0],[0,-1],[0,1],[1,-1],[1,0]];
    const res = [];
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) res.push({ r: nr, c: nc });
    }
    return res;
  }

  function findConnected(r, c, color, visited = new Set()) {
    const key = `${r},${c}`;
    if (visited.has(key)) return [];
    visited.add(key);
    const bubble = grid[r][c];
    if (!bubble || bubble.color !== color) return [];
    let res = [{ r, c }];
    for (const n of getNeighbors(r, c)) {
      res = res.concat(findConnected(n.r, n.c, color, visited));
    }
    return res;
  }

  function findFloating() {
    const supported = new Set();
    const queue = [];
    for (let c = 0; c < COLS; c++) {
      if (grid[0][c]) { queue.push({ r: 0, c }); supported.add(`0,${c}`); }
    }
    while (queue.length) {
      const { r, c } = queue.shift();
      for (const n of getNeighbors(r, c)) {
        const key = `${n.r},${n.c}`;
        if (grid[n.r][n.c] && !supported.has(key)) {
          supported.add(key);
          queue.push(n);
        }
      }
    }
    const floating = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] && !supported.has(`${r},${c}`)) floating.push({ r, c });
      }
    }
    return floating;
  }

  function shoot() {
    if (currentBubble.flying) return;
    currentBubble.flying = true;
    currentBubble.vx = Math.cos(shooter.angle) * 500 * difficultyMult;
    currentBubble.vy = Math.sin(shooter.angle) * 500 * difficultyMult;
    if (typeof window.playSfx === 'function') { try { window.playSfx('shoot'); } catch (e) {} }
  }

  function update(dt) {
    if (shake > 0) shake -= dt;

    if ((keys.ArrowLeft || keys.KeyA || touches.left) && !currentBubble.flying) {
      shooter.angle = Math.max(-Math.PI * 0.9, shooter.angle - 2 * dt);
    }
    if ((keys.ArrowRight || keys.KeyD || touches.right) && !currentBubble.flying) {
      shooter.angle = Math.min(-Math.PI * 0.1, shooter.angle + 2 * dt);
    }
    if ((keys.Space || keys.ArrowUp || keys.KeyW || touches.action) && !currentBubble.flying) {
      shoot();
    }

    if (currentBubble.flying) {
      currentBubble.x += currentBubble.vx * dt;
      currentBubble.y += currentBubble.vy * dt;

      if (currentBubble.x - BUBBLE_R < 100) {
        currentBubble.x = 100 + BUBBLE_R;
        currentBubble.vx *= -1;
      }
      if (currentBubble.x + BUBBLE_R > 100 + COLS * BUBBLE_R * 2) {
        currentBubble.x = 100 + COLS * BUBBLE_R * 2 - BUBBLE_R;
        currentBubble.vx *= -1;
      }
      if (currentBubble.y - BUBBLE_R < 50) {
        currentBubble.y = 50 + BUBBLE_R;
        stickBubble();
      }

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const b = grid[r][c];
          if (b && b.pop === 0) {
            const pos = gridToPos(r, c);
            const dx = currentBubble.x - pos.x;
            const dy = currentBubble.y - pos.y;
            if (dx * dx + dy * dy < BUBBLE_R * BUBBLE_R * 1.5) {
              stickBubble();
              break;
            }
          }
        }
      }
    }

    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.pop += dt;
      if (b.pop > 0.3) bubbles.splice(i, 1);
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const b = grid[r][c];
        if (b && b.pop > 0) {
          b.pop += dt;
          if (b.pop > 0.3) grid[r][c] = null;
        }
      }
    }

    let lowest = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c]) { lowest = Math.max(lowest, r); break; }
      }
    }
    if (lowest >= ROWS - 2) {
      gameOver();
    }
  }

  function stickBubble() {
    const pos = posToGrid(currentBubble.x, currentBubble.y);
    if (!pos) { currentBubble.flying = false; currentBubble.x = shooter.x; currentBubble.y = shooter.y; return; }
    if (grid[pos.r][pos.c]) { currentBubble.flying = false; currentBubble.x = shooter.x; currentBubble.y = shooter.y; return; }
    grid[pos.r][pos.c] = { color: currentBubble.color, x: 0, y: 0, r: BUBBLE_R, pop: 0 };
    const connected = findConnected(pos.r, pos.c, currentBubble.color);
    let popped = 0;
    if (connected.length >= 3) {
      for (const p of connected) {
        grid[p.r][p.c].pop = 0.001;
        bubbles.push({ ...grid[p.r][p.c], x: gridToPos(p.r, p.c).x, y: gridToPos(p.r, p.c).y });
        grid[p.r][p.c] = null;
        popped++;
      }
      const floating = findFloating();
      for (const p of floating) {
        if (grid[p.r][p.c]) {
          bubbles.push({ ...grid[p.r][p.c], x: gridToPos(p.r, p.c).x, y: gridToPos(p.r, p.c).y });
          grid[p.r][p.c].pop = 0.001;
          grid[p.r][p.c] = null;
          popped++;
        }
      }
      combo = popped >= 3 ? combo + 1 : 0;
      const gained = popped * 10 * (1 + combo * 0.5);
      score += Math.floor(gained);
      coins += Math.floor(popped / 5);
      // pop jingle: pop per chain, win2 on big combo
      if (typeof window.playSfx === 'function') { try { window.playSfx(popped >= 6 ? 'win2' : 'pop'); } catch (e) {} }
      if (navigator.vibrate) { try { navigator.vibrate(Math.min(20 + popped * 5, 60)); } catch (e) {} }
      onScore(score);
      shake = 0.2;
    } else {
      combo = 0;
    }
    currentBubble = nextBubble;
    currentBubble.x = shooter.x;
    currentBubble.y = shooter.y;
    currentBubble.flying = false;
    nextBubble = { color: randomColor(), x: W - 40, y: H - 40, r: BUBBLE_R };
  }

  function gameOver() {
    if (over) return;
    over = true;
    running = false;
    cancelAnimationFrame(raf);
    if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
    onGameOver(score, coins);
  }

  function draw() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#222244';
    ctx.lineWidth = 1;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const pos = gridToPos(r, c);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, BUBBLE_R, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const b = grid[r][c];
        if (b && b.pop === 0) {
          const pos = gridToPos(r, c);
          drawBubble(ctx, pos.x, pos.y, BUBBLE_R, b.color, 1);
        }
      }
    }

    for (const b of bubbles) {
      drawBubble(ctx, b.x, b.y, BUBBLE_R, b.color, 1 - b.pop / 0.3);
    }

    if (!currentBubble.flying) {
      ctx.save();
      ctx.translate(shooter.x, shooter.y);
      ctx.rotate(shooter.angle);
      drawBubble(ctx, 0, 0, BUBBLE_R, currentBubble.color, 1);
      ctx.restore();
    } else {
      drawBubble(ctx, currentBubble.x, currentBubble.y, BUBBLE_R, currentBubble.color, 1);
    }

    drawBubble(ctx, nextBubble.x, nextBubble.y, BUBBLE_R, nextBubble.color, 1);

    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 10 * shake, (Math.random() - 0.5) * 10 * shake);
    ctx.font = 'bold 18px Orbitron, monospace';
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 10;
    ctx.fillText('BUBBLE SHOOTER', 12, 28);
    ctx.shadowBlur = 0;
    ctx.font = '12px monospace';
    ctx.fillStyle = '#8888aa';
    ctx.fillText('←/→ Aim  Space/Shoot', 12, 48);
    ctx.fillText(`Score: ${score}  Coins: ${coins}`, W - 180, 28);
    ctx.restore();
  }

  function drawBubble(ctx, x, y, r, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.4, color);
    grad.addColorStop(1, '#111133');
    ctx.fillStyle = grad;
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
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
  function setDifficulty(level) {
    const m = [1.0, 1.15, 1.3, 1.5, 1.75, 2.0];
    const l = Math.max(0, Math.min(5, Math.floor(level) || 0));
    difficultyMult = m[l];
  }
  return { start, pause, resume, destroy, setInput: (t, k) => { touches = t; keys = k; }, setDifficulty };
}