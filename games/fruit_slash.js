/* ============================================================
   Fruit Slash — Fruit Ninja Style Arcade Game
   Canvas 800x450, swipe to cut fruit. Bombs cost lives.
   Neon trails, combos, golden fruit coins. 60s timer.
   ============================================================ */
function fruitSlash(canvas, ctx, onScore, onGameOver, onCoins) {
  // ---- state ----
  const W = 800, H = 450;
  let raf = null, last = 0, running = false;
  let score = 0, coins = 0;
  let over = false;

  // game settings
  const GAME_TIME = 60;
  const MAX_LIVES = 3;
  const FRUIT_INTERVAL = 0.8;
  const GRAVITY = 380;
  const SLASH_LIFETIME = 200; // ms

  // game state
  let lives = MAX_LIVES;
  let timeLeft = GAME_TIME;
  let spawnTimer = 0;
  let difficulty = 1;
  let difficultyMult = 1;   // v7.18 difficulty ramp

  // fruits
  const FRUIT_COLORS = ['#FF10F0', '#00FFFF', '#39FF88', '#FFE600', '#FF6644'];
  const FRUIT_SHAPES = ['circle', 'circle', 'circle', 'circle', 'circle'];
  let fruits = [];

  // bombs
  let bombChance = 0.12;

  // slash trails
  let slashTrails = [];

  // splash effects (from cut fruit)
  let splashes = [];

  // combo
  let comboCount = 0;
  let comboTimer = 0;
  let comboText = '';
  let comboTextTimer = 0;
  let comboMultiplier = 1;

  // floating score texts
  let floatingTexts = [];

  // golden fruit coins
  let coinDrop = null;

  // swipe state
  let isSwiping = false;
  let swipePoints = [];
  let lastSwipeX = 0;
  let lastSwipeY = 0;

  // input
  let touches = {};
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

  function dist(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2));
  }

  function spawnFruit() {
    const isBomb = Math.random() < bombChance;
    const isGolden = !isBomb && Math.random() < 0.08;
    const colorIdx = Math.floor(Math.random() * FRUIT_COLORS.length);
    const startX = 100 + Math.random() * (W - 200);
    const startY = H + 30;
    const vx = (Math.random() - 0.5) * 100;
    const vy = -(350 + Math.random() * 200 + difficulty * 20);

    fruits.push({
      x: startX,
      y: startY,
      vx: vx,
      vy: vy,
      r: isBomb ? 22 : (isGolden ? 20 : 18),
      isBomb: isBomb,
      isGolden: isGolden,
      colorIdx: colorIdx,
      cut: false,
      alive: true,
      rotation: 0,
      rotSpeed: (Math.random() - 0.5) * 4
    });
  }

  function slashCheck() {
    for (const fruit of fruits) {
      if (!fruit.alive || fruit.cut) continue;
      // check if any slash segment intersects the fruit
      for (let i = 1; i < slashTrails.length; i++) {
        const s1 = slashTrails[i - 1];
        const s2 = slashTrails[i];
        // point-to-segment distance
        const d = pointToSegmentDist(fruit.x, fruit.y, s1.x, s1.y, s2.x, s2.y);
        if (d < fruit.r + 6) {
          cutFruit(fruit);
          break;
        }
      }
    }
  }

  function pointToSegmentDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return dist(px, py, ax, ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const closestX = ax + t * dx;
    const closestY = ay + t * dy;
    return dist(px, py, closestX, closestY);
  }

  function cutFruit(fruit) {
    fruit.cut = true;
    fruit.alive = false;

    if (fruit.isBomb) {
      // bomb: lose life
      lives--;
      comboCount = 0;
      comboTimer = 0;
      comboMultiplier = 1;
      floatingTexts.push({
        x: fruit.x, y: fruit.y - 20,
        text: '-1 LIFE',
        color: '#FF4444',
        life: 1.0,
        vy: -40
      });
      if (navigator.vibrate) {
        try { navigator.vibrate(300); } catch (e) {}
      }
      if (typeof window.playSfx === 'function') { try { window.playSfx('error'); } catch (e) {} }
      if (lives <= 0) {
        gameOver();
        return;
      }
    } else {
      // fruit: score points
      comboCount++;
      comboTimer = 2.0;
      if (typeof window.playSfx === 'function') { try { window.playSfx('pop'); } catch (e) {} }

      let pts = 10;
      let label = '+10';
      let textColor = '#FFE600';

      if (comboCount >= 3) {
        comboMultiplier = 2;
        pts = 20;
        label = 'EXCELLENT! x2';
        textColor = '#FF10F0';
        if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
      } else if (comboCount === 2) {
        comboMultiplier = 1;
        pts = 10;
        label = 'NICE x1';
        textColor = '#39FF88';
      }

      score += pts;
      onScore(score);

      floatingTexts.push({
        x: fruit.x, y: fruit.y - 20,
        text: label,
        color: textColor,
        life: 1.2,
        vy: -60
      });

      // splash particles
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 150;
        splashes.push({
          x: fruit.x,
          y: fruit.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: FRUIT_COLORS[fruit.colorIdx],
          size: 3 + Math.random() * 5,
          life: 0.5 + Math.random() * 0.5
        });
      }

      // golden fruit drops coin
      if (fruit.isGolden) {
        coins += 5;
        onCoins(5);
        floatingTexts.push({
          x: fruit.x, y: fruit.y - 40,
          text: '🪙 +5 COINS',
          color: '#FFE600',
          life: 1.5,
          vy: -50
        });
      }
    }
  }

  function reset() {
    score = 0; coins = 0; over = false;
    lives = MAX_LIVES;
    timeLeft = GAME_TIME;
    spawnTimer = 0;
    difficulty = 1;
    difficultyMult = 1;
    fruits = [];
    slashTrails = [];
    splashes = [];
    comboCount = 0;
    comboTimer = 0;
    comboText = '';
    comboTextTimer = 0;
    comboMultiplier = 1;
    floatingTexts = [];
    isSwiping = false;
    swipePoints = [];
  }

  // ---- update ----
  function update(dt) {
    if (over || !running) return;

    // timer
    timeLeft -= dt;
    difficulty = 1 + (GAME_TIME - timeLeft) * 0.05;
    if (timeLeft <= 0) {
      timeLeft = 0;
      gameOver();
      return;
    }

    // combo timer
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) {
        comboCount = 0;
        comboMultiplier = 1;
      }
    }

    // spawn fruits
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnFruit();
      spawnTimer = Math.max(0.3, (FRUIT_INTERVAL - difficulty * 0.03) / difficultyMult);
      bombChance = Math.min(0.25, 0.12 + difficulty * 0.005);
    }

    // update fruits (physics)
    for (let i = fruits.length - 1; i >= 0; i--) {
      const f = fruits[i];
      if (!f.alive) {
        // cut fruits fall down and fade
        f.vy += GRAVITY * dt;
        f.y += f.vy * dt;
        f.x += f.vx * dt;
        f.rotation += f.rotSpeed * dt;
        if (f.y > H + 80) {
          fruits.splice(i, 1);
        }
        continue;
      }
      // alive fruits: physics
      f.vy += GRAVITY * dt;
      f.y += f.vy * dt;
      f.x += f.vx * dt;
      f.rotation += f.rotSpeed * dt;

      // off screen = missed fruit (no penalty unless bomb)
      if (f.y > H + 50 && !f.cut) {
        f.alive = false;
        // missed fruit resets combo
        comboCount = 0;
        comboTimer = 0;
        fruits.splice(i, 1);
        if (typeof window.playSfx === 'function') { try { window.playSfx('move'); } catch (e) {} }
      }
    }

    // check slash collisions
    if (isSwiping && slashTrails.length > 1) {
      slashCheck();
    }

    // slash trail decay
    for (let i = slashTrails.length - 1; i >= 0; i--) {
      slashTrails[i].age += dt * 1000;
      if (slashTrails[i].age > SLASH_LIFETIME) {
        slashTrails.splice(i, 1);
      }
    }

    // splashes update
    for (let i = splashes.length - 1; i >= 0; i--) {
      const s = splashes[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 200 * dt;
      s.life -= dt;
      if (s.life <= 0) {
        splashes.splice(i, 1);
      }
    }

    // floating texts update
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      if (ft.life <= 0) {
        floatingTexts.splice(i, 1);
      }
    }
  }

  // ---- render ----
  function render() {
    // bg
    ctx.fillStyle = '#05070A';
    ctx.fillRect(0, 0, W, H);

    // background grid
    ctx.strokeStyle = 'rgba(0,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 40) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, H);
      ctx.stroke();
    }
    for (let gy = 0; gy < H; gy += 40) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(W, gy);
      ctx.stroke();
    }

    // splashes (behind fruits)
    for (const s of splashes) {
      const alpha = Math.max(0, s.life / 0.5);
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 8;
      ctx.shadowColor = s.color;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // fruits
    for (const f of fruits) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rotation);

      if (f.isBomb) {
        // bomb: dark circle with skull
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#FF4444';
        ctx.fillStyle = '#331111';
        ctx.strokeStyle = '#FF4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, f.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        // skull icon
        ctx.fillStyle = '#FF4444';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('💣', 0, 6);
        ctx.textAlign = 'left';
      } else if (f.isGolden) {
        // golden fruit: shiny gold
        ctx.shadowBlur = 22;
        ctx.shadowColor = '#FFE600';
        ctx.fillStyle = '#FFE600';
        ctx.beginPath();
        ctx.arc(0, 0, f.r, 0, Math.PI * 2);
        ctx.fill();
        // inner highlight
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(-4, -4, f.r * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        // coin symbol
        ctx.fillStyle = '#AA8800';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('$', 0, 4);
        ctx.textAlign = 'left';
      } else {
        // normal fruit
        const color = FRUIT_COLORS[f.colorIdx];
        ctx.shadowBlur = 14;
        ctx.shadowColor = color;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, f.r, 0, Math.PI * 2);
        ctx.fill();
        // highlight
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.arc(-f.r * 0.25, -f.r * 0.25, f.r * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.restore();
    }

    // slash trails
    if (slashTrails.length > 1) {
      for (let i = 1; i < slashTrails.length; i++) {
        const s = slashTrails[i];
        const age = s.age;
        const alpha = Math.max(0, 1 - age / SLASH_LIFETIME);
        if (alpha <= 0) continue;
        const prev = slashTrails[i - 1];
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 4 * alpha;
        ctx.shadowBlur = 16;
        ctx.shadowColor = '#00FFFF';
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        // secondary trail
        ctx.strokeStyle = '#00FFFF';
        ctx.lineWidth = 2 * alpha;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
    }

    // floating texts
    for (const ft of floatingTexts) {
      const alpha = Math.min(1, ft.life / 0.3);
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 12;
      ctx.shadowColor = ft.color;
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.textAlign = 'left';
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // HUD - lives
    for (let i = 0; i < lives; i++) {
      const hx = 16 + i * 28;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#FF10F0';
      ctx.fillStyle = '#FF10F0';
      ctx.font = '18px monospace';
      ctx.fillText('♥', hx, 28);
      ctx.shadowBlur = 0;
    }

    // HUD - timer
    ctx.shadowBlur = 8;
    ctx.shadowColor = timeLeft <= 10 ? '#FF4444' : '#00FFFF';
    ctx.fillStyle = timeLeft <= 10 ? '#FF4444' : '#00FFFF';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(Math.ceil(timeLeft) + 's', W / 2, 28);
    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;

    // timer bar
    const barW = 200;
    const barH = 4;
    const barX = W / 2 - barW / 2;
    const barY = 36;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(barX, barY, barW, barH);
    const timeRatio = timeLeft / GAME_TIME;
    const barColor = timeRatio > 0.5 ? '#00FFFF' : timeRatio > 0.25 ? '#FFE600' : '#FF4444';
    ctx.fillStyle = barColor;
    ctx.shadowBlur = 6;
    ctx.shadowColor = barColor;
    ctx.fillRect(barX, barY, barW * timeRatio, barH);
    ctx.shadowBlur = 0;

    // combo display
    if (comboCount >= 2) {
      ctx.shadowBlur = 14;
      ctx.shadowColor = comboCount >= 3 ? '#FF10F0' : '#39FF88';
      ctx.fillStyle = comboCount >= 3 ? '#FF10F0' : '#39FF88';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('COMBO x' + comboCount, W / 2, 70);
      if (comboCount >= 3) {
        ctx.font = 'bold 16px monospace';
        ctx.fillStyle = '#FFE600';
        ctx.fillText('EXCELLENT! 2X POINTS', W / 2, 92);
      }
      ctx.textAlign = 'left';
      ctx.shadowBlur = 0;
    }

    // score (top right)
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#FFE600';
    ctx.fillStyle = '#FFE600';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(score, W - 16, 28);
    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;

    // game over overlay
    if (over) {
      ctx.fillStyle = 'rgba(5,7,10,0.85)';
      ctx.fillRect(0, 0, W, H);
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#FF10F0';
      ctx.fillStyle = '#FF10F0';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 40);
      ctx.shadowColor = '#00FFFF';
      ctx.fillStyle = '#00FFFF';
      ctx.font = '18px monospace';
      ctx.fillText('SCORE: ' + score, W / 2, H / 2);
      ctx.fillText('COINS: ' + coins, W / 2, H / 2 + 28);
      ctx.fillStyle = '#FFE600';
      ctx.font = '14px monospace';
      ctx.fillText('TIME: ' + GAME_TIME + 's | LIVES: ' + MAX_LIVES, W / 2, H / 2 + 58);
      ctx.textAlign = 'left';
      ctx.shadowBlur = 0;
    }
  }

  // ---- swipe input handling ----
  function getCanvasPos(clientX, clientY) {
    const rect2 = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect2.left) * (W / rect2.width),
      y: (clientY - rect2.top) * (H / rect2.height)
    };
  }

  function onPointerDown(e) {
    if (!running || over) return;
    isSwiping = true;
    const pos = getCanvasPos(e.clientX, e.clientY);
    slashTrails.push({ x: pos.x, y: pos.y, age: 0 });
    lastSwipeX = pos.x;
    lastSwipeY = pos.y;
  }

  function onPointerMove(e) {
    if (!running || over || !isSwiping) return;
    const pos = getCanvasPos(e.clientX, e.clientY);
    // only add if moved enough
    if (dist(pos.x, pos.y, lastSwipeX, lastSwipeY) > 5) {
      slashTrails.push({ x: pos.x, y: pos.y, age: 0 });
      lastSwipeX = pos.x;
      lastSwipeY = pos.y;
    }
  }

  function onPointerUp(e) {
    isSwiping = false;
  }

  function onTouchStart(e) {
    if (!running || over) return;
    e.preventDefault();
    if (e.touches.length > 0) {
      const t = e.touches[0];
      isSwiping = true;
      const pos = getCanvasPos(t.clientX, t.clientY);
      slashTrails.push({ x: pos.x, y: pos.y, age: 0 });
      lastSwipeX = pos.x;
      lastSwipeY = pos.y;
    }
  }

  function onTouchMove(e) {
    if (!running || over) return;
    e.preventDefault();
    if (e.touches.length > 0) {
      const t = e.touches[0];
      const pos = getCanvasPos(t.clientX, t.clientY);
      if (dist(pos.x, pos.y, lastSwipeX, lastSwipeY) > 5) {
        slashTrails.push({ x: pos.x, y: pos.y, age: 0 });
        lastSwipeX = pos.x;
        lastSwipeY = pos.y;
      }
    }
  }

  function onTouchEnd(e) {
    isSwiping = false;
  }

  function attachEvents() {
    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mousemove', onPointerMove);
    canvas.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('mouseleave', onPointerUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
  }

  function detachEvents() {
    canvas.removeEventListener('mousedown', onPointerDown);
    canvas.removeEventListener('mousemove', onPointerMove);
    canvas.removeEventListener('mouseup', onPointerUp);
    canvas.removeEventListener('mouseleave', onPointerUp);
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd);
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
    setInput(t, k) { touches = t || {}; keys = k || {}; },
    setDifficulty(level) {
      const m = [1.0, 1.15, 1.3, 1.5, 1.75, 2.0];
      const l = Math.max(0, Math.min(5, Math.floor(level) || 0));
      difficultyMult = m[l];
    },
    controls: { joystick: false, boost: false, action: false, drift: false }
  };
}
