#!/usr/bin/env node
/* RETRO ARCADE HUB — headless lifecycle test for all game engines
   Usage: node test/run_all.js
   Loads each games/*.js engine, stubs canvas/rAF, runs start→frames→pause→resume→destroy. */
const fs = require('fs'); const path = require('path');
const G = path.join(__dirname, '..', 'games');
function chainable(){ const f = function(){ return f; }; return new Proxy(f, { get(t, p){ if(p==='addColorStop') return ()=>{}; if(p===Symbol.toPrimitive) return ()=>0; return chainable(); }, set(){ return true; }, apply(){ return chainable(); } }); }
function makeCtx(){ return new Proxy({}, { get(t, p){ if(p==='canvas') return {width:800,height:450}; if(p==='measureText') return ()=>({width:10}); if(p==='createLinearGradient'||p==='createRadialGradient'||p==='createPattern') return ()=>chainable(); if(p==='getImageData') return ()=>({data:new Uint8ClampedArray(4)}); return chainable(); }, set(){ return true; } }); }
const canvas = { width:800, height:450, style:{}, getContext(){ return makeCtx(); }, addEventListener(){}, removeEventListener(){}, getBoundingClientRect(){ return {left:0,top:0,width:800,height:450}; } };
let rafCbs = {};
global.requestAnimationFrame = (cb)=>{ const id=Math.random(); rafCbs[id]=cb; return id; };
global.cancelAnimationFrame = (id)=>{ delete rafCbs[id]; };
global.__t = 0;
try { global.performance = { now: ()=>{ global.__t+=16; return global.__t; } }; }
catch(e) { Object.defineProperty(global, 'performance', { value: { now: ()=>{ global.__t+=16; return global.__t; } }, writable: true, configurable: true }); }
if (!globalThis.performance) globalThis.performance = global.performance;

// Build map file→fn from core.js GAME_ENGINE
const core = fs.readFileSync(path.join(G,'core.js'),'utf8');
const map = {};
const re = /'([^']+)':\s+'(\w+)'/g; let m;
while ((m = re.exec(core))) {
  const fn = m[2];
  if (fn === 'engineReady') continue;
  const f = fn[0].toLowerCase() + fn.slice(1).replace(/([A-Z])/g, '_$1').toLowerCase() + '.js';
  if (['core.js','controls.js','project_status.js'].includes(f)) continue;
  const fp = path.join(G, f);
  if (fs.existsSync(fp) && fs.readFileSync(fp,'utf8').includes('function '+fn+'(')) map[f.slice(0,-3)] = fn;
}
const results = [];
for (const [file, fn] of Object.entries(map)) {
  try {
    const code = fs.readFileSync(path.join(G, file + '.js'),'utf8');
    const run = new Function('canvas','ctx','onScore','onGameOver','onCoins','window', code + '; return ' + fn + ';');
    const engineFn = run(canvas, makeCtx(), ()=>{}, ()=>{}, ()=>{}, {});
    const eng = engineFn(canvas, makeCtx(), ()=>{}, ()=>{}, ()=>{});
    eng.start();
    for (let i=0;i<25;i++){ const cbs=Object.values(rafCbs); rafCbs={}; cbs.forEach(cb=>cb(performance.now())); }
    eng.setInput && eng.setInput({left:true,right:false,up:true,down:false,action:true,gas:true,brake:false}, {ArrowLeft:true,Space:true,ArrowDown:true});
    for (let i=0;i<15;i++){ const cbs=Object.values(rafCbs); rafCbs={}; cbs.forEach(cb=>cb(performance.now())); }
    eng.pause(); eng.resume(); eng.destroy();
    results.push('PASS ' + file);
  } catch (e) {
    results.push('FAIL ' + file + ' — ' + (e && e.message ? e.message : String(e)) + (e && e.stack ? '\n' + e.stack.split('\n').slice(0,4).join('\n') : ''));
  }
}
results.forEach(r=>console.log(r));
const fails = results.filter(r=>r.startsWith('FAIL'));
console.log(`\n${results.length - fails.length}/${results.length} engines passed`);
process.exit(fails.length ? 1 : 0);
