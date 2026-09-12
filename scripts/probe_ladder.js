#!/usr/bin/env node
/* Behavioral spot-check for ladder_climb (not a suite test — a one-off QA probe):
   1) idle run → every hold falls past → 3 misses → game over MUST fire
   2) tapping run → climber survives and scores */
const fs = require('fs'), path = require('path');
const G = path.join(__dirname, '..', 'games');
function chainable(){ const f = function(){ return f; }; return new Proxy(f, { get(t,p){ if(p==='addColorStop') return ()=>{}; if(p===Symbol.toPrimitive) return ()=>0; return chainable(); }, set(){ return true; }, apply(){ return chainable(); } }); }
function makeCtx(){ return new Proxy({}, { get(t,p){ if(p==='canvas') return {width:800,height:450}; if(p==='measureText') return ()=>({width:10}); if(p==='createLinearGradient'||p==='createRadialGradient'||p==='createPattern') return ()=>chainable(); return chainable(); }, set(){ return true; } }); }
const canvas = { width:800, height:450, style:{}, getContext(){ return makeCtx(); }, addEventListener(){}, removeEventListener(){}, getBoundingClientRect(){ return {left:0,top:0,width:800,height:450}; } };
let rafCbs = {};
global.requestAnimationFrame = (cb)=>{ const id=Math.random(); rafCbs[id]=cb; return id; };
global.cancelAnimationFrame = (id)=>{ delete rafCbs[id]; };
global.__t = 0;
global.performance = { now: ()=>{ global.__t+=16; return global.__t; } };
if (!globalThis.navigator) globalThis.navigator = { vibrate: ()=>false };
const code = fs.readFileSync(path.join(G,'ladder_climb.js'),'utf8');
const run = new Function('canvas','ctx','onScore','onGameOver','onCoins','window', code + '; return ladderClimb;');
const winStub = { gameFX: { burst(){}, shake(){} }, popScore(){}, playSfx(){} };

function frames(n, eng, inputFn){
  for (let f = 0; f < n; f++) {
    if (inputFn) eng.setInput(inputFn(f), {});
    const cbs = Object.values(rafCbs); rafCbs = {};
    cbs.forEach(cb => cb(performance.now()));
  }
}

// --- test 1: idle (never press) → must die within ~40s of sim time ---
let gameOver = null;
const makeEng = () => {
  const ctor = run(canvas, makeCtx(), ()=>{}, ()=>{}, ()=>{}, winStub);
  return ctor(canvas, makeCtx(), ()=>{}, (s,c)=>{ gameOver = {s,c}; }, ()=>{});
};
let eng = makeEng();
eng.start();
frames(2500, eng, ()=> ({ action:false }));
const simSecs = Math.round(global.__t / 1000);
console.log('IDLE: gameOver =', !!gameOver, '| sim', simSecs + 's', gameOver ? '(score='+gameOver.s+', coins='+gameOver.c+')' : '❌ NO GAME OVER — miss mechanic broken');
if (!gameOver) process.exit(1);

// --- test 2: tap rhythmically → should survive and score ---
gameOver = null;
let lastScore = 0;
eng = null;
const ctor2 = run(canvas, makeCtx(), ()=>{}, ()=>{}, ()=>{}, winStub);
const eng2 = ctor2(canvas, makeCtx(), (s)=>{ lastScore = s; }, (s,c)=>{ gameOver = {s,c}; }, ()=>{});
eng2.start();
frames(2500, eng2, (f)=> ({ action: (f % 5 === 0) })); // tap every 5 frames (~80ms)
console.log('TAP:  gameOver =', !!gameOver, '| final score =', lastScore, '| survived 40s sim:', !gameOver);
if (gameOver) process.exit(1);
console.log('✔ ladder_climb behavioral checks passed');