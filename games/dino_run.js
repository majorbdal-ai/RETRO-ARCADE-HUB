function dinoRun(canvas, ctx, onScore, onGameOver, onCoins) {
  var W = 800, H = 450;
  var raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  var keys = {}, touches = {};
  var groundY = H - 70;
  var dino = { x: 80, y: groundY, vy: 0, w: 30, h: 40, grounded: true, sliding: false, slideTimer: 0 };
  var gravity = 1600;
  var jumpForce = -550;
  var obstacles = [];
  var spawnTimer = 0, spawnInterval = 1.8;
  var speed = 250;
  var distance = 0;
  var frameCount = 0;
  var highScore = 0;
  var dayNight = 0;

  function reset() {
    score = 0; coins = 0; distance = 0; speed = 250;
    spawnTimer = 1.5; spawnInterval = 1.8; frameCount = 0;
    obstacles = [];
    dayNight = 0;
    dino.y = groundY; dino.vy = 0; dino.grounded = true;
    dino.sliding = false; dino.slideTimer = 0;
  }

  function spawnObstacle() {
    var type = Math.random();
    if (type < 0.6) {
      // Cactus
      var h = 30 + Math.random() * 30;
      var w = 15 + Math.random() * 15;
      obstacles.push({ type: 'cactus', x: W + 20, y: groundY - h, w: w, h: h, passed: false });
    } else if (type < 0.85) {
      // Small cactus cluster
      for (var i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
        var ch = 20 + Math.random() * 20;
        obstacles.push({ type: 'cactus', x: W + 20 + i * 22, y: groundY - ch, w: 18, h: ch, passed: false });
      }
    } else {
      // Bird
      var by = groundY - 50 - Math.random() * 40;
      obstacles.push({ type: 'bird', x: W + 20, y: by, w: 35, h: 20, wingPhase: 0, passed: false });
    }
  }

  function update(dt) {
    if (over) return;
    frameCount++;

    // Score
    distance += speed * dt;
    score = Math.floor(distance / 10);
    if (score % 50 === 0 && score > 0) coins = Math.floor(score / 50);
    onScore(score);

    // Speed increases over time
    speed = 250 + distance * 0.02;
    if (speed > 600) speed = 600;

    // Spawn
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnObstacle();
      spawnTimer = Math.max(0.6, spawnInterval - distance * 0.0002);
    }

    // Jump
    if ((touches.up || touches.action || keys.Space || keys.ArrowUp || keys.KeyW) && dino.grounded && !dino.sliding) {
      dino.vy = jumpForce;
      dino.grounded = false;
      touches.action = false;
      keys.Space = false;
      if (typeof window.playSfx === 'function') { try { window.playSfx('flap'); } catch (e) {} } // v7.15 jump
    }

    // Slide (hold down)
    if ((touches.down || keys.ArrowDown || keys.KeyS) && dino.grounded) {
      if (!dino.sliding) {
        dino.sliding = true;
        dino.slideTimer = 0.6;
      }
    }

    // Dino physics
    if (!dino.grounded) {
      dino.vy += gravity * dt;
      dino.y += dino.vy * dt;
      if (dino.y >= groundY) {
        dino.y = groundY;
        dino.vy = 0;
        dino.grounded = true;
      }
    }

    // Slide timer
    if (dino.sliding) {
      dino.slideTimer -= dt;
      if (dino.slideTimer <= 0 && !(touches.down || keys.ArrowDown || keys.KeyS)) {
        dino.sliding = false;
      }
    }

    // Obstacles
    for (var i = obstacles.length - 1; i >= 0; i--) {
      var o = obstacles[i];
      o.x -= speed * dt;
      if (o.type === 'bird') o.wingPhase += dt * 12;
      if (o.x < -60) { obstacles.splice(i, 1); continue; }

      // Collision
      var dinoHitbox = {
        x: dino.x + 5,
        y: dino.sliding ? groundY - 15 : dino.y - dino.h + 5,
        w: dino.w - 10,
        h: dino.sliding ? 15 : dino.h - 10
      };

      if (o.type === 'bird') {
        // Bird hitbox
        var bx = o.x, by = o.y + (o.wingPhase ? Math.sin(o.wingPhase) * 5 : 0);
        if (dinoHitbox.x < bx + o.w && dinoHitbox.x + dinoHitbox.w > bx &&
            dinoHitbox.y < by + o.h && dinoHitbox.y + dinoHitbox.h > by) {
          // Bird collision — can dodge by sliding under
          if (!dino.sliding || o.y + o.h > groundY - 12) {
            endGame();
            return;
          }
        }
      } else {
        // Cactus
        if (dinoHitbox.x < o.x + o.w && dinoHitbox.x + dinoHitbox.w > o.x &&
            dinoHitbox.y < o.y + o.h && dinoHitbox.y + dinoHitbox.h > o.y) {
          endGame();
          return;
        }
      }
    }

    // Day/night cycle
    dayNight = (dayNight + dt * 0.1) % (Math.PI * 2);
  }

  function endGame() {
    over = true;
    if (score > highScore) highScore = score;
    onGameOver(score, coins);
  }

  function draw() {
    // Background
    var nightness = (Math.sin(dayNight) + 1) / 2;
    var bgR = Math.floor(10 + nightness * 20);
    var bgG = Math.floor(10 + nightness * 20);
    var bgB = Math.floor(26 + nightness * 30);
    ctx.fillStyle = 'rgb(' + bgR + ',' + bgG + ',' + bgB + ')';
    ctx.fillRect(0, 0, W, H);

    // Stars
    if (nightness > 0.3) {
      ctx.save();
      ctx.globalAlpha = nightness * 0.6;
      ctx.fillStyle = '#fff';
      for (var i = 0; i < 30; i++) {
        var sx = (i * 137 + 50) % W;
        var sy = (i * 97 + 20) % (H - 100);
        ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.restore();
    }

    // Title
    ctx.save();
    ctx.shadowColor = '#0f0';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#0f0';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('DINO RUN', 10, 25);
    ctx.fillStyle = '#888';
    ctx.font = '12px monospace';
    ctx.fillText('Jump: ↑/Space/Tap  Slide: ↓/Hold', 10, 42);
    ctx.restore();

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText('Score: ' + score + '  HI: ' + highScore, W - 200, 25);

    // Ground
    ctx.save();
    ctx.shadowColor = '#0f0';
    ctx.shadowBlur = 5;
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();
    // Ground details
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    for (var i = 0; i < 20; i++) {
      var gx = ((i * 45 - frameCount * 0.5 * speed / 60) % (W + 40));
      if (gx < 0) gx += W + 40;
      ctx.beginPath();
      ctx.moveTo(gx, groundY + 3);
      ctx.lineTo(gx + 15, groundY + 3);
      ctx.stroke();
    }
    ctx.restore();

    // Dino
    ctx.save();
    ctx.shadowColor = '#0f0';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#0f0';
    var dy = dino.sliding ? groundY - 12 : dino.y;
    var dh = dino.sliding ? 12 : dino.h;
    // Body
    ctx.fillRect(dino.x, dy - dh, dino.w, dh);
    // Head
    ctx.fillRect(dino.x + dino.w - 5, dy - dh - 12, 15, 15);
    // Eye
    ctx.fillStyle = '#000';
    ctx.fillRect(dino.x + dino.w + 3, dy - dh - 8, 4, 4);
    // Legs animation
    if (dino.grounded && !dino.sliding) {
      var legFrame = Math.floor(frameCount / 6) % 2;
      ctx.fillStyle = '#0f0';
      if (legFrame === 0) {
        ctx.fillRect(dino.x + 5, dy, 6, 12);
        ctx.fillRect(dino.x + dino.w - 10, dy, 6, 8);
      } else {
        ctx.fillRect(dino.x + 5, dy, 6, 8);
        ctx.fillRect(dino.x + dino.w - 10, dy, 6, 12);
      }
    }
    // Tail
    ctx.fillRect(dino.x - 10, dy - dh + 5, 12, 5);
    ctx.restore();

    // Obstacles
    for (var i = 0; i < obstacles.length; i++) {
      var o = obstacles[i];
      ctx.save();
      if (o.type === 'cactus') {
        ctx.shadowColor = '#f00';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#f00';
        // Main stem
        ctx.fillRect(o.x + o.w / 2 - 4, o.y, 8, o.h);
        // Arms
        if (o.h > 35) {
          ctx.fillRect(o.x, o.y + 10, o.w / 2, 5);
          ctx.fillRect(o.x, o.y + 10, 5, 15);
          ctx.fillRect(o.x + o.w / 2, o.y + 5, o.w / 2, 5);
          ctx.fillRect(o.x + o.w - 5, o.y + 5, 5, 15);
        }
        // Spikes
        ctx.strokeStyle = '#f44';
        ctx.lineWidth = 1;
        for (var s = 0; s < o.h; s += 8) {
          ctx.beginPath();
          ctx.moveTo(o.x + o.w / 2 - 4, o.y + s);
          ctx.lineTo(o.x + o.w / 2 - 8, o.y + s + 3);
          ctx.moveTo(o.x + o.w / 2 + 4, o.y + s);
          ctx.lineTo(o.x + o.w / 2 + 8, o.y + s + 3);
          ctx.stroke();
        }
      } else {
        // Bird
        ctx.shadowColor = '#f0f';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#f0f';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        // Wings
        var wOff = Math.sin(o.wingPhase) * 10;
        ctx.beginPath();
        ctx.moveTo(o.x + o.w / 2, o.y);
        ctx.lineTo(o.x + o.w / 2 - 15, o.y - 8 + wOff);
        ctx.lineTo(o.x + o.w / 2 + 15, o.y - 8 - wOff);
        ctx.closePath();
        ctx.fill();
        // Beak
        ctx.fillStyle = '#ff0';
        ctx.beginPath();
        ctx.moveTo(o.x + o.w, o.y + 5);
        ctx.lineTo(o.x + o.w + 10, o.y + 10);
        ctx.lineTo(o.x + o.w, o.y + 15);
        ctx.fill();
      }
      ctx.restore();
    }

    // Game over
    if (over) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.shadowColor = '#f00';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#f00';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 20);
      ctx.fillStyle = '#fff';
      ctx.font = '18px monospace';
      ctx.fillText('Score: ' + score + '  HI: ' + highScore, W / 2, H / 2 + 20);
      ctx.fillText('Tap/Space to restart', W / 2, H / 2 + 50);
      ctx.restore();

      if (touches.action || keys.Space) {
        touches.action = false;
        keys.Space = false;
        over = false;
        reset();
      }
    }
  }

  function loop(ts) {
    var dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    update(dt);
    draw();
    if (!over) raf = requestAnimationFrame(loop);
    else raf = requestAnimationFrame(loop); // Keep looping for game over screen
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
  function resume() {
    if (!running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }

  function destroy() {
    running = false;
    over = true;
    cancelAnimationFrame(raf);
  }

  return {
    start: start,
    pause: pause,
    resume: resume,
    destroy: destroy,
    setInput: function(t, k) {
      touches = t || {};
      keys = k || {};
    }
  };
}
