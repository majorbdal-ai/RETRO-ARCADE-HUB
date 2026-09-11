function duckHunt(canvas, ctx, onScore, onGameOver, onCoins) {
  var W = 800, H = 450;
  var raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  var keys = {}, touches = {};
  var round = 1, maxRounds = 3, lives = 3, ducksHit = 0, ducksPerRound = 5;
  var ducks = [], particles = [], crosshair = { x: W / 2, y: H / 2 };
  var roundTimer = 0, roundDuration = 8, roundActive = false, spawnTimer = 0;
  var message = '', msgTimer = 0;
  var streak = 0, maxStreak = 0; // consecutive hits without miss
  var muzzleFlash = 0; // muzzle flash timer
  var lastMilestone = 0; // track distance milestones for celebration
  var hintTimer = 3; // control hint display
  var shakeTimer = 0, shakeIntensity = 0; // canvas shake

  // Safe SFX/haptic wrappers
  function sfx(name) {
    if (typeof window.playSfx === 'function') { try { window.playSfx(name); } catch (e) {} }
  }
  function haptic(pattern) {
    if (typeof window.hapticVibe === 'function') { try { window.hapticVibe(pattern); } catch (e) {} }
  }
  function fx_shake(intensity) {
    if (window.gameFX && window.gameFX.shake) { try { window.gameFX.shake(intensity); } catch (e) {} }
  }
  function fx_burst(x, y, color, count) {
    if (window.gameFX && window.gameFX.burst) { try { window.gameFX.burst(x, y, color, count); } catch (e) {} }
  }

  function reset() {
    score = 0; coins = 0; round = 1; lives = 3; ducksHit = 0;
    streak = 0; maxStreak = 0; lastMilestone = 0;
    ducks = []; particles = [];
    roundTimer = 0; spawnTimer = 0; roundActive = false;
    hintTimer = 3; muzzleFlash = 0;
    message = 'ROUND 1 — TAP TO SHOOT!';
    msgTimer = 2.5;
  }

  // Difficulty escalation per round
  function getRoundConfig() {
    return {
      duckSpeed: [1, 1.3, 1.7][round - 1] || 1,
      spawnRate: [2.0, 1.5, 1.0][round - 1] || 2.0,
      maxOnScreen: [3, 4, 5][round - 1] || 3,
      zigzagChance: [0, 0.3, 0.5][round - 1] || 0,
      fastChance: [0, 0.15, 0.35][round - 1] || 0,
      minHitReq: [2, 3, 4][round - 1] || 2,
      bonusPoints: [200, 350, 500][round - 1] || 200
    };
  }

  function spawnDuck() {
    var cfg = getRoundConfig();
    var dir = Math.random() < 0.5 ? 1 : -1;
    var baseSpeed = 60 + Math.random() * 40;
    var speed = baseSpeed * cfg.duckSpeed;
    var yPos = 40 + Math.random() * 200;
    var isFast = Math.random() < cfg.fastChance;
    if (isFast) speed *= 1.6;
    var isZigzag = Math.random() < cfg.zigzagChance;

    ducks.push({
      x: dir === 1 ? -40 : W + 40,
      y: yPos,
      dir: dir,
      speed: speed,
      wingPhase: Math.random() * Math.PI * 2,
      hit: false,
      fallVy: 0,
      zigzag: isZigzag,
      zigPhase: Math.random() * Math.PI * 2,
      fast: isFast,
      color: ['neon green', 'neon pink', 'neon cyan', 'neon orange'][Math.floor(Math.random() * 4)]
    });
  }

  function spawnMuzzleParticles() {
    for (var i = 0; i < 4; i++) {
      particles.push({
        x: crosshair.x, y: crosshair.y,
        vx: (Math.random() - 0.5) * 120,
        vy: (Math.random() - 0.5) * 120,
        life: 0.15 + Math.random() * 0.1,
        color: 'orange',
        size: 2 + Math.random() * 2
      });
    }
  }

  function shoot(mx, my) {
    if (!roundActive) return;
    muzzleFlash = 0.12;
    sfx('shoot');
    haptic('action');
    spawnMuzzleParticles();

    for (var i = ducks.length - 1; i >= 0; i--) {
      var d = ducks[i];
      if (d.hit) continue;
      var dx = mx - d.x, dy = my - d.y;
      if (Math.abs(dx) < 30 && Math.abs(dy) < 30) {
        d.hit = true;
        d.fallVy = 0;
        streak++;
        if (streak > maxStreak) maxStreak = streak;
        var streakBonus = streak >= 3 ? streak * 20 : 0;
        var pts = 100 + round * 50 + streakBonus;
        score += pts;
        coins += 1;
        ducksHit++;
        onScore(score);
        sfx('hit');
        haptic('tap');
        fx_shake(0.4);
        fx_burst(crosshair.x, crosshair.y,
          d.color === 'neon green' ? '#0f0' : d.color === 'neon pink' ? '#f0f' : d.color === 'neon cyan' ? '#0ff' : '#f80',
          10);

        // Hit particles
        for (var j = 0; j < 12; j++) {
          particles.push({
            x: d.x, y: d.y,
            vx: (Math.random() - 0.5) * 250,
            vy: (Math.random() - 0.5) * 250,
            life: 0.4 + Math.random() * 0.5,
            color: d.color,
            size: 2 + Math.random() * 3
          });
        }
        // Streak text
        if (streak >= 3) {
          message = 'STREAK x' + streak + '! +' + pts;
        } else {
          message = '+' + pts;
        }
        msgTimer = 1;
        return;
      }
    }
    // Missed shot — break streak
    streak = 0;
    sfx('click');
    particles.push({ x: mx, y: my, vx: 0, vy: 0, life: 0.3, color: 'red', text: 'MISS', size: 0 });
  }

  function update(dt) {
    if (msgTimer > 0) msgTimer -= dt;
    if (hintTimer > 0) hintTimer -= dt;
    if (muzzleFlash > 0) muzzleFlash -= dt;

    // Spawn ducks
    if (roundActive) {
      var cfg = getRoundConfig();
      spawnTimer -= dt;
      if (spawnTimer <= 0 && ducks.filter(function(d) { return !d.hit; }).length < cfg.maxOnScreen) {
        spawnDuck();
        spawnTimer = Math.max(0.4, cfg.spawnRate - round * 0.15);
      }
      roundTimer -= dt;
      if (roundTimer <= 0) {
        roundActive = false;
        if (round < maxRounds) {
          if (ducksHit < cfg.minHitReq) {
            lives--;
            message = 'Only ' + ducksHit + ' ducks! Need ' + cfg.minHitReq + '. Life lost. (' + lives + ' left)';
            sfx('over');
            haptic('over');
            fx_shake(1.0);
          } else {
            message = 'Round ' + round + ' CLEAR! +' + cfg.bonusPoints + ' bonus!';
            score += cfg.bonusPoints;
            coins += 2;
            onScore(score);
            sfx('win');
            haptic('win');
            fx_burst(W / 2, H / 2, '#FFD700', 15);
          }
          if (lives <= 0) {
            over = true;
            onGameOver(score, coins);
            return;
          }
          round++;
          message += ' — ROUND ' + round + '!';
          msgTimer = 2.5;
          setTimeout(function() {
            if (!over) startRound();
          }, 1800);
        } else {
          // All rounds complete — bonus for remaining lives
          var lifeBonus = lives * 300;
          score += lifeBonus;
          if (streak >= 3) score += streak * 50; // final streak bonus
          onScore(score);
          message = 'ALL CLEAR! +' + lifeBonus + ' life bonus!';
          sfx('win');
          haptic('win');
          fx_burst(W / 2, H / 2, '#FFD700', 20);
          fx_burst(W / 4, H / 2, '#0ff', 12);
          fx_burst(3 * W / 4, H / 2, '#0ff', 12);
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
        var moveX = d.dir * d.speed * dt;
        if (d.zigzag) {
          d.zigPhase += dt * 5;
          d.y += Math.sin(d.zigPhase) * 80 * dt;
          d.y = Math.max(30, Math.min(H - 60, d.y));
        }
        d.x += moveX;
        d.wingPhase += dt * 10;
        // Duck escaped
        if ((d.dir === 1 && d.x > W + 50) || (d.dir === -1 && d.x < -50)) {
          if (roundActive) {
            streak = 0;
            lives--;
            sfx('error');
            haptic('over');
            fx_shake(0.6);
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
        p.x += (p.vx || 0) * dt;
        p.y += (p.vy || 0) * dt;
        if (p.vy !== undefined) p.vy += 150 * dt; // gravity
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
    // Sky gradient
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a0a2a');
    grad.addColorStop(0.6, '#0f1535');
    grad.addColorStop(1, '#1a2a1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Ground
    ctx.fillStyle = '#0d1a0d';
    ctx.fillRect(0, H - 50, W, 50);
    ctx.fillStyle = '#1a3a1a';
    ctx.fillRect(0, H - 50, W, 3);
    // Grass blades
    for (var g = 0; g < W; g += 8) {
      ctx.fillStyle = '#1a4a1a';
      ctx.fillRect(g, H - 50, 3, -(4 + Math.sin(g * 0.1) * 3));
    }

    // Stars in sky
    ctx.save();
    for (var s = 0; s < 30; s++) {
      var sx = (s * 137.5 + 50) % W;
      var sy = (s * 97.3 + 10) % (H - 100);
      var alpha = 0.3 + 0.4 * Math.abs(Math.sin(s * 2.1 + last * 0.001));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Title
    ctx.save();
    ctx.shadowColor = '#0ff';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#0ff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('DUCK HUNT', 10, 25);
    ctx.restore();

    // HUD
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = '13px monospace';
    var cfg = getRoundConfig();
    var hudText = 'Round ' + round + '/' + maxRounds + '  ' +
      '\u2764'.repeat(lives) + '\u2661'.repeat(Math.max(0, 3 - lives)) +
      '  Score: ' + score + '  Hit: ' + ducksHit + '/' + cfg.minHitReq;
    ctx.fillText(hudText, 10, H - 14);
    // Streak indicator
    if (streak >= 2) {
      ctx.fillStyle = streak >= 5 ? '#f0f' : '#ff0';
      ctx.shadowColor = streak >= 5 ? '#f0f' : '#ff0';
      ctx.shadowBlur = 8;
      ctx.font = 'bold 12px monospace';
      ctx.fillText('STREAK x' + streak, W - 100, H - 14);
      ctx.shadowBlur = 0;
    }
    ctx.restore();

    // Round timer bar
    if (roundActive) {
      var pct = roundTimer / roundDuration;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(W - 120, 8, 110, 8);
      ctx.fillStyle = pct > 0.3 ? '#0f0' : '#f80';
      ctx.fillRect(W - 120, 8, 110 * pct, 8);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.strokeRect(W - 120, 8, 110, 8);
    }

    // Muzzle flash
    if (muzzleFlash > 0) {
      ctx.save();
      var flashAlpha = muzzleFlash / 0.12;
      ctx.globalAlpha = flashAlpha * 0.6;
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#ff0';
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.arc(crosshair.x, crosshair.y, 15 + (1 - flashAlpha) * 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

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
    // Center dot
    ctx.fillStyle = '#f00';
    ctx.beginPath();
    ctx.arc(crosshair.x, crosshair.y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw ducks
    for (var i = 0; i < ducks.length; i++) {
      var d = ducks[i];
      ctx.save();
      var col = d.hit ? '#888' : (d.color === 'neon green' ? '#0f0' : d.color === 'neon pink' ? '#f0f' : d.color === 'neon cyan' ? '#0ff' : '#f80');
      ctx.shadowColor = col;
      ctx.shadowBlur = d.hit ? 5 : (d.fast ? 22 : 15);
      ctx.fillStyle = col;
      // Body
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, 25, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      // Head
      ctx.beginPath();
      ctx.arc(d.x + d.dir * 20, d.y - 8, 10, 0, Math.PI * 2);
      ctx.fill();
      // Eye
      if (!d.hit) {
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(d.x + d.dir * 23, d.y - 10, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(d.x + d.dir * 23.5, d.y - 10.5, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      // Wings
      if (!d.hit) {
        var wingOff = Math.sin(d.wingPhase) * 12;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y - 8 + wingOff, 18, 6, -0.3, 0, Math.PI * 2);
        ctx.fill();
        // Wing tip glow for fast ducks
        if (d.fast) {
          ctx.globalAlpha = 0.4 + 0.3 * Math.sin(d.wingPhase * 2);
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(d.x - d.dir * 12, d.y - 8 + wingOff, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      // Beak
      ctx.fillStyle = '#ff0';
      ctx.beginPath();
      ctx.moveTo(d.x + d.dir * 30, d.y - 8);
      ctx.lineTo(d.x + d.dir * 40, d.y - 5);
      ctx.lineTo(d.x + d.dir * 30, d.y - 2);
      ctx.fill();
      // Zigzag warning trail
      if (d.zigzag && !d.hit) {
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(d.x - d.dir * 30, d.y);
        for (var z = 1; z <= 5; z++) {
          ctx.lineTo(d.x - d.dir * (30 + z * 12), d.y + Math.sin(d.zigPhase - z * 0.8) * 15);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    // Draw particles
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.save();
      var pAlpha = Math.min(1, p.life / 0.5);
      ctx.globalAlpha = pAlpha;
      if (p.text === 'MISS') {
        ctx.shadowColor = '#f00';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#f00';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('MISS', p.x, p.y);
      } else {
        var pcol = p.color === 'neon green' ? '#0f0' : p.color === 'neon pink' ? '#f0f' : p.color === 'neon cyan' ? '#0ff' : p.color === 'orange' ? '#f80' : '#f00';
        ctx.shadowColor = pcol;
        ctx.shadowBlur = 6;
        ctx.fillStyle = pcol;
        var psize = (p.size || 3) * (0.5 + pAlpha * 0.5);
        ctx.beginPath();
        ctx.arc(p.x, p.y, psize, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Control hint
    if (hintTimer > 0) {
      ctx.save();
      var ha = Math.min(1, hintTimer / 0.5);
      ctx.globalAlpha = ha;
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#0ff';
      ctx.shadowBlur = 12;
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('AIM & TAP TO SHOOT', W / 2, H / 2);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#aaa';
      ctx.font = '12px monospace';
      ctx.fillText('Drag to move crosshair \u2022 Tap/Space to fire', W / 2, H / 2 + 22);
      ctx.restore();
    }

    // Message
    if (msgTimer > 0 && hintTimer <= 0) {
      ctx.save();
      var msgAlpha = Math.min(1, msgTimer / 0.3);
      ctx.globalAlpha = msgAlpha;
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
    var cfg = getRoundConfig();
    spawnTimer = 0.5;
    roundTimer = roundDuration + (round - 1) * 0.5; // slightly more time in later rounds
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
