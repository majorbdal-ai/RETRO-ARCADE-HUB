/* ============================================================
   Water Sort — Color-Sort Puzzle Game
   Canvas 800x450, tap bottles to pour colors between them
   Select a bottle (glow), tap another to pour. Win when sorted.
   ============================================================ */
function waterSort(canvas, ctx, onScore, onGameOver, onCoins) {
  // ---- state ----
  const W = 800, H = 450;
  let raf = null, last = 0, running = false;
  let score = 0, coins = 0;
  let over = false;

  // bottles config
  const BOTTLE_COUNT = 5;
  const MAX_LAYERS = 4;
  const NUM_COLORS = 3;
  const COLORS = ['#FF10F0', '#00FFFF', '#39FF88'];
  const COLOR_NAMES = ['MAGENTA', 'CYAN', 'GREEN'];

  // bottle layout
  let bottles = [];
  let selectedBottle = -1;
  let moves = 0;

  // undo stack
  let undoStack = [];

  // confetti particles
  let confetti = [];

  // pour animation
  let pourAnim = null;

  // win state
  let won = false;

  // input (set by core)
  let touches = { action: false };
  let keys = {};
  let tapX = -1, tapY = -1;

  // difficulty ramp
  let diffLevel = 0;
  let moveLimit = 0; // 0 = unlimited; >0 = lose when moves exceed

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

  function getBottlePositions() {
    const positions = [];
    const spacing = W / (BOTTLE_COUNT + 1);
    const bottleW = 60;
    const bottleH = 220;
    const baseY = H / 2 - bottleH / 2 + 20;
    for (let i = 0; i < BOTTLE_COUNT; i++) {
      const x = spacing * (i + 1) - bottleW / 2;
      positions.push({ x: x, y: baseY, w: bottleW, h: bottleH });
    }
    return positions;
  }

  function generateBottles() {
    // Create color distribution: NUM_COLORS bottles with 4 layers each, 
    // 2 empty bottles for shuffling space
    let allLayers = [];
    for (let c = 0; c < NUM_COLORS; c++) {
      for (let j = 0; j < MAX_LAYERS; j++) {
        allLayers.push(c);
      }
    }
    // Shuffle
    for (let i = allLayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allLayers[i], allLayers[j]] = [allLayers[j], allLayers[i]];
    }

    // Distribute into BOTTLE_COUNT bottles, 2 are empty
    const result = [];
    let idx = 0;
    const filledBottles = NUM_COLORS; // 3 bottles get 4 layers each
    for (let i = 0; i < BOTTLE_COUNT; i++) {
      if (i < filledBottles) {
        result.push([allLayers[idx], allLayers[idx + 1], allLayers[idx + 2], allLayers[idx + 3]]);
        idx += 4;
      } else {
        result.push([]);
      }
    }
    return result;
  }

  function isSorted() {
    for (let i = 0; i < bottles.length; i++) {
      if (bottles[i].length === 0) continue;
      if (bottles[i].length < MAX_LAYERS) return false;
      const color = bottles[i][0];
      for (let j = 1; j < bottles[i].length; j++) {
        if (bottles[i][j] !== color) return false;
      }
    }
    return true;
  }

  function canPour(fromIdx, toIdx) {
    const from = bottles[fromIdx];
    const to = bottles[toIdx];
    if (from.length === 0) return false;
    if (to.length === 0) return true;
    if (to.length >= MAX_LAYERS) return false;
    // Pour top color
    const fromColor = from[from.length - 1];
    const toColor = to[to.length - 1];
    return fromColor === toColor;
  }

  function doPour(fromIdx, toIdx) {
    undoStack.push({ from: fromIdx, to: toIdx, color: bottles[fromIdx][bottles[fromIdx].length - 1] });
    const fromColor = bottles[fromIdx].pop();
    bottles[toIdx].push(fromColor);
    moves++;
    if (typeof window.playSfx === 'function') { try { window.playSfx('shoot'); } catch (e) {} }

    // pour animation
    pourAnim = { fromIdx, toIdx, t: 0, color: COLORS[fromColor] };

    if (isSorted()) {
      if (typeof gameFX !== 'undefined') { try { var __r2 = canvas.getBoundingClientRect(); gameFX.burst(__r2.left + (W/2) * __r2.width / canvas.width, __r2.top + (H/2) * __r2.height / canvas.height, '#ffd700', 22); } catch(e){} gameFX.shake(2); }
      won = true;
      score = moves * 100;
      onScore(score);
      if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
      if (navigator.vibrate) { try { navigator.vibrate([60, 30, 60]); } catch (e) {} }
      // spawn confetti
      for (let i = 0; i < 80; i++) {
        confetti.push({
          x: Math.random() * W,
          y: Math.random() * H * 0.5,
          vx: (Math.random() - 0.5) * 200,
          vy: Math.random() * -200 - 50,
          color: COLORS[Math.floor(Math.random() * NUM_COLORS)],
          size: 4 + Math.random() * 6,
          life: 2 + Math.random() * 2
        });
      }
      // coins reward
      const coinReward = Math.max(0, 100 - moves * 5);
      if (coinReward > 0) {
        coins += coinReward;
        onCoins(coinReward);
      }
      setTimeout(function() {
        if (!over) {
          gameOver();
        }
      }, 3000);
    } else if (moveLimit > 0 && moves >= moveLimit) {
      // Move limit exceeded — lose
      if (typeof window.playSfx === 'function') { try { window.playSfx('error'); } catch (e) {} }
      score = Math.max(0, moves * 10);
      onScore(score);
      setTimeout(function() { if (!over) gameOver(); }, 800);
    }
  }

  function undoLast() {
    if (undoStack.length === 0) return;
    const last = undoStack.pop();
    bottles[last.to].pop();
    bottles[last.from].push(last.color);
    moves = Math.max(0, moves - 1);
    selectedBottle = -1;
  }

  function reset() {
    score = 0; coins = 0; over = false; won = false;
    selectedBottle = -1;
    moves = 0;
    undoStack = [];
    confetti = [];
    pourAnim = null;
    bottles = generateBottles();
  }

  // ---- update ----
  function update(dt) {
    if (over || !running) return;

    // update pour animation
    if (pourAnim) {
      pourAnim.t += dt * 3;
      if (pourAnim.t >= 1) {
        pourAnim = null;
      }
    }

    // update confetti
    for (let i = confetti.length - 1; i >= 0; i--) {
      const p = confetti[i];
      p.x += p.vx * dt;
      p.vy += 300 * dt; // gravity
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0 || p.y > H + 20) {
        confetti.splice(i, 1);
      }
    }

    // check tap
    if (tapX >= 0 && tapY >= 0) {
      handleTap(tapX, tapY);
      tapX = -1;
      tapY = -1;
    }
  }

  function handleTap(tx, ty) {
    if (won || over) return;
    const positions = getBottlePositions();

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      if (tx >= p.x && tx <= p.x + p.w && ty >= p.y && ty <= p.y + p.h) {
        if (selectedBottle === -1) {
          // select bottle if it has layers
          if (bottles[i].length > 0) {
            selectedBottle = i;
          }
        } else if (selectedBottle === i) {
          // deselect
          selectedBottle = -1;
        } else {
          // try pour
          if (canPour(selectedBottle, i)) {
            doPour(selectedBottle, i);
            selectedBottle = -1;
          } else {
            // switch selection
            if (bottles[i].length > 0) {
              selectedBottle = i;
            } else {
              selectedBottle = -1;
            }
          }
        }
        return;
      }
    }
    // tapped outside bottles
    selectedBottle = -1;
  }

  // Handle touch/mouse on canvas
  function handleCanvasClick(e) {
    if (!running || over) return;
    const rect2 = canvas.getBoundingClientRect();
    const scaleX = W / rect2.width;
    const scaleY = H / rect2.height;
    const tx = (e.clientX - rect2.left) * scaleX;
    const ty = (e.clientY - rect2.top) * scaleY;
    handleTap(tx, ty);
  }

  function handleCanvasTouch(e) {
    if (!running || over) return;
    e.preventDefault();
    const rect2 = canvas.getBoundingClientRect();
    const scaleX = W / rect2.width;
    const scaleY = H / rect2.height;
    const touch = e.touches[0];
    if (touch) {
      const tx = (touch.clientX - rect2.left) * scaleX;
      const ty = (touch.clientY - rect2.top) * scaleY;
      handleTap(tx, ty);
    }
  }

  // Attach event listeners
  function attachEvents() {
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('touchstart', handleCanvasTouch, { passive: false });
  }

  function detachEvents() {
    canvas.removeEventListener('click', handleCanvasClick);
    canvas.removeEventListener('touchstart', handleCanvasTouch);
  }

  // ---- render ----
  function render() {
    // bg
    ctx.fillStyle = '#05070A';
    ctx.fillRect(0, 0, W, H);

    // title
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00FFFF';
    ctx.fillStyle = '#00FFFF';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('WATER SORT', W / 2, 35);
    ctx.shadowBlur = 0;

    // moves counter
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#FFE600';
    ctx.fillStyle = '#FFE600';
    ctx.font = '14px monospace';
    ctx.fillText('MOVES: ' + moves + (moveLimit > 0 ? ' / ' + moveLimit : ''), W / 2, 58);
    ctx.shadowBlur = 0;

    const positions = getBottlePositions();

    // draw bottles
    for (let i = 0; i < BOTTLE_COUNT; i++) {
      const p = positions[i];
      const layers = bottles[i];
      const isSelected = (selectedBottle === i);

      // bottle glow for selection
      if (isSelected) {
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#FFE600';
        ctx.strokeStyle = '#FFE600';
        ctx.lineWidth = 3;
        ctx.strokeRect(p.x - 4, p.y - 4, p.w + 8, p.h + 8);
        ctx.shadowBlur = 0;
      }

      // bottle body (glass outline)
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x, p.y, p.w, p.h);

      // bottle neck
      const neckW = 20;
      const neckH = 20;
      const neckX = p.x + p.w / 2 - neckW / 2;
      ctx.strokeRect(neckX, p.y - neckH, neckW, neckH);
      ctx.fillStyle = '#0A0E18';
      ctx.fillRect(neckX + 2, p.y - neckH + 2, neckW - 4, neckH - 2);

      // empty bottle fill
      ctx.fillStyle = 'rgba(10,14,24,0.5)';
      ctx.fillRect(p.x + 2, p.y + 2, p.w - 4, p.h - 4);

      // pour animation: show color block moving
      let animFrom = -1, animTo = -1, animT = 0, animColor = '';
      if (pourAnim) {
        animFrom = pourAnim.fromIdx;
        animTo = pourAnim.toIdx;
        animT = pourAnim.t;
        animColor = pourAnim.color;
      }

      // draw color layers (bottom to top)
      const layerH = (p.h - 10) / MAX_LAYERS;
      for (let j = 0; j < layers.length; j++) {
        // skip the layer being animated out
        if (i === animFrom && j === layers.length) continue;

        const colorIdx = layers[j];
        const ly = p.y + p.h - (j + 1) * layerH - 3;
        const lx = p.x + 4;
        const lw = p.w - 8;
        const lh = layerH - 2;

        ctx.shadowBlur = 10;
        ctx.shadowColor = COLORS[colorIdx];
        ctx.fillStyle = COLORS[colorIdx];
        ctx.fillRect(lx, ly, lw, lh);
        ctx.shadowBlur = 0;

        // highlight
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(lx, ly, lw, lh / 3);
      }

      // draw animated color block
      if (animT > 0 && animT < 1) {
        const fromPos = positions[animFrom];
        const toPos = positions[animTo];
        const ax = fromPos.x + (toPos.x - fromPos.x) * animT;
        const ay = fromPos.y - 40 + Math.sin(animT * Math.PI) * -40;
        const layerH2 = (fromPos.h - 10) / MAX_LAYERS;
        ctx.shadowBlur = 14;
        ctx.shadowColor = animColor;
        ctx.fillStyle = animColor;
        ctx.fillRect(ax + 4, ay, fromPos.w - 8, layerH2 - 2);
        ctx.shadowBlur = 0;
      }

      // bottle number label
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#666';
      ctx.fillStyle = '#444';
      ctx.font = '10px monospace';
      ctx.fillText(String.fromCharCode(65 + i), p.x + p.w / 2 - 3, p.y + p.h + 16);
      ctx.shadowBlur = 0;
    }

    // undo hint
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#39FF88';
    ctx.fillStyle = '#39FF88';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('[ACTION] UNDO', W / 2, H - 20);
    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;

    // confetti
    for (const p of confetti) {
      ctx.shadowBlur = 6;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
      ctx.shadowBlur = 0;
    }

    // win overlay
    if (won) {
      ctx.fillStyle = 'rgba(5,7,10,0.8)';
      ctx.fillRect(0, 0, W, H);
      ctx.shadowBlur = 30;
      ctx.shadowColor = '#39FF88';
      ctx.fillStyle = '#39FF88';
      ctx.font = 'bold 40px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SORTED!', W / 2, H / 2 - 30);
      ctx.shadowBlur = 0;
      ctx.shadowColor = '#FFE600';
      ctx.fillStyle = '#FFE600';
      ctx.font = '20px monospace';
      ctx.fillText('SCORE: ' + score + '  MOVES: ' + moves, W / 2, H / 2 + 15);
      ctx.textAlign = 'left';
      ctx.shadowBlur = 0;
    }

    // game over overlay
    if (over && !won) {
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
      ctx.fillText('SCORE: ' + score, W / 2, H / 2 + 10);
      ctx.fillText('COINS: ' + coins, W / 2, H / 2 + 38);
      ctx.textAlign = 'left';
      ctx.shadowBlur = 0;
    }
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
    if (won && typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
    if (typeof gameFX !== 'undefined') { try { var __r = canvas.getBoundingClientRect(); gameFX.burst(__r.left + (W/2) * __r.width / canvas.width, __r.top + (H/2) * __r.height / canvas.height, '#ff4444', 16); } catch(e){} gameFX.shake(5); }
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
    setInput(t, k) {
      touches = t || {};
      keys = k || {};
      // handle undo via action key
      if (touches.action || keys.KeyZ || keys.KeyU) {
        if (!over && !won) undoLast();
        touches.action = false;
        keys.KeyZ = false;
        keys.KeyU = false;
      }
    },
    controls: { joystick: false, boost: false, action: true, drift: false },
    setDifficulty: function(level) {
      var l = Math.max(0, Math.min(5, Math.floor(level) || 0));
      diffLevel = l;
      // Move limit imposed at higher difficulty — forces efficient solving
      moveLimit = [0, 0, 25, 20, 16, 12][l];
    }
  };
}
