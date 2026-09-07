function tankBattle(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  const TANK_R = 17, BULLET_R = 5, EBULLET_R = 5;
  let raf = null, last = 0, running = false, over = false, overSent = false;
  let score = 0, coins = 0, keys = {}, touches = {};
  let state = 'play', time = 0, shake = 0;
  let tank = null, enemies = [], bullets = [], ebullets = [], particles = [];
  let wave = 0, waveState = 'start', waveTimer = 0, spawnQueue = 0, spawnTimer = 0;
  let banner = '', bannerT = 0;

  function key(n) { return !!keys[n]; }
  function t(n) { return !!touches[n]; }

  function reset() {
    over = false; overSent = false;
    score = 0; coins = 0; time = 0; shake = 0;
    state = 'play';
    tank = { x: W / 2, y: H - 70, vx: 0, vy: 0, angle: -Math.PI / 2, turret: -Math.PI / 2,
             fireCd: 0, inv: 0, lives: 3, speed: 235 };
    enemies = []; bullets = []; ebullets = []; particles = [];
    wave = 0; waveState = 'start'; waveTimer = 1.4; spawnQueue = 0; spawnTimer = 0;
    banner = ''; bannerT = 0;
  }

  function callScore() { if (typeof onScore === 'function') onScore(score); }
  function callCoins() { if (typeof onCoins === 'function') onCoins(coins); }

  function addParticle(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 220;
      particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                       life: 0.35 + Math.random() * 0.4, t: 0, color: color, r: 2 + Math.random() * 3 });
    }
  }

  function startWave() {
    wave = wave + 1;
    spawnQueue = Math.min(2 + wave, 10);
    spawnTimer = 0.4;
    waveState = 'spawning';
    banner = 'WAVE ' + wave;
    bannerT = 1.4;
  }

  function makeEnemy(type) {
    let x = 0, y = 0;
    for (let i = 0; i < 12; i++) {
      x = 30 + Math.random() * (W - 60);
      y = 30 + Math.random() * (H * 0.45);
      if (Math.hypot(x - tank.x, y - tank.y) > 150) break;
    }
    const hp = type === 2 ? 4 : (type === 1 ? 2 : 1);
    return { x: x, y: y, vx: 0, vy: 0, type: type, hp: hp, r: type === 2 ? 19 : 15,
             fireCd: 1.2 + Math.random(), strafe: Math.random() < 0.5 ? 1 : -1 };
  }

  function gameOver() {
    if (overSent) return;
    coins = coins + wave * 2;
    callCoins();
    overSent = true; over = true; state = 'over';
    callScore();
    if (typeof onGameOver === 'function') onGameOver(score, coins);
  }

  function hitPlayer() {
    if (tank.inv > 0) return;
    tank.lives = tank.lives - 1;
    tank.inv = 1.6;
    shake = 0.4;
    addParticle(tank.x, tank.y, '#ff4d5e', 18);
    if (tank.lives <= 0) { tank.lives = 0; gameOver(); }
  }

  function update(dt) {
    time = time + dt;
    if (bannerT > 0) bannerT = bannerT - dt;
    if (shake > 0) shake = shake - dt;

    // wave management
    if (waveState === 'start') {
      waveTimer = waveTimer - dt;
      if (waveTimer <= 0) startWave();
    } else if (waveState === 'spawning') {
      spawnTimer = spawnTimer - dt;
      if (spawnTimer <= 0 && spawnQueue > 0) {
        let type = 0;
        const r = Math.random();
        if (wave >= 3 && r < 0.22) type = 2;
        else if (wave >= 2 && r < 0.5) type = 1;
        enemies.push(makeEnemy(type));
        spawnQueue = spawnQueue - 1;
        spawnTimer = 0.7;
      }
      if (spawnQueue <= 0 && enemies.length === 0) {
        waveState = 'clear';
        const bonus = 40 + wave * 10;
        score = score + bonus; callScore();
        coins = coins + 1 + wave; callCoins();
        banner = 'WAVE CLEAR +' + bonus;
        bannerT = 1.2;
        waveTimer = 1.8;
      }
    } else if (waveState === 'clear') {
      waveTimer = waveTimer - dt;
      if (waveTimer <= 0) startWave();
    }

    // input vector (left stick / WASD)
    let mx = (t('right') ? 1 : 0) - (t('left') ? 1 : 0);
    let my = (t('down') ? 1 : 0) - (t('up') ? 1 : 0);
    if (mx === 0 && my === 0) {
      mx = (key('ArrowRight') || key('KeyD') ? 1 : 0) - (key('ArrowLeft') || key('KeyA') ? 1 : 0);
      my = (key('ArrowDown') || key('KeyS') ? 1 : 0) - (key('ArrowUp') || key('KeyW') ? 1 : 0);
    }
    const ml = Math.hypot(mx, my);
    if (ml > 0) { mx = mx / ml; my = my / ml; }

    tank.vx = tank.vx + (mx * tank.speed - tank.vx) * Math.min(1, 8 * dt);
    tank.vy = tank.vy + (my * tank.speed - tank.vy) * Math.min(1, 8 * dt);
    tank.x = tank.x + tank.vx * dt;
    tank.y = tank.y + tank.vy * dt;
    tank.x = Math.max(24, Math.min(W - 24, tank.x));
    tank.y = Math.max(24, Math.min(H - 24, tank.y));
    if (ml > 0.1) tank.angle = Math.atan2(my, mx);
    if (tank.inv > 0) tank.inv = tank.inv - dt;
    if (tank.fireCd > 0) tank.fireCd = tank.fireCd - dt;

    // turret auto-aims nearest enemy, limited turn speed
    let ti = -1, best = 1e9;
    for (let i = 0; i < enemies.length; i++) {
      const d = Math.hypot(enemies[i].x - tank.x, enemies[i].y - tank.y);
      if (d < best) { best = d; ti = i; }
    }
    let want = tank.turret;
    if (ti >= 0) want = Math.atan2(enemies[ti].y - tank.y, enemies[ti].x - tank.x);
    else if (ml > 0.1) want = Math.atan2(my, mx);
    let diff = want - tank.turret;
    while (diff > Math.PI) diff = diff - Math.PI * 2;
    while (diff < -Math.PI) diff = diff + Math.PI * 2;
    const turn = 7 * dt;
    tank.turret = tank.turret + Math.max(-turn, Math.min(turn, diff));

    // fire
    if ((t('action') || key('Space')) && tank.fireCd <= 0) {
      tank.fireCd = 0.24;
      bullets.push({ x: tank.x + Math.cos(tank.turret) * 22, y: tank.y + Math.sin(tank.turret) * 22,
                     vx: Math.cos(tank.turret) * 430, vy: Math.sin(tank.turret) * 430, life: 2.2 });
    }

    // player bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x = b.x + b.vx * dt; b.y = b.y + b.vy * dt; b.life = b.life - dt;
      let dead = b.life <= 0 || b.x < 0 || b.x > W || b.y < 0 || b.y > H;
      if (!dead) {
        for (let j = enemies.length - 1; j >= 0; j--) {
          const e = enemies[j];
          if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + BULLET_R) {
            e.hp = e.hp - 1;
            addParticle(b.x, b.y, '#ffd93b', 6);
            if (e.hp <= 0) {
              addParticle(e.x, e.y, e.type === 1 ? '#3bc9ff' : (e.type === 2 ? '#ff7a3b' : '#ff4d5e'), 16);
              const pts = (e.type === 2 ? 30 : (e.type === 1 ? 20 : 10)) + Math.round(wave * 1.5);
              score = score + pts; callScore();
              coins = coins + 2; callCoins();
              enemies.splice(j, 1);
            }
            dead = true;
            break;
          }
        }
      }
      if (dead) bullets.splice(i, 1);
    }

    // enemies
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      const dx = tank.x - e.x, dy = tank.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d;
      if (e.type === 0) {
        const sp = 55 + wave * 6;
        e.x = e.x + ux * sp * dt; e.y = e.y + uy * sp * dt;
      } else if (e.type === 1) {
        const sp = 95;
        let mvx = 0, mvy = 0;
        if (d > 200) { mvx = ux * sp; mvy = uy * sp; }
        else if (d < 150) { mvx = -ux * sp; mvy = -uy * sp; }
        else { mvx = -uy * e.strafe * sp * 0.7; mvy = ux * e.strafe * sp * 0.7; }
        e.x = e.x + mvx * dt; e.y = e.y + mvy * dt;
        e.fireCd = e.fireCd - dt;
        if (e.fireCd <= 0 && d < 420) {
          e.fireCd = 1.5 + Math.random() * 0.6;
          const angE = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.16;
          ebullets.push({ x: e.x, y: e.y, vx: Math.cos(angE) * 235, vy: Math.sin(angE) * 235, life: 3.4 });
        }
      } else {
        const sp = 40 + wave * 2;
        e.x = e.x + ux * sp * dt; e.y = e.y + uy * sp * dt;
        e.fireCd = e.fireCd - dt;
        if (e.fireCd <= 0 && d < 300) {
          e.fireCd = 2.2 + Math.random() * 0.8;
          const angE = Math.atan2(dy, dx);
          ebullets.push({ x: e.x, y: e.y, vx: Math.cos(angE) * 190, vy: Math.sin(angE) * 190, life: 3.8 });
        }
      }
      // separation
      for (let j = i + 1; j < enemies.length; j++) {
        const o = enemies[j];
        const dx2 = o.x - e.x, dy2 = o.y - e.y;
        const d2 = Math.hypot(dx2, dy2) || 1;
        if (d2 < e.r + o.r) {
          const push = (e.r + o.r - d2) / 2;
          const px = dx2 / d2 * push, py = dy2 / d2 * push;
          e.x = e.x - px; e.y = e.y - py; o.x = o.x + px; o.y = o.y + py;
        }
      }
      e.x = Math.max(20, Math.min(W - 20, e.x));
      e.y = Math.max(14, Math.min(H - 14, e.y));
      // ram the player
      if (tank.inv <= 0 && Math.hypot(tank.x - e.x, tank.y - e.y) < TANK_R + e.r) {
        hitPlayer();
        e.x = e.x - ux * 26; e.y = e.y - uy * 26;
      }
    }

    // enemy bullets
    for (let i = ebullets.length - 1; i >= 0; i--) {
      const b = ebullets[i];
      b.x = b.x + b.vx * dt; b.y = b.y + b.vy * dt; b.life = b.life - dt;
      let dead = b.life <= 0 || b.x < 0 || b.x > W || b.y < 0 || b.y > H;
      if (!dead && tank.inv <= 0 && Math.hypot(b.x - tank.x, b.y - tank.y) < TANK_R + EBULLET_R) {
        hitPlayer();
        dead = true;
      }
      if (dead) ebullets.splice(i, 1);
    }

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t = p.t + dt;
      if (p.t >= p.life) { particles.splice(i, 1); continue; }
      p.x = p.x + p.vx * dt; p.y = p.y + p.vy * dt;
      p.vx = p.vx * (1 - 2.2 * dt); p.vy = p.vy * (1 - 2.2 * dt);
    }

    render();
  }

  function glowCircle(x, y, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function glowRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = 12;
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
  }

  function neonText(txt, x, y, size, color) {
    ctx.font = 'bold ' + size + 'px "Courier New", monospace';
    ctx.fillStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.fillText(txt, x, y);
    ctx.shadowBlur = 0;
  }

  function drawTank() {
    if (tank.inv > 0 && Math.floor(time * 12) % 2 === 0) return;
    const c = '#4dff88';
    ctx.save();
    ctx.translate(tank.x, tank.y);
    ctx.rotate(tank.angle);
    ctx.shadowColor = c; ctx.shadowBlur = 16;
    ctx.fillStyle = c;
    ctx.fillRect(-16, -12, 32, 24);
    ctx.strokeStyle = '#1c8f52'; ctx.lineWidth = 3;
    ctx.strokeRect(-16, -12, 32, 24);
    ctx.restore();
    ctx.save();
    ctx.translate(tank.x, tank.y);
    ctx.rotate(tank.turret);
    ctx.shadowColor = c; ctx.shadowBlur = 13;
    ctx.fillStyle = '#c8ffe0';
    ctx.fillRect(0, -4, 25, 8);
    ctx.restore();
    ctx.shadowBlur = 0;
    glowCircle(tank.x, tank.y, 8, '#eafff2');
  }

  function drawEnemy(e) {
    const cols = ['#ff4d5e', '#3bc9ff', '#ff7a3b'];
    const c = cols[e.type];
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.shadowColor = c; ctx.shadowBlur = 14;
    ctx.fillStyle = c;
    ctx.beginPath();
    if (e.type === 0) {
      ctx.moveTo(0, -e.r); ctx.lineTo(e.r, 0); ctx.lineTo(0, e.r); ctx.lineTo(-e.r, 0);
    } else if (e.type === 1) {
      ctx.moveTo(0, -e.r); ctx.lineTo(e.r, e.r * 0.8); ctx.lineTo(-e.r, e.r * 0.8);
    } else {
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * Math.PI * 2 + Math.PI / 6;
        const px = Math.cos(a) * e.r, py = Math.sin(a) * e.r;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    if (e.hp > 1) {
      const maxHp = e.type === 2 ? 4 : 2;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(-e.r, e.r + 4, e.r * 2, 4);
      ctx.fillStyle = c;
      ctx.fillRect(-e.r, e.r + 4, e.r * 2 * (e.hp / maxHp), 4);
    }
    if (e.type === 1 || e.type === 2) {
      const a = Math.atan2(tank.y - e.y, tank.x - e.x);
      ctx.strokeStyle = c; ctx.lineWidth = 4;
      ctx.shadowColor = c; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * (e.r + 10), Math.sin(a) * (e.r + 10));
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  function render() {
    ctx.fillStyle = '#07070f';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(80,90,160,0.10)';
    ctx.lineWidth = 1;
    for (let gx = 40; gx < W; gx = gx + 40) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }
    for (let gy = 40; gy < H; gy = gy + 40) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(120,140,255,0.25)';
    ctx.strokeRect(2, 2, W - 4, H - 4);

    if (shake > 0) {
      ctx.save();
      ctx.translate((Math.random() - 0.5) * 10 * shake, (Math.random() - 0.5) * 10 * shake);
    }

    for (let i = 0; i < bullets.length; i++) glowCircle(bullets[i].x, bullets[i].y, BULLET_R, '#9bff3b');
    for (let i = 0; i < ebullets.length; i++) glowCircle(ebullets[i].x, ebullets[i].y, EBULLET_R, '#ff5d3b');
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      ctx.globalAlpha = 1 - p.t / p.life;
      glowCircle(p.x, p.y, p.r, p.color);
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < enemies.length; i++) drawEnemy(enemies[i]);
    drawTank();
    if (shake > 0) ctx.restore();

    ctx.textAlign = 'left';
    neonText('TANK BATTLE', 14, 16, 15, '#7df9ff');
    neonText('MOVE: STICK/WASD  FIRE: SPACE/A', 14, 33, 10, '#8a93b8');
    ctx.textAlign = 'right';
    neonText('SCORE ' + score, W - 14, 20, 16, '#ffd93b');
    neonText('WAVE ' + Math.max(wave, 1), W - 14, 38, 12, '#a6a8d0');
    ctx.textAlign = 'left';
    neonText('LIVES', 14, H - 34, 10, '#8a93b8');
    for (let i = 0; i < tank.lives; i++) glowRect(14 + i * 26, H - 26, 18, 13, '#ff4d5e');

    if (bannerT > 0 && banner !== '') {
      ctx.textAlign = 'center';
      neonText(banner, W / 2, 112, 26, '#ffffff');
      ctx.textAlign = 'left';
    }
    if (state === 'over') {
      ctx.fillStyle = 'rgba(4,4,10,0.72)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      neonText('GAME OVER', W / 2, 180, 44, '#ff4d5e');
      neonText('SCORE ' + score, W / 2, 232, 24, '#ffd93b');
      neonText('WAVES ' + wave + '  COINS +' + coins, W / 2, 264, 16, '#3bff8f');
      ctx.textAlign = 'left';
    }
  }

  function loop(ts) {
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    if (running && !over) update(dt);
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
  function destroy() { running = false; over = true; cancelAnimationFrame(raf); }
  function setInput(ts, ks) { touches = ts || {}; keys = ks || {}; }

  return { start: start, pause: pause, resume: resume, destroy: destroy, setInput: setInput };
}