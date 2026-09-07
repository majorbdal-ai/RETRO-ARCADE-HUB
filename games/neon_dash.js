function neonDash(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  let keys = {}, touches = {};
  let player = { x: 100, y: 300, w: 30, h: 30, vy: 0, onGround: true };
  let obstacles = [];
  let scrollSpeed = 300;
  let spawnTimer = 0;
  let gameSpeed = 1;

  function reset() {
    player = { x: 100, y: 300, w: 30, h: 30, vy: 0, onGround: true };
    obstacles = [];
    scrollSpeed = 300;
    spawnTimer = 0;
    gameSpeed = 1;
    score = 0;
    coins = 0;
    over = false;
    onScore(0);
  }

  function spawnObstacle() {
    const type = Math.random() < 0.5 ? 'block' : 'spike';
    const h = type === 'block' ? 60 + Math.random() * 80 : 40;
    obstacles.push({
      x: W + 50,
      y: H - h,
      w: 40,
      h: h,
      type: type,
      passed: false
    });
  }

  function update(dt) {
    if (over) return;

    const jumpPressed = keys.ArrowUp || keys.KeyW || keys.Space || touches.up || touches.gas || touches.action;

    if (jumpPressed && player.onGround) {
      player.vy = -550;
      player.onGround = false;
    }

    player.vy += 1400 * dt;
    player.y += player.vy * dt;

    if (player.y >= 300) {
      player.y = 300;
      player.vy = 0;
      player.onGround = true;
    }

    spawnTimer -= dt * gameSpeed;
    if (spawnTimer <= 0) {
      spawnObstacle();
      spawnTimer = 1.2 + Math.random() * 1.0;
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.x -= scrollSpeed * dt * gameSpeed;

      if (!obs.passed && obs.x + obs.w < player.x) {
        obs.passed = true;
        score += 10;
        onScore(score);
        if (score % 100 === 0) {
          coins += 1;
          onCoins(coins);
        }
        gameSpeed = 1 + score * 0.002;
      }

      if (player.x < obs.x + obs.w &&
          player.x + player.w > obs.x &&
          player.y < obs.y + obs.h &&
          player.y + player.h > obs.y) {
        over = true;
        onGameOver(score, coins);
        return;
      }

      if (obs.x + obs.w < 0) {
        obstacles.splice(i, 1);
      }
    }
  }

  function draw() {
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, 330);
    ctx.lineTo(W, 330);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 15;
    ctx.fillRect(player.x, player.y, player.w, player.h);
    ctx.shadowBlur = 0;

    for (const obs of obstacles) {
      if (obs.type === 'block') {
        ctx.fillStyle = '#ff00ff';
        ctx.shadowColor = '#ff00ff';
      } else {
        ctx.fillStyle = '#ffff00';
        ctx.shadowColor = '#ffff00';
      }
      ctx.shadowBlur = 12;
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      if (obs.type === 'spike') {
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y + obs.h);
        ctx.lineTo(obs.x + obs.w / 2, obs.y);
        ctx.lineTo(obs.x + obs.w, obs.y + obs.h);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = '#00ffff';
    ctx.font = '14px monospace';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 5;
    ctx.fillText('NEON DASH', 10, 20);
    ctx.fillText('HOLD [SPACE/UP] TO JUMP', 10, 40);
    ctx.shadowBlur = 0;
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
    if (!running) {
      running = true;
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    }
  }

  function pause() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function resume() {
    if (!over && !running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }

  function destroy() {
    running = false;
    cancelAnimationFrame(raf);
  }

  return {
    start,
    pause,
    resume,
    destroy,
    setInput: (t, k) => { touches = t; keys = k; }
  };
}