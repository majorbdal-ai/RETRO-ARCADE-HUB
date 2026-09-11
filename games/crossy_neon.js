function crossyNeon(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  const CELL = 40, ROWS = Math.ceil(H / CELL) + 2, COLS = Math.ceil(W / CELL);
  let raf = null, last = 0, running = false, over = false, overSent = false;
  let score = 0, coins = 0, keys = {}, touches = {};
  let time = 0, player = null, rows = [], scrollY = 0;
  let state = 'play', message = '', msgT = 0;

  function key(n) { return !!keys[n]; }
  function t(n) { return !!touches[n]; }

  const ROW_TYPES = ['road', 'road', 'road', 'grass', 'grass', 'water', 'road', 'grass', 'water', 'road'];

  function makeRow(idx) {
    const type = ROW_TYPES[idx % ROW_TYPES.length];
    const speed = (60 + Math.random() * 100 + Math.min(idx * 5, 200)) * (Math.random() < 0.5 ? 1 : -1);
    const vehicles = [];
    if (type === 'road') {
      const count = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const w = 30 + Math.random() * 40;
        vehicles.push({
          x: Math.random() * (W + 100) - 50,
          w: w, h: 18 + Math.random() * 8,
          speed: speed,
          color: ['#ff3b6b', '#ffd93b', '#3bff8f', '#3bc9ff', '#c084fc'][Math.floor(Math.random() * 5)]
        });
      }
    } else if (type === 'water') {
      const logW = 60 + Math.random() * 80;
      for (let i = 0; i < 2; i++) {
        vehicles.push({
          x: Math.random() * (W + 120) - 60 + i * 200,
          w: logW, h: 14,
          speed: speed * 0.6,
          color: '#0e7490',
          isLog: true
        });
      }
    }
    return { type: type, y: idx, vehicles: vehicles, colored: Math.random() < 0.15 };
  }

  function reset() {
    over = false; overSent = false;
    score = 0; coins = 0; time = 0; state = 'play';
    message = ''; msgT = 0;
    rows = [];
    for (let i = 0; i < ROWS; i++) rows.push(makeRow(i));
    player = { x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2), onLog: false, jumpT: 0, jumpFrom: 0 };
    scrollY = 0;
  }

  function callScore() { if (typeof onScore === 'function') onScore(score); }
  function callCoins() { if (typeof onCoins === 'function') onCoins(coins); }

  function die() {
    if (overSent) return;
    overSent = true; over = true; state = 'over';
    callScore();
    if (typeof window.playSfx === 'function') { try { window.playSfx('error'); } catch (e) {} }
    if (navigator.vibrate) { try { navigator.vibrate(150); } catch (e) {} }
    if (typeof onGameOver === 'function') onGameOver(score, coins);
  }

  function movePlayer(dx, dy) {
    if (over || player.jumpT > 0) return;
    player.x += dx;
    player.y += dy;
    player.jumpT = 0.15;
    player.jumpFrom = scrollY;
    if (typeof window.playSfx === 'function') { try { window.playSfx('jump'); } catch (e) {} }
    if (player.y < 0) player.y = 0;
    if (player.y >= rows.length) player.y = rows.length - 1;
    if (player.x < 0) { player.x = 0; }
    if (player.x >= COLS) { player.x = COLS - 1; }

    // Score for moving forward
    if (dy < 0) {
      const rowScore = Math.abs(player.y - Math.floor(ROWS / 2));
      if (rowScore > score) {
        const diff = rowScore - score;
        score += diff; callScore();
        if (diff > 0) { coins += diff; callCoins(); }
      }
    }
  }

  let prevUp = false, prevDown = false, prevLeft = false, prevRight = false;
  function update(dt) {
    time = time + dt;
    if (msgT > 0) msgT -= dt;

    // Input handling
    const up = t('up') || key('ArrowUp') || key('KeyW');
    const down = t('down') || key('ArrowDown') || key('KeyS');
    const left = t('left') || key('ArrowLeft') || key('KeyA');
    const right = t('right') || key('ArrowRight') || key('KeyD');

    if (up && !prevUp) movePlayer(0, -1);
    if (down && !prevDown) movePlayer(0, 1);
    if (left && !prevLeft) movePlayer(-1, 0);
    if (right && !prevRight) movePlayer(1, 0);
    prevUp = up; prevDown = down; prevLeft = left; prevRight = right;

    // Scroll to keep player centered
    const targetScroll = player.y * CELL - H / 2 + CELL;
    scrollY += (targetScroll - scrollY) * Math.min(1, dt * 6);

    // Update vehicles
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      for (let j = 0; j < row.vehicles.length; j++) {
        const v = row.vehicles[j];
        v.x += v.speed * speedMul * dt;
        if (v.speed > 0 && v.x > W + 80) v.x = -v.w - 40;
        if (v.speed < 0 && v.x + v.w < -80) v.x = W + 40;
      }
    }

    // Jump animation
    if (player.jumpT > 0) player.jumpT -= dt;

    // Collision detection
    const pRow = rows[player.y];
    if (pRow) {
      const px = player.x * CELL + CELL / 2;
      const py = player.y * CELL - scrollY + CELL / 2;

      if (pRow.type === 'road') {
        for (let j = 0; j < pRow.vehicles.length; j++) {
          const v = pRow.vehicles[j];
          if (px + CELL / 3 > v.x && px - CELL / 3 < v.x + v.w &&
              py + CELL / 3 > v.y + (H / 2 - scrollY) - v.h / 2 &&
              py - CELL / 3 < v.y + (H / 2 - scrollY) + v.h / 2) {
            die(); return;
          }
        }
      } else if (pRow.type === 'water') {
        player.onLog = false;
        for (let j = 0; j < pRow.vehicles.length; j++) {
          const v = pRow.vehicles[j];
          if (v.isLog && px + CELL / 3 > v.x && px - CELL / 3 < v.x + v.w) {
            player.onLog = true;
            break;
          }
        }
        if (!player.onLog && player.jumpT <= 0) {
          die(); return;
        }
      }
    }

    render();
  }

  function neonText(txt, x, y, size, color) {
    ctx.font = 'bold ' + size + 'px "Courier New", monospace';
    ctx.fillStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.fillText(txt, x, y);
    ctx.shadowBlur = 0;
  }

  function render() {
    ctx.fillStyle = '#060a06';
    ctx.fillRect(0, 0, W, H);

    // Draw rows from bottom to top
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const ry = row.y * CELL - scrollY;
      if (ry > H + CELL || ry < -CELL) continue;

      // Row background
      if (row.type === 'grass') {
        ctx.fillStyle = row.colored ? '#0a2a0a' : '#081a08';
        ctx.fillRect(0, ry, W, CELL);
        // Grass details
        ctx.strokeStyle = '#1a4a1a';
        ctx.lineWidth = 1;
        for (let gx = 0; gx < W; gx += 18) {
          ctx.beginPath();
          ctx.moveTo(gx + 6, ry + CELL); ctx.lineTo(gx + 8, ry + CELL - 8 - Math.sin(gx) * 3);
          ctx.stroke();
        }
      } else if (row.type === 'road') {
        ctx.fillStyle = '#15151f';
        ctx.fillRect(0, ry, W, CELL);
        // Road lines
        ctx.strokeStyle = '#333348';
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 18]);
        ctx.beginPath(); ctx.moveTo(0, ry + CELL / 2); ctx.lineTo(W, ry + CELL / 2); ctx.stroke();
        ctx.setLineDash([]);
      } else if (row.type === 'water') {
        ctx.fillStyle = '#081828';
        ctx.fillRect(0, ry, W, CELL);
        // Water waves
        ctx.strokeStyle = '#1a3a5a';
        ctx.lineWidth = 1;
        for (let wx = 0; wx < W; wx += 30) {
          ctx.beginPath();
          ctx.moveTo(wx, ry + CELL / 2 + Math.sin(time * 2 + wx * 0.05) * 3);
          ctx.lineTo(wx + 20, ry + CELL / 2 + Math.sin(time * 2 + (wx + 20) * 0.05) * 3);
          ctx.stroke();
        }
      }

      // Draw vehicles
      for (let j = 0; j < row.vehicles.length; j++) {
        const v = row.vehicles[j];
        const vx = v.x;
        const vy = ry + (CELL - v.h) / 2;
        if (v.isLog) {
          ctx.fillStyle = '#3a2a0a';
          ctx.shadowColor = '#5a4a2a';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.roundRect(vx, vy, v.w, v.h, 5);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = '#6a5a3a';
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          ctx.fillStyle = v.color;
          ctx.shadowColor = v.color;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.roundRect(vx, vy, v.w, v.h, 4);
          ctx.fill();
          ctx.shadowBlur = 0;
          // Headlights
          if (v.speed > 0) {
            ctx.fillStyle = '#ffd93b';
            ctx.fillRect(vx + v.w - 3, vy + 2, 4, 3);
            ctx.fillRect(vx + v.w - 3, vy + v.h - 5, 4, 3);
          } else {
            ctx.fillStyle = '#ff3b3b';
            ctx.fillRect(vx - 1, vy + 2, 4, 3);
            ctx.fillRect(vx - 1, vy + v.h - 5, 4, 3);
          }
        }
      }
    }

    // Draw player
    if (player) {
      const px = player.x * CELL + CELL / 2;
      const py = player.y * CELL - scrollY + CELL / 2;
      const jumpHeight = player.jumpT > 0 ? Math.sin(player.jumpT / 0.15 * Math.PI) * 12 : 0;
      const drawY = py - jumpHeight;

      // Player body (frog/chicken style)
      ctx.fillStyle = '#3bff8f';
      ctx.shadowColor = '#3bff8f';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(px, drawY - 2, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Eyes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px - 4, drawY - 5, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px + 4, drawY - 5, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(px - 4, drawY - 5, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px + 4, drawY - 5, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // HUD
    ctx.textAlign = 'left';
    neonText('CROSSY NEON', 14, 20, 14, '#7df9ff');
    neonText('SWIPE / ARROWS', 14, 36, 9, '#8a93b8');
    ctx.textAlign = 'right';
    neonText('SCORE ' + score, W - 14, 20, 16, '#ffd93b');
    ctx.textAlign = 'left';

    if (state === 'over') {
      ctx.fillStyle = 'rgba(4,4,10,0.78)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      neonText('GAME OVER', W / 2, 170, 44, '#ff4d5e');
      neonText('SCORE ' + score, W / 2, 222, 24, '#ffd93b');
      neonText('COINS +' + coins, W / 2, 258, 16, '#3bff8f');
      ctx.textAlign = 'left';
    }
  }

  function loop(ts) {
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    if (running && !over) update(dt);
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
  function resume() { if (!over && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); } }
  function destroy() { running = false; over = true; cancelAnimationFrame(raf); }
  function setInput(ts, ks) { touches = ts || {}; keys = ks || {}; }
  // difficulty ramp (v7.18): speed multiplier applied to all vehicles
  let speedMul = 1;
  function setDifficulty(level) {
    speedMul = [1, 1.15, 1.3, 1.5, 1.75, 2][Math.min(5, level)] || 1;
  }

  return { start: start, pause: pause, resume: resume, destroy: destroy, setInput: setInput, setDifficulty: setDifficulty };
}