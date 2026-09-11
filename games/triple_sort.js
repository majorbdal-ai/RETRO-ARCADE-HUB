/* ============================================================
   Triple Sort — Triple Match Arcade Game
   Canvas 800x450, items on conveyor, tap to place on shelf
   3 identical adjacent items auto-remove. Shelf full = game over.
   ============================================================ */
function tripleSort(canvas, ctx, onScore, onGameOver, onCoins) {
  // ---- state ----
  const W = 800, H = 450;
  let raf = null, last = 0, running = false;
  let score = 0, coins = 0;
  let over = false;

  // item types (colors with glow + shapes)
  const ITEM_TYPES = [
    { color: '#FF10F0', shape: 'box', label: '◆', glow: 16 },
    { color: '#00FFFF', shape: 'gem', label: '●', glow: 16 },
    { color: '#39FF88', shape: 'fruit', label: '▲', glow: 16 },
    { color: '#FFE600', shape: 'star', label: '★', glow: 16 },
    { color: '#FF6644', shape: 'diamond', label: '◇', glow: 16 },
    { color: '#AA88FF', shape: 'hex', label: '⬡', glow: 16 }
  ];

  // shelf (7 slots)
  const SHELF_SLOTS = 7;
  const SHELF_ITEM_SIZE = 50;
  const SHELF_Y = H - 100;
  let shelf = []; // array of item type indices, max 7

  // conveyor
  let conveyor = []; // items waiting, array of { type: index, x, y, speed }
  let conveyorSpeed = 60; // px/s
  let spawnTimer = 0;
  let spawnInterval = 2.5;

  // neon burst effects
  let bursts = [];

  // input
  let touches = { action: false };
  let keys = {};

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

  function drawItem(x, y, size, typeIdx, extraGlow) {
    const item = ITEM_TYPES[typeIdx];
    const g = extraGlow || item.glow;
    ctx.shadowBlur = g;
    ctx.shadowColor = item.color;
    ctx.fillStyle = item.color;
    ctx.strokeStyle = item.color;
    ctx.lineWidth = 2;

    if (item.shape === 'box') {
      ctx.fillRect(x, y, size, size);
    } else if (item.shape === 'gem') {
      ctx.beginPath();
      ctx.moveTo(x + size / 2, y);
      ctx.lineTo(x + size, y + size / 2);
      ctx.lineTo(x + size / 2, y + size);
      ctx.lineTo(x, y + size / 2);
      ctx.closePath();
      ctx.fill();
    } else if (item.shape === 'fruit') {
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.shape === 'star') {
      const cx = x + size / 2;
      const cy = y + size / 2;
      const outerR = size / 2 - 2;
      const innerR = outerR * 0.45;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI / 5) - Math.PI / 2;
        const innerAngle = angle + Math.PI / 5;
        ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
        ctx.lineTo(cx + Math.cos(innerAngle) * innerR, cy + Math.sin(innerAngle) * innerR);
      }
      ctx.closePath();
      ctx.fill();
    } else if (item.shape === 'diamond') {
      ctx.beginPath();
      ctx.moveTo(x + size / 2, y);
      ctx.lineTo(x + size, y + size * 0.35);
      ctx.lineTo(x + size / 2, y + size);
      ctx.lineTo(x, y + size * 0.35);
      ctx.closePath();
      ctx.fill();
    } else if (item.shape === 'hex') {
      const cx2 = x + size / 2;
      const cy2 = y + size / 2;
      const r2 = size / 2 - 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI / 3) - Math.PI / 6;
        const px = cx2 + Math.cos(angle) * r2;
        const py = cy2 + Math.sin(angle) * r2;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  function spawnItem() {
    const typeIdx = Math.floor(Math.random() * Math.min(ITEM_TYPES.length, 4 + Math.floor(score / 500)));
    conveyor.push({
      type: typeIdx,
      x: W + 40,
      y: 50 + Math.random() * 40,
      speed: conveyorSpeed,
      alive: true
    });
  }

  function addToShelf(typeIdx) {
    if (shelf.length >= SHELF_SLOTS) return false;
    shelf.push(typeIdx);
    // Check for triple match
    checkTripleMatch();
    return true;
  }

  function checkTripleMatch() {
    let matched = false;
    let i = 0;
    while (i < shelf.length - 2) {
      if (shelf[i] === shelf[i + 1] && shelf[i + 1] === shelf[i + 2]) {
        const color = ITEM_TYPES[shelf[i]].color;
        // Remove the triple
        shelf.splice(i, 3);
        // Create neon burst at shelf position
        const shelfX = getShelfX(i);
        bursts.push({
          x: shelfX,
          y: SHELF_Y + SHELF_ITEM_SIZE / 2,
          t: 0,
          color: color
        });
        score += 50;
        onScore(score);
        matched = true;
        if (typeof window.playSfx === 'function') { try { window.playSfx('pop'); } catch (e) {} }
        // Don't increment i since items shifted
        continue;
      }
      i++;
    }
    return matched;
  }

  function getShelfX(idx) {
    const totalW = SHELF_SLOTS * (SHELF_ITEM_SIZE + 8);
    const startX = (W - totalW) / 2;
    return startX + idx * (SHELF_ITEM_SIZE + 8);
  }

  function reset() {
    score = 0; coins = 0; over = false;
    shelf = [];
    conveyor = [];
    bursts = [];
    conveyorSpeed = 60;
    spawnTimer = 0;
    spawnInterval = 2.5;
  }

  // ---- update ----
  function update(dt) {
    if (over || !running) return;

    // spawn conveyor items
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnItem();
      spawnTimer = spawnInterval;
      // increase speed over time
      conveyorSpeed = 60 + score * 0.08;
      spawnInterval = Math.max(0.8, 2.5 - score * 0.001);
    }

    // move conveyor items
    for (const item of conveyor) {
      if (item.alive) {
        item.x -= item.speed * dt;
      }
    }

    // remove items that reached left edge (passed by)
    conveyor = conveyor.filter(function(item) {
      return item.alive && item.x > -60;
    });

    // update burst effects
    for (let i = bursts.length - 1; i >= 0; i--) {
      bursts[i].t += dt * 2.5;
      if (bursts[i].t >= 1) {
        bursts.splice(i, 1);
      }
    }

    // check if shelf is full = game over
    if (shelf.length >= SHELF_SLOTS) {
      gameOver();
      return;
    }
  }

  // ---- render ----
  function render() {
    // bg
    ctx.fillStyle = '#05070A';
    ctx.fillRect(0, 0, W, H);

    // title
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#FF10F0';
    ctx.fillStyle = '#FF10F0';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TRIPLE SORT', W / 2, 30);
    ctx.shadowBlur = 0;

    // score
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#FFE600';
    ctx.fillStyle = '#FFE600';
    ctx.font = '14px monospace';
    ctx.fillText('SCORE: ' + score, W / 2, 52);
    ctx.shadowBlur = 0;

    // conveyor belt background
    ctx.fillStyle = '#0B0F1A';
    ctx.fillRect(0, 60, W, 80);
    // conveyor lines
    ctx.strokeStyle = 'rgba(0,255,255,0.15)';
    ctx.lineWidth = 1;
    const lineOffset = (performance.now() * 0.05) % 30;
    for (let lx = -30 + lineOffset; lx < W + 30; lx += 30) {
      ctx.beginPath();
      ctx.moveTo(lx, 60);
      ctx.lineTo(lx - 20, 140);
      ctx.stroke();
    }
    // conveyor borders
    rect(0, 58, W, 3, '#00FFFF', 8);
    rect(0, 140, W, 3, '#00FFFF', 8);

    // conveyor items
    for (const item of conveyor) {
      if (item.alive) {
        drawItem(item.x, item.y, 40, item.type, 12);
      }
    }

    // conveyor item indicator (arrow to shelf)
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#39FF88';
    ctx.fillStyle = '#39FF88';
    ctx.font = '16px monospace';
    ctx.fillText('▼ TAP TO SHELF ▼', W / 2, 170);
    ctx.shadowBlur = 0;

    // shelf area
    const totalW = SHELF_SLOTS * (SHELF_ITEM_SIZE + 8);
    const shelfStartX = (W - totalW) / 2;

    // shelf background
    ctx.fillStyle = 'rgba(11,15,26,0.8)';
    ctx.fillRect(shelfStartX - 10, SHELF_Y - 10, totalW + 20, SHELF_ITEM_SIZE + 20);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(shelfStartX - 10, SHELF_Y - 10, totalW + 20, SHELF_ITEM_SIZE + 20);

    // shelf slots
    for (let i = 0; i < SHELF_SLOTS; i++) {
      const sx = getShelfX(i);
      // empty slot
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, SHELF_Y, SHELF_ITEM_SIZE, SHELF_ITEM_SIZE);

      // filled slot
      if (i < shelf.length) {
        drawItem(sx + 3, SHELF_Y + 3, SHELF_ITEM_SIZE - 6, shelf[i], 14);
      }
    }

    // slot count indicator
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#666';
    ctx.fillStyle = '#666';
    ctx.font = '12px monospace';
    ctx.fillText('SHELF: ' + shelf.length + '/' + SHELF_SLOTS, W / 2, SHELF_Y + SHELF_ITEM_SIZE + 28);
    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;

    // warning when shelf is almost full
    if (shelf.length >= 5) {
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#FF4444';
      ctx.fillStyle = '#FF4444';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ SHELF ALMOST FULL ⚠', W / 2, SHELF_Y + SHELF_ITEM_SIZE + 48);
      ctx.textAlign = 'left';
      ctx.shadowBlur = 0;
    }

    // neon burst effects
    for (const b of bursts) {
      const progress = b.t;
      const alpha = 1 - progress;
      const radius = 30 + progress * 60;
      ctx.shadowBlur = 20 * alpha;
      ctx.shadowColor = b.color;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 3 * alpha;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(b.x, b.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      // inner flash
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    // tap hint at first conveyor item
    if (conveyor.length > 0 && conveyor[0].alive) {
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#FFE600';
      ctx.fillStyle = '#FFE600';
      ctx.font = '11px monospace';
      ctx.fillText('▲', conveyor[0].x + 14, conveyor[0].y - 8);
      ctx.shadowBlur = 0;
    }

    // game over overlay
    if (over) {
      ctx.fillStyle = 'rgba(5,7,10,0.85)';
      ctx.fillRect(0, 0, W, H);
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#FF10F0';
      ctx.fillStyle = '#FF10F0';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 30);
      ctx.shadowColor = '#00FFFF';
      ctx.fillStyle = '#00FFFF';
      ctx.font = '18px monospace';
      ctx.fillText('SHELF OVERFLOWED!', W / 2, H / 2 + 5);
      ctx.fillText('SCORE: ' + score, W / 2, H / 2 + 35);
      ctx.fillText('COINS: ' + coins, W / 2, H / 2 + 63);
      ctx.textAlign = 'left';
      ctx.shadowBlur = 0;
    }
  }

  // ---- input handling ----
  function handleCanvasClick(e) {
    if (!running || over) return;
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = W / canvasRect.width;
    const scaleY = H / canvasRect.height;
    const tx = (e.clientX - canvasRect.left) * scaleX;
    const ty = (e.clientY - canvasRect.top) * scaleY;

    // check conveyor item tap
    for (const item of conveyor) {
      if (!item.alive) continue;
      if (tx >= item.x && tx <= item.x + 40 && ty >= item.y && ty <= item.y + 40) {
        // try to add to shelf
        if (shelf.length < SHELF_SLOTS) {
          addToShelf(item.type);
          item.alive = false;
          // coins for streak
          coins += 1;
          onCoins(1);
        }
        return;
      }
    }
  }

  function handleCanvasTouch(e) {
    if (!running || over) return;
    e.preventDefault();
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = W / canvasRect.width;
    const scaleY = H / canvasRect.height;
    const touch = e.touches[0];
    if (touch) {
      const tx = (touch.clientX - canvasRect.left) * scaleX;
      const ty = (touch.clientY - canvasRect.top) * scaleY;
      for (const item of conveyor) {
        if (!item.alive) continue;
        if (tx >= item.x && tx <= item.x + 40 && ty >= item.y && ty <= item.y + 40) {
          if (shelf.length < SHELF_SLOTS) {
            addToShelf(item.type);
            item.alive = false;
            coins += 1;
            onCoins(1);
          }
          return;
        }
      }
    }
  }

  function attachEvents() {
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('touchstart', handleCanvasTouch, { passive: false });
  }

  function detachEvents() {
    canvas.removeEventListener('click', handleCanvasClick);
    canvas.removeEventListener('touchstart', handleCanvasTouch);
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
    detachEvents();
    if (raf) cancelAnimationFrame(raf);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(200); } catch (e) {}
    }
    if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
    onGameOver(Math.floor(score), coins);
  }

  // ---- public API ----
  return {
    start() {
      reset();
      attachEvents();
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    update() {/* handled internally */},
    render() { render(); },
    pause() { running = false; if (raf) cancelAnimationFrame(raf); },
    resume() { if (over || running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); },
    destroy() { running = false; if (raf) cancelAnimationFrame(raf); detachEvents(); },
    setInput(t, k) { touches = t || {}; keys = k || {}; },
    controls: { joystick: false, boost: false, action: true, drift: false }
  };
}
