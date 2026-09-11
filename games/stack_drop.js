function stackDrop(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
let diffMul = 1;  // v7.20 difficulty ramp
  let raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  let keys = {}, touches = {};
  let blocks = [], movingBlock = null, stackBase = 20, stackTop = H;
  let combo = 0, totalScore = 0, speed = 120, dir = 1;
  let particles = [], shakeTimer = 0, perfectCount = 0;
  const BLOCK_H = 25;
  const BLOCK_W = 120;
  const BASE_X = 160;
  const TOLERANCE = 6;

  // --- NEW: level system, background stars, combo popup, haptics ---
  let level = 1, stars = [], comboPopup = null, fallPieces = [];
  let bgHue = 0; // slowly shifting background hue

  function vibrate(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {}
  }

  // Generate background stars
  function initStars() {
    stars = [];
    for (let i = 0; i < 30; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        size: 0.5 + Math.random() * 1.5,
        twinkle: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.7
      });
    }
  }

  function reset() {
    blocks = [];
    particles = [];
    fallPieces = [];
    combo = 0;
    totalScore = 0;
    score = 0;
    coins = 0;
    over = false;
    speed = 120;
    perfectCount = 0;
    shakeTimer = 0;
    level = 1;
    comboPopup = null;
    bgHue = 0;
    stackTop = H;
    initStars();
    spawnBlock();
    onScore(0);
  }

  function spawnBlock() {
    const w = Math.max(30, BLOCK_W - combo * 2);
    const startX = dir > 0 ? -w : W + w;
    movingBlock = { x: startX, y: stackTop - BLOCK_H - 4, w: w, h: BLOCK_H, speed: speed, dir: dir, dropped: false };
  }

  function spawnComboPopup(x, y, text, color) {
    comboPopup = { x, y, text, color, life: 1.0 };
  }

  function dropBlock() {
    if (!movingBlock || movingBlock.dropped || over) return;
    movingBlock.dropped = true;
    const b = movingBlock;

    let placed = false;
    if (blocks.length === 0) {
      const aligned = Math.abs(b.x - BASE_X) < TOLERANCE;
      if (aligned) b.x = BASE_X;
      blocks.push({ x: b.x, y: b.y, w: b.w, h: b.h, perfect: true });
      stackTop = b.y;
      combo = 0;
      totalScore += 10;
      score = totalScore;
      coins += 1;
      perfectCount++;
      vibrate(30);
      spawnParticles(b.x + b.w / 2, b.y, '#00ffff', 15);
      onScore(score);
      placed = true;
      if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
    } else {
      const top = blocks[blocks.length - 1];
      const overlap = Math.min(b.x + b.w, top.x + top.w) - Math.max(b.x, top.x);

      if (overlap <= 0) {
        over = true;
        vibrate([100, 50, 100]);
        if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
        if (typeof gameFX !== 'undefined') { try { var __r = canvas.getBoundingClientRect(); gameFX.burst(__r.left + (W/2) * __r.width / canvas.width, __r.top + (H/2) * __r.height / canvas.height, '#ff4444', 16); } catch(e){} gameFX.shake(5); }
      onGameOver(score, coins);
        return;
      }

      if (overlap >= top.w - TOLERANCE) {
        b.x = top.x;
        b.w = top.w;
        b.perfect = true;
        combo++;
        const pts = 10 * (combo + 1);
        totalScore += pts;
        coins += 2;
        perfectCount++;
        shakeTimer = 0.2;
        vibrate([20, 15, 20, 15, 40]);
        spawnParticles(b.x + b.w / 2, b.y, '#00ff00', 25);
        spawnParticles(b.x + b.w / 2, b.y, '#ffffff', 8);
        spawnComboPopup(b.x + b.w / 2, b.y - 10, 'PERFECT x' + combo + ' +' + pts, '#00ff00');
        if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
      } else {
        b.perfect = false;
        combo = 0;
        const sliceX = Math.min(b.x + b.w, top.x + top.w) - Math.max(b.x, top.x);
        const newX = Math.max(b.x, top.x);

        // Spawn falling piece for the trimmed part
        if (b.x < top.x) {
          fallPieces.push({ x: b.x, y: b.y, w: top.x - b.x, h: b.h, vy: 0, color: '#ff6600' });
        } else if (b.x + b.w > top.x + top.w) {
          fallPieces.push({ x: top.x + top.w, y: b.y, w: b.x + b.w - (top.x + top.w), h: b.h, vy: 0, color: '#ff6600' });
        }

        b.x = newX;
        b.w = Math.max(15, sliceX);
        totalScore += 10;
        coins += 1;
        vibrate(15);
        if (typeof window.playSfx === 'function') { try { window.playSfx('pop'); } catch (e) {} }
        spawnParticles(b.x + b.w / 2, b.y, '#ff6600', 10);
        spawnComboPopup(b.x + b.w / 2, b.y - 10, '+10', '#ff8800');
      }
      score = totalScore;
      stackTop = b.y;
      onScore(score);
      blocks.push({ x: b.x, y: b.y, w: b.w, h: b.h, perfect: b.perfect });
      if (blocks.length > 15) blocks.shift();
    }

    // Level up every 5 blocks
    level = Math.floor(blocks.length / 5) + 1;
    speed = Math.min(350, (120 + blocks.length * 8) * diffMul);
    dir = Math.random() > 0.5 ? 1 : -1;
    movingBlock = null;
    shakeTimer = 0.1;
    setTimeout(() => spawnBlock(), 400);

    if (stackTop < H / 2) {
      over = true;
      vibrate([50, 30, 50, 30, 150]);
      if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
      onGameOver(score, coins);
    }
  }

  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 180;
      particles.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 40,
        life: 0.6 + Math.random() * 0.6,
        color,
        size: 1.5 + Math.random() * 3.5
      });
    }
  }

  function update(dt) {
    if (over) return;

    // Background hue shift
    bgHue = (bgHue + dt * 8) % 360;

    // Star twinkle
    for (const s of stars) {
      s.twinkle += s.speed * dt * 3;
      s.y += s.speed * 15 * dt;
      if (s.y > H + 5) { s.y = -5; s.x = Math.random() * W; }
    }

    if ((touches.action || keys.Space || keys.KeyW) && movingBlock && !movingBlock.dropped) {
      dropBlock();
    }

    if (movingBlock && !movingBlock.dropped) {
      movingBlock.x += movingBlock.speed * movingBlock.dir * dt;
      if (movingBlock.x > W + 20) { movingBlock.dir = -1; }
      if (movingBlock.x + movingBlock.w < -20) { movingBlock.dir = 1; }
    }

    if (shakeTimer > 0) shakeTimer -= dt;

    // Combo popup decay
    if (comboPopup) {
      comboPopup.life -= dt * 1.8;
      if (comboPopup.life <= 0) comboPopup = null;
    }

    // Falling trim pieces
    for (let i = fallPieces.length - 1; i >= 0; i--) {
      const fp = fallPieces[i];
      fp.vy += 400 * dt;
      fp.y += fp.vy * dt;
      if (fp.y > H + 50) fallPieces.splice(i, 1);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
      p.life -= dt * 2;
      if (p.life <= 0) particles.splice(i, 1);
    }
    if (particles.length > 150) particles.splice(0, particles.length - 150);
  }

  function draw() {
    // --- Background with subtle hue shift ---
    const bgR = 10 + Math.sin(bgHue * Math.PI / 180) * 4;
    const bgG = 10 + Math.sin((bgHue + 120) * Math.PI / 180) * 4;
    const bgB = 18 + Math.sin((bgHue + 240) * Math.PI / 180) * 6;
    ctx.fillStyle = `rgb(${bgR|0},${bgG|0},${bgB|0})`;
    ctx.fillRect(0, 0, W, H);

    const shx = shakeTimer > 0 ? (Math.random() - 0.5) * 5 : 0;
    const shy = shakeTimer > 0 ? (Math.random() - 0.5) * 5 : 0;
    ctx.save();
    ctx.translate(shx, shy);

    // --- Background stars ---
    for (const s of stars) {
      const alpha = 0.3 + 0.5 * Math.abs(Math.sin(s.twinkle));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#aaccff';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;

    // --- Subtle grid ---
    ctx.strokeStyle = '#111122';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    const neonColors = ['#ff00ff', '#00ffff', '#ff6600', '#00ff88', '#ffff00', '#ff0088', '#8800ff'];

    // --- Ground indicator line ---
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#333366';
    ctx.strokeStyle = '#333366';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const colorIdx = i % neonColors.length;
      const color = neonColors[colorIdx];
      const glow = b.perfect && i === blocks.length - 1 ? '#ffffff' : color;

      ctx.shadowBlur = b.perfect ? 15 : 8;
      ctx.shadowColor = glow;
      ctx.fillStyle = color;
      ctx.fillRect(b.x, b.y, b.w, b.h);

      // Inner gradient shine on top block
      if (i === blocks.length - 1) {
        const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
        grad.addColorStop(0, 'rgba(255,255,255,0.25)');
        grad.addColorStop(1, 'rgba(0,0,0,0.15)');
        ctx.fillStyle = grad;
        ctx.fillRect(b.x, b.y, b.w, b.h);
      }

      ctx.strokeStyle = '#ffffff33';
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x, b.y, b.w, b.h);

      if (b.perfect && i === blocks.length - 1) {
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#00ffff';
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
      }
      ctx.shadowBlur = 0;
    }

    // --- Falling trim pieces ---
    for (const fp of fallPieces) {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = fp.color;
      ctx.fillRect(fp.x, fp.y, fp.w, fp.h);
      ctx.globalAlpha = 1;
    }

    // Moving block
    if (movingBlock && !movingBlock.dropped) {
      const color = '#00ffcc';
      ctx.shadowBlur = 14;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(performance.now() / 100);
      ctx.fillRect(movingBlock.x, movingBlock.y, movingBlock.w, movingBlock.h);
      // Guide line from moving block down to stack
      ctx.strokeStyle = '#00ffcc33';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      ctx.moveTo(movingBlock.x + movingBlock.w / 2, movingBlock.y + movingBlock.h);
      ctx.lineTo(movingBlock.x + movingBlock.w / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      ctx.shadowBlur = 6;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    ctx.restore();

    // --- HUD ---
    ctx.font = 'bold 18px Orbitron, monospace';
    ctx.fillStyle = '#ff00ff';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff00ff';
    ctx.fillText('STACK DROP', 16, 28);
    ctx.font = '12px Orbitron, monospace';
    ctx.fillStyle = '#ff88ff';
    ctx.fillText('TAP/SPACE Drop  |  Perfect = bonus  |  Don\'t miss!', 16, 46);
    ctx.shadowBlur = 0;

    // Score
    ctx.font = 'bold 22px Orbitron, monospace';
    ctx.fillStyle = '#ffff00';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffff00';
    ctx.fillText('SCORE: ' + score, W - 190, 36);

    // Level indicator
    ctx.font = 'bold 16px Orbitron, monospace';
    ctx.fillStyle = '#ff00ff';
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 8;
    ctx.fillText('LV.' + level, W - 190, 58);

    // Combo
    if (combo > 1) {
      ctx.font = 'bold 18px Orbitron, monospace';
      ctx.fillStyle = '#00ff88';
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 14;
      ctx.fillText('COMBO x' + combo, W - 190, 80);
    }
    ctx.shadowBlur = 0;

    // Perfect count
    if (perfectCount > 0) {
      ctx.font = '12px Orbitron, monospace';
      ctx.fillStyle = '#88aacc';
      ctx.fillText('Perfects: ' + perfectCount, W - 190, 98);
    }

    // --- Combo popup floating text ---
    if (comboPopup && comboPopup.life > 0) {
      ctx.globalAlpha = comboPopup.life;
      ctx.font = 'bold 18px Orbitron, monospace';
      ctx.fillStyle = comboPopup.color;
      ctx.shadowBlur = 12;
      ctx.shadowColor = comboPopup.color;
      ctx.fillText(comboPopup.text, comboPopup.x - 30, comboPopup.y - (1 - comboPopup.life) * 35);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // --- Level-up flash text ---
    if (blocks.length > 0 && blocks.length % 5 === 1 && blocks.length < 60) {
      // Already showing via comboPopup
    }
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

  function pause() { running = false; cancelAnimationFrame(raf); }
  function resume() { if (!over && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); } }
  function destroy() { running = false; cancelAnimationFrame(raf); }

  return { start, pause, resume, destroy, setDifficulty: function(lvl){ diffMul = [1,1.15,1.3,1.5,1.75,2][Math.min(5,Math.floor(lvl)||0)]||1; }, setInput: (t, k) => { touches = t; keys = k; } };
}
