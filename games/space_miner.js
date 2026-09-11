function spaceMiner(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, overSent = false;
  let score = 0, coins = 0, keys = {}, touches = {};
  let time = 0, state = 'play', shake = 0, combo = 0;
  
  // Player ship
  let ship = { x: W/2, y: H - 80, w: 48, h: 48, hp: 3, maxHp: 3, level: 1, xp: 0, xpToNext: 50 };
  
  // Upgrades
  let upgrades = {
    drill: 1,      // mining speed
    hull: 1,       // max HP
    cargo: 1,      // coin multiplier
    scanner: 1,    // rare mineral chance
    thruster: 1    // move speed
  };
  
  // Asteroids
  let asteroids = [];
  let particles = [];
  let minerals = [];  // floating mineral pickups
  
  // Boss
  let boss = null;
  let bossTimer = 0;
  let wave = 1;
  let asteroidsDestroyed = 0;
  let difficultyMult = 1;   // v7.18 difficulty ramp
  
  function key(n) { return !!keys[n]; }
  function t(n) { return !!touches[n]; }
  
  function reset() {
    over = false; overSent = false;
    score = 0; coins = 0; time = 0; combo = 0; shake = 0;
    state = 'play'; wave = 1; asteroidsDestroyed = 0; bossTimer = 0;
    ship = { x: W/2, y: H - 80, w: 48, h: 48, hp: 3, maxHp: 3, level: 1, xp: 0, xpToNext: 50 };
    upgrades = { drill: 1, hull: 1, cargo: 1, scanner: 1, thruster: 1 };
    asteroids = []; particles = []; minerals = []; boss = null;
    spawnWave();
  }
  
  function callScore() { if (typeof onScore === 'function') onScore(score); }
  function callCoins() { if (typeof onCoins === 'function') onCoins(coins); }
  
  function spawnWave() {
    asteroids = [];
    const count = 5 + wave * 2;
    for (let i = 0; i < count; i++) {
      const size = 30 + Math.random() * 50;
      const type = Math.random() < 0.7 ? 'common' : (Math.random() < 0.9 ? 'rare' : 'legendary');
      asteroids.push({
        x: Math.random() * (W - 100) + 50,
        y: -size - Math.random() * 300,
        size: size,
        hp: size * (type === 'legendary' ? 3 : type === 'rare' ? 2 : 1),
        maxHp: size * (type === 'legendary' ? 3 : type === 'rare' ? 2 : 1),
        type: type,
        speed: (30 + wave * 5 + Math.random() * 20) * difficultyMult,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.02,
        value: Math.floor(size / 2) * (type === 'legendary' ? 10 : type === 'rare' ? 5 : 1),
        color: type === 'legendary' ? '#FFD700' : type === 'rare' ? '#00FFFF' : '#888888'
      });
    }
    if (wave % 5 === 0) spawnBoss();
  }
  
  function spawnBoss() {
    boss = {
      x: W/2, y: -120,
      size: 120, hp: 500 + wave * 100, maxHp: 500 + wave * 100,
      phase: 1, timer: 0, pattern: 0,
      color: '#FF3B6B', value: 500 + wave * 50
    };
  }
  
  function die() {
    if (overSent) return;
    overSent = true; over = true; state = 'over';
    callScore();
    if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
    if (typeof onGameOver === 'function') onGameOver(score, coins);
  }
  
  function takeDamage(amount) {
    ship.hp -= amount;
    shake = 0.3;
    if (typeof window.playSfx === 'function') { try { window.playSfx('error'); } catch (e) {} }
    if (ship.hp <= 0) die();
  }
  
  function heal(amount) {
    ship.hp = Math.min(ship.maxHp, ship.hp + amount);
  }
  
  function addXP(amount) {
    ship.xp += amount;
    while (ship.xp >= ship.xpToNext) {
      ship.xp -= ship.xpToNext;
      ship.level++;
      ship.xpToNext = Math.floor(ship.xpToNext * 1.5);
      // Level up bonus
      heal(1);
      score += 50; callScore();
      if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
    }
  }
  
  function collectMineral(m) {
    const mult = upgrades.cargo;
    score += m.value * mult; callScore();
    coins += m.coinValue * mult; callCoins();
    if (typeof window.playSfx === 'function') { try { window.playSfx('coin'); } catch (e) {} }
    addXP(m.value);
    // particle burst
    for (let i = 0; i < 8; i++) {
      particles.push({
        x: m.x, y: m.y,
        vx: (Math.random()-0.5)*8, vy: (Math.random()-0.5)*8,
        life: 1, color: m.color, size: 3+Math.random()*3
      });
    }
  }
  
  function destroyAsteroid(ast, isBoss) {
    asteroidsDestroyed++;
    if (typeof window.playSfx === 'function') { try { window.playSfx(isBoss ? 'win2' : 'pop'); } catch (e) {} }
    if (isBoss && navigator.vibrate) { try { navigator.vibrate([60, 30, 80]); } catch (e) {} }
    // spawn minerals
    const mineralCount = isBoss ? 15 : (ast.type === 'legendary' ? 5 : ast.type === 'rare' ? 3 : 2);
    for (let i = 0; i < mineralCount; i++) {
      minerals.push({
        x: ast.x + (Math.random()-0.5)*ast.size,
        y: ast.y + (Math.random()-0.5)*ast.size,
        vx: (Math.random()-0.5)*3, vy: (Math.random()-0.5)*3 + 1,
        value: ast.value * (isBoss ? 5 : 1),
        coinValue: isBoss ? 3 : (ast.type === 'legendary' ? 2 : 1),
        color: ast.color, size: 6, life: 8
      });
    }
    // particles
    for (let i = 0; i < 20; i++) {
      particles.push({
        x: ast.x, y: ast.y,
        vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10,
        life: 1, color: ast.color, size: 2+Math.random()*4
      });
    }
    if (isBoss) {
      score += ast.value * upgrades.cargo; callScore();
      coins += 10 * upgrades.cargo; callCoins();
      wave++;
      boss = null;
      bossTimer = 120; // 2 sec before next wave
      if (wave % 5 !== 0) setTimeout(spawnWave, 2000);
    } else {
      // check wave clear
      const remaining = asteroids.filter(a => a.hp > 0).length;
      if (remaining === 0 && !boss) {
        wave++;
        bossTimer = 60;
      }
    }
  }
  
  function mineAsteroid(ast) {
    const dmg = 10 * upgrades.drill;
    ast.hp -= dmg;
    // hit particles
    for (let i = 0; i < 3; i++) {
      particles.push({
        x: ast.x + (Math.random()-0.5)*ast.size,
        y: ast.y + (Math.random()-0.5)*ast.size,
        vx: (Math.random()-0.5)*4, vy: (Math.random()-0.5)*4,
        life: 0.5, color: '#FFFF00', size: 2
      });
    }
    if (ast.hp <= 0) destroyAsteroid(ast, false);
  }
  
  function damageBoss(amount) {
    if (!boss) return;
    boss.hp -= amount;
    shake = 0.2;
    for (let i = 0; i < 5; i++) {
      particles.push({
        x: boss.x + (Math.random()-0.5)*boss.size,
        y: boss.y + (Math.random()-0.5)*boss.size,
        vx: (Math.random()-0.5)*6, vy: (Math.random()-0.5)*6,
        life: 0.5, color: '#FF6666', size: 3
      });
    }
    if (boss.hp <= 0) destroyAsteroid(boss, true);
  }
  
  function input() {
    // Movement
    const speed = 5 * upgrades.thruster;
    if (key('ArrowLeft') || key('KeyA') || t('left')) ship.x -= speed;
    if (key('ArrowRight') || key('KeyD') || t('right')) ship.x += speed;
    if (key('ArrowUp') || key('KeyW') || t('up')) ship.y -= speed;
    if (key('ArrowDown') || key('KeyS') || t('down')) ship.y += speed;
    
    // Clamp
    ship.x = Math.max(ship.w/2, Math.min(W - ship.w/2, ship.x));
    ship.y = Math.max(ship.h/2, Math.min(H - ship.h/2, ship.y));
    
    // Mining (hold space/action to mine nearest asteroid)
    const mining = key('Space') || key('KeyE') || t('action');
    if (mining) {
      // Find nearest asteroid in range
      let nearest = null, nearestDist = 120;
      for (const ast of asteroids) {
        if (ast.hp > 0) {
          const dx = ast.x - ship.x;
          const dy = ast.y - ship.y;
          const dist = Math.hypot(dx, dy);
          if (dist < nearestDist) { nearest = ast; nearestDist = dist; }
        }
      }
      if (boss && boss.hp > 0) {
        const dx = boss.x - ship.x;
        const dy = boss.y - ship.y;
        const dist = Math.hypot(dx, dy);
        if (dist < nearestDist) { nearest = boss; nearestDist = dist; }
      }
      if (nearest) {
        if (nearest === boss) damageBoss(5 * upgrades.drill);
        else mineAsteroid(nearest);
      }
    }
    
    // Auto-collect minerals in range
    for (let i = minerals.length - 1; i >= 0; i--) {
      const m = minerals[i];
      const dx = m.x - ship.x;
      const dy = m.y - ship.y;
      if (Math.hypot(dx, dy) < 50) {
        collectMineral(m);
        minerals.splice(i, 1);
      }
    }
  }
  
  function update(dt) {
    time += dt;
    if (shake > 0) shake -= dt;
    
    if (bossTimer > 0) {
      bossTimer -= dt;
      if (bossTimer <= 0 && !boss && asteroids.filter(a => a.hp > 0).length === 0) {
        spawnWave();
      }
    }
    
    input();
    
    // Update asteroids
    for (const ast of asteroids) {
      ast.y += ast.speed * dt;
      ast.rotation += ast.rotSpeed * dt;
      // Remove if off screen bottom
      if (ast.y - ast.size > H + 50) {
        ast.hp = 0; // missed
      }
    }
    // Remove dead asteroids
    for (let i = asteroids.length - 1; i >= 0; i--) {
      if (asteroids[i].hp <= 0) {
        if (asteroids[i].hp === 0 && asteroidsDestroyed > 0) {
          // already handled by destroyAsteroid
        }
        asteroids.splice(i, 1);
      }
    }
    
    // Boss behavior
    if (boss) {
      boss.timer += dt;
      boss.y = Math.min(boss.y + 20 * dt, 150); // descend to position
      
      // Boss patterns
      boss.pattern = Math.floor(boss.timer / 3) % 4;
      switch(boss.pattern) {
        case 0: // horizontal sweep
          boss.x = W/2 + Math.sin(boss.timer * 2) * (W/2 - 80);
          break;
        case 1: // vertical pulse
          boss.y = 150 + Math.sin(boss.timer * 4) * 30;
          break;
        case 2: // circle
          boss.x = W/2 + Math.cos(boss.timer) * (W/2 - 100);
          boss.y = 150 + Math.sin(boss.timer) * 80;
          break;
        case 3: // stay center, spawn mini asteroids
          if (Math.random() < 0.02) {
            asteroids.push({
              x: boss.x + (Math.random()-0.5)*80,
              y: boss.y + boss.size/2,
              size: 25, hp: 30, maxHp: 30,
              type: 'common', speed: 60, rotation: 0, rotSpeed: 0.01,
              value: 10, color: '#FF6666'
            });
          }
          break;
      }
      
      // Boss collision with ship
      const dx = boss.x - ship.x;
      const dy = boss.y - ship.y;
      if (Math.hypot(dx, dy) < boss.size/2 + ship.w/2) {
        takeDamage(1);
      }
    }
    
    // Update minerals
    for (let i = minerals.length - 1; i >= 0; i--) {
      const m = minerals[i];
      m.x += m.vx * dt * 60;
      m.y += m.vy * dt * 60;
      m.life -= dt;
      m.vy += 0.5 * dt * 60; // gravity
      if (m.life <= 0 || m.y > H + 50) minerals.splice(i, 1);
    }
    
    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    
    // Check collisions: ship vs asteroids
    for (const ast of asteroids) {
      const dx = ast.x - ship.x;
      const dy = ast.y - ship.y;
      if (Math.hypot(dx, dy) < ast.size/2 + ship.w/2) {
        takeDamage(1);
        ast.hp = 0; // destroy on collision
        destroyAsteroid(ast, false);
      }
    }
    
    // Win condition (endless but track high score)
    if (score > 100000) {
      // just keep going
    }
    
    render();
  }
  
  function drawShip() {
    const cx = ship.x, cy = ship.y;
    ctx.save();
    ctx.translate(cx, cy);
    if (shake > 0) ctx.translate(Math.sin(time*50)*shake*10, Math.cos(time*50)*shake*10);
    
    // Engine glow
    const engineGlow = ctx.createRadialGradient(0, ship.h/2, 5, 0, ship.h/2, 25);
    engineGlow.addColorStop(0, '#00FFFF');
    engineGlow.addColorStop(1, 'rgba(0,255,255,0)');
    ctx.fillStyle = engineGlow;
    ctx.beginPath();
    ctx.ellipse(0, ship.h/2, 15, 25, 0, 0, Math.PI*2);
    ctx.fill();
    
    // Ship body
    ctx.fillStyle = '#444';
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00FFFF';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, -ship.h/2);
    ctx.lineTo(-ship.w/2, ship.h/2);
    ctx.lineTo(0, ship.h/2 - 8);
    ctx.lineTo(ship.w/2, ship.h/2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    // Cockpit
    ctx.fillStyle = '#00FFFF88';
    ctx.beginPath();
    ctx.ellipse(0, -8, 8, 6, 0, 0, Math.PI*2);
    ctx.fill();
    
    // Mining laser indicator
    if (key('Space') || key('KeyE') || t('action')) {
      ctx.strokeStyle = '#00FFFF';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(0, -ship.h/2);
      ctx.lineTo(0, -H);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    ctx.restore();
  }
  
  function drawAsteroid(ast) {
    ctx.save();
    ctx.translate(ast.x, ast.y);
    ctx.rotate(ast.rotation);
    
    // Asteroid shape (irregular polygon)
    const spikes = 8;
    ctx.fillStyle = ast.color;
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 2;
    ctx.shadowColor = ast.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (let i = 0; i <= spikes; i++) {
      const angle = (i / spikes) * Math.PI * 2;
      const r = ast.size/2 * (0.7 + Math.sin(ast.rotation*5 + i) * 0.3);
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    // HP bar
    if (ast.hp < ast.maxHp) {
      ctx.fillStyle = '#333';
      ctx.fillRect(-ast.size/2, -ast.size/2 - 10, ast.size, 5);
      ctx.fillStyle = ast.hp / ast.maxHp > 0.5 ? '#39FF88' : (ast.hp / ast.maxHp > 0.25 ? '#FFE600' : '#FF3B6B');
      ctx.fillRect(-ast.size/2, -ast.size/2 - 10, ast.size * (ast.hp/ast.maxHp), 5);
    }
    
    // Type indicator
    if (ast.type !== 'common') {
      ctx.fillStyle = ast.type === 'legendary' ? '#FFD700' : '#00FFFF';
      ctx.font = 'bold 10px Orbitron';
      ctx.textAlign = 'center';
      ctx.fillText(ast.type.toUpperCase()[0], 0, 4);
      ctx.textAlign = 'left';
    }
    
    ctx.restore();
  }
  
  function drawBoss() {
    if (!boss) return;
    ctx.save();
    ctx.translate(boss.x, boss.y);
    
    // Boss glow
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, boss.size);
    glow.addColorStop(0, 'rgba(255,59,107,0.3)');
    glow.addColorStop(1, 'rgba(255,59,107,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, boss.size, 0, Math.PI*2);
    ctx.fill();
    
    // Boss body
    ctx.fillStyle = boss.color;
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 3;
    ctx.shadowColor = boss.color;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    // Star-like shape
    const spikes = 12;
    for (let i = 0; i <= spikes; i++) {
      const angle = (i / spikes) * Math.PI * 2;
      const r = i % 2 === 0 ? boss.size/2 : boss.size/3;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    // Core
    ctx.fillStyle = '#FF0000';
    ctx.shadowColor = '#FF0000';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(0, 0, boss.size/4, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // HP bar
    ctx.fillStyle = '#333';
    ctx.fillRect(-boss.size/2, -boss.size/2 - 20, boss.size, 8);
    ctx.fillStyle = boss.hp / boss.maxHp > 0.5 ? '#39FF88' : (boss.hp / boss.maxHp > 0.25 ? '#FFE600' : '#FF3B6B');
    ctx.fillRect(-boss.size/2, -boss.size/2 - 20, boss.size * (boss.hp/boss.maxHp), 8);
    
    ctx.restore();
  }
  
  function drawMineral(m) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(time * 2);
    ctx.fillStyle = m.color;
    ctx.shadowColor = m.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    // Diamond shape
    ctx.moveTo(0, -m.size);
    ctx.lineTo(m.size, 0);
    ctx.lineTo(0, m.size);
    ctx.lineTo(-m.size, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
  
  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  
  function drawMinerals() {
    for (const m of minerals) drawMineral(m);
  }
  
  function drawAsteroids() {
    for (const ast of asteroids) if (ast.hp > 0) drawAsteroid(ast);
    if (boss) drawBoss();
  }
  
  function drawUI() {
    // Top bar
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, 60);
    
    // Score
    ctx.font = 'bold 24px Orbitron';
    ctx.fillStyle = '#FFE600';
    ctx.shadowColor = '#FFE600';
    ctx.shadowBlur = 10;
    ctx.textAlign = 'left';
    ctx.fillText('SCORE: ' + score.toLocaleString(), 20, 40);
    ctx.shadowBlur = 0;
    
    // Wave
    ctx.font = '16px Orbitron';
    ctx.fillStyle = '#00FFFF';
    ctx.textAlign = 'center';
    ctx.fillText('WAVE ' + wave, W/2, 35);
    
    // Coins
    ctx.font = '16px Orbitron';
    ctx.fillStyle = '#FFE600';
    ctx.textAlign = 'right';
    ctx.fillText('COINS: ' + coins.toLocaleString() + ' 💰', W - 20, 35);
    
    // Level/XP
    ctx.font = '12px Space Grotesk';
    ctx.fillStyle = '#8A93A6';
    ctx.textAlign = 'left';
    ctx.fillText('LVL ' + ship.level, 20, 58);
    
    // XP bar
    const xpW = 100 * (ship.xp / ship.xpToNext);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(60, 54, 100, 6);
    ctx.fillStyle = '#00FFFF';
    ctx.fillRect(60, 54, xpW, 6);
    
    // HP
    ctx.fillStyle = '#FF3B6B';
    for (let i = 0; i < ship.maxHp; i++) {
      ctx.fillStyle = i < ship.hp ? '#FF3B6B' : 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.arc(W - 100 + i * 20, 55, 8, 0, Math.PI*2);
      ctx.fill();
    }
    
    // Upgrades display (bottom)
    ctx.font = '10px Space Grotesk';
    ctx.fillStyle = '#8A93A6';
    ctx.textAlign = 'center';
    const upgNames = ['DRILL', 'HULL', 'CARGO', 'SCANNER', 'THRUST'];
    const upgVals = [upgrades.drill, upgrades.hull, upgrades.cargo, upgrades.scanner, upgrades.thruster];
    for (let i = 0; i < 5; i++) {
      const x = 80 + i * 150;
      ctx.fillStyle = '#8A93A6';
      ctx.fillText(upgNames[i], x, H - 15);
      ctx.fillStyle = '#00FFFF';
      ctx.fillText('Lv.' + upgVals[i], x, H - 3);
    }
    ctx.textAlign = 'left';
  }
  
  function render() {
    // Space background
    ctx.fillStyle = '#050515';
    ctx.fillRect(0, 0, W, H);
    
    // Stars
    for (let i = 0; i < 100; i++) {
      const x = (i * 37 + time * 10) % W;
      const y = (i * 73) % H;
      ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.sin(time + i) * 0.2})`;
      ctx.beginPath();
      ctx.arc(x, y, 1 + (i % 3) * 0.5, 0, Math.PI*2);
      ctx.fill();
    }
    
    drawMinerals();
    drawAsteroids();
    drawParticles();
    drawShip();
    drawUI();
    
    // Game over overlay
    if (state === 'over') {
      ctx.fillStyle = 'rgba(0,0,10,0.9)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.font = 'bold 48px "Press Start 2P"';
      ctx.fillStyle = '#FF3B6B';
      ctx.shadowColor = '#FF3B6B';
      ctx.shadowBlur = 20;
      ctx.fillText('MISSION FAILED', W/2, H/2 - 60);
      ctx.shadowBlur = 0;
      ctx.font = '24px Orbitron';
      ctx.fillStyle = '#FFE600';
      ctx.fillText('ORE MINED: ' + score.toLocaleString(), W/2, H/2);
      ctx.fillStyle = '#00FFFF';
      ctx.fillText('COINS: +' + coins.toLocaleString(), W/2, H/2 + 40);
      ctx.font = '16px Space Grotesk';
      ctx.fillStyle = '#8A93A6';
      ctx.fillText('TAP TO RETRY', W/2, H/2 + 100);
      ctx.textAlign = 'left';
    }
    
    // Boss warning
    if (bossTimer > 0 && bossTimer < 3 && !boss) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 32px "Press Start 2P"';
      ctx.fillStyle = '#FF3B6B';
      ctx.shadowColor = '#FF3B6B';
      ctx.shadowBlur = 20;
      ctx.fillText('⚠ BOSS INCOMING ⚠', W/2, H/2);
      ctx.shadowBlur = 0;
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
  function getHelp() { return 'MOVE: ARROWS/WASD · MINE: HOLD SPACE/E · COLLECT MINERALS · UPGRADE SHIP · DEFEAT BOSSES'; }
  function setDifficulty(level) {
    const m = [1.0, 1.15, 1.3, 1.5, 1.75, 2.0];
    const l = Math.max(0, Math.min(5, Math.floor(level) || 0));
    difficultyMult = m[l];
  }
  
  return { start, pause, resume, destroy, setInput, getHelp, setDifficulty };
}