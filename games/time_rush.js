function timeRush(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, overSent = false;
  let score = 0, coins = 0, keys = {}, touches = {};
  let time = 0, state = 'play', shake = 0;

  // Rewind mechanic
  let history = [];
  const HISTORY_MAX = 300;   // ~5s at 60fps
  let rewind = false;
  let rewindTimer = 0;
  const REWIND_DURATION = 2.0;

  // Player
  let player = { x: 100, y: H/2, vy: 0, r: 15, rot: 0 };
  let gravity = 900;
  let speed = 320;
  let difficultyMult = 1;   // v7.18 difficulty ramp
  let obstacles = [];
  let stars = [];
  let distance = 0;
  let lives = 3;
  let invuln = 0;
  let lastFrame = {
    player: null, obstacles: null, distance: 0, score: 0, lives: 0,
    grav: gravity, speed: speed
  };

  const COLORS = ['#FF3B6B', '#FF8A00', '#FFE600', '#39FF88', '#00FFFF', '#7B61FF'];

  function key(n) { return !!keys[n]; }
  function t(n) { return !!touches[n]; }

  function initStars() {
    stars = [];
    for (let i = 0; i < 100; i++) {
      stars.push({ x: Math.random()*W, y: Math.random()*H, z: 0.2+Math.random()*1.5, s: 1+Math.random()*2 });
    }
  }

  function reset() {
    over = false; overSent = false;
    score = 0; coins = 0; time = 0; shake = 0;
    state = 'play'; rewind = false; rewindTimer = 0;
    gravity = 900; speed = 320; distance = 0; lives = 3; invuln = 0;
    player = { x: 100, y: H/2, vy: 0, r: 15, rot: 0 };
    obstacles = []; history = [];
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

  function saveFrame() {
    history.push({
      player: { ...player },
      obstacles: obstacles.map(o => ({ ...o })),
      distance, score, lives, grav: gravity, speed
    });
    if (history.length > HISTORY_MAX) history.shift();
  }

  function popFrame() {
    const f = history.pop();
    if (!f) return;
    player = f.player;
    obstacles = f.obstacles.map(o => ({ ...o }));
    distance = f.distance;
    score = f.score;
    lives = f.lives;
    gravity = f.grav;
    speed = f.speed;
    invuln = 1.0;
  }

  function spawnObstacle() {
    const type = Math.random();
    if (type < 0.4) {
      // spike from bottom
      obstacles.push({
        x: W + 30, y: H - 60, w: 30, h: 60,
        type: 'spike', color: '#FF3B6B'
      });
    } else if (type < 0.7) {
      // floating block
      obstacles.push({
        x: W + 30, y: 80 + Math.random() * (H - 180), w: 30, h: 60,
        type: 'block', color: '#FF8A00'
      });
    } else {
      // laser gate (top+bottom)
      obstacles.push({
        x: W + 30, y: 0, w: 16, h: H,
        type: 'gate', color: '#00FFFF', gapY: 100 + Math.random() * (H - 200), gapH: 120
      });
    }
  }

  function input() {
    // tap/space jump
    if (t('action') || key('Space') || key('ArrowUp') || key('KeyW')) {
      player.vy -= 340 * (1/60);
      if (typeof window.playSfx === 'function' && Math.random() < 0.1) {
        try { window.playSfx('click'); } catch (e) {}
      }
    }
    // hold down to rewind
    if (key('KeyZ') || key('ArrowDown') || key('KeyS') || t('down')) {
      if (!rewind && history.length > 5) {
        rewind = true;
        rewindTimer = 0;
        if (typeof window.playSfx === 'function') { try { window.playSfx('hit'); } catch (e) {} }
      }
    }
  }

  function update(dt) {
    time += dt;
    if (shake > 0) shake -= dt;
    if (invuln > 0) invuln -= dt;

    input();

    // REWIND MODE — replay history backwards
    if (rewind) {
      rewindTimer += dt;
      popFrame();  // 1 frame per update = ~60x speed rewind
      // keep popping until timer ends
      let pops = 0;
      while (rewindTimer > REWIND_DURATION / 10 && pops < 3) {
        popFrame(); pops++;
        rewindTimer -= REWIND_DURATION / 10;
      }
      if (history.length < 5) rewind = false;
      if (rewindTimer >= REWIND_DURATION) rewind = false;
      render();
      return;
    }

    // Normal play
    saveFrame();
    distance += speed * dt;
    score = Math.floor(distance / 10);
    callScore();
    speed = Math.min(600, (320 + distance * 0.02) * difficultyMult);

    player.vy += gravity * dt;
    player.y += player.vy * dt;
    player.rot += 3 * dt;

    // floor/ceiling
    if (player.y > H - player.r) { player.y = H - player.r; player.vy = 0; }
    if (player.y < player.r) { player.y = player.r; player.vy = 0; }

    // obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= speed * dt;
      if (o.x + o.w < 0) { obstacles.splice(i, 1); continue; }
      // collision (only if not invulnerable)
      if (invuln <= 0) {
        if (o.type === 'gate') {
          // check if player is in gap
          const inGap = player.y > o.gapY && player.y < o.gapY + o.gapH;
          if (!inGap && player.x + player.r > o.x && player.x - player.r < o.x + o.w) {
            hitObstacle();
          }
        } else {
          const cx = Math.max(o.x, Math.min(player.x, o.x + o.w));
          const cy = Math.max(o.y, Math.min(player.y, o.y + o.h));
          const dx = player.x - cx, dy = player.y - cy;
          if (dx*dx + dy*dy < player.r*player.r) {
            hitObstacle();
            obstacles.splice(i, 1);
          }
        }
      }
    }

    // stars
    for (const s of stars) {
      s.x -= speed * s.z * dt;
      if (s.x < 0) { s.x = W; s.y = Math.random()*H; }
    }

    // spawn
    if (Math.random() < 0.02 + distance * 0.00001) spawnObstacle();

    render();
  }

  function hitObstacle() {
    // instead of dying — auto save + allow rewind
    lives--;
    shake = 0.4;
    score = Math.max(0, score - 30);
    callScore();
    if (typeof window.playSfx === 'function') { try { window.playSfx('hit'); } catch (e) {} }
    if (lives <= 0) die();
  }

  function drawStars() {
    for (const s of stars) {
      ctx.globalAlpha = Math.min(1, s.z);
      ctx.fillStyle = '#FFF';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.s, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.rot);
    if (invuln > 0 && Math.floor(time*10)%2===0) ctx.globalAlpha = 0.4;
    // trail
    if (!rewind) {
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#FFE600';
      ctx.beginPath();
      ctx.arc(-10, 0, player.r * 0.8, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = invuln > 0 ? 0.4 : 1;
    }
    // body
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, player.r);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(0.6, '#00FFFF');
    grad.addColorStop(1, '#0055FF');
    ctx.fillStyle = grad;
    ctx.shadowColor = '#00FFFF';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, player.r, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawObstacles() {
    for (const o of obstacles) {
      ctx.save();
      ctx.fillStyle = o.color;
      ctx.shadowColor = o.color;
      ctx.shadowBlur = 8;
      if (o.type === 'spike') {
        // triangle
        ctx.beginPath();
        ctx.moveTo(o.x, o.y + o.h);
        ctx.lineTo(o.x + o.w/2, o.y);
        ctx.lineTo(o.x + o.w, o.y + o.h);
        ctx.closePath();
        ctx.fill();
      } else if (o.type === 'gate') {
        // gate: draw bars with gap
        ctx.fillStyle = '#00FFFF88';
        ctx.fillRect(o.x, o.y, o.w, o.gapY);
        ctx.fillRect(o.x, o.gapY + o.gapH, o.w, H - o.gapY - o.gapH);
      } else {
        ctx.fillRect(o.x, o.y, o.w, o.h);
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  function drawUI() {
    // HUD
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
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
    ctx.fillText(rewind ? '⏪ REWINDING...' : Math.round(speed) + ' m/s', W/2, 30);
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

    // rewind charge bar (history level)
    const charge = Math.min(1, history.length / HISTORY_MAX);
    ctx.fillStyle = 'rgba(255,255,255,.15)';
    ctx.fillRect(W - 120, H - 20, 100, 8);
    ctx.fillStyle = charge > 0.3 ? '#39FF88' : '#FFE600';
    ctx.fillRect(W - 120, H - 20, 100 * charge, 8);
    ctx.font = '9px Orbitron';
    ctx.fillStyle = '#8A93A6';
    ctx.textAlign = 'right';
    ctx.fillText('REWIND (HOLD ↓)', W - 14, H - 26);
    ctx.textAlign = 'left';
  }

  function render() {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    if (rewind) {
      bgGrad.addColorStop(0, '#0A020A');
      bgGrad.addColorStop(1, '#1A0A1A');
    } else {
      bgGrad.addColorStop(0, '#02040A');
      bgGrad.addColorStop(1, '#0A0A1A');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    drawStars();
    drawObstacles();
    drawPlayer();
    drawUI();

    // rewind overlay
    if (rewind) {
      ctx.fillStyle = 'rgba(123,97,255,0.1)';
      ctx.fillRect(0, 0, W, H);
      ctx.font = 'bold 30px "Press Start 2P"';
      ctx.fillStyle = '#7B61FF';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#7B61FF';
      ctx.shadowBlur = 20;
      ctx.fillText('⏪ REWIND', W/2, H/2);
      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
    }

    if (state === 'over') {
      ctx.fillStyle = 'rgba(0,0,10,0.9)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.font = 'bold 42px "Press Start 2P"';
      ctx.fillStyle = '#FF3B6B';
      ctx.shadowColor = '#FF3B6B';
      ctx.shadowBlur = 20;
      ctx.fillText('TIME UP!', W/2, H/2 - 50);
      ctx.shadowBlur = 0;
      ctx.font = '22px Orbitron';
      ctx.fillStyle = '#FFE600';
      ctx.fillText('SCORE: ' + score.toLocaleString(), W/2, H/2);
      ctx.fillStyle = '#00FFFF';
      ctx.fillText('DISTANCE: ' + Math.floor(distance/10) + 'm · COINS: +' + coins, W/2, H/2 + 35);
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
  function getHelp() { return 'TAP/SPACE TO JUMP · HOLD ↓/Z TO REWIND TIME · DODGE OBSTACLES'; }
  function setDifficulty(level) {
    const m = [1.0, 1.15, 1.3, 1.5, 1.75, 2.0];
    const l = Math.max(0, Math.min(5, Math.floor(level) || 0));
    difficultyMult = m[l];
  }

  return { start, pause, resume, destroy, setInput, getHelp, setDifficulty };
}