function soccerPenalty(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  let keys = {}, touches = {};
  let ball = { x: 180, y: 300, vx: 0, vy: 0, r: 12, active: false };
  let goalie = { x: 400, y: 200, w: 50, h: 70, target: 400, speed: 180 };
  let goal = { x: 290, y: 90, w: 220, h: 160 };
  let shots = 0;
  let maxShots = 5;
  let aiming = false;
  let aimStartX = 0, aimStartY = 0;
  let aimDx = 0, aimDy = 0;
  let power = 0;
  let phase = 'aim';
  let time = 0;
  let particles = [];
  let goalFlash = 0;
  let shakeAmount = 0;
  let streak = 0; // consecutive goals for difficulty
  let celebrations = []; // flying text

  function vibrate(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function spawnParticles(x, y, color, count, spread, life) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x, y: y,
        vx: rnd(-spread, spread),
        vy: rnd(-spread, spread),
        life: life || 0.8,
        maxLife: life || 0.8,
        color: color,
        size: rnd(2, 6)
      });
    }
  }

  function spawnCelebration(text, x, y, color) {
    celebrations.push({ text: text, x: x, y: y, life: 1.2, maxLife: 1.2, color: color, vy: -60 });
  }

  function reset() {
    ball = { x: 180, y: 300, vx: 0, vy: 0, r: 12, active: false };
    goalie = { x: 400, y: 200, w: 50, h: 70, target: 400, speed: 180 };
    shots = 0;
    score = 0;
    coins = 0;
    over = false;
    phase = 'aim';
    streak = 0;
    particles = [];
    celebrations = [];
    goalFlash = 0;
    shakeAmount = 0;
    aimDx = 0;
    aimDy = 0;
    power = 0;
    aiming = false;
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
    vibrate(30);
    if (typeof window.playSfx === 'function') { try { window.playSfx('shoot'); } catch (e) {} }
    // Ball trail particles
    spawnParticles(ball.x, ball.y, '#ffffff', 4, 40, 0.4);
  }

  function update(dt) {
    time += dt;

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      let pt = particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 200 * dt; // gravity
      pt.life -= dt;
      if (pt.life <= 0) particles.splice(i, 1);
    }

    // Update celebrations
    for (let i = celebrations.length - 1; i >= 0; i--) {
      let c = celebrations[i];
      c.y += c.vy * dt;
      c.life -= dt;
      if (c.life <= 0) celebrations.splice(i, 1);
    }

    if (goalFlash > 0) goalFlash -= dt;
    if (shakeAmount > 0) shakeAmount *= Math.max(0, 1 - 8 * dt);

    if (over) return;

    // Aiming: touch/mouse drag from ball position
    if (phase === 'aim') {
      if (touches.down && !aiming) {
        aiming = true;
        aimStartX = touches.x || 180;
        aimStartY = touches.y || 300;
      }
      if (aiming && touches.down) {
        let cx = touches.x || aimStartX;
        let cy = touches.y || aimStartY;
        aimDx = aimStartX - cx; // drag back = power forward
        aimDy = aimStartY - cy; // drag down = power up
        power = clamp(Math.hypot(aimDx, aimDy) / 150, 0, 1);
      } else if (aiming && !touches.down) {
        // Release — shoot!
        aiming = false;
        if (power > 0.05) {
          let angle = Math.atan2(aimDy, aimDx);
          let speed = 250 + power * 450;
          shoot(Math.cos(angle) * speed, Math.sin(angle) * speed);
        } else {
          // Tap = quick random shot
          let dir = Math.random() < 0.5 ? -1 : 1;
          let pw = 0.5 + Math.random() * 0.5;
          shoot(dir * (40 + pw * 60), -(60 + pw * 80));
        }
        power = 0;
        aimDx = 0;
        aimDy = 0;
      }

      // Keyboard fallback
      if (keys.Space || keys.ArrowUp) {
        let dir = keys.ArrowLeft ? -1 : keys.ArrowRight ? 1 : (Math.random() < 0.5 ? -1 : 1);
        let pw = 0.6 + Math.random() * 0.4;
        shoot(dir * (50 + pw * 70), -(70 + pw * 90));
      }
    }

    if (ball.active) {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      // Gravity
      ball.vy += 180 * dt;

      // Ball trail
      if (Math.random() < 0.4) {
        spawnParticles(ball.x, ball.y, 'rgba(255,255,255,0.5)', 1, 15, 0.3);
      }

      // Goalie movement — gets faster with streaks and shot count
      let difficultyMult = 1 + streak * 0.15 + (shots / maxShots) * 0.3;
      goalie.speed = 180 * difficultyMult;
      goalie.target += Math.sin(time * (2.5 + streak * 0.4)) * goalie.speed * dt;
      goalie.target = Math.max(goal.x + 25, Math.min(goal.x + goal.w - 25, goalie.target));
      goalie.x += (goalie.target - goalie.x) * (3 + streak * 0.5) * dt;

      // Check goal — the ball must be heading toward goal area
      if (ball.x > goal.x && ball.x < goal.x + goal.w &&
          ball.y > goal.y && ball.y < goal.y + goal.h) {
        score += 100;
        streak++;
        onScore(score);
        goalFlash = 0.5;
        shakeAmount = 8;
        vibrate([50, 30, 80]);
        if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
        // Goal celebration particles
        spawnParticles(ball.x, ball.y, '#3bff8f', 25, 200, 1.0);
        spawnParticles(ball.x, ball.y, '#ffd93b', 15, 160, 0.8);
        spawnParticles(ball.x, ball.y, '#ffffff', 10, 120, 0.6);
        let msgs = ['GOAL!', 'SCORE!', 'BEAUTIFUL!', 'NICE SHOT!', 'GOAAAL!'];
        spawnCelebration(msgs[Math.floor(Math.random() * msgs.length)], ball.x, ball.y - 30, '#3bff8f');
        recordShot(true);
        return;
      }

      // Check goalie hit
      if (Math.abs(ball.x - goalie.x) < (goalie.w / 2 + ball.r) &&
          Math.abs(ball.y - goalie.y) < (goalie.h / 2 + ball.r)) {
        streak = 0;
        vibrate(80);
        shakeAmount = 4;
        spawnParticles(ball.x, ball.y, '#ff4d5e', 12, 120, 0.6);
        spawnParticles(goalie.x, goalie.y, '#ffcc00', 8, 80, 0.5);
        spawnCelebration('SAVED!', ball.x, ball.y - 30, '#ff4d5e');
        recordShot(false);
        return;
      }

      // Out of bounds
      if (ball.x > W || ball.y > H || ball.y < 0) {
        streak = 0;
        vibrate(40);
        if (typeof window.playSfx === 'function') { try { window.playSfx('error'); } catch (e) {} }
        spawnParticles(ball.x, Math.min(ball.y, H), '#ff8c3b', 8, 100, 0.5);
        spawnCelebration('MISS!', ball.x, Math.min(ball.y, H) - 20, '#ff8c3b');
        recordShot(false);
        return;
      }
    }
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

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
        if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
        onGameOver(score, coins);
      } else {
        phase = 'aim';
        ball.vx = 0;
        ball.vy = 0;
        ball.x = 180;
        ball.y = 300;
      }
    }, 1000);
  }

  function draw() {
    // Apply screen shake
    ctx.save();
    if (shakeAmount > 0.5) {
      ctx.translate(
        (Math.random() - 0.5) * shakeAmount * 2,
        (Math.random() - 0.5) * shakeAmount * 2
      );
    }

    // Background with gradient
    let bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#06061a');
    bgGrad.addColorStop(1, '#0a0a2a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (let i = 0; i < 30; i++) {
      let sx = (i * 137.5 + time * 5) % W;
      let sy = (i * 73.7) % (H * 0.4);
      ctx.fillStyle = 'rgba(200,220,255,' + (0.3 + 0.3 * Math.sin(time * 2 + i)) + ')';
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // Field with gradient
    let fieldGrad = ctx.createLinearGradient(0, 150, 0, H);
    fieldGrad.addColorStop(0, '#0d4420');
    fieldGrad.addColorStop(1, '#0a3318');
    ctx.fillStyle = fieldGrad;
    ctx.fillRect(0, 150, W, 300);

    // Field lines
    ctx.strokeStyle = '#1a8833';
    ctx.lineWidth = 2;
    ctx.strokeRect(100, 150, 600, 240);
    // Center line
    ctx.beginPath();
    ctx.moveTo(100, 270);
    ctx.lineTo(700, 270);
    ctx.stroke();
    // Penalty spot
    ctx.fillStyle = '#1a8833';
    ctx.beginPath();
    ctx.arc(280, 270, 4, 0, Math.PI * 2);
    ctx.fill();

    // Goal frame with depth
    ctx.fillStyle = '#1a1a4a';
    ctx.fillRect(goal.x - 14, goal.y - 14, goal.w + 28, goal.h + 28);
    // Goal net pattern
    ctx.strokeStyle = 'rgba(100,120,200,0.3)';
    ctx.lineWidth = 1;
    for (let gx = goal.x; gx < goal.x + goal.w; gx += 18) {
      ctx.beginPath();
      ctx.moveTo(gx, goal.y);
      ctx.lineTo(gx, goal.y + goal.h);
      ctx.stroke();
    }
    for (let gy = goal.y; gy < goal.y + goal.h; gy += 18) {
      ctx.beginPath();
      ctx.moveTo(goal.x, gy);
      ctx.lineTo(goal.x + goal.w, gy);
      ctx.stroke();
    }
    ctx.fillStyle = '#2a2a5a';
    ctx.fillRect(goal.x - 10, goal.y - 10, goal.w + 20, goal.h + 20);

    // Goalie with glow
    ctx.save();
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(goalie.x - goalie.w / 2, goalie.y - goalie.h / 2, goalie.w, goalie.h);
    // Goalie jersey stripe
    ctx.fillStyle = '#cc9900';
    ctx.fillRect(goalie.x - goalie.w / 2, goalie.y - 4, goalie.w, 8);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Goalie difficulty indicator (subtle glow increases with streak)
    if (streak > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,77,94,' + Math.min(0.6, streak * 0.1) + ')';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ff4d5e';
      ctx.shadowBlur = 8 + streak * 3;
      ctx.strokeRect(goalie.x - goalie.w / 2 - 4, goalie.y - goalie.h / 2 - 4, goalie.w + 8, goalie.h + 8);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Ball with trail
    if (ball.active || phase === 'aim') {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();
      // Ball pattern
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.arc(ball.x - 3, ball.y - 3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Aim arrow (when dragging)
    if (phase === 'aim' && aiming && power > 0.05) {
      ctx.save();
      let angle = Math.atan2(aimDy, aimDx);
      let len = 40 + power * 60;
      let arrowX = ball.x + Math.cos(angle) * (ball.r + 8);
      let arrowY = ball.y + Math.sin(angle) * (ball.r + 8);
      let endX = arrowX + Math.cos(angle) * len;
      let endY = arrowY + Math.sin(angle) * len;

      // Aim line
      ctx.strokeStyle = power > 0.7 ? '#ff4d5e' : power > 0.4 ? '#ffd93b' : '#3bff8f';
      ctx.lineWidth = 3;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 8;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrowhead
      let headLen = 10;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - headLen * Math.cos(angle - 0.4), endY - headLen * Math.sin(angle - 0.4));
      ctx.lineTo(endX - headLen * Math.cos(angle + 0.4), endY - headLen * Math.sin(angle + 0.4));
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Power bar
    if (phase === 'aim') {
      ctx.fillStyle = '#1a1a3a';
      ctx.fillRect(W - 48, H - 180, 24, 130);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.strokeRect(W - 48, H - 180, 24, 130);

      let barH = 126 * power;
      let barColor = power > 0.7 ? '#ff4d5e' : power > 0.4 ? '#ffd93b' : '#3bff8f';
      ctx.fillStyle = barColor;
      ctx.shadowColor = barColor;
      ctx.shadowBlur = 10;
      ctx.fillRect(W - 46, H - 178 + (126 - barH), 20, barH);
      ctx.shadowBlur = 0;

      // Power label
      ctx.fillStyle = '#7f92b8';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PWR', W - 36, H - 185);
      ctx.textAlign = 'left';
    }

    // Particles
    for (let i = 0; i < particles.length; i++) {
      let pt = particles[i];
      let alpha = pt.life / pt.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pt.color;
      ctx.shadowColor = pt.color;
      ctx.shadowBlur = 4;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size * alpha, pt.size * alpha);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Celebration text
    for (let i = 0; i < celebrations.length; i++) {
      let c = celebrations[i];
      let alpha = c.life / c.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = c.color;
      ctx.shadowColor = c.color;
      ctx.shadowBlur = 12;
      ctx.fillText(c.text, c.x, c.y);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Goal flash overlay
    if (goalFlash > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(59,255,143,' + (goalFlash * 0.3) + ')';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // HUD
    ctx.save();
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 6;
    ctx.font = 'bold 16px monospace';
    ctx.fillText('⚽ SOCCER PENALTY', 12, 24);
    ctx.font = '12px monospace';
    ctx.fillText('DRAG & RELEASE TO SHOOT  |  SHOTS: ' + shots + '/' + maxShots + '  |  SCORE: ' + score, 12, 44);

    // Streak indicator
    if (streak > 0) {
      ctx.fillStyle = '#ffd93b';
      ctx.shadowColor = '#ffd93b';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('🔥 STREAK x' + streak, 12, 64);
    }

    // Shot counter dots
    for (let i = 0; i < maxShots; i++) {
      let dotX = W - 30 - i * 22;
      let dotY = 30;
      if (i < shots) {
        ctx.fillStyle = '#ff4d5e';
        ctx.shadowColor = '#ff4d5e';
      } else {
        ctx.fillStyle = '#2a2a4a';
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚽', dotX, dotY + 4);
      ctx.textAlign = 'left';
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // Control hint on canvas (bottom area)
    ctx.save();
    ctx.fillStyle = 'rgba(20,20,40,0.7)';
    ctx.fillRect(W / 2 - 180, H - 32, 360, 26);
    ctx.fillStyle = '#5a6a8a';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('👆 DRAG BACKWARD from ball → AIM  |  RELEASE → SHOOT', W / 2, H - 15);
    ctx.textAlign = 'left';
    ctx.restore();

    // Game over overlay
    if (over) {
      ctx.save();
      ctx.fillStyle = 'rgba(4,4,16,0.82)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';

      let resultColor = score >= 300 ? '#3bff8f' : score >= 100 ? '#ffd93b' : '#ff4d5e';
      let resultText = score >= 300 ? '🏆 GREAT GAME!' : score >= 100 ? '👍 NOT BAD!' : '😅 TRY AGAIN!';
      ctx.font = 'bold 40px monospace';
      ctx.fillStyle = resultColor;
      ctx.shadowColor = resultColor;
      ctx.shadowBlur = 16;
      ctx.fillText(resultText, W / 2, H / 2 - 50);

      ctx.font = 'bold 28px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.fillText('FINAL SCORE: ' + score, W / 2, H / 2 + 10);

      ctx.font = '18px monospace';
      ctx.fillStyle = '#ffd93b';
      ctx.shadowColor = '#ffd93b';
      ctx.fillText('COINS +' + coins, W / 2, H / 2 + 46);

      if (score >= 300) {
        ctx.font = '14px monospace';
        ctx.fillStyle = '#7f92b8';
        ctx.shadowBlur = 0;
        ctx.fillText('Perfect shots win the match!', W / 2, H / 2 + 72);
      }

      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
      ctx.restore();
    }

    ctx.restore(); // end screen shake
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
