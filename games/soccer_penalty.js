function soccerPenalty(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  let keys = {}, touches = {};
  let ball = { x: 180, y: 300, vx: 0, vy: 0, r: 12, active: false };
  let goalie = { x: 400, y: 200, w: 50, h: 70, target: 400, vy: 0 };
  let goal = { x: 290, y: 90, w: 220, h: 160 };
  let shots = 0;
  let maxShots = 5;
  let aiming = false;
  let aimX = 0, aimY = 0;
  let power = 0;
  let phase = 'aim';

  function reset() {
    ball = { x: 180, y: 300, vx: 0, vy: 0, r: 12, active: false };
    goalie = { x: 400, y: 200, w: 50, h: 70, target: 400, vy: 0 };
    shots = 0;
    score = 0;
    coins = 0;
    over = false;
    phase = 'aim';
    onScore(0);
  }

  function shoot(vx, vy) {
    if (phase !== 'aim' || shots >= maxShots) return;
    ball.active = true;
    ball.x = 180;
    ball.y = 300;
    ball.vx = vx;
    ball.vy = vy;
    phase = 'shot';
    shots++;
  }

  function update(dt) {
    if (over) return;

    const dragging = touches.down || keys.ArrowDown;

    // Aiming: drag down/back to set power, release to shoot
    if (phase === 'aim') {
      if (dragging) {
        aiming = true;
        power = Math.min((300 - (touches.right ? 1 : 0)) * 0.5, 1);
        power = Math.min(power + 0.1, 1);
      } else if (aiming) {
        shoot(ball.vx, ball.vy);
        aiming = false;
      }
    }

    if (ball.active) {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // Goalie movement (dives)
      goalie.target += Math.sin(performance.now() * 0.003) * 400 * dt;
      goalie.target = Math.max(goal.x + 25, Math.min(goal.x + goal.w - 25, goalie.target));
      goalie.x += (goalie.target - goalie.x) * 3 * dt;

      // Check goal
      if (ball.x > goal.x && ball.x < goal.x + goal.w &&
          ball.y > goal.y && ball.y < goal.y + goal.h) {
        score += 100;
        onScore(score);
        recordShot(true);
        return;
      }

      // Check goalie hit
      if (Math.abs(ball.x - goalie.x) < (goalie.w / 2 + ball.r) &&
          Math.abs(ball.y - goalie.y) < (goalie.h / 2 + ball.r)) {
        recordShot(false);
        return;
      }

      // Out of bounds
      if (ball.x > W || ball.y > H || ball.y < 0) {
        recordShot(false);
        return;
      }
    }
  }

  function recordShot(scored) {
    ball.active = false;
    if (scored) {
      phase = 'celebrate';
    } else {
      phase = 'miss';
    }

    setTimeout(() => {
      if (shots >= maxShots) {
        coins += Math.floor(score / 100);
        onCoins(coins);
        over = true;
        onGameOver(score, coins);
      } else {
        phase = 'aim';
        ball.vx = 0;
        ball.vy = 0;
      }
    }, 800);
  }

  function aimRelease() {
    if (phase === 'aim' && shots < maxShots) {
      // Screen-tap aim: position-based power and angle
      const centerX = W / 2;
      const centerY = H / 2;
      const dxc = 0 - 0;
      const powerLevel = 0.7 + Math.random() * 0.3;
      const dir = Math.random() < 0.5 ? -1 : 1;
      shoot(dir * (40 + powerLevel * 60), -(60 + powerLevel * 80));
    }
  }

  function draw() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    // Field
    ctx.fillStyle = '#10331a';
    ctx.fillRect(0, 150, W, 300);
    ctx.strokeStyle = '#22cc44';
    ctx.lineWidth = 2;
    ctx.strokeRect(100, 150, 600, 240);

    // Goal
    ctx.fillStyle = '#1a1a3a';
    ctx.fillRect(goal.x - 10, goal.y - 10, goal.w + 20, goal.h + 20);

    // Goalie
    ctx.fillStyle = '#ffcc00';
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur = 10;
    ctx.fillRect(goalie.x - goalie.w / 2, goalie.y - goalie.h / 2, goalie.w, goalie.h);
    ctx.shadowBlur = 0;

    // Ball
    if (ball.active || phase === 'aim') {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Power bar
    if (phase === 'aim') {
      ctx.fillStyle = '#333';
      ctx.fillRect(W - 40, H - 150, 20, 100);
      ctx.fillStyle = '#00ffff';
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 8;
      ctx.fillRect(W - 40, H - 150 + (100 - 100 * power), 20, 100 * power);
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 5;
    ctx.font = '14px monospace';
    ctx.fillText('SOCCER PENALTY', 10, 20);
    ctx.fillText('DRAG BACK & RELEASE OR SWIPE | SHOTS: ' + shots + '/' + maxShots, 10, 40);
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