function duckHunt(canvas, ctx, onScore, onGameOver, onCoins) {
  var W = 800, H = 450;
  var raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  var keys = {}, touches = {};
  var round = 1, maxRounds = 3, lives = 3, ducksHit = 0, ducksPerRound = 5;
  var ducks = [], particles = [], crosshair = { x: W / 2, y: H / 2 };
  var roundTimer = 0, roundDuration = 8, roundActive = false, spawnTimer = 0;
  var message = '', msgTimer = 0;

  function reset() {
    score = 0; coins = 0; round = 1; lives = 3; ducksHit = 0;
    ducks = []; particles = [];
    roundTimer = 0; spawnTimer = 0; roundActive = false;
    message = 'ROUND 1 — Tap/Click to shoot ducks!';
    msgTimer = 2;
  }

  function spawnDuck() {
    var dir = Math.random() < 0.5 ? 1 : -1;
    var speed = 60 + Math.random() * 40 + round * 15;
    var yPos = 40 + Math.random() * 200;
    ducks.push({
      x: dir === 1 ? -40 : W + 40,
      y: yPos,
      dir: dir,
      speed: speed,
      wingPhase: Math.random() * Math.PI * 2,
      hit: false,
      fallVy: 0,
      color: ['neon green', 'neon pink', 'neon cyan', 'neon orange'][Math.floor(Math.random() * 4)]
    });
  }

  function shoot(mx, my) {
    if (!roundActive) return;
    for (var i = ducks.length - 1; i >= 0; i--) {
      var d = ducks[i];
      if (d.hit) continue;
      var dx = mx - d.x, dy = my - d.y;
      if (Math.abs(dx) < 30 && Math.abs(dy) < 30) {
        d.hit = true;
        d.fallVy = 0;
        var pts = 100 + round * 50;
        score += pts;
        coins += 1;
        ducksHit++;
        onScore(score);
        for (var j = 0; j < 10; j++) {
          particles.push({
            x: d.x, y: d.y,
            vx: (Math.random() - 0.5) * 200,
            vy: (Math.random() - 0.5) * 200,
            life: 0.5 + Math.random() * 0.5,
            color: d.color
          });
        }
        message = '+' + pts;
        msgTimer = 1;
        return;
      }
    }
    // Missed shot
    particles.push({ x: mx, y: my, vx: 0, vy: 0, life: 0.3, color: 'red', text: 'MISS' });
  }

  function update(dt) {
    if (msgTimer > 0) msgTimer -= dt;

    // Spawn ducks
    if (roundActive) {
      spawnTimer -= dt;
      if (spawnTimer <= 0 && ducks.filter(function(d) { return !d.hit; }).length < 3) {
        spawnDuck();
        spawnTimer = Math.max(0.5, 2.0 - round * 0.3);
      }
      roundTimer -= dt;
      if (roundTimer <= 0) {
        // End round
        roundActive = false;
        if (round < maxRounds) {
          if (ducksHit < 2) {
            lives--;
            message = 'Too few ducks hit! Life lost. (' + lives + ' left)';
          } else {
            message = 'Round ' + round + ' complete! +200 bonus!';
            score += 200;
            coins += 2;
            onScore(score);
          }
          if (lives <= 0) {
            over = true;
            onGameOver(score, coins);
            return;
          }
          round++;
          message += ' — Starting Round ' + round + '!';
          msgTimer = 2;
          setTimeout(function() {
            if (!over) startRound();
          }, 1500);
        } else {
          score += lives * 300;
          onScore(score);
          over = true;
          onGameOver(score, coins);
        }
        return;
      }
    }

    // Update ducks
    for (var i = ducks.length - 1; i >= 0; i--) {
      var d = ducks[i];
      if (d.hit) {
        d.fallVy += 400 * dt;
        d.y += d.fallVy * dt;
        if (d.y > H + 50) { ducks.splice(i, 1); continue; }
      } else {
        d.x += d.dir * d.speed * dt;
        d.wingPhase += dt * 10;
        if ((d.dir === 1 && d.x > W + 50) || (d.dir === -1 && d.x < -50)) {
          // Duck escaped
          if (roundActive) {
            lives--;
            if (lives <= 0) {
              over = true;
              onGameOver(score, coins);
              return;
            }
          }
          ducks.splice(i, 1);
        }
      }
    }

    // Update particles
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= dt;
      if (p.text !== 'MISS') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Track crosshair from input
    if (touches.action || keys.Space || keys.Enter) {
      shoot(crosshair.x, crosshair.y);
      touches.action = false;
      keys.Space = false;
      keys.Enter = false;
    }
  }

  function draw() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.save();
    ctx.shadowColor = '#0ff';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#0ff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('DUCK HUNT', 10, 25);
    ctx.restore();

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText('Round: ' + round + '/' + maxRounds + '  Lives: ' + '♥'.repeat(lives) + '  Score: ' + score + '  Ducks: ' + ducksHit + '/' + ducksPerRound, 10, H - 15);

    // Crosshair
    ctx.save();
    ctx.shadowColor = '#f00';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = '#f00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(crosshair.x, crosshair.y, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(crosshair.x - 25, crosshair.y);
    ctx.lineTo(crosshair.x + 25, crosshair.y);
    ctx.moveTo(crosshair.x, crosshair.y - 25);
    ctx.lineTo(crosshair.x, crosshair.y + 25);
    ctx.stroke();
    ctx.restore();

    // Draw ducks
    for (var i = 0; i < ducks.length; i++) {
      var d = ducks[i];
      ctx.save();
      var col = d.hit ? '#888' : (d.color === 'neon green' ? '#0f0' : d.color === 'neon pink' ? '#f0f' : d.color === 'neon cyan' ? '#0ff' : '#f80');
      ctx.shadowColor = col;
      ctx.shadowBlur = d.hit ? 5 : 15;
      ctx.fillStyle = col;
      // Body
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, 25, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      // Head
      ctx.beginPath();
      ctx.arc(d.x + d.dir * 20, d.y - 8, 10, 0, Math.PI * 2);
      ctx.fill();
      // Wings
      if (!d.hit) {
        var wingOff = Math.sin(d.wingPhase) * 12;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y - 8 + wingOff, 18, 6, -0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      // Beak
      ctx.fillStyle = '#ff0';
      ctx.beginPath();
      ctx.moveTo(d.x + d.dir * 30, d.y - 8);
      ctx.lineTo(d.x + d.dir * 40, d.y - 5);
      ctx.lineTo(d.x + d.dir * 30, d.y - 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw particles
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.save();
      ctx.globalAlpha = p.life / 1.0;
      if (p.text === 'MISS') {
        ctx.shadowColor = '#f00';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#f00';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('MISS', p.x, p.y);
      } else {
        ctx.shadowColor = p.color === 'neon green' ? '#0f0' : p.color === 'neon pink' ? '#f0f' : p.color === 'neon cyan' ? '#0ff' : '#f80';
        ctx.shadowBlur = 8;
        ctx.fillStyle = ctx.shadowColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Message
    if (msgTimer > 0) {
      ctx.save();
      ctx.shadowColor = '#ff0';
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#ff0';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(message, W / 2, H / 2 - 30);
      ctx.restore();
    }
  }

  function startRound() {
    roundActive = true;
    ducksHit = 0;
    spawnTimer = 0.5;
    roundTimer = roundDuration;
    ducks = [];
  }

  function loop(ts) {
    var dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    update(dt);
    draw();
    if (!over) raf = requestAnimationFrame(loop);
  }

  function start() {
    reset();
    startRound();
    if (!running) {
      running = true;
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    }
  }

  function pause() { running = false; cancelAnimationFrame(raf); }
  function resume() {
    if (!over && !running) {
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
      if (touches.mx !== undefined) {
        crosshair.x = touches.mx;
        crosshair.y = touches.my;
      }
      if (touches.moveX !== undefined) {
        crosshair.x = Math.max(0, Math.min(W, crosshair.x + touches.moveX * 10));
        crosshair.y = Math.max(0, Math.min(H, crosshair.y + touches.moveY * 10));
      }
    }
  };
}
