function neonSlam(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, overSent = false;
  let score = 0, coins = 0, keys = {}, touches = {};
  let time = 0, state = 'play', shake = 0;

  // Paddle
  let paddle = { x: W/2, y: H - 40, w: 140, h: 14, targetX: W/2 };
  // Ball
  let ball = { x: W/2, y: H - 80, vx: 4, vy: -5, r: 10, speed: 1, stuck: true };
  // Bricks
  let bricks = [];
  let particles = [];
  let powerups = [];
  let level = 1;
  let lives = 3;
  let maxLives = 3;
  let combo = 0;

  const BRICK_COLS = 10, BRICK_ROWS = 6;
  const COLORS = ['#FF3B6B', '#FF8A00', '#FFE600', '#39FF88', '#00FFFF', '#7B61FF'];

  function key(n) { return !!keys[n]; }
  function t(n) { return !!touches[n]; }

  function reset() {
    over = false; overSent = false;
    score = 0; coins = 0; time = 0; shake = 0;
    state = 'play'; level = 1; lives = 3; combo = 0;
    paddle = { x: W/2, y: H - 40, w: 140, h: 14, targetX: W/2 };
    ball = { x: W/2, y: H - 80, vx: 4, vy: -5, r: 10, speed: 1, stuck: true };
    bricks = []; particles = []; powerups = [];
    buildLevel(1);
  }

  function callScore() { if (typeof onScore === 'function') onScore(score); }
  function callCoins() { if (typeof onCoins === 'function') onCoins(coins); }

  function buildLevel(lv) {
    bricks = [];
    const rows = Math.min(BRICK_ROWS, 4 + lv);
    brickW = (W - 100) / BRICK_COLS;
    brickH = 22;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        // higher levels have gaps
        if (lv > 2 && (c + r) % (lv > 4 ? 5 : 7) === 0) continue;
        const hp = (r === 0 && lv >= 3) ? 2 : 1;
        bricks.push({
          x: 50 + c * brickW,
          y: 60 + r * brickH,
          w: brickW - 4,
          h: brickH - 4,
          hp: hp, maxHp: hp,
          color: COLORS[r % COLORS.length],
          power: Math.random() < (0.08 + lv * 0.02) ? 'extra' : null
        });
      }
    }
  }

  function die() {
    if (overSent) return;
    overSent = true; over = true; state = 'over';
    if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
    callScore();
    if (typeof onGameOver === 'function') onGameOver(score, coins);
  }

  function loseLife() {
    lives--;
    shake = 0.3;
    combo = 0;
    if (lives <= 0) { die(); return; }
    // reset ball
    ball.x = paddle.x; ball.y = paddle.y - 20;
    ball.vx = 4 * (Math.random() < 0.5 ? -1 : 1);
    ball.vy = -5;
    ball.speed = 1;
    ball.stuck = true;
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x: x, y: y,
        vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10,
        life: 0.8, color: color, size: 2+Math.random()*3
      });
    }
  }

  function breakBrick(b) {
    score += 10 * b.maxHp + combo;
    combo++;
    callScore();
    if (typeof window.playSfx === 'function') { try { window.playSfx('pop'); } catch (e) {} }
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch(e){} }
    burst(b.x + b.w/2, b.y + b.h/2, b.color, 10);
    if (b.power === 'extra') {
      powerups.push({
        x: b.x + b.w/2, y: b.y + b.h/2,
        vy: 2.5, type: Math.random() < 0.5 ? 'wide' : 'life', life: 10
      });
    }
  }

  function levelClear() {
    level++;
    score += 100;
    callScore();
    if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
    if (navigator.vibrate) { try { navigator.vibrate(200); } catch(e){} }
    coins += 5;
    callCoins();
    // reset for next level
    ball.x = paddle.x; ball.y = paddle.y - 20;
    ball.stuck = true;
    ball.speed = Math.min(2.5, 1 + level * 0.15);
    ball.vx = 4 * (Math.random() < 0.5 ? -1 : 1);
    ball.vy = -5;
    buildLevel(level);
  }

  function input() {
    // Keyboard
    let dir = 0;
    if (key('ArrowLeft') || key('KeyA') || t('left')) dir -= 1;
    if (key('ArrowRight') || key('KeyD') || t('right')) dir += 1;
    const paddleSpeed = 14;
    paddle.x += dir * paddleSpeed;
    // Mouse/touch pointer tracked in targetX (set by app)
    if (touches.pointerX !== undefined) {
      paddle.targetX = touches.pointerX;
      paddle.x = paddle.targetX;
    }
    paddle.x = Math.max(paddle.w/2, Math.min(W - paddle.w/2, paddle.x));

    // Launch ball
    if (ball.stuck && (key('Space') || t('action'))) {
      ball.stuck = false;
      ball.vx = 4 * (Math.random() < 0.5 ? -1 : 1);
      ball.vy = -5;
    }
  }

  function update(dt) {
    time += dt;
    if (shake > 0) shake -= dt;

    input();

    // Stuck ball follows paddle
    if (ball.stuck) {
      ball.x = paddle.x;
      ball.y = paddle.y - 20;
    } else {
      // Move ball
      ball.x += ball.vx * ball.speed * dt * 60;
      ball.y += ball.vy * ball.speed * dt * 60;

      // Walls
      if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); if (typeof window.playSfx === 'function') { try { window.playSfx('click'); } catch (e) {} } }
      if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); if (typeof window.playSfx === 'function') { try { window.playSfx('click'); } catch (e) {} } }
      if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); if (typeof window.playSfx === 'function') { try { window.playSfx('click'); } catch (e) {} } }

      // Bottom: lose life
      if (ball.y - ball.r > H) {
        if (lives > 1) loseLife();
        else die();
      }

      // Paddle collision
      if (ball.vy > 0 &&
          ball.y + ball.r >= paddle.y - paddle.h/2 &&
          ball.y + ball.r <= paddle.y + paddle.h/2 + 10 &&
          ball.x > paddle.x - paddle.w/2 - ball.r &&
          ball.x < paddle.x + paddle.w/2 + ball.r) {
        // angle by hit position
        const rel = (ball.x - paddle.x) / (paddle.w/2);
        const maxAngle = Math.PI/3;
        const angle = rel * maxAngle;
        const speed = Math.hypot(ball.vx, ball.vy) * ball.speed;
        ball.vx = Math.sin(angle) * speed;
        ball.vy = -Math.cos(angle) * speed;
        ball.y = paddle.y - paddle.h/2 - ball.r;
        ball.speed = Math.min(2.5, ball.speed + 0.03);
        combo = Math.max(0, combo - 1);
        burst(ball.x, paddle.y - 10, '#00FFFF', 4);
        if (typeof window.playSfx === 'function') { try { window.playSfx('click'); } catch (e) {} }
      }

      // Bricks
      for (let i = bricks.length - 1; i >= 0; i--) {
        const b = bricks[i];
        if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w &&
            ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
          b.hp--;
          // determine bounce side
          const overlapLeft = ball.x + ball.r - b.x;
          const overlapRight = b.x + b.w - (ball.x - ball.r);
          const overlapTop = ball.y + ball.r - b.y;
          const overlapBottom = b.y + b.h - (ball.y - ball.r);
          const minX = Math.min(overlapLeft, overlapRight);
          const minY = Math.min(overlapTop, overlapBottom);
          if (minX < minY) ball.vx = overlapLeft < overlapRight ? -Math.abs(ball.vx) : Math.abs(ball.vx);
          else ball.vy = overlapTop < overlapBottom ? -Math.abs(ball.vy) : Math.abs(ball.vy);
          if (b.hp <= 0) {
            breakBrick(b);
            bricks.splice(i, 1);
          } else {
            burst(b.x + b.w/2, b.y + b.h/2, '#FFFFFF', 3);
          }
        }
      }

      // Level clear
      if (bricks.length === 0) levelClear();
    }

    // Powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.y += p.vy * dt * 60;
      p.life -= dt;
      if (p.y > H + 20 || p.life <= 0) { powerups.splice(i, 1); continue; }
      // catch with paddle
      if (Math.abs(p.y - paddle.y) < 30 && Math.abs(p.x - paddle.x) < paddle.w/2 + 15) {
        if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
        if (p.type === 'wide') {
          paddle.w = Math.min(240, paddle.w + 40);
          burst(p.x, p.y, '#FFE600', 8);
          score += 25; callScore();
        } else {
          lives = Math.min(5, lives + 1);
          burst(p.x, p.y, '#39FF88', 8);
          score += 25; callScore();
        }
        powerups.splice(i, 1);
      }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.vy += 0.1 * dt * 60;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    render();
  }

  function drawPaddle() {
    ctx.save();
    ctx.translate(paddle.x, paddle.y);
    // Glow
    ctx.shadowColor = '#00FFFF';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#00FFFF';
    ctx.fillRect(-paddle.w/2, -paddle.h/2, paddle.w, paddle.h);
    ctx.shadowBlur = 0;
    // Inner highlight
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.fillRect(-paddle.w/2 + 3, -paddle.h/2 + 2, paddle.w - 6, 3);
    ctx.restore();
  }

  function drawBall() {
    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.shadowColor = '#FFE600';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#FFE600';
    ctx.beginPath();
    ctx.arc(0, 0, ball.r, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Trail
    if (!ball.stuck) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#FFE60055';
      ctx.beginPath();
      ctx.arc(-ball.vx * 2, -ball.vy * 2, ball.r * 0.8, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawBricks() {
    for (const b of bricks) {
      ctx.save();
      ctx.translate(b.x + b.w/2, b.y + b.h/2);
      ctx.shadowColor = b.color;
      ctx.shadowBlur = b.hp > 1 ? 15 : 6;
      ctx.fillStyle = b.color;
      ctx.fillRect(-b.w/2, -b.h/2, b.w, b.h);
      ctx.shadowBlur = 0;
      // shine
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      ctx.fillRect(-b.w/2 + 2, -b.h/2 + 2, b.w - 4, 4);
      ctx.restore();
    }
  }

  function drawPowerups() {
    for (const p of powerups) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = p.type === 'wide' ? '#FFE600' : '#39FF88';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.font = '16px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText(p.type === 'wide' ? 'W' : '+', 0, 6);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawUI() {
    // Top bar
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, 48);

    ctx.font = 'bold 22px Orbitron';
    ctx.fillStyle = '#FFE600';
    ctx.shadowColor = '#FFE600';
    ctx.shadowBlur = 8;
    ctx.textAlign = 'left';
    ctx.fillText('SCORE: ' + score.toLocaleString(), 16, 34);
    ctx.shadowBlur = 0;

    ctx.font = '14px Orbitron';
    ctx.fillStyle = '#00FFFF';
    ctx.textAlign = 'center';
    ctx.fillText('LEVEL ' + level, W/2, 30);

    ctx.font = '14px Orbitron';
    ctx.fillStyle = '#FFE600';
    ctx.textAlign = 'right';
    ctx.fillText('COINS: ' + coins, W - 16, 30);

    // combo
    if (combo > 4) {
      ctx.font = 'bold 28px "Press Start 2P"';
      ctx.fillStyle = '#FF8A00';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#FF8A00';
      ctx.shadowBlur = 15;
      ctx.fillText('COMBO x' + combo, W/2, H/2 - 40);
      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
    }

    // Lives
    ctx.font = '14px "Press Start 2P"';
    ctx.fillStyle = '#FF3B6B';
    ctx.textAlign = 'left';
    let lvText = '';
    for (let i = 0; i < maxLives; i++) lvText += i < lives ? '♥ ' : '♡ ';
    ctx.fillText(lvText, 16, H - 12);
    ctx.textAlign = 'left';
  }

  function render() {
    // Background
    ctx.fillStyle = '#0A0A1A';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(0,255,255,.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    drawBricks();
    drawPowerups();
    drawParticles();
    drawBall();
    drawPaddle();
    drawUI();

    // Level intro banner
    if (time < 1.5 && state === 'play') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(W/2 - 150, H/2 - 40, 300, 60);
      ctx.font = 'bold 24px "Press Start 2P"';
      ctx.fillStyle = '#00FFFF';
      ctx.shadowColor = '#00FFFF';
      ctx.shadowBlur = 12;
      ctx.textAlign = 'center';
      ctx.fillText('LEVEL ' + level, W/2, H/2 + 8);
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
      ctx.fillText('GAME OVER', W/2, H/2 - 50);
      ctx.shadowBlur = 0;
      ctx.font = '22px Orbitron';
      ctx.fillStyle = '#FFE600';
      ctx.fillText('SCORE: ' + score.toLocaleString(), W/2, H/2);
      ctx.fillStyle = '#00FFFF';
      ctx.fillText('COINS: +' + coins, W/2, H/2 + 35);
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
  function getHelp() { return 'MOVE: ARROWS/WASD OR DRAG · SPACE RELEASE BALL · BREAK ALL BRICKS · CATCH POWERUPS'; }

  return { start, pause, resume, destroy, setInput, getHelp };
}