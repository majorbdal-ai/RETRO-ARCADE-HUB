/* ============================================================
   Pixel Dungeon — Top-down Dungeon Crawler
   Canvas 800x450, room-based exploration
   Joystick movement, action button to attack
   Find keys, open chests, defeat enemies
   ============================================================ */
function pixelDungeon(canvas, ctx, onScore, onGameOver, onCoins) {
  // ---- state ----
  const W = 800, H = 450;
let diffMul = 1;  // v7.20 difficulty ramp
  let raf = null, last = 0, running = false;
  let score = 0, coins = 0;
  let over = false;

  // tile-based grid
  const TILE = 40;
  const COLS = 20;
  const ROWS = 11;
  const MAP_W = W;
  const MAP_H = H;

  // 0=floor, 1=wall, 2=door
  let rooms = [];
  let currentRoom = 0;

  // player
  const P = {
    x: 0, y: 0, w: 28, h: 28, speed: 140,
    facing: 'down', hp: 5, maxHp: 5,
    attacking: false, attackTimer: 0, attackCooldown: 0,
    attackDir: 'down', invincible: 0
  };

  // enemies
  let enemies = [];

  // key & chest
  let hasKey = false;
  let chestOpened = false;
  let keyPos = null;
  let chestPos = null;

  // sword swing
  let swordHit = null;

  // particles
  let particles = [];

  // input
  let touches = { left: false, right: false, up: false, down: false, action: false };
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

  function dist(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  function boxOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 200,
        life: 0.4 + Math.random() * 0.3,
        color: color, size: 2 + Math.random() * 3
      });
    }
  }

  // ---- room generation ----
  function generateRoom() {
    const map = [];
    for (let r = 0; r < ROWS; r++) {
      map[r] = [];
      for (let c = 0; c < COLS; c++) {
        if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
          map[r][c] = 1; // wall border
        } else {
          map[r][c] = 0; // floor
        }
      }
    }
    // add some random walls inside
    const wallCount = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < wallCount; i++) {
      const rw = 2 + Math.floor(Math.random() * 3);
      const rh = 2 + Math.floor(Math.random() * 2);
      const rx = 2 + Math.floor(Math.random() * (COLS - rw - 2));
      const ry = 2 + Math.floor(Math.random() * (ROWS - rh - 2));
      for (let r = ry; r < ry + rh && r < ROWS - 1; r++) {
        for (let c = rx; c < rx + rw && c < COLS - 1; c++) {
          if (r > 0 && c > 0) map[r][c] = 1;
        }
      }
    }
    // add doors on edges
    const doors = [];
    // top door
    const td = 3 + Math.floor(Math.random() * (COLS - 6));
    map[0][td] = 2;
    map[0][td + 1] = 2;
    doors.push({ side: 'top', col: td });
    // bottom door
    const bd = 3 + Math.floor(Math.random() * (COLS - 6));
    map[ROWS - 1][bd] = 2;
    map[ROWS - 1][bd + 1] = 2;
    doors.push({ side: 'bottom', col: bd });
    // right door
    const rd = 2 + Math.floor(Math.random() * (ROWS - 4));
    map[rd][COLS - 1] = 2;
    doors.push({ side: 'right', row: rd });

    return { map: map, doors: doors };
  }

  function spawnEnemies(roomIndex) {
    const count = 1 + Math.floor(Math.random() * 3) + Math.floor(roomIndex / 2);
    const enemyList = [];
    for (let i = 0; i < count; i++) {
      let ex, ey, tries = 0;
      do {
        ex = (2 + Math.floor(Math.random() * (COLS - 4))) * TILE + 6;
        ey = (2 + Math.floor(Math.random() * (ROWS - 4))) * TILE + 6;
        tries++;
      } while (tries < 30);
      enemyList.push({
        x: ex, y: ey, w: 28, h: 28,
        hp: 2 + Math.floor(roomIndex / 3),
        speed: 50 + Math.random() * 40,
        color: ['#FF10F0', '#FF4444', '#AA88FF'][Math.floor(Math.random() * 3)],
        dir: Math.random() * Math.PI * 2,
        moveTimer: 0,
        changeTimer: 1 + Math.random() * 2,
        hitFlash: 0
      });
    }
    return enemyList;
  }

  function generateRooms() {
    rooms = [];
    for (let i = 0; i < 5; i++) {
      const room = generateRoom();
      room.enemies = spawnEnemies(i);
      room.keyPlaced = false;
      room.chestPlaced = false;
      room.visited = false;
      rooms.push(room);
    }
    // place key in room 2, chest in room 3
    placeKeyAndChest();
  }

  function placeKeyAndChest() {
    // key in room index 2
    const kr = rooms[2];
    let kx, ky, tries = 0;
    do {
      kx = (3 + Math.floor(Math.random() * (COLS - 6))) * TILE + TILE / 2;
      ky = (3 + Math.floor(Math.random() * (ROWS - 6))) * TILE + TILE / 2;
      tries++;
    } while (tries < 50);
    kr.keyPlaced = true;
    keyPos = { x: kx, y: ky, room: 2 };

    // chest in room index 4
    const cr = rooms[4];
    let cx, cy;
    do {
      cx = (3 + Math.floor(Math.random() * (COLS - 6))) * TILE + TILE / 2;
      cy = (3 + Math.floor(Math.random() * (ROWS - 6))) * TILE + TILE / 2;
      tries++;
    } while (tries < 50);
    cr.chestPlaced = true;
    chestPos = { x: cx, y: cy, room: 4, opened: false };
  }

  function reset() {
    score = 0; coins = 0; over = false;
    hasKey = false;
    chestOpened = false;
    currentRoom = 0;
    particles = [];
    generateRooms();
    rooms[0].visited = true;
    P.x = COLS / 2 * TILE;
    P.y = (ROWS - 2) * TILE;
    P.hp = 5; P.maxHp = 5;
    P.attacking = false; P.attackTimer = 0; P.attackCooldown = 0;
    P.invincible = 0;
    P.facing = 'up';
    swordHit = null;
  }

  // ---- collision check for tile map ----
  function isWall(px, py, pw, ph) {
    const room = rooms[currentRoom];
    const map = room.map;
    const startCol = Math.floor(px / TILE);
    const endCol = Math.floor((px + pw - 1) / TILE);
    const startRow = Math.floor(py / TILE);
    const endRow = Math.floor((py + ph - 1) / TILE);
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true;
        if (map[r][c] === 1) return true;
      }
    }
    return false;
  }

  // ---- update ----
  function update(dt) {
    if (over || !running) return;

    let dx = 0, dy = 0;
    if (touches.left || keys.ArrowLeft || keys.KeyA) dx -= 1;
    if (touches.right || keys.ArrowRight || keys.KeyD) dx += 1;
    if (touches.up || keys.ArrowUp || keys.KeyW) dy -= 1;
    if (touches.down || keys.ArrowDown || keys.KeyS) dy += 1;

    // normalize diagonal
    if (dx !== 0 && dy !== 0) {
      dx *= 0.707;
      dy *= 0.707;
    }

    // facing direction
    if (dx > 0.3) P.facing = 'right';
    else if (dx < -0.3) P.facing = 'left';
    if (dy > 0.3) P.facing = 'down';
    else if (dy < -0.3) P.facing = 'up';

    // move with collision
    const nx = P.x + dx * P.speed * dt;
    const ny = P.y + dy * P.speed * dt;
    if (!isWall(nx, P.y, P.w, P.h)) P.x = nx;
    if (!isWall(P.x, ny, P.w, P.h)) P.y = ny;

    // attack
    if (P.attackCooldown > 0) P.attackCooldown -= dt;
    if ((touches.action || keys.Space || keys.KeyJ) && !P.attacking && P.attackCooldown <= 0) {
      P.attacking = true;
      P.attackTimer = 0.2;
      P.attackCooldown = 0.35;
      P.attackDir = P.facing;
      if (typeof window.playSfx === 'function') { try { window.playSfx('shoot'); } catch (e) {} }
      // calculate sword hitbox
      updateSwordHit();
      // check enemies hit by sword
      for (const e of enemies) {
        if (e.room !== currentRoom) continue;
        if (swordHit && boxOverlap(swordHit, { x: e.x, y: e.y, w: e.w, h: e.h })) {
          e.hp -= 1;
          e.hitFlash = 0.15;
          spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#00FFFF', 5);
          if (e.hp <= 0) {
            score += 50;
            onScore(score);
            if (typeof window.playSfx === 'function') { try { window.playSfx('pop'); } catch (e) {} }
            if (navigator.vibrate) { try { navigator.vibrate(30); } catch(e){} }
            spawnParticles(e.x + e.w / 2, e.y + e.h / 2, e.color, 10);
            enemies.splice(enemies.indexOf(e), 1);
          }
        }
      }
    }
    if (P.attacking) {
      P.attackTimer -= dt;
      if (P.attackTimer <= 0) {
        P.attacking = false;
        swordHit = null;
      } else {
        updateSwordHit();
      }
    }

    // invincibility frames
    if (P.invincible > 0) P.invincible -= dt;

    // update enemies
    for (const e of enemies) {
      if (e.room !== currentRoom) continue;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.moveTimer += dt;
      // patrol AI
      if (e.moveTimer >= e.changeTimer) {
        e.moveTimer = 0;
        e.changeTimer = 1 + Math.random() * 2;
        e.dir = Math.random() * Math.PI * 2;
      }
      // chase player if close enough
      const dxp = (P.x + P.w / 2) - (e.x + e.w / 2);
      const dyp = (P.y + P.h / 2) - (e.y + e.h / 2);
      const d = Math.sqrt(dxp * dxp + dyp * dyp);
      if (d < 200) {
        e.dir = Math.atan2(dyp, dxp);
      }
      const enx = e.x + Math.cos(e.dir) * e.speed * dt;
      const eny = e.y + Math.sin(e.dir) * e.speed * dt;
      if (!isWall(enx, e.y, e.w, e.h)) e.x = enx;
      if (!isWall(e.x, eny, e.w, e.h)) e.y = eny;
      // enemy-player collision
      if (P.invincible <= 0 && boxOverlap(P, { x: e.x, y: e.y, w: e.w, h: e.h })) {
        P.hp -= 1;
        P.invincible = 0.8;
        if (typeof window.playSfx === 'function') { try { window.playSfx('error'); } catch (e) {} }
        spawnParticles(P.x + P.w / 2, P.y + P.h / 2, '#FF4444', 6);
        if (P.hp <= 0) {
          gameOver();
          return;
        }
      }
    }

    // check key pickup
    if (keyPos && keyPos.room === currentRoom && !hasKey) {
      const kdx = Math.abs(P.x + P.w / 2 - keyPos.x);
      const kdy = Math.abs(P.y + P.h / 2 - keyPos.y);
      if (kdx < 30 && kdy < 30) {
        hasKey = true;
        score += 100;
        onScore(score);
        if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
        spawnParticles(keyPos.x, keyPos.y, '#39FF88', 15);
      }
    }

    // check chest
    if (chestPos && chestPos.room === currentRoom && !chestPos.opened) {
      const cdx = Math.abs(P.x + P.w / 2 - chestPos.x);
      const cdy = Math.abs(P.y + P.h / 2 - chestPos.y);
      if (cdx < 30 && cdy < 30 && hasKey) {
        chestPos.opened = true;
        chestOpened = true;
        score += 500;
        onScore(score);
        coins += 50;
        onCoins(50);
        if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
        if (navigator.vibrate) { try { navigator.vibrate(200); } catch(e){} }
        spawnParticles(chestPos.x, chestPos.y, '#FFE600', 20);
      }
    }

    // room transitions via doors
    const room = rooms[currentRoom];
    for (const door of room.doors) {
      if (door.side === 'top' && P.y < 4 && P.x > door.col * TILE - TILE && P.x < (door.col + 2) * TILE) {
        transitionRoom(currentRoom - 3);
        break;
      }
      if (door.side === 'bottom' && P.y > (ROWS - 2) * TILE && P.x > door.col * TILE - TILE && P.x < (door.col + 2) * TILE) {
        transitionRoom(currentRoom + 3);
        break;
      }
      if (door.side === 'right' && P.x > (COLS - 2) * TILE && P.y > door.row * TILE - TILE && P.y < (door.row + 1) * TILE + TILE) {
        transitionRoom(currentRoom + 1);
        break;
      }
    }

    // update particles
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);

    // score over time
    score += dt * 5;
    onScore(Math.floor(score));
  }

  function transitionRoom(newRoom) {
    if (newRoom < 0 || newRoom >= rooms.length) return;
    currentRoom = newRoom;
    rooms[currentRoom].visited = true;
    // enter from corresponding edge
    if (P.y < TILE) { P.y = (ROWS - 2) * TILE; }
    else if (P.y > (ROWS - 2) * TILE) { P.y = TILE; }
    else if (P.x > (COLS - 2) * TILE) { P.x = 2 * TILE; }
    else { P.x = (COLS / 2) * TILE; }
    enemies = rooms[currentRoom].enemies;
  }

  function updateSwordHit() {
    const sw = 30, sh = 30;
    if (P.attackDir === 'up') swordHit = { x: P.x + P.w / 2 - sw / 2, y: P.y - sh, w: sw, h: sh };
    else if (P.attackDir === 'down') swordHit = { x: P.x + P.w / 2 - sw / 2, y: P.y + P.h, w: sw, h: sh };
    else if (P.attackDir === 'left') swordHit = { x: P.x - sw, y: P.y + P.h / 2 - sh / 2, w: sw, h: sh };
    else swordHit = { x: P.x + P.w, y: P.y + P.h / 2 - sh / 2, w: sw, h: sh };
  }

  // ---- render ----
  function render() {
    // bg
    ctx.fillStyle = '#05070A';
    ctx.fillRect(0, 0, W, H);

    const room = rooms[currentRoom];
    const map = room.map;

    // draw tiles
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tx = c * TILE, ty = r * TILE;
        if (map[r][c] === 1) {
          // wall
          rect(tx, ty, TILE, TILE, '#1A1A2E', 4);
          ctx.strokeStyle = '#2A2A4E';
          ctx.lineWidth = 1;
          ctx.strokeRect(tx, ty, TILE, TILE);
        } else if (map[r][c] === 2) {
          // door
          rect(tx, ty, TILE, TILE, '#0B0F1A', 0);
          ctx.strokeStyle = '#39FF88';
          ctx.lineWidth = 2;
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#39FF88';
          ctx.strokeRect(tx + 4, ty + 4, TILE - 8, TILE - 8);
          ctx.shadowBlur = 0;
        } else {
          // floor
          ctx.fillStyle = '#0A0E18';
          ctx.fillRect(tx, ty, TILE, TILE);
          // subtle floor pattern
          if ((r + c) % 2 === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.02)';
            ctx.fillRect(tx, ty, TILE, TILE);
          }
        }
      }
    }

    // room border glow
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00FFFF';
    ctx.strokeRect(1, 1, W - 2, H - 2);
    ctx.shadowBlur = 0;

    // key
    if (keyPos && keyPos.room === currentRoom && !hasKey) {
      const pulse = Math.sin(performance.now() * 0.005) * 0.3 + 0.7;
      ctx.globalAlpha = pulse;
      circle(keyPos.x, keyPos.y, 10, '#39FF88', 20);
      ctx.globalAlpha = 1;
      // key shape
      ctx.fillStyle = '#39FF88';
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#39FF88';
      ctx.fillRect(keyPos.x - 2, keyPos.y - 8, 4, 12);
      ctx.fillRect(keyPos.x - 5, keyPos.y - 8, 10, 4);
      ctx.shadowBlur = 0;
    }

    // chest
    if (chestPos && chestPos.room === currentRoom) {
      const cx = chestPos.x, cy = chestPos.y;
      if (chestPos.opened) {
        rect(cx - 14, cy - 10, 28, 20, '#8B6914', 8);
        rect(cx - 14, cy - 14, 28, 8, '#AA8800', 10);
        // sparkles inside
        const sparkle = Math.sin(performance.now() * 0.01) * 0.5 + 0.5;
        ctx.globalAlpha = sparkle;
        circle(cx, cy, 6, '#FFE600', 16);
        ctx.globalAlpha = 1;
      } else {
        const glow = hasKey ? '#FFE600' : '#8B6914';
        const glowAmt = hasKey ? 20 : 6;
        rect(cx - 14, cy - 10, 28, 20, '#5C4400', glowAmt);
        rect(cx - 14, cy - 14, 28, 8, glow, glowAmt);
        // lock
        if (!hasKey) {
          ctx.fillStyle = '#FF4444';
          ctx.fillRect(cx - 3, cy - 4, 6, 8);
        }
      }
    }

    // enemies
    for (const e of enemies) {
      if (e.room !== currentRoom) continue;
      const flashColor = e.hitFlash > 0 ? '#FFFFFF' : e.color;
      rect(e.x, e.y, e.w, e.h, flashColor, 12);
      // eyes
      ctx.fillStyle = '#FF4444';
      ctx.fillRect(e.x + 4, e.y + 8, 6, 6);
      ctx.fillRect(e.x + e.w - 10, e.y + 8, 6, 6);
      ctx.fillStyle = '#000';
      ctx.fillRect(e.x + 6, e.y + 10, 3, 3);
      ctx.fillRect(e.x + e.w - 8, e.y + 10, 3, 3);
    }

    // sword swing
    if (P.attacking && swordHit) {
      ctx.globalAlpha = 0.6;
      rect(swordHit.x, swordHit.y, swordHit.w, swordHit.h, '#00FFFF', 18);
      ctx.globalAlpha = 1;
    }

    // player
    const pFlash = P.invincible > 0 && Math.floor(performance.now() / 80) % 2 === 0;
    if (!pFlash) {
      // body
      rect(P.x, P.y, P.w, P.h, '#00FFFF', 14);
      // eyes based on facing
      const eyeOff = 6;
      let ex1, ey1, ex2, ey2;
      if (P.facing === 'up') {
        ex1 = P.x + 6; ey1 = P.y + 4;
        ex2 = P.x + P.w - 10; ey2 = P.y + 4;
      } else if (P.facing === 'down') {
        ex1 = P.x + 6; ey1 = P.y + P.h - 10;
        ex2 = P.x + P.w - 10; ey2 = P.y + P.h - 10;
      } else if (P.facing === 'left') {
        ex1 = P.x + 2; ey1 = P.y + 6;
        ex2 = P.x + 2; ey2 = P.y + P.h - 10;
      } else {
        ex1 = P.x + P.w - 8; ey1 = P.y + 6;
        ex2 = P.x + P.w - 8; ey2 = P.y + P.h - 10;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(ex1, ey1, 5, 5);
      ctx.fillRect(ex2, ey2, 5, 5);
      ctx.fillStyle = '#000';
      ctx.fillRect(ex1 + 1, ey1 + 1, 3, 3);
      ctx.fillRect(ex2 + 1, ey2 + 1, 3, 3);
    }

    // particles
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / 0.5);
      circle(p.x, p.y, p.size, p.color, 8);
    }
    ctx.globalAlpha = 1;

    // HUD
    // HP bar
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(12, 12, 120, 14);
    const hpRatio = P.hp / P.maxHp;
    const hpColor = hpRatio > 0.5 ? '#39FF88' : hpRatio > 0.25 ? '#FFE600' : '#FF4444';
    ctx.fillStyle = hpColor;
    ctx.shadowBlur = 8;
    ctx.shadowColor = hpColor;
    ctx.fillRect(12, 12, 120 * hpRatio, 14);
    ctx.shadowBlur = 0;

    // key indicator
    if (hasKey) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#39FF88';
      ctx.fillStyle = '#39FF88';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('🔑 KEY', 144, 24);
      ctx.shadowBlur = 0;
    }

    // room indicator
    ctx.fillStyle = '#00FFFF';
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#00FFFF';
    ctx.font = '12px monospace';
    ctx.fillText('ROOM ' + (currentRoom + 1) + '/5', W - 120, 24);
    ctx.shadowBlur = 0;

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
      ctx.fillText('SCORE: ' + Math.floor(score), W / 2, H / 2 + 10);
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
    if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
    if (navigator.vibrate) { try { navigator.vibrate(200); } catch (e) {} }
    if (typeof gameFX !== 'undefined') { try { var __r = canvas.getBoundingClientRect(); gameFX.burst(__r.left + (W/2) * __r.width / canvas.width, __r.top + (H/2) * __r.height / canvas.height, '#ff4444', 16); } catch(e){} gameFX.shake(5); }
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
    destroy() { running = false; if (raf) cancelAnimationFrame(raf); },
    resume() { if (over || running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); },
    destroy() { running = false; if (raf) cancelAnimationFrame(raf); },
    setInput(t, k) { touches = t || {}; keys = k || {}; },
    controls: { joystick: true, boost: false, action: true, drift: false },
    setDifficulty: function(lvl){ diffMul = [1,1.15,1.3,1.5,1.75,2][Math.min(5,Math.floor(lvl)||0)]||1; }
  };
}
