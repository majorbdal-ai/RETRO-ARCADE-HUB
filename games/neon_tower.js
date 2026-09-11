function neonTower(canvas, ctx, onScore, onGameOver, onCoins) {
  const W = 800, H = 450;
  let raf = null, last = 0, running = false, over = false, overSent = false;
  let score = 0, coins = 0, keys = {}, touches = {};
  let time = 0, state = 'play', shake = 0;

  // Tower physics
  let blocks = [];
  let currentBlock = null;
  let blockSpeed = 3;
  let blockWidth = 200;
  let maxBlocks = 0;
  let lives = 3;
  let nextBlockX = 0, nextBlockY = 0;

  const COLORS = ['#00FFFF', '#FF3B6B', '#FFE600', '#39FF88', '#7B61FF', '#FF8A00'];

  function key(n) { return !!keys[n]; }
  function t(n) { return !!touches[n]; }

  function reset() {
    over = false; overSent = false;
    score = 0; coins = 0; time = 0; shake = 0;
    state = 'play'; blockWidth = 200; blockSpeed = 3 * diffMul; maxBlocks = 0; lives = 3;
    blocks = [];
    // base block
    blocks.push({ x: W/2, y: H - 60, w: blockWidth, h: 30, color: COLORS[0] });
    nextBlockY = H - 60 - 30;
    currentBlock = { x: 0 - blockWidth/2, y: nextBlockY, w: blockWidth, h: 30, vx: blockSpeed, color: COLORS[1] };
  }

  function callScore() { if (typeof onScore === 'function') onScore(score); }
  function callCoins() { if (typeof onCoins === 'function') onCoins(coins); }

  function die() {
    if (overSent) return;
    overSent = true; over = true; state = 'over';
    callScore();
    if (typeof onGameOver === 'function') if (typeof gameFX !== 'undefined') { try { var __r = canvas.getBoundingClientRect(); gameFX.burst(__r.left + (W/2) * __r.width / canvas.width, __r.top + (H/2) * __r.height / canvas.height, '#ff4444', 16); } catch(e){} gameFX.shake(5); }
      onGameOver(score, coins);
  }

  function dropBlock() {
    if (!currentBlock) return;
    const top = blocks[blocks.length - 1];
    // Hit test: do the x-ranges overlap?
    const cbLeft = currentBlock.x - currentBlock.w/2;
    const cbRight = currentBlock.x + currentBlock.w/2;
    const tbLeft = top.x - top.w/2;
    const tbRight = top.x + top.w/2;
    const overlap = Math.min(cbRight, tbRight) - Math.max(cbLeft, tbLeft);

    if (overlap <= 0) {
      // Missed entirely — lose life, block falls
      lives--;
      shake = 0.4;
      if (lives <= 0 || blocks.length <= 1) { die(); return; }
      // Current block falls off
      currentBlock = null;
      // Keep playing, next block comes
      score = Math.max(0, score - 20);
      callScore();
      // retry: new current block at full width
      if (lives > 0) {
        blockWidth = Math.min(200, top.w * 1.1);
        currentBlock = { x: -blockWidth/2, y: top.y - 30, w: blockWidth, h: 30, vx: blockSpeed, color: COLORS[(blocks.length) % COLORS.length] };
      }
      return;
    }

    // Success — new block becomes the top
    const newBlock = {
      x: (cbLeft + cbRight) / 2,
      y: currentBlock.y,
      w: overlap,
      h: 30,
      color: currentBlock.color
    };
    blocks.push(newBlock);
    score += 10 * blocks.length;
    callScore();

    // bonus coins every 5 blocks
    if (blocks.length % 5 === 0) {
      coins += 5;
      callCoins();
      if (typeof window.playSfx === 'function') { try { window.playSfx('coin'); } catch (e) {} }
    }

    // Next block
    blockWidth = Math.max(40, newBlock.w * 0.92);
    blockSpeed = Math.min(8, 3 + blocks.length * 0.05) * diffMul;
    currentBlock = {
      x: (Math.random() < 0.5 ? -1 : 1) * (W/2 + blockWidth/2),
      y: newBlock.y - 30,
      w: blockWidth,
      h: 30,
      vx: (Math.random() < 0.5 ? 1 : -1) * blockSpeed,
      color: COLORS[blocks.length % COLORS.length]
    };
    maxBlocks = Math.max(maxBlocks, blocks.length);
  }

  function input() {
    if (!currentBlock) return;
    // keyboard to flip direction (support tap)
    if (key('Space') || key('ArrowDown') || t('action')) {
      dropBlock();
    }
    // move with arrows?
    if (key('ArrowLeft') || t('left')) currentBlock.x -= currentBlock.vx * 2;
    if (key('ArrowRight') || t('right')) currentBlock.x += currentBlock.vx * 2;
  }

  function update(dt) {
    time += dt;
    if (shake > 0) shake -= dt;

    input();

    if (currentBlock) {
      currentBlock.x += currentBlock.vx * dt * 60;
      // Bounce at edges (if moving too far, wrap)
      const half = currentBlock.w/2;
      if (currentBlock.x - half < 0) { currentBlock.x = half; currentBlock.vx = Math.abs(currentBlock.vx); }
      if (currentBlock.x + half > W) { currentBlock.x = W - half; currentBlock.vx = -Math.abs(currentBlock.vx); }
    }

    // subtle tower sway on miss
    if (state === 'play' && blocks.length > 3) {
      blocks.forEach((b, i) => {
        if (i === blocks.length - 1) b.x += Math.sin(time * 2 + i) * 0.2;
      });
    }

    // auto-fast-forward? No — player taps
    render();
  }

  function drawBlock(b, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha || 1;
    ctx.fillStyle = b.color;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 10;
    ctx.fillRect(b.x - b.w/2, b.y, b.w, b.h);
    ctx.shadowBlur = 0;
    // shine
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.fillRect(b.x - b.w/2 + 2, b.y + 2, b.w - 4, 4);
    ctx.restore();
  }

  function drawCurrent() {
    if (!currentBlock) return;
    ctx.save();
    // ghost preview: where it will land
    const top = blocks[blocks.length - 1];
    if (top) {
      const cbLeft = currentBlock.x - currentBlock.w/2;
      const cbRight = currentBlock.x + currentBlock.w/2;
      const tbLeft = top.x - top.w/2;
      const tbRight = top.x + top.w/2;
      const overlap = Math.min(cbRight, tbRight) - Math.max(cbLeft, tbLeft);
      if (overlap > 0) {
        const cx = (Math.max(cbLeft, tbLeft) + Math.min(cbRight, tbRight)) / 2;
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = currentBlock.color;
        ctx.fillRect(cx - overlap/2, top.y, overlap, 4);
        ctx.globalAlpha = 1;
      }
    }
    // moving block
    drawBlock(currentBlock);
    ctx.restore();
  }

  function drawUI() {
    // Top bar
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, 48);
    ctx.font = 'bold 22px Orbitron';
    ctx.fillStyle = '#FFE600';
    ctx.textAlign = 'left';
    ctx.shadowColor = '#FFE600';
    ctx.shadowBlur = 8;
    ctx.fillText('SCORE: ' + score.toLocaleString(), 16, 34);
    ctx.shadowBlur = 0;

    ctx.font = '14px Orbitron';
    ctx.fillStyle = '#00FFFF';
    ctx.textAlign = 'center';
    ctx.fillText('BLOCK ' + blocks.length, W/2, 30);

    ctx.font = '14px Orbitron';
    ctx.fillStyle = '#FFE600';
    ctx.textAlign = 'right';
    ctx.fillText('COINS: ' + coins, W - 16, 30);

    // lives
    ctx.font = '14px "Press Start 2P"';
    ctx.fillStyle = '#FF3B6B';
    ctx.textAlign = 'left';
    let lv = '';
    for (let i = 0; i < 3; i++) lv += i < lives ? '♥ ' : '♡ ';
    ctx.fillText(lv, 16, H - 12);

    // tower height progress
    ctx.font = '12px Space Grotesk';
    ctx.fillStyle = '#8A93A6';
    ctx.textAlign = 'right';
    ctx.fillText('HEIGHT: ' + Math.round(blocks.length * 30) + 'px', W - 16, H - 12);
    ctx.textAlign = 'left';
  }

  function render() {
    // Background
    ctx.fillStyle = "#0A0A1A";
    ctx.fillRect(0, 0, W, H);

    // Perspective grid
    ctx.strokeStyle = 'rgba(0,255,255,.06)';
    for (let i = 0; i < 20; i++) {
      const y = H - i * (H/20);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    drawCurrent();
    blocks.forEach(b => drawBlock(b, b === blocks[0] ? 0.4 : 1));

    drawUI();

    if (state === 'over') {
      ctx.fillStyle = 'rgba(0,0,10,0.9)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.font = 'bold 42px "Press Start 2P"';
      ctx.fillStyle = '#FF3B6B';
      ctx.shadowColor = '#FF3B6B';
      ctx.shadowBlur = 20;
      ctx.fillText('TOWER FELL!', W/2, H/2 - 50);
      ctx.shadowBlur = 0;
      ctx.font = '22px Orbitron';
      ctx.fillStyle = '#FFE600';
      ctx.fillText('SCORE: ' + score.toLocaleString(), W/2, H/2);
      ctx.fillStyle = '#00FFFF';
      ctx.fillText('COINS: +' + coins, W/2, H/2 + 35);
      ctx.font = '14px Space Grotesk';
      ctx.fillStyle = '#8A93A6';
      ctx.fillText('TAP TO RETRY', W/2, H/2 + 80);
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
  function getHelp() { return 'TAP/SPACE TO DROP BLOCK · PERFECT STACK FOR COMBO · BUILDS TOWER'; }

  // difficulty ramp (v7.18): extra block speed multiplier
  let diffMul = 1;
  function setDifficulty(level) {
    diffMul = [1, 1.1, 1.25, 1.4, 1.6, 1.8][Math.min(5, level)] || 1;
  }

  return { start, pause, resume, destroy, setInput, getHelp, setDifficulty };
}