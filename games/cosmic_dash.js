function cosmicDash(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, overSent = false;
  let score = 0, coins = 0, keys = {}, touches = {};
  let time = 0, state = 'play', shake = 0;

  let player = { x: 120, y: H/2, vy: 0, r: 18, rot: 0 };
  let gravity = 1200;   // px/s²
  let flipGravity = false;
  let speed = 300;      // world scroll speed
  let difficultyMult = 1;   // v7.18 difficulty ramp
  let obstacles = [];
  let stars = [];
  let portals = [];
  let distance = 0;
  let lives = 3;
  let portalFlash = 0;
  let invuln = 0;

  const COLORS = ['#FF3B6B', '#FF8A00', '#FFE600', '#39FF88', '#00FFFF', '#7B61FF'];

  function key(n) { return !!keys[n]; }
  function t(n) { return !!touches[n]; }

  function initStars() {
    stars = [];
    for (let i = 0; i < 120; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        z: 0.2 + Math.random() * 1.5,
        size: 1 + Math.random() * 2
      });
    }
  }

  function reset() {
    over = false; overSent = false;
    score = 0; coins = 0; time = 0; shake = 0;
    state = 'play'; gravity = 1200; flipGravity = false; speed = 300;
    distance = 0; lives = 3; portalFlash = 0; invuln = 0;
    player = { x: 120, y: H/2, vy: 0, r: 18, rot: 0 };
    obstacles = []; portals = [];
    initStars();
  }

  function callScore() { if (typeof onScore === 'function') onScore(score); }
  function callCoins() { if (typeof onCoins === 'function') onCoins(coins); }

  function die() {
    if (overSent) return;
    overSent = true; over = true; state = 'over';
    callScore();
    if (typeof onGameOver === 'function') onGameOver(score, coins);
  }

  function spawnObstacle() {
    const type = Math.random();
    const gap = 140 + Math.min(80, speed * 0.1);
    let obs;
    if (type < 0.5) {
      // Block from one side
      const fromTop = Math.random() < 0.5;
      const h = 60 + Math.random() * 120;
      obs = {
        x: W + 40, y: fromTop ? 0 : H - h,
        w: 36, h: h, type: 'block',
        color: COLORS[Math.floor(Math.random() * COLORS.length)]
      };
    } else if (type < 0.8) {
      // Moving block (sin wave)
      obs = {
        x: W + 40, y: H/2 - 60, w: 40, h: 120,
        type: 'move', amp: 80 + Math.random() * 80, phase: Math.random() * 6,
        speed: 2 + Math.random() * 2,
        color: '#FF8A00'
      };
    } else {
      // Portal pair
      if (portals.length < 4) {
        portals.push({
          x: W + 80, y: 40 + Math.random() * (H - 120),
          r: 28, type: Math.random() < 0.5 ? 'flip' : 'warp',
          id: Date.now() + Math.random()
        });
      }
      obs = null;
    }
    if (obs) obstacles.push(obs);
  }

  function checkPortal() {
    if (portalFlash > 0) return;
    for (let i = portals.length - 1; i >= 0; i--) {
      const p = portals[i];
      const dx = player.x - p.x;
      const dy = player.y - p.y;
      if (Math.hypot(dx, dy) < player.r + p.r) {
        if (p.type === 'flip') {
          flipGravity = !flipGravity;
          player.vy = player.vy * 0.3;
          portalFlash = 0.4;
          score += 20;
          callScore();
          if (typeof window.playSfx === 'function') { try { window.playSfx('coin'); } catch (e) {} }
        } else {
          // warp: teleport slightly forward
          player.x = Math.min(W - 60, player.x + 150);
          portalFlash = 0.3;
          score += 30;
          callScore();
        }
        portals.splice(i, 1);
      }
    }
  }

  function input() {
    if (t('action') || key('Space') || key('ArrowUp') || key('KeyW')) {
      // impulse
      player.vy += (flipGravity ? -1 : 1) * 380 * (1/60);
    }
  }

  function update(dt) {
    time += dt;
    if (shake > 0) shake -= dt;
    if (portalFlash > 0) portalFlash -= dt;
    if (invuln > 0) invuln -= dt;

    input();
    distance += speed * dt;
    score = Math.floor(distance / 10);
    callScore();

    // speed ramp
    speed = Math.min(650, (300 + distance * 0.02) * difficultyMult);

    // gravity
    player.vy += (flipGravity ? -1 : 1) * gravity * dt;
    player.y += player.vy * dt;
    player.rot += (flipGravity ? 1 : -1) * 4 * dt;

    // floor/ceiling clamp (bounce)
    if (player.y > H - player.r) {
      player.y = H - player.r;
      player.vy = Math.min(0, player.vy);
    }
    if (player.y < player.r) {
      player.y = player.r;
      player.vy = Math.max(0, player.vy);
    }

    // obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= speed * dt;
      if (o.type === 'move') {
        o.y = H/2 + Math.sin(time * o.speed + o.phase) * o.amp;
      }
      if (o.x + o.w < 0) { obstacles.splice(i, 1); continue; }
      // collision
      if (invuln <= 0) {
        const cx = Math.max(o.x, Math.min(player.x, o.x + o.w));
        const cy = Math.max(o.y, Math.min(player.y, o.y + o.h));
        const dx = player.x - cx, dy = player.y - cy;
        if (dx * dx + dy * dy < player.r * player.r) {
          hitObstacle();
          obstacles.splice(i, 1);
        }
      }
    }

    // portals
    for (let i = portals.length - 1; i >= 0; i--) {
      portals[i].x -= speed * dt;
      if (portals[i].x < -60) portals.splice(i, 1);
    }
    checkPortal();

    // stars
    for (const s of stars) {
      s.x -= speed * s.z * dt;
      if (s.x < 0) { s.x = W; s.y = Math.random() * H; }
    }

    // spawn
    if (Math.random() < 0.025 + distance * 0.00001) spawnObstacle();

    render();
  }

  function hitObstacle() {
    lives--;
    shake = 0.4;
    invuln = 1.2;
    score = Math.max(0, score - 50);
    callScore();
    if (typeof window.playSfx === 'function') { try { window.playSfx('hit'); } catch (e) {} }
    if (lives <= 0) die();
  }

  function drawStars() {
    for (const s of stars) {
      ctx.globalAlpha = Math.min(1, s.z);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.rot);
    // invulnerability blink
    if (invuln > 0 && Math.floor(time * 10) % 2 === 0) ctx.globalAlpha = 0.4;

    // flame
    ctx.fillStyle = '#FF8A00';
    ctx.shadowColor = '#FF8A00';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    const flameLen = 14 + Math.random() * 6;
    ctx.moveTo(-22, 0);
    ctx.lineTo(-22 - flameLen, -8);
    ctx.lineTo(-22 - flameLen + 6, 0);
    ctx.lineTo(-22 - flameLen, 8);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // ship
    const grad = ctx.createLinearGradient(0, -20, 0, 20);
    grad.addColorStop(0, '#00FFFF');
    grad.addColorStop(1, '#0055FF');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00FFFF';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(-14, -16);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-14, 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  function drawPortals() {
    for (const p of portals) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.strokeStyle = p.type === 'flip' ? '#7B61FF' : '#39FF88';
      ctx.lineWidth = 3;
      ctx.shadowColor = p.type === 'flip' ? '#7B61FF' : '#39FF88';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // spin
      ctx.beginPath();
      ctx.arc(0, 0, p.r - 6, time * 3, time * 3 + 1.5);
      ctx.stroke();
      ctx.font = '14px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillStyle = p.type === 'flip' ? '#7B61FF' : '#39FF88';
      ctx.fillText(p.type === 'flip' ? '⇅' : '»', 0, 5);
      ctx.restore();
    }
  }

  function drawObstacles() {
    for (const o of obstacles) {
      ctx.save();
      ctx.fillStyle = o.color;
      ctx.shadowColor = o.color;
      ctx.shadowBlur = 8;
      // warning stripes
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,.2)';
      for (let sy = o.y; sy < o.y + o.h; sy += 14) {
        ctx.fillRect(o.x, sy, o.w, 6);
      }
      ctx.restore();
    }
  }

  function drawUI() {
    // HUD
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, 48);
    ctx.font = 'bold 22px Orbitron';
    ctx.fillStyle = '#FFE600';
    ctx.textAlign = 'left';
    ctx.shadowColor = '#FFE600';
    ctx.shadowBlur = 8;
    ctx.fillText('SCORE: ' + score.toLocaleString(), 16, 34);
    ctx.shadowBlur = 0;

    ctx.font = '14px Orbitron';
    ctx.fillStyle = '#00FFFF';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(speed) + ' m/s', W/2, 30);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFE600';
    ctx.fillText('COINS: ' + coins, W - 16, 30);

    // lives
    ctx.font = '14px "Press Start 2P"';
    ctx.fillStyle = '#FF3B6B';
    ctx.textAlign = 'left';
    let lv = '';
    for (let i = 0; i < 3; i++) lv += i < lives ? '♥ ' : '♡ ';
    ctx.fillText(lv, 16, H - 12);

    // gravity indicator
    ctx.fillStyle = flipGravity ? 'rgba(123,97,255,.4)' : 'rgba(0,255,255,.15)';
    ctx.fillRect(W - 44, H - 44, 36, 36);
    ctx.fillStyle = '#FFF';
    ctx.font = '18px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText(flipGravity ? '⇅' : '↓', W - 26, H - 18);
    ctx.textAlign = 'left';
  }

  function render() {
    // background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#02040A');
    bgGrad.addColorStop(1, '#0A0A1A');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    drawStars();
    drawPortals();
    drawObstacles();
    drawPlayer();
    drawUI();

    if (portalFlash > 0) {
      ctx.fillStyle = `rgba(123,97,255,${portalFlash * 0.6})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (state === 'over') {
      ctx.fillStyle = 'rgba(0,0,10,0.9)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.font = 'bold 42px "Press Start 2P"';
      ctx.fillStyle = '#FF3B6B';
      ctx.shadowColor = '#FF3B6B';
      ctx.shadowBlur = 20;
      ctx.fillText('WRECKED!', W/2, H/2 - 50);
      ctx.shadowBlur = 0;
      ctx.font = '22px Orbitron';
      ctx.fillStyle = '#FFE600';
      ctx.fillText('SCORE: ' + score.toLocaleString(), W/2, H/2);
      ctx.fillStyle = '#00FFFF';
      ctx.fillText('DISTANCE: ' + Math.floor(distance / 10) + 'm · COINS: +' + coins, W/2, H/2 + 35);
      ctx.font = '14px Space Grotesk';
      ctx.fillStyle = '#8A93A6';
      ctx.fillText('TAP TO RETRY', W/2, H/2 + 80);
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
  function getHelp() { return 'TAP/SPACE TO THRUST · FLIP GRAVITY THROUGH PORTALS · DODGE OBSTACLES'; }
  function setDifficulty(level) {
    const m = [1.0, 1.15, 1.3, 1.5, 1.75, 2.0];
    const l = Math.max(0, Math.min(5, Math.floor(level) || 0));
    difficultyMult = m[l];
  }

  return { start, pause, resume, destroy, setInput, getHelp, setDifficulty };
}