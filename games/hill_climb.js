/* ============================================================
   Hill Climb — Side-scroll hill climb racer
   Canvas 800x450, procedural terrain, gravity + suspension
   Hold right = gas, left = brake. Fuel depletes, collect cans.
   Car flip = game over. Coins + upgrades.
   ============================================================ */
function hillClimb(canvas, ctx, onScore, onGameOver, onCoins) {
  // ---- state ----
  const W = 800, H = 450;
  let raf = null, last = 0, running = false;
  let score = 0, coins = 0;
  let over = false;

  // terrain
  let terrainSeed = 0;
  const TERRAIN_SEGMENTS = 200;
  const SEGMENT_W = 40;
  let terrain = [];
  let cameraX = 0;
  let maxDistance = 0;

  // car physics
  const GRAVITY = 980;
  const CAR_W = 60;
  const CAR_H = 24;
  const WHEEL_R = 10;
  const WHEEL_BASE = 44;

  let car = {
    x: 200, y: 200,
    vx: 0, vy: 0,
    angle: 0,
    angularVel: 0,
    frontWheelY: 0,
    rearWheelY: 0,
    onGround: false
  };

  // fuel
  let fuel = 100;
  let maxFuel = 100;
  let fuelDepleteRate = 8; // per second when driving

  // upgrades (level 1-5)
  let upgrades = {
    engine: 1,
    tire: 1,
    fuel: 1
  };

  // collectibles
  let fuelCans = [];
  let coinItems = [];
  let spawnTimer = 0;

  // terrain objects (bushes, rocks for depth)
  let bgObjects = [];

  // input
  let touches = { left: false, right: false, boost: false, drift: false };
  let keys = {};

  // ---- helpers ----
  function rect(x, y, w, h, color, glow) {
    ctx.shadowBlur = glow || 12;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
  }

  function circle(x, y, r, color, glow) {
    ctx.shadowBlur = glow || 14;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // simple hash for procedural terrain
  function hash(x) {
    let h = Math.sin(x * 127.1 + terrainSeed * 311.7) * 43758.5453;
    return h - Math.floor(h);
  }

  function noise(x) {
    const i = Math.floor(x);
    const f = x - i;
    const t = f * f * (3 - 2 * f); // smoothstep
    return hash(i) * (1 - t) + hash(i + 1) * t;
  }

  function generateTerrain() {
    terrain = [];
    for (let i = 0; i < TERRAIN_SEGMENTS; i++) {
      const x = i * SEGMENT_W;
      // multi-octave noise for hills
      const baseH = H * 0.65;
      const h1 = noise(i * 0.02) * 200;
      const h2 = noise(i * 0.05) * 80;
      const h3 = noise(i * 0.1) * 30;
      const y = baseH - h1 - h2 - h3;
      terrain.push({ x, y });
    }
    // background objects
    bgObjects = [];
    for (let i = 0; i < 80; i++) {
      bgObjects.push({
        x: Math.random() * TERRAIN_SEGMENTS * SEGMENT_W,
        type: Math.random() < 0.5 ? 'tree' : 'rock',
        size: 10 + Math.random() * 20,
        depth: 0.3 + Math.random() * 0.4
      });
    }
  }

  function getTerrainY(worldX) {
    const idx = worldX / SEGMENT_W;
    const i = Math.floor(idx);
    const f = idx - i;
    if (i < 0) return terrain[0].y;
    if (i >= terrain.length - 1) return terrain[terrain.length - 1].y;
    // lerp between segments
    return terrain[i].y + (terrain[i + 1].y - terrain[i].y) * f;
  }

  function getTerrainNormal(worldX) {
    const dx = 2;
    const y1 = getTerrainY(worldX - dx);
    const y2 = getTerrainY(worldX + dx);
    const angle = Math.atan2(y2 - y1, dx * 2);
    return angle;
  }

  function reset() {
    score = 0; coins = 0; over = false;
    terrainSeed = Math.random() * 1000;
    generateTerrain();
    cameraX = 0;
    maxDistance = 0;
    fuel = 100;
    maxFuel = 100;
    fuelDepleteRate = 8;
    fuelCans = [];
    coinItems = [];
    spawnTimer = 0;
    upgrades = { engine: 1, tire: 1, fuel: 1 };

    car.x = 200;
    car.y = getTerrainY(200) - 30;
    car.vx = 0;
    car.vy = 0;
    car.angle = 0;
    car.angularVel = 0;
    car.onGround = false;
  }

  function spawnCollectibles() {
    const spawnX = cameraX + W + 200;
    const idx = Math.floor(spawnX / SEGMENT_W);
    if (idx < terrain.length - 2) {
      const ty = getTerrainY(spawnX);
      if (Math.random() < 0.3) {
        fuelCans.push({ x: spawnX, y: ty - 30, collected: false });
      }
      if (Math.random() < 0.4) {
        coinItems.push({ x: spawnX + Math.random() * 60 - 30, y: ty - 25 - Math.random() * 20, collected: false });
      }
    }
  }

  // ---- update ----
  function update(dt) {
    if (over || !running) return;

    const speedMul = 1 + (upgrades.engine - 1) * 0.25;
    const gripMul = 1 + (upgrades.tire - 1) * 0.15;
    maxFuel = 100 + (upgrades.fuel - 1) * 30;

    // terrain angle at car position
    const terrainAngle = getTerrainNormal(car.x);
    const cosA = Math.cos(terrainAngle);
    const sinA = Math.sin(terrainAngle);

    // gas / brake
    const isGas = touches.right || keys.ArrowRight || keys.KeyD;
    const isBrake = touches.left || keys.ArrowLeft || keys.KeyA;

    if (isGas && fuel > 0) {
      // apply force along terrain
      const engineForce = 400 * speedMul;
      car.vx += cosA * engineForce * dt;
      car.vy += sinA * engineForce * dt;
      fuel -= fuelDepleteRate * dt;
    }

    if (isBrake) {
      // brake force
      const brakeForce = 300;
      const speed = Math.sqrt(car.vx * car.vx + car.vy * car.vy);
      if (speed > 1) {
        car.vx -= (car.vx / speed) * brakeForce * dt;
        car.vy -= (car.vy / speed) * brakeForce * dt;
      }
    }

    // gravity
    car.vy += GRAVITY * dt;

    // apply velocity
    car.x += car.vx * dt;
    car.y += car.vy * dt;

    // ground collision
    const groundY = getTerrainY(car.x);
    const wheelContactY = groundY - WHEEL_R;

    if (car.y + WHEEL_R >= groundY) {
      car.y = wheelContactY - CAR_H / 2 + WHEEL_R;
      // bounce / friction
      const normalAngle = getTerrainNormal(car.x);
      const nCos = Math.cos(normalAngle);
      const nSin = Math.sin(normalAngle);

      // project velocity onto normal
      const dot = car.vx * nSin + car.vy * (-nCos);
      if (dot > 0) {
        car.vy -= nCos * dot;
        car.vx += nSin * dot;
      }

      // friction along surface
      const friction = 0.92 - gripMul * 0.02;
      car.vx *= friction;

      // surface following angular velocity
      const targetAngle = -normalAngle + Math.PI / 2;
      car.angularVel += (targetAngle - car.angle) * 8 * dt;
      car.onGround = true;
    } else {
      car.onGround = false;
    }

    // angular damping
    car.angularVel *= 0.95;
    car.angle += car.angularVel * dt;

    // clamp angle for flip detection
    // check if flipped (upside down)
    const absAngle = Math.abs(car.angle % (Math.PI * 2));
    const normalizedAngle = absAngle > Math.PI ? Math.PI * 2 - absAngle : absAngle;

    // speed cap
    const maxSpeed = 500 * speedMul;
    const currentSpeed = Math.sqrt(car.vx * car.vx + car.vy * car.vy);
    if (currentSpeed > maxSpeed) {
      car.vx = (car.vx / currentSpeed) * maxSpeed;
      car.vy = (car.vy / currentSpeed) * maxSpeed;
    }

    // camera follows car
    const targetCamX = car.x - W * 0.35;
    cameraX += (targetCamX - cameraX) * Math.min(1, dt * 5);
    if (cameraX < 0) cameraX = 0;

    // distance / score
    const dist = Math.floor(car.x / 10);
    if (dist > maxDistance) {
      score += (dist - maxDistance) * 2;
      maxDistance = dist;
      onScore(score);
    }

    // spawn collectibles
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnCollectibles();
      spawnTimer = 0.5;
    }

    // expand terrain if needed
    const farIdx = Math.floor((cameraX + W + 400) / SEGMENT_W);
    while (terrain.length <= farIdx + 10) {
      const i = terrain.length;
      const x = i * SEGMENT_W;
      const baseH = H * 0.65;
      const h1 = noise(i * 0.02) * 200;
      const h2 = noise(i * 0.05) * 80;
      const h3 = noise(i * 0.1) * 30;
      const y = baseH - h1 - h2 - h3;
      terrain.push({ x, y });
    }

    // fuel can collection
    for (let i = fuelCans.length - 1; i >= 0; i--) {
      const fc = fuelCans[i];
      if (fc.collected) { fuelCans.splice(i, 1); continue; }
      const dx = car.x - fc.x;
      const dy = car.y - fc.y;
      if (dx * dx + dy * dy < 1600) {
        fc.collected = true;
        fuel = Math.min(maxFuel, fuel + 20);
      }
      if (fc.x < cameraX - 200) { fuelCans.splice(i, 1); continue; }
    }

    // coin collection
    for (let i = coinItems.length - 1; i >= 0; i--) {
      const ci = coinItems[i];
      if (ci.collected) { coinItems.splice(i, 1); continue; }
      const dx = car.x - ci.x;
      const dy = car.y - ci.y;
      if (dx * dx + dy * dy < 1200) {
        ci.collected = true;
        coins += 5;
        onCoins(5);
      }
      if (ci.x < cameraX - 200) { coinItems.splice(i, 1); continue; }
    }

    // game over conditions
    if (fuel <= 0) {
      fuel = 0;
      gameOver();
      return;
    }
    if (normalizedAngle > Math.PI * 0.45 && car.onGround) {
      gameOver();
      return;
    }
    // fell off bottom
    if (car.y > H + 200) {
      gameOver();
      return;
    }
  }

  // ---- render ----
  function render() {
    // bg gradient
    ctx.fillStyle = '#05070A';
    ctx.fillRect(0, 0, W, H);

    // sky gradient (neon)
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a0520');
    grad.addColorStop(0.5, '#10082a');
    grad.addColorStop(1, '#05070A');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // stars
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 211.3 + 50) % W);
      const sy = ((i * 137.7 + 30) % (H * 0.4));
      const brightness = 0.3 + hash(i) * 0.7;
      ctx.fillStyle = 'rgba(0,255,255,' + brightness + ')';
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // background objects (parallax)
    for (const obj of bgObjects) {
      const screenX = obj.x - cameraX * obj.depth;
      if (screenX < -50 || screenX > W + 50) continue;
      const groundY = getTerrainY(obj.x);
      const screenY = groundY - cameraX * 0 + (groundY * (1 - obj.depth));
      if (obj.type === 'tree') {
        ctx.fillStyle = 'rgba(0,255,200,0.15)';
        ctx.beginPath();
        ctx.moveTo(screenX, groundY + 20 - cameraX * 0);
        ctx.lineTo(screenX - obj.size * 0.4, groundY + 20);
        ctx.lineTo(screenX + obj.size * 0.4, groundY + 20);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(100,100,120,0.2)';
        ctx.beginPath();
        ctx.arc(screenX, groundY + 15, obj.size * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // terrain
    ctx.beginPath();
    const startIdx = Math.max(0, Math.floor(cameraX / SEGMENT_W) - 1);
    const endIdx = Math.min(terrain.length - 1, Math.floor((cameraX + W) / SEGMENT_W) + 2);

    if (startIdx < terrain.length) {
      ctx.moveTo(terrain[startIdx].x - cameraX, terrain[startIdx].y);
    }
    for (let i = startIdx; i <= endIdx && i < terrain.length; i++) {
      ctx.lineTo(terrain[i].x - cameraX, terrain[i].y);
    }
    // close at bottom
    ctx.lineTo(terrain[Math.min(endIdx, terrain.length - 1)].x - cameraX, H + 50);
    ctx.lineTo(terrain[startIdx].x - cameraX, H + 50);
    ctx.closePath();

    // terrain fill
    const terrainGrad = ctx.createLinearGradient(0, H * 0.4, 0, H);
    terrainGrad.addColorStop(0, '#0a3a2a');
    terrainGrad.addColorStop(1, '#050e0a');
    ctx.fillStyle = terrainGrad;
    ctx.fill();

    // terrain border (neon)
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#39FF88';
    ctx.strokeStyle = '#39FF88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (startIdx < terrain.length) {
      ctx.moveTo(terrain[startIdx].x - cameraX, terrain[startIdx].y);
    }
    for (let i = startIdx; i <= endIdx && i < terrain.length; i++) {
      ctx.lineTo(terrain[i].x - cameraX, terrain[i].y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // fuel cans
    for (const fc of fuelCans) {
      const sx = fc.x - cameraX;
      if (sx < -30 || sx > W + 30) continue;
      const sy = fc.y;
      // can body
      rect(sx - 8, sy - 12, 16, 24, '#39FF88', 14);
      // can label
      ctx.fillStyle = '#05070A';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('F', sx, sy + 4);
      ctx.textAlign = 'left';
    }

    // coins
    for (const ci of coinItems) {
      const sx = ci.x - cameraX;
      if (sx < -20 || sx > W + 20) continue;
      const sy = ci.y + Math.sin(performance.now() * 0.003 + ci.x) * 4;
      circle(sx, sy, 8, '#FFE600', 14);
      // inner
      ctx.fillStyle = '#AA8800';
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // car
    ctx.save();
    const carScreenX = car.x - cameraX;
    ctx.translate(carScreenX, car.y);
    ctx.rotate(car.angle);

    // car body
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#00FFFF';
    ctx.fillStyle = '#00E5FF';
    ctx.fillRect(-CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H);

    // cabin
    ctx.fillStyle = '#1a2a3e';
    ctx.fillRect(-CAR_W / 4, -CAR_H / 2 - 8, CAR_W / 2, 10);
    ctx.shadowBlur = 0;

    // wheels
    const wheelColor = '#FFE600';
    // rear wheel
    circle(-WHEEL_BASE / 2, CAR_H / 2, WHEEL_R, wheelColor, 10);
    // front wheel
    circle(WHEEL_BASE / 2, CAR_H / 2, WHEEL_R, wheelColor, 10);

    // engine glow when gas
    if ((touches.right || keys.ArrowRight || keys.KeyD) && fuel > 0) {
      ctx.fillStyle = '#FF10F0';
      ctx.shadowBlur = 16;
      ctx.shadowColor = '#FF10F0';
      ctx.beginPath();
      ctx.moveTo(-CAR_W / 2, -4);
      ctx.lineTo(-CAR_W / 2 - 12, 0);
      ctx.lineTo(-CAR_W / 2, 4);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    // HUD
    // fuel bar
    const fuelBarW = 160;
    const fuelBarH = 14;
    const fuelBarX = 14;
    const fuelBarY = 14;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(fuelBarX, fuelBarY, fuelBarW, fuelBarH);
    const fuelRatio = fuel / maxFuel;
    const fuelColor = fuelRatio > 0.3 ? '#39FF88' : fuelRatio > 0.15 ? '#FFE600' : '#FF4444';
    ctx.shadowBlur = 8;
    ctx.shadowColor = fuelColor;
    ctx.fillStyle = fuelColor;
    ctx.fillRect(fuelBarX, fuelBarY, fuelBarW * fuelRatio, fuelBarH);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 1;
    ctx.strokeRect(fuelBarX, fuelBarY, fuelBarW, fuelBarH);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '10px monospace';
    ctx.fillText('FUEL', fuelBarX + 4, fuelBarY + 11);

    // score
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#FFE600';
    ctx.fillStyle = '#FFE600';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('SCORE: ' + score, fuelBarX, fuelBarY + 36);
    ctx.fillStyle = '#00FFFF';
    ctx.fillText('COINS: ' + coins, fuelBarX + 160, fuelBarY + 36);

    // speed
    const spd = Math.floor(Math.sqrt(car.vx * car.vx + car.vy * car.vy) * 0.36);
    ctx.fillStyle = '#FF10F0';
    ctx.fillText(spd + ' km/h', fuelBarX + 320, fuelBarY + 36);
    ctx.shadowBlur = 0;

    // upgrade indicators
    ctx.font = '10px monospace';
    ctx.fillStyle = '#39FF88';
    ctx.fillText('ENG:' + upgrades.engine + ' TIR:' + upgrades.tire + ' FUL:' + upgrades.fuel, fuelBarX, fuelBarY + 52);

    // controls hint
    ctx.fillStyle = 'rgba(255,16,240,0.4)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('RIGHT: Gas | LEFT: Brake | BOOST: Speed | DRIFT: Upgrades', W / 2, H - 10);
    ctx.textAlign = 'left';

    // game over overlay
    if (over) {
      ctx.fillStyle = 'rgba(5,7,10,0.85)';
      ctx.fillRect(0, 0, W, H);
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#FF10F0';
      ctx.fillStyle = '#FF10F0';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 30);
      ctx.shadowColor = '#00FFFF';
      ctx.fillStyle = '#00FFFF';
      ctx.font = '18px monospace';
      ctx.fillText('DISTANCE: ' + score, W / 2, H / 2 + 10);
      ctx.fillText('COINS: ' + coins, W / 2, H / 2 + 38);
      ctx.textAlign = 'left';
      ctx.shadowBlur = 0;
    }
  }

  function loop(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    update(dt);
    render();
    raf = requestAnimationFrame(loop);
  }

  function gameOver() {
    over = true;
    running = false;
    if (raf) cancelAnimationFrame(raf);
    if (navigator.vibrate) { try { navigator.vibrate(200); } catch (e) {} }
    onGameOver(Math.floor(score), coins);
  }

  // ---- public API ----
  return {
    start() {
      reset();
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    update() {/* handled internally */},
    render() { render(); },
    pause() { running = false; if (raf) cancelAnimationFrame(raf); },
    resume() { if (over || running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); },
    destroy() { running = false; if (raf) cancelAnimationFrame(raf); },
    setInput(t, k) { touches = t || {}; keys = k || {}; },
    controls: { joystick: false, boost: true, action: false, drift: true }
  };
}
