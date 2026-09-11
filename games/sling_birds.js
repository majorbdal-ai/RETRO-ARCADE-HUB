function slingBirds(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, score = 0, coins = 0;
  let keys = {}, touches = {};
  let birds = [];
  let structures = [];
  let particles = [];
  let aimPos = null;
  let dragging = false;
  let dragStart = { x: 150, y: 300 };
  let launchPower = 0;
  let birdsLeft = 5;
  let maxPull = 120;
  let activeBird = null;
  let state = 'aim';

  function reset() {
    birds = [];
    structures = [];
    particles = [];
    aimPos = null;
    dragging = false;
    birdsLeft = 5;
    state = 'aim';
    score = 0;
    coins = 0;
    over = false;
    onScore(0);
    buildLevel();
  }

  function buildLevel() {
    structures = [];
    const baseX = 500;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3 - row; col++) {
        structures.push({
          x: baseX + col * 35 + row * 18,
          y: 320 - row * 30,
          w: 25,
          h: 28,
          hp: 2,
          type: row === 2 ? 'pig' : 'block'
        });
      }
    }
    structures.push({
      x: baseX + 50,
      y: 280,
      w: 25,
      h: 28,
      hp: 2,
      type: 'pig'
    });
  }

  function launchBird(vx, vy) {
    if (birdsLeft <= 0 || state !== 'aim') return;
    birdsLeft--;
    state = 'flying';
    if (typeof window.playSfx === 'function') { try { window.playSfx('shoot'); } catch (e) {} }
    activeBird = {
      x: dragStart.x,
      y: dragStart.y,
      vx: vx,
      vy: vy,
      r: 12,
      alive: true,
      timer: 5
    };
    birds.push(activeBird);
  }

  function update(dt) {
    if (over || state === 'aim') return;

    for (let i = birds.length - 1; i >= 0; i--) {
      const b = birds[i];
      if (!b.alive) continue;
      b.vy += 600 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.timer -= dt;

      if (b.x > W + 50 || b.y > H + 50 || b.timer <= 0) {
        b.alive = false;
        continue;
      }

      for (let j = structures.length - 1; j >= 0; j--) {
        const s = structures[j];
        if (Math.abs(b.x - (s.x + s.w / 2)) < (s.w / 2 + b.r) &&
            Math.abs(b.y - (s.y + s.h / 2)) < (s.h / 2 + b.r)) {
          s.hp--;
          b.vx *= 0.3;
          b.vy *= 0.3;
          if (typeof window.playSfx === 'function') { try { window.playSfx('pop'); } catch (e) {} }
          for (let p = 0; p < 5; p++) {
            particles.push({
              x: s.x + s.w / 2,
              y: s.y + s.h / 2,
              vx: (Math.random() - 0.5) * 200,
              vy: (Math.random() - 0.5) * 200,
              life: 0.5,
              color: s.type === 'pig' ? '#00ff88' : '#ff4488'
            });
          }
          if (s.hp <= 0) {
            score += s.type === 'pig' ? 500 : 100;
            onScore(score);
            if (typeof window.playSfx === 'function') { try { window.playSfx(s.type === 'pig' ? 'pop' : 'shoot'); } catch (e) {} }
            structures.splice(j, 1);
          }
        }
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    const allDead = birds.every(b => !b.alive);
    if (allDead) {
      if (birdsLeft > 0) {
        state = 'aim';
        activeBird = null;
      } else {
        const pigs = structures.filter(s => s.type === 'pig');
        if (pigs.length === 0) {
          coins += Math.floor(score / 200);
          onCoins(coins);
          if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
        }
        over = true;
        if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
        onGameOver(score, coins);
      }
    }
  }

  function draw() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 350, W, 100);

    ctx.fillStyle = '#333';
    for (let i = 0; i < 10; i++) {
      ctx.fillRect(i * 85, 350, 80, 80);
    }

    ctx.fillStyle = '#ff0088';
    ctx.shadowColor = '#ff0088';
    ctx.shadowBlur = 15;
    ctx.fillRect(dragStart.x - 15, dragStart.y - 10, 30, 20);
    ctx.shadowBlur = 0;

    for (const b of birds) {
      if (!b.alive) continue;
      ctx.fillStyle = '#ffaa00';
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    for (const s of structures) {
      if (s.type === 'pig') {
        ctx.fillStyle = '#00ff88';
        ctx.shadowColor = '#00ff88';
      } else {
        ctx.fillStyle = '#ff4488';
        ctx.shadowColor = '#ff4488';
      }
      ctx.shadowBlur = 8;
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.shadowBlur = 0;
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 3, 3);
    }
    ctx.globalAlpha = 1;

    if (dragging && aimPos) {
      const dx = dragStart.x - aimPos.x;
      const dy = dragStart.y - aimPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        ctx.strokeStyle = '#ff0088';
        ctx.shadowColor = '#ff0088';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(dragStart.x, dragStart.y);
        ctx.lineTo(aimPos.x, aimPos.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
      }
    }

    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 5;
    ctx.font = '14px monospace';
    ctx.fillText('SLING BIRDS', 10, 20);
    ctx.fillText('DRAG TO AIM & RELEASE | BIRDS: ' + birdsLeft, 10, 40);
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