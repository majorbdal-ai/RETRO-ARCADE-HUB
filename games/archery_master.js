function archeryMaster(canvas, ctx, onScore, onGameOver, onCoins) {
  var W = 800, H = 450;
  var raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  var keys = {}, touches = {};
  var totalArrows = 5, arrowsLeft = 5;
  var bow = { x: 120, y: H / 2, angle: 0, pulling: false, pullPower: 0 };
  var arrow = null;
  var wind = 0;
  var target = { x: W - 120, y: 0 };
  var scoreText = '';
  var scoreTextTimer = 0;
  var phase = 'aim'; // aim, flying, result

  var targetRings = [15, 35, 55, 75, 95];
  var ringColors = ['#fff', '#ff0', '#f80', '#f00', '#800'];
  var ringScores = [100, 75, 50, 25, 10];

  function reset() {
    score = 0; coins = 0; arrowsLeft = totalArrows;
    target.y = 80 + Math.random() * (H - 200);
    newWind();
    phase = 'aim';
    bow.pulling = false; bow.pullPower = 0; bow.angle = 0;
    arrow = null;
  }

  function newWind() {
    wind = (Math.random() - 0.5) * 120;
  }

  function shoot() {
    if (phase !== 'aim' || arrowsLeft <= 0) return;
    var power = bow.pullPower;
    if (power < 0.1) power = 0.1;
    var angle = bow.angle;
    var vx = Math.cos(angle) * power * 800;
    var vy = Math.sin(angle) * power * 800;
    arrow = {
      x: bow.x + 20, y: bow.y,
      vx: vx, vy: vy,
      trail: [],
      life: 5
    };
    bow.pulling = false;
    bow.pullPower = 0;
    arrowsLeft--;
    phase = 'flying';
  }

  function update(dt) {
    if (scoreTextTimer > 0) scoreTextTimer -= dt;

    if (phase === 'aim') {
      // Bow aiming
      if (touches.down || keys.ArrowDown) bow.angle = Math.min(bow.angle + dt * 2, Math.PI / 4);
      if (touches.up || keys.ArrowUp) bow.angle = Math.max(bow.angle - dt * 2, -Math.PI / 4);

      // Pull power
      if (touches.action || keys.Space) {
        bow.pulling = true;
        bow.pullPower = Math.min(bow.pullPower + dt * 1.5, 1);
      } else if (bow.pulling && !(touches.action || keys.Space)) {
        shoot();
      }
    }

    if (phase === 'flying' && arrow) {
      arrow.vx += wind * dt;
      arrow.vy += 400 * dt; // gravity
      arrow.x += arrow.vx * dt;
      arrow.y += arrow.vy * dt;
      arrow.trail.push({ x: arrow.x, y: arrow.y });
      if (arrow.trail.length > 30) arrow.trail.shift();
      arrow.life -= dt;

      // Check hit target
      var dx = arrow.x - target.x;
      var dy = arrow.y - target.y;
      var dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < targetRings[4]) {
        // Hit!
        var ringIdx = 0;
        for (var i = 0; i < targetRings.length; i++) {
          if (dist <= targetRings[i]) { ringIdx = i; break; }
        }
        var pts = ringScores[ringIdx];
        score += pts;
        coins += Math.floor(pts / 25);
        onScore(score);
        scoreText = (ringIdx === 0 ? '★ BULLSEYE! ★ ' : '') + '+' + pts;
        scoreTextTimer = 1.5;
        phase = 'result';
        setTimeout(function() {
          if (!over && arrowsLeft > 0) {
            target.y = 80 + Math.random() * (H - 200);
            newWind();
            phase = 'aim';
            arrow = null;
          } else if (arrowsLeft <= 0) {
            over = true;
            onGameOver(score, coins);
          }
        }, 1000);
        arrow = null;
      }

      // Off screen
      if (arrow && (arrow.x > W + 50 || arrow.x < -50 || arrow.y > H + 50 || arrow.y < -50)) {
        scoreText = 'MISS!';
        scoreTextTimer = 1;
        phase = 'result';
        setTimeout(function() {
          if (!over && arrowsLeft > 0) {
            target.y = 80 + Math.random() * (H - 200);
            newWind();
            phase = 'aim';
            arrow = null;
          } else if (arrowsLeft <= 0) {
            over = true;
            onGameOver(score, coins);
          }
        }, 800);
        arrow = null;
      }
    }
  }

  function draw() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.save();
    ctx.shadowColor = '#f80';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#f80';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('ARCHERY MASTER', 10, 25);
    ctx.fillStyle = '#888';
    ctx.font = '12px monospace';
    ctx.fillText('↑↓ aim | Hold Space/Tap pull | Release shoot', 10, 42);
    ctx.restore();

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText('Arrows: ' + arrowsLeft + '/' + totalArrows + '  Score: ' + score, W - 250, 25);

    // Wind indicator
    ctx.save();
    ctx.shadowColor = '#0ff';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#0ff';
    ctx.font = '14px monospace';
    ctx.fillText('Wind:', W - 150, 50);
    ctx.strokeStyle = wind > 0 ? '#0f0' : '#f00';
    ctx.lineWidth = 3;
    ctx.beginPath();
    var windBarLen = wind / 120 * 50;
    ctx.moveTo(W - 100, 45);
    ctx.lineTo(W - 100 + windBarLen, 45);
    ctx.stroke();
    // Arrow
    var windDir = wind > 0 ? '→' : '←';
    ctx.fillText(windDir + ' ' + Math.abs(Math.round(wind)), W - 80, 45);
    ctx.restore();

    // Target
    for (var i = targetRings.length - 1; i >= 0; i--) {
      ctx.save();
      ctx.shadowColor = ringColors[i];
      ctx.shadowBlur = 8;
      ctx.fillStyle = ringColors[i];
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(target.x, target.y, targetRings[i], 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = ringColors[i];
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Target stand
    ctx.save();
    ctx.shadowColor = '#888';
    ctx.shadowBlur = 5;
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(target.x - 30, target.y + targetRings[4]);
    ctx.lineTo(target.x, target.y + targetRings[4] + 40);
    ctx.lineTo(target.x + 30, target.y + targetRings[4]);
    ctx.stroke();
    ctx.restore();

    // Bow
    ctx.save();
    ctx.translate(bow.x, bow.y);
    ctx.rotate(bow.angle);
    ctx.shadowColor = '#ff0';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = 3;
    // Bow body
    ctx.beginPath();
    ctx.arc(0, 0, 40, -0.8, 0.8);
    ctx.stroke();
    // String
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    var pullOffset = bow.pullPower * 20;
    ctx.moveTo(40 * Math.cos(-0.8), 40 * Math.sin(-0.8));
    ctx.lineTo(pullOffset, 0);
    ctx.lineTo(40 * Math.cos(0.8), 40 * Math.sin(0.8));
    ctx.stroke();
    // Arrow on bow (when aiming)
    if (phase === 'aim') {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.lineTo(15 + pullOffset, 0);
      ctx.stroke();
      // Arrowhead
      ctx.fillStyle = '#f00';
      ctx.beginPath();
      ctx.moveTo(20 + pullOffset, 0);
      ctx.lineTo(15 + pullOffset, -4);
      ctx.lineTo(15 + pullOffset, 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Flying arrow
    if (phase === 'flying' && arrow) {
      // Trail
      ctx.save();
      ctx.strokeStyle = '#ff0';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      for (var i = 0; i < arrow.trail.length; i++) {
        if (i === 0) ctx.moveTo(arrow.trail[i].x, arrow.trail[i].y);
        else ctx.lineTo(arrow.trail[i].x, arrow.trail[i].y);
      }
      ctx.stroke();
      ctx.restore();

      // Arrow
      ctx.save();
      var angle = Math.atan2(arrow.vy, arrow.vx);
      ctx.translate(arrow.x, arrow.y);
      ctx.rotate(angle);
      ctx.shadowColor = '#ff0';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-15, 0);
      ctx.lineTo(10, 0);
      ctx.stroke();
      ctx.fillStyle = '#f00';
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(10, -3);
      ctx.lineTo(10, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Score text
    if (scoreTextTimer > 0) {
      ctx.save();
      ctx.shadowColor = '#ff0';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#ff0';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, scoreTextTimer);
      ctx.fillText(scoreText, W / 2, H / 2);
      ctx.restore();
    }

    // Pull power meter
    if (bow.pulling) {
      ctx.save();
      ctx.shadowColor = '#f00';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#333';
      ctx.fillRect(30, H - 40, 100, 12);
      var meterColor = bow.pullPower < 0.5 ? '#0f0' : bow.pullPower < 0.8 ? '#ff0' : '#f00';
      ctx.shadowColor = meterColor;
      ctx.fillStyle = meterColor;
      ctx.fillRect(30, H - 40, bow.pullPower * 100, 12);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(30, H - 40, 100, 12);
      ctx.restore();
    }

    // Game over
    if (over) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.shadowColor = '#f80';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#f80';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ROUND COMPLETE', W / 2, H / 2 - 30);
      ctx.fillStyle = '#fff';
      ctx.font = '20px monospace';
      ctx.fillText('Final Score: ' + score, W / 2, H / 2 + 10);
      ctx.fillText('Coins: ' + coins, W / 2, H / 2 + 40);
      ctx.restore();
    }
  }

  function loop(ts) {
    var dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    update(dt);
    draw();
    if (!over) raf = requestAnimationFrame(loop);
    else raf = requestAnimationFrame(loop);
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
