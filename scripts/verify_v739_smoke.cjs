#!/usr/bin/env node
/* Live DOM smoke for v7.39 challenge feature — jsdom harness (skill recipe:
   runScripts:'dangerously' + INLINE script elements (jsdom does not fetch
   external <script src>); assert DOM, never window.gameState) */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dom = new JSDOM(html, {
  url: 'http://localhost/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
});
const { window } = dom;
// stub browser APIs jsdom lacks
window.HTMLCanvasElement.prototype.getContext = () => ({
  canvas: { width: 800, height: 450 },
  setTransform() {}, clearRect() {}, beginPath() {}, arc() {}, fill() {},
  fillRect() {}, stroke() {}, moveTo() {}, lineTo() {}, fillText() {}, strokeText() {},
  save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
  createLinearGradient() { return { addColorStop() {} }; },
  createRadialGradient() { return { addColorStop() {} }; },
  measureText() { return { width: 10 }; },
});
window.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 16);
window.cancelAnimationFrame = () => {};
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
window.devicePixelRatio = 1;
window.scrollTo = () => {};
if (!window.localStorage) {
  const mem = {};
  window.localStorage = {
    getItem: k => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: k => { delete mem[k]; },
    key: i => Object.keys(mem)[i] || null,
    get length() { return Object.keys(mem).length; },
  };
}
// fetch stub -> live_state json (banner path)
window.fetch = (u) => Promise.resolve({ ok: true, json: () => Promise.resolve({
  rot: 0, updated: new Date().toISOString(),
  featured: ['neon-racer', 'cyber-shooter', 'pixel-dungeon', 'light-cycle', 'tank-battle', 'bubble-shooter'],
  deal: { item: 'boost-2x', pct: 20 },
  challenge: 'neon-snake',
  botBoost: [1, 1.2, 1.4, 1.6, 1.8],
}) });

function inlineScript(file) {
  const s = window.document.createElement('script');
  s.textContent = fs.readFileSync(path.join(ROOT, file), 'utf8');
  window.document.body.appendChild(s);
  return new Promise(r => setTimeout(r, 30));
}

(async () => {
  let fails = 0;
  const ok = (name, cond) => { console.log((cond ? '  PASS ' : '  FAIL ') + name); if (!cond) fails++; };
  try {
    await inlineScript('games/controls.js');
    await inlineScript('assets/logos.js');
    await inlineScript('games/core.js');
    await new Promise(r => setTimeout(r, 80));
    await inlineScript('app.js');
    await new Promise(r => setTimeout(r, 400)); // init + loadLive
  } catch (e) {
    console.log('SCRIPT LOAD ERROR: ' + e.message);
    process.exit(1);
  }

  // 1. window.liveChallenge exported + returns the fetched LIVE challenge
  ok('window.liveChallenge is a function', typeof window.liveChallenge === 'function');
  ok('liveChallenge returns banner game (live_state)', typeof window.liveChallenge === 'function' && window.liveChallenge() === 'neon-snake');

  // 2. home banner rendered with the REAL reward text
  const banner = window.document.querySelector('.deal-banner');
  ok('challenge banner rendered on home', !!banner);
  ok('banner names the game + reward', !!banner && /neon-snake|Neon Snake/.test(banner.textContent) && /40/.test(banner.textContent) && banner.textContent.includes('🪙'));
  ok('banner claim is honest (no vague "earn bonus coins")', !!banner && !/earn bonus coins/.test(banner.textContent));

  // 3. offline fallback: same function with LIVE cleared still returns a game id
  //    (LIVE is module-scope in app.js — verify the fallback path statically + via function shape)
  const appSrc = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  ok('offline fallback pool exists in app.js', /CHALL_FALLBACK_POOL/.test(appSrc) && /dayIdx % CHALL_FALLBACK_POOL\.length/.test(appSrc));
  ok('fallback is deterministic day rotation (mirrors rotate_daily)', /Math\.floor\(Date\.now\(\) \/ 86400000\)/.test(appSrc));

  // 4. endGame challenge payout guards are wired (static, from loaded core source)
  const core = fs.readFileSync(path.join(ROOT, 'games/core.js'), 'utf8');
  const endGame = core.slice(core.indexOf('function endGame'), core.indexOf('function shuffle'));
  ok('core has challenge bonus logic', /CHALLENGE BONUS/.test(endGame) && /challBonus = 40/.test(endGame));
  ok('once-per-day gate', /rah_chall_/.test(endGame) && /localStorage/.test(endGame));
  ok('payout gated on banner game + new best', /challId && challId === gameState\.id && isNewBest/.test(endGame));

  // 5. 2048 settle also pays
  ok('2048 settle pays challenge bonus', /challId2048 === '2048'/.test(core));

  console.log(fails === 0 ? '\nALL V7.39 DOM CHECKS PASSED' : '\n' + fails + ' CHECKS FAILED');
  process.exit(fails === 0 ? 0 : 1);
})();