/* ============================================================
   Temple Run — Neon Endless Runner (দৌড়)
   Canvas 800x450, swipe up = jump, down = slide, left/right = turn (lanes)
   Magnet + Jetpack boosters, monkey behind
   ============================================================ */
function templeRun(canvas, ctx, onScore, onGameOver, onCoins) {
  // ---- state ----
  const W = 800, H = 450;
  let raf = null, last = 0, running = false;
  let score = 0, coins = 0;
  let over = false;

  // lanes (3)
  const LANE_X = [220, 400, 580];
  const GROUND_Y = H - 70;

  const player = {
    x: LANE_X[1], y: GROUND_Y, w: 40, h: 56,
    lane: 1, vy: 0, onGround: true, sliding: false, slideT: 0,
    jetpack: 0, // seconds remaining
    anim: 0
  };
  const GRAVITY = 900;
  const JUMP_V = -420;

  // obstacles: {x, lane, type:'block'|'bar'|'spike', passed}
  let obstacles = [];
  let coinsList = [];
  let obstaclesTimer = 0;
  let speed = 260;
  const SPEED_UP = 8;
  let difficultyMult = 1;   // v7.18 difficulty ramp

  // monkey trailing
  let monkeyX = -60, monkeyY = GROUND_Y - 40;

  // swipes
  let swipeStart = null;

  // ---- helpers ----
  function rect(x, y, w, h, color, glow) {
    ctx.shadowBlur = glow || 10;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
  }
  function circle(x, y, r, color, glow) {
    ctx.shadowBlur = glow || 12;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // ==== VISUAL JUICE (gameFX) — discrete events only ====
  function fx_toScreen(gx, gy) {
    const r = canvas.getBoundingClientRect();
    return { x: r.left + r.width * (gx / W), y: r.top + r.height * (gy / H) };
  }
  function fx_shake(intensity) {
    if (window.gameFX && window.gameFX.shake) { try { window.gameFX.shake(intensity); } catch (e) {} }
  }
  function fx_burst(x, y, color, count) {
    if (window.gameFX && window.gameFX.burst) { try { window.gameFX.burst(x, y, color, count); } catch (e) {} }
  }
  function fx_burstAt(gx, gy, color, count) {
    const p = fx_toScreen(gx, gy);
    fx_burst(p.x, p.y, color, count);
  }

  function reset() {
    score = 0; coins = 0; over = false;
    player.x = LANE_X[1]; player.y = GROUND_Y; player.lane = 1;
    player.vy = 0; player.onGround = true; player.sliding = false; player.slideT = 0;
    player.jetpack = 0;
    obstacles = []; coinsList = []; obstaclesTimer = 0;
    speed = 260;
    difficultyMult = 1;
    monkeyX = -60;
    swipeStart = null;
  }

  // ---- spawn ----
  function spawnObstacle() {
    const lane = Math.floor(Math.random() * 3);
    const rand = Math.random();
    let type = 'block';
    if (rand < 0.3) type = 'bar';      // high bar — must slide
    else if (rand < 0.45) type = 'spike'; // low spike — must jump
    obstacles.push({ x: W + 60, lane, type, passed: false });
    // maybe a coin on another lane
    if (Math.random() < 0.5) {
      const lane2 = (lane + 1 + Math.floor(Math.random() * 2)) % 3;
      coinsList.push({ x: W + 60, lane: lane2, taken: false });
    }
  }

  // ---- swipes ----
  function swipe(vx, vy) {
    if (over || !running) return;
    if (Math.abs(vx) > Math.abs(vy)) {
      // horizontal: change lane
      if (vx < -30 && player.lane > 0) player.lane--;
      if (vx > 30 && player.lane < 2) player.lane++;
    } else {
      if (vy < -30) {
        // swipe up = jump
        if (player.onGround && !player.sliding) {
          player.vy = JUMP_V;
          player.onGround = false;
          if (typeof window.playSfx === 'function') { try { window.playSfx('flap'); } catch (e) {} }
        }
      } else if (vy > 30) {
        // swipe down = slide
        player.sliding = true;
        player.slideT = 0.6;
        if (typeof window.playSfx === 'function') { try { window.playSfx('slide'); } catch (e) {} }
      }
    }
  }

  // ---- update ----
  function update(dt) {
    if (over || !running) return;

    // difficulty
    speed = Math.min(560 * difficultyMult, speed + SPEED_UP * dt);
    score += Math.floor(speed * dt * 0.1);
    onScore(score);

    // move to lane
    const targetX = LANE_X[player.lane];
    player.x += (targetX - player.x) * Math.min(1, dt * 10);

    // gravity / jetpack
    if (player.jetpack > 0) {
      player.jetpack -= dt;
      player.y -= 200 * dt;
      if (player.y < 120) player.y = 120;
      player.onGround = false;
    } else {
      player.vy += GRAVITY * dt;
      player.y += player.vy * dt;
      if (player.y >= GROUND_Y) {
        player.y = GROUND_Y;
        player.vy = 0;
        player.onGround = true;
      }
    }

    // slide timer
    if (player.sliding) {
      player.slideT -= dt;
      if (player.slideT <= 0) player.sliding = false;
    }

    // anim
    player.anim += dt * 6;

    // spawn obstacles
    obstaclesTimer -= dt;
    if (obstaclesTimer <= 0) {
      spawnObstacle();
      obstaclesTimer = Math.max(0.6, 1.6 - speed / 700);
    }

    // move obstacles & coins
    for (const o of obstacles) o.x -= speed * dt;
    for (const c of coinsList) c.x -= speed * dt;
    obstacles = obstacles.filter(o => o.x > -80);
    coinsList = coinsList.filter(c => c.x > -40 && !c.taken);

    // scoring per obstacle passed
    for (const o of obstacles) {
      if (!o.passed && o.x + 30 < player.x) {
        o.passed = true;
        score += 10;
      }
    }

    // magnet: pull coins toward player
    const magnet = player.jetpack > 0;
    for (const c of coinsList) {
      if (c.taken) continue;
      if (magnet) {
        c.x += (player.x - c.x) * dt * 6;
        c.y += (GROUND_Y - 40 - c.y) * dt * 6;
      }
      const dx = c.x - player.x, dy = (GROUND_Y - 30) - c.y;
      if (Math.hypot(dx, dy) < 44) {
        c.taken = true;
        coins += 10;
        onCoins(10);
        if (typeof window.playSfx === 'function') { try { window.playSfx('coin'); } catch (e) {} }
      }
    }

    // jetpack pickup
    for (const c of coinsList) {
      if (c.taken && c.booster) { /* boosters handled below */ }
    }

    // collisions with obstacles
    const pBox = {
      x: player.x - player.w / 2, y: player.sliding ? player.y - 22 : player.y - player.h,
      w: player.w, h: player.sliding ? 22 : player.h
    };
    for (const o of obstacles) {
      const ob = {
        x: o.x, y: o.type === 'bar' ? GROUND_Y - 60 : GROUND_Y - 50,
        w: 30, h: o.type === 'bar' ? 60 : 50
      };
      if (pBox.x + pBox.w > ob.x && pBox.x < ob.x + ob.w && pBox.y + pBox.h > ob.y && pBox.y < ob.y + ob.h) {
        // slide under bar is safe
        if (o.type === 'bar' && player.sliding) continue;
        // jump over spike/block is safe (player above)
        if (player.y + player.vy * 0.1 < ob.y && player.vy < 0) continue;
        if (typeof window.playSfx === 'function') { try { window.playSfx('error'); } catch (e) {} }
        gameOver();
        return;
      }
    }

    // monkey chases (visual) — closer over time
    monkeyX = Math.min(player.x - 120, monkeyX + speed * dt);

    // end condition: fall out (jetpack out of bounds up) — none
  }

  // ---- render ----
  function render() {
    ctx.fillStyle = '#05070A';
    ctx.fillRect(0, 0, W, H);

    // background ruins / grid
    ctx.fillStyle = 'rgba(0,255,255,0.06)';
    for (let i = 0; i < 40; i++) {
      const sx = (i * 61) % W, sy = (i * 37) % (H - 100);
      ctx.fillRect(sx, sy, 2, 2);
    }

    // ground
    ctx.fillStyle = '#0B0F1A';
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    rect(0, GROUND_Y, W, 3, '#FF10F0', 12);
    // lane dividers
    ctx.strokeStyle = 'rgba(0,255,255,0.25)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      const lx = (LANE_X[0] + LANE_X[1]) / 2 + (i - 1) * (LANE_X[2] - LANE_X[0]) / 2;
      ctx.beginPath();
      ctx.moveTo(lx, GROUND_Y + 10);
      ctx.lineTo(lx, H);
      ctx.stroke();
    }

    // obstacles
    for (const o of obstacles) {
      if (o.type === 'block') rect(o.x, GROUND_Y - 50, 30, 50, '#FF10F0', 14);
      else if (o.type === 'bar') rect(o.x, GROUND_Y - 60, 30, 60, '#39FF88', 14);
      else rect(o.x, GROUND_Y - 34, 30, 34, '#FFE600', 14); // spike
    }

    // coins
    for (const c of coinsList) {
      if (c.taken) continue;
      circle(c.x, GROUND_Y - 40, 10, '#FFE600', 14);
      ctx.fillStyle = '#AA8800';
      ctx.beginPath();
      ctx.arc(c.x, GROUND_Y - 40, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // player (runner)
    const px = player.x, py = player.y;
    if (player.sliding) {
      // sliding body
      ctx.shadowBlur = 14; ctx.shadowColor = '#00FFFF';
      ctx.fillStyle = '#00E5FF';
      ctx.beginPath();
      ctx.ellipse(px, py - 10, 24, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      const bob = Math.sin(player.anim) * 4;
      // body
      ctx.shadowBlur = 16; ctx.shadowColor = '#00FFFF';
      ctx.fillStyle = '#00E5FF';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(px - 14, py - 52 + bob, 28, 44, 8) : ctx.rect(px - 14, py - 52 + bob, 28, 44);
      ctx.fill();
      // head
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(px, py - 58 + bob, 10, 0, Math.PI * 2);
      ctx.fill();
      // scarf
      ctx.fillStyle = '#FF10F0';
      ctx.fillRect(px - 12, py - 40 + bob, 24, 6);
      ctx.shadowBlur = 0;
    }

    // jetpack flame
    if (player.jetpack > 0) {
      const fl = Math.random() * 14 + 8;
      circle(px, py + 8, fl, '#FFE600', 20);
      circle(px, py + 8, fl / 2, '#FF10F0', 16);
    }

    // monkey behind
    ctx.fillStyle = '#8B5E3C';
    ctx.shadowBlur = 8; ctx.shadowColor = '#8B5E3C';
    ctx.beginPath();
    ctx.arc(monkeyX, GROUND_Y - 30, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5C3D24';
    ctx.beginPath();
    ctx.arc(monkeyX - 6, GROUND_Y - 38, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🐒', monkeyX, GROUND_Y - 34);

    // HUD
    ctx.shadowBlur = 12; ctx.shadowColor = '#00FFFF';
    ctx.fillStyle = '#00FFFF'; ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SCORE', 16, 30);
    ctx.fillStyle = '#FFF'; ctx.font = 'bold 18px monospace';
    ctx.fillText('' + score, 16, 54);
    ctx.fillStyle = '#FFE600'; ctx.shadowColor = '#FFE600';
    ctx.fillText('🪙 ' + coins, W - 110, 30);
    ctx.shadowBlur = 0;
    if (!running && !over) {
      ctx.fillStyle = '#39FF88'; ctx.font = '14px monospace'; ctx.textAlign = 'center';
      ctx.fillText('SWIPE: ↑ JUMP · ↓ SLIDE · ←→ LANE', W / 2, H - 14);
    }
    // game over
    if (over) {
      ctx.fillStyle = 'rgba(5,7,10,0.85)';
      ctx.fillRect(0, 0, W, H);
      ctx.shadowBlur = 20; ctx.shadowColor = '#FF10F0';
      ctx.fillStyle = '#FF10F0'; ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 30);
      ctx.shadowColor = '#00FFFF'; ctx.fillStyle = '#00FFFF';
      ctx.font = '20px monospace';
      ctx.fillText('SCORE: ' + score, W / 2, H / 2 + 10);
      ctx.fillText('COINS: ' + coins, W / 2, H / 2 + 38);
      ctx.textAlign = 'left'; ctx.shadowBlur = 0;
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
    over = true; running = false;
    if (raf) cancelAnimationFrame(raf);
    if (navigator.vibrate) { try { navigator.vibrate(200); } catch (e) {} }
    if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
    fx_shake(4);
    onGameOver(Math.floor(score), coins);
  }

  // ---- public API ----
  return {
    start() {
      reset();
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    update() {/* handled internally */},
    render() { render(); },
    pause() { running = false; if (raf) cancelAnimationFrame(raf); },
    resume() { if (over || running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); },
    destroy() { running = false; if (raf) cancelAnimationFrame(raf); },
    setInput(t, k) { touches = t || {}; keys = k || {}; },
    setDifficulty(level) {
      const m = [1.0, 1.15, 1.3, 1.5, 1.75, 2.0];
      const l = Math.max(0, Math.min(5, Math.floor(level) || 0));
      difficultyMult = m[l];
    },
    // swipe controls only — bind via canvas pointer events
    controls: { joystick: false, boost: false, action: false, drift: false },
    swipe
  };
}