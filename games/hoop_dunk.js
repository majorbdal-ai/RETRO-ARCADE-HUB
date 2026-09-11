function hoopDunk(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
let diffMul = 1;  // v7.20 difficulty ramp
  let raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  let keys = {}, touches = {};
  let gameOverSent = false;
  const TOTAL_BALLS = 10;
  let ballsLeft = TOTAL_BALLS, shooting = false, aiming = false;
  let aimStartX = 0, aimStartY = 0, aimEndX = 0, aimEndY = 0;
  let ballX = 200, ballY = H - 80, ballVX = 0, ballVY = 0;
  let ballRadius = 10, ballInFlight = false, ballRotation = 0;
  let hoopX = 620, hoopY = 140, hoopW = 50, rimLeft = hoopX - 10, rimRight = hoopX + hoopW + 10;
  let backboardX = rimRight + 5, backboardTop = hoopY - 50, backboardBot = hoopY + 30;
  let streak = 0, swishAnim = 0;
  let mouseX = 0, mouseY = 0, mouseDown = false;
  let pointerId = null;
  let swishCount = 0, hitCount = 0;

  function reset() {
    over = false; gameOverSent = false; score = 0; coins = 0;
    ballsLeft = TOTAL_BALLS; shooting = false; aiming = false;
    ballX = 200; ballY = H - 80; ballVX = 0; ballVY = 0;
    ballInFlight = false; streak = 0; swishAnim = 0;
    mouseX = 0; mouseY = 0; mouseDown = false;
    swishCount = 0; hitCount = 0;
  }

  function drawNeonText(text, x, y, color, size) {
    ctx.shadowBlur = 12;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.font = (size || 14) + 'px "Courier New", monospace';
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
  }

  function draw() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    // Floor
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#111122';
    ctx.fillRect(0, H - 50, W, 50);
    ctx.strokeStyle = '#333355';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H - 50);
    ctx.lineTo(W, H - 50);
    ctx.stroke();

    // Court lines
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#ff6600';
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, H - 50, 80, Math.PI, 0);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Backboard
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff4444';
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(backboardX, backboardTop);
    ctx.lineTo(backboardX, backboardBot);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Rim
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff8800';
    ctx.fillStyle = '#ff8800';
    ctx.fillRect(rimLeft, hoopY, rimRight - rimLeft, 4);
    // Net (simple lines)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    for (let i = 0; i <= 4; i++) {
      const nx = rimLeft + i * ((rimRight - rimLeft) / 4);
      ctx.beginPath();
      ctx.moveTo(nx, hoopY + 4);
      ctx.lineTo(nx + (i < 2 ? 3 : -3), hoopY + 28);
      ctx.stroke();
    }

    // Swish animation
    if (swishAnim > 0) {
      ctx.shadowBlur = 25;
      ctx.shadowColor = '#ffff00';
      ctx.font = 'bold 36px "Courier New"';
      ctx.fillStyle = '#ffff00';
      ctx.textAlign = 'center';
      ctx.fillText('SWISH! 2x', W / 2, H / 2 - 20);
      ctx.textAlign = 'left';
      ctx.shadowBlur = 0;
    }

    // Ball
    if (ballInFlight || !shooting) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ff6600';
      ctx.fillStyle = '#ff6600';
      ctx.beginPath();
      ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
      ctx.fill();
      // Ball lines
      ctx.strokeStyle = '#cc4400';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ballX - ballRadius, ballY);
      ctx.lineTo(ballX + ballRadius, ballY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ballX, ballY - ballRadius);
      ctx.lineTo(ballX, ballY + ballRadius);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Aim line
    if (aiming && !ballInFlight) {
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#00ffff';
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(ballX, ballY);
      // Show trajectory prediction
      const power = Math.min(Math.sqrt((aimStartX - mouseX) ** 2 + (aimStartY - mouseY) ** 2) / 3, 25);
      const angle = Math.atan2(aimStartY - mouseY, aimStartX - mouseX);
      ctx.lineTo(ballX + Math.cos(angle) * power * 15, ballY + Math.sin(angle) * power * 15);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
    }

    // Player position indicator
    if (!ballInFlight && !shooting) {
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#00ffff';
      ctx.fillStyle = '#003344';
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 2;
      // Simple stick figure
      ctx.beginPath();
      ctx.arc(ballX, ballY + 15, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillRect(ballX - 15, ballY + 22, 30, 40);
      ctx.strokeRect(ballX - 15, ballY + 22, 30, 40);
      ctx.shadowBlur = 0;
    }

    // UI
    drawNeonText('HOOP DUNK', 10, 20, '#ff6600', 18);
    drawNeonText('Drag & release to shoot!', 10, 40, '#666688', 11);
    drawNeonText('Balls: ' + ballsLeft + '/' + TOTAL_BALLS, 10, 65, '#00ff88', 14);
    drawNeonText('Score: ' + score, 10, 85, '#00ff88', 16);
    drawNeonText('Streak: ' + streak, W - 150, 20, '#ffff00', 14);

    // Miss message
    if (ballsLeft === 0 && !ballInFlight && !over) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#ff0044';
      ctx.fillStyle = '#ff0044';
      ctx.font = '28px "Courier New"';
      ctx.fillText('GAME OVER', W / 2 - 80, H / 2);
      ctx.shadowBlur = 0;
    }
  }

  function checkScore() {
    // Check if ball passes through the hoop area
    // Hoop is from rimLeft to rimRight at hoopY
    if (ballX > rimLeft + 5 && ballX < rimRight - 5 &&
        ballY > hoopY - 5 && ballY < hoopY + 10 && ballVY > 0) {
      // Score!
      let points = 2;
      if (streak > 0 && streak % 3 === 0) points = 4; // streak bonus
      const swish = Math.abs(ballVX) < 2; // swish = very little horizontal movement
      if (swish) {
        points *= 2;
        swishAnim = 1.5;
        swishCount++;
        coins += 5;
      } else {
        hitCount++;
        coins += 2;
      }
      streak++;
      score += points;
      onScore(score);
      if (typeof window.playSfx === 'function') { try { window.playSfx(swish ? 'win2' : 'pop'); } catch (e) {} }
      if (swish && navigator.vibrate) { try { navigator.vibrate(40); } catch (e) {} }
      return true;
    }
    return false;
  }

  function update(dt) {
    // Swish animation timer
    if (swishAnim > 0) swishAnim -= dt;

    // Ball in flight physics
    if (ballInFlight) {
      const gravity = 600;
      ballVY += gravity * dt;
      ballX += ballVX * dt;
      ballY += ballVY * dt;
      ballRotation += ballVX * dt * 0.05;

      // Backboard collision
      if (ballX + ballRadius > backboardX && ballX - ballRadius < backboardX + 5 &&
          ballY > backboardTop && ballY < backboardBot) {
        ballVX = -ballVX * 0.5;
        ballX = backboardX - ballRadius;
      }

      // Rim collision (left rim)
      if (Math.abs(ballX - rimLeft) < ballRadius + 3 && Math.abs(ballY - hoopY) < 8) {
        ballVX = -Math.abs(ballVX) * 0.5;
        ballVY = -Math.abs(ballVY) * 0.3;
        ballY = hoopY - ballRadius;
      }
      // Rim collision (right rim)
      if (Math.abs(ballX - rimRight) < ballRadius + 3 && Math.abs(ballY - hoopY) < 8) {
        ballVX = Math.abs(ballVX) * 0.5;
        ballVY = -Math.abs(ballVY) * 0.3;
        ballY = hoopY - ballRadius;
      }

      // Check score (ball passes through hoop going down)
      if (checkScore()) {
        ballInFlight = false;
        setTimeout(function() {
          nextBall();
        }, 800);
        return;
      }

      // Ball out of bounds
      if (ballY > H + 50 || ballX < -50 || ballX > W + 50) {
        ballInFlight = false;
        streak = 0;
        nextBall();
      }
    }
  }

  function nextBall() {
    if (over) return;
    ballsLeft--;
    if (ballsLeft <= 0) {
      if (!gameOverSent) {
        gameOverSent = true;
        over = true;
        if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
        if (typeof gameFX !== 'undefined') { try { var __r = canvas.getBoundingClientRect(); gameFX.burst(__r.left + (W/2) * __r.width / canvas.width, __r.top + (H/2) * __r.height / canvas.height, '#ff4444', 16); } catch(e){} gameFX.shake(5); }
      onGameOver(score, coins);
      }
    } else {
      ballInFlight = false;
      shooting = false;
      ballX = 200;
      ballY = H - 80;
      ballVX = 0;
      ballVY = 0;
    }
  }

  function shoot(power, angle) {
    if (ballInFlight || shooting || over || ballsLeft <= 0) return;
    ballInFlight = true;
    ballVX = Math.cos(angle) * power * 8 * diffMul;
    ballVY = Math.sin(angle) * power * 8 * diffMul;
    if (typeof window.playSfx === 'function') { try { window.playSfx('shoot'); } catch (e) {} }
  }

  function loop(ts) {
    if (!running) return;
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    if (!over) {
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    }
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
    if (!over && !running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }
  function destroy() { running = false; cancelAnimationFrame(raf); }

  return {
    start: start,
    pause: pause,
    resume: resume,
    destroy: destroy,
    setInput: function(t, k) { touches = t || {}; keys = k || {}; },
    setDifficulty: function(lvl){ diffMul = [1,1.15,1.3,1.5,1.75,2][Math.min(5,Math.floor(lvl)||0)]||1; }
  };
}
