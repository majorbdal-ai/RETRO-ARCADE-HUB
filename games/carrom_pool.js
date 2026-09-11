/* ============================================================
   Carrom Pool — Neon Carrom (Striker drag & shoot)
   Canvas 800x450, drag aim with guide line, release to shoot
   Queen + cover rule, 1v1 same phone
   ============================================================ */
function carromPool(canvas, ctx, onScore, onGameOver, onCoins) {
  // ---- state ----
  const W = 800, H = 450;
let diffMul = 1;  // v7.20 difficulty ramp
  let raf = null, last = 0, running = false;
  let score = 0, coins = 0;
  let over = false;

  // board geometry (center square)
  const B = { x: 130, y: 60, w: 540, h: 330 }; // board rect
  const CX = B.x + B.w / 2, CY = B.y + B.h / 2;
  const R = 12;      // piece radius
  const SR = 16;     // striker radius
  const POCKET_R = 24;

  // pockets at corners + mid edges
  const pockets = [
    { x: B.x,       y: B.y,       r: POCKET_R },
    { x: B.x + B.w, y: B.y,       r: POCKET_R },
    { x: B.x,       y: B.y + B.h, r: POCKET_R },
    { x: B.x + B.w, y: B.y + B.h, r: POCKET_R },
    { x: CX,        y: B.y,       r: POCKET_R },
    { x: CX,        y: B.y + B.h, r: POCKET_R }
  ];

  const PIECES = [];       // {x, y, vx, vy, color, queen, alive, pocketed}
  const striker = { x: CX, y: B.y + B.h - 40, vx: 0, vy: 0, inHand: true };

  // aiming
  let aiming = false, aimStart = null, aimVec = null;

  // turn state
  let player = 1; // 1 or 2
  let queenCovered = false; // queen pocketed must be covered

  // friction
  const FRICTION = 0.985;

  // ---- helpers ----
  function circle(x, y, r, color, glow) {
    ctx.shadowBlur = glow || 12;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  function rect(x, y, w, h, color, glow) {
    ctx.shadowBlur = glow || 8;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
  }

  // ---- setup pieces ----
  function setupPieces() {
    PIECES.length = 0;
    queenCovered = false;
    // pieces around center: 9 black, 9 white, 1 red queen
    const cols = ['#00FFFF', '#FF10F0', '#39FF88', '#FFE600', '#00FFFF', '#FF10F0', '#39FF88', '#FFE600', '#00FFFF', '#FF10F0', '#39FF88', '#FFE600', '#00FFFF', '#FF10F0', '#39FF88', '#FFE600', '#00FFFF', '#FF10F0'];
    // place in a rough circular cluster near center
    const fx = CX, fy = CY;
    const px = [0, 20, -20, 40, -40, 60, -60, 80, -80, 0, 20, -20, 40, -40, 60, -60, 80, -80];
    const py = [0, 14, 14, 30, 30, 46, 46, 62, 62, -14, -14, -30, -30, -46, -46, -62, -62, -80];
    for (let i = 0; i < 18; i++) {
      PIECES.push({
        x: fx + px[i], y: fy + py[i], vx: 0, vy: 0,
        color: cols[i], queen: false, alive: true, pocketed: false
      });
    }
    // queen (red) at exact center
    PIECES.push({ x: fx, y: fy, vx: 0, vy: 0, color: '#FF2D2D', queen: true, alive: true, pocketed: false });
    // striker position at bottom
    striker.x = CX; striker.y = B.y + B.h - 40;
    striker.vx = 0; striker.vy = 0; striker.inHand = true;
    player = 1;
  }

  // ---- reset ----
  function reset() {
    score = 0; coins = 0; over = false;
    setupPieces();
    aiming = false; aimStart = null; aimVec = null;
  }

  // ---- pointer ----
  function pointerDown(x, y) {
    if (over || !running) return;
    // if striker in hand, start aiming
    if (striker.inHand) {
      aiming = true;
      aimStart = { x, y };
      aimVec = null;
    } else {
      // place striker back (tap on board)
      if (x > B.x && x < B.x + B.w && y > B.y && y < B.y + B.h) {
        striker.x = x; striker.y = y;
        striker.vx = 0; striker.vy = 0;
        striker.inHand = true;
      }
    }
  }
  function pointerMove(x, y) {
    if (!aiming || !aimStart) return;
    const dx = aimStart.x - x, dy = aimStart.y - y;
    const len = Math.hypot(dx, dy);
    if (len > 5) aimVec = { dx, dy, len: Math.min(len, 140) };
  }
  function pointerUp() {
    if (!aiming) return;
    aiming = false;
    if (aimVec && aimVec.len > 10 && striker.inHand) {
      const power = aimVec.len / 140; // 0..1
      striker.vx = (aimVec.dx / aimVec.len) * 720 * power * diffMul;
      striker.vy = (aimVec.dy / aimVec.len) * 720 * power * diffMul;
      striker.inHand = false;
      if (typeof window.playSfx === 'function') { try { window.playSfx('shoot'); } catch (e) {} }
    }
    aimStart = null; aimVec = null;
  }

  // ---- pocket check ----
  function pocketPiece(p) {
    for (const pk of pockets) {
      const dx = p.x - pk.x, dy = p.y - pk.y;
      if (Math.hypot(dx, dy) < pk.r - 4) {
        p.pocketed = true; p.alive = false;
        return true;
      }
    }
    return false;
  }

  // ---- update ----
  function update(dt) {
    if (over || !running) return;
    const sub = 3; // sub-steps for collision quality
    const sdt = dt / sub;
    for (let s = 0; s < sub; s++) {
      // move striker
      striker.x += striker.vx * sdt;
      striker.y += striker.vy * sdt;
      striker.vx *= Math.pow(FRICTION, sdt * 60);
      striker.vy *= Math.pow(FRICTION, sdt * 60);
      // stop striker
      if (Math.hypot(striker.vx, striker.vy) < 8) { striker.vx = 0; striker.vy = 0; }
      // strike pieces
      for (const p of PIECES) {
        if (!p.alive) continue;
        p.x += p.vx * sdt;
        p.y += p.vy * sdt;
        p.vx *= Math.pow(FRICTION, sdt * 60);
        p.vy *= Math.pow(FRICTION, sdt * 60);
        if (Math.hypot(p.vx, p.vy) < 6) { p.vx = 0; p.vy = 0; }
      }
      // collide striker vs pieces
      for (const p of PIECES) {
        if (!p.alive) continue;
        const dx = p.x - striker.x, dy = p.y - striker.y;
        const d = Math.hypot(dx, dy);
        if (d < R + SR && d > 0.01) {
          const nx = dx / d, ny = dy / d;
          const overlap = (R + SR) - d;
          striker.x -= nx * overlap; striker.y -= ny * overlap;
          p.x += nx * overlap; p.y += ny * overlap;
          // elastic exchange (striker heavy)
          const rel = (striker.vx - p.vx) * nx + (striker.vy - p.vy) * ny;
          if (rel > 0) {
            striker.vx -= rel * 0.6 * nx;
            striker.vy -= rel * 0.6 * ny;
            p.vx += rel * 1.0 * nx;
            p.vy += rel * 1.0 * ny;
          }
        }
      }
      // collide pieces vs pieces
      for (let i = 0; i < PIECES.length; i++) {
        const a = PIECES[i]; if (!a.alive) continue;
        for (let j = i + 1; j < PIECES.length; j++) {
          const b = PIECES[j]; if (!b.alive) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d < R * 2 && d > 0.01) {
            const nx = dx / d, ny = dy / d;
            const overlap = (R * 2) - d;
            a.x -= nx * overlap / 2; a.y -= ny * overlap / 2;
            b.x += nx * overlap / 2; b.y += ny * overlap / 2;
            const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
            if (rel > 0) {
              a.vx -= rel * 0.9 * nx; a.vy -= rel * 0.9 * ny;
              b.vx += rel * 0.9 * nx; b.vy += rel * 0.9 * ny;
              if (rel > 120 && typeof window.playSfx === 'function') { try { window.playSfx('pop'); } catch (e) {} }
            }
          }
        }
      }
      // board walls
      const wallPieces = [striker, ...PIECES.filter(p => p.alive)];
      for (const p of wallPieces) {
        if (p.x < B.x + R) { p.x = B.x + R; p.vx = Math.abs(p.vx) * 0.7; }
        if (p.x > B.x + B.w - R) { p.x = B.x + B.w - R; p.vx = -Math.abs(p.vx) * 0.7; }
        if (p.y < B.y + R) { p.y = B.y + R; p.vy = Math.abs(p.vy) * 0.7; }
        if (p.y > B.y + B.h - R) { p.y = B.y + B.h - R; p.vy = -Math.abs(p.vy) * 0.7; }
      }
      // pocketing pieces
      for (const p of PIECES) {
        if (!p.alive) continue;
        if (pocketPiece(p)) {
          if (p.queen) {
            // must be covered — for simplicity reward immediately
            score += p.pocketed ? 25 : 0;
            onCoins(25);
            queenCovered = true;
            if (typeof window.playSfx === 'function') { try { window.playSfx('win2'); } catch (e) {} }
          } else {
            const bonus = p.color === '#FFE600' ? 15 : 10;
            score += bonus;
            onCoins(10);
            if (typeof window.playSfx === 'function') { try { window.playSfx('pop'); } catch (e) {} }
          }
        }
      }
      // striker pocketed
      if (pocketPiece({ x: striker.x, y: striker.y })) {
        striker.inHand = true;
        striker.vx = 0; striker.vy = 0;
        striker.x = CX; striker.y = B.y + B.h - 40;
        player = player === 1 ? 2 : 1;
        if (typeof window.playSfx === 'function') { try { window.playSfx('error'); } catch (e) {} }
      }
      // check game over: all pieces pocketed
      if (PIECES.every(p => !p.alive)) {
        // end turn
        if (typeof gameFX !== 'undefined') { try { var __r = canvas.getBoundingClientRect(); gameFX.burst(__r.left + (W/2) * __r.width / canvas.width, __r.top + (H/2) * __r.height / canvas.height, '#ff4444', 16); } catch(e){} gameFX.shake(5); }
      onGameOver(Math.floor(score), coins);
        over = true;
        return;
      }
    }
  }

  // ---- render ----
  function render() {
    ctx.fillStyle = '#05070A';
    ctx.fillRect(0, 0, W, H);
    // board
    rect(B.x, B.y, B.w, B.h, '#0B0F1A', 16);
    // board border glow
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#00FFFF';
    ctx.strokeRect(B.x, B.y, B.w, B.h);
    ctx.shadowBlur = 0;
    // center circle
    ctx.strokeStyle = 'rgba(0,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(CX, CY, 60, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(CX, CY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#00FFFF';
    ctx.fill();
    // pockets
    for (const pk of pockets) {
      circle(pk.x, pk.y, pk.r, '#000000', 0);
      ctx.strokeStyle = '#FF10F0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pk.x, pk.y, pk.r - 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    // pieces
    for (const p of PIECES) {
      if (!p.alive) continue;
      circle(p.x, p.y, R, p.color, 14);
      // inner dot
      ctx.fillStyle = 'rgba(5,7,10,0.5)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, R * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    // striker
    if (striker.inHand) {
      circle(striker.x, striker.y, SR + 4, 'rgba(255,255,255,0.2)', 6);
    }
    circle(striker.x, striker.y, SR, '#FFFFFF', 16);
    ctx.fillStyle = '#FF10F0';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('S', striker.x, striker.y + 5);
    // aiming guide
    if (aiming && aimVec) {
      const ang = Math.atan2(aimVec.dy, aimVec.dx);
      const gx = striker.x + Math.cos(ang) * 40;
      const gy = striker.y + Math.sin(ang) * 40;
      ctx.strokeStyle = 'rgba(255,16,240,0.6)';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(striker.x, striker.y);
      ctx.lineTo(gx, gy);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // HUD
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#00FFFF';
    ctx.fillStyle = '#00FFFF';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('PLAYER ' + player, 16, 30);
    ctx.fillStyle = '#FFE600';
    ctx.shadowColor = '#FFE600';
    ctx.fillText('SCORE: ' + score, W - 160, 30);
    ctx.shadowBlur = 0;
    if (striker.inHand && !over) {
      ctx.fillStyle = '#39FF88';
      ctx.font = '15px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('DRAG BACK TO AIM · RELEASE TO SHOOT', W / 2, H - 14);
    }
    // game over
    if (over) {
      ctx.fillStyle = 'rgba(5,7,10,0.85)';
      ctx.fillRect(0, 0, W, H);
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#FF10F0';
      ctx.fillStyle = '#FF10F0';
      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 30);
      ctx.shadowColor = '#00FFFF';
      ctx.fillStyle = '#00FFFF';
      ctx.font = '20px monospace';
      ctx.fillText('SCORE: ' + score, W / 2, H / 2 + 10);
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
    if (typeof window.playSfx === 'function') { try { window.playSfx('over'); } catch (e) {} }
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
    // touch handled via canvas pointer events; no buttons needed
    controls: { joystick: false, boost: false, action: false, drift: false },
    // expose for touch binding
    pointerDown, pointerMove, pointerUp,
    setDifficulty: function(lvl){ diffMul = [1,1.15,1.3,1.5,1.75,2][Math.min(5,Math.floor(lvl)||0)]||1; }
  };
}