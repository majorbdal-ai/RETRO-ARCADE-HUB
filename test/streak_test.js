// Headless smoke test for the v7.9 Daily Streak logic in app.js
const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('app.js', 'utf8');

// stub localStorage + a minimal DOM the top-level code touches
const mem = {};
const storage = {
  getItem: k => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: k => { delete mem[k]; }
};
const el = () => ({ innerText: '', innerHTML: '', classList: { add(){}, remove(){}, contains(){ return false; } }, style: {}, appendChild(){}, addEventListener(){}, removeEventListener(){}, querySelectorAll(){ return []; }, parentElement: null, getContext(){ return {}; }, setAttribute(){}, getBoundingClientRect(){ return { left:0, top:0, width:0, height:0 }; } });
function fakeDom(id){ if (id === 'page-profile') return { classList: { contains(){ return false; } } }; return el(); }
const sandbox = {
  console, Math, Date, setTimeout, clearTimeout, JSON, Object, Array,
  localStorage: storage, navigator: { onLine: true, serviceWorker: { register(){ return Promise.resolve(); } } },
  location: { protocol: 'file:', href: '' }, fetch(){ return Promise.resolve(); },
  document: {
    getElementById: fakeDom,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: el,
    body: { appendChild(){} },
    addEventListener(){}, documentElement: { style: { setProperty(){} } }
  },
  window: {},
  addEventListener(){}, removeEventListener(){},
  requestAnimationFrame: cb => 1,
  innerWidth: 800, innerHeight: 600,
  // functions used at top level
  toast(){}, showVersionBadge(){}, renderProfile(){},
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'app.js' });

// extract live state
const S = vm.runInContext('state', sandbox);
console.log('initial streak:', S.streak, 'lastPlay:', S.lastPlay);

// Simulate DAY 1: play a game
function playDay(dayOffset) {
  vm.runInContext(`updateStreak();`, sandbox);
}
// current day is "today"; we can't change Date easily, so directly simulate: set lastPlay to yesterday then call
const now = new Date();
const yestStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
vm.runInContext(`state.lastPlay = ${yestStart}; state.streak = 0;`, sandbox);
playDay(0);
const s1 = vm.runInContext('state', sandbox);
console.log('after day1 play: streak=', s1.streak, 'lastPlayToday=', s1.lastPlay === new Date(new Date().getFullYear(), now.getMonth(), now.getDate()).getTime(), 'coins=', s1.coins);

// Simulate DAY 2 (consecutive): set lastPlay to today-start (same day already played) -> should NOT increment again
vm.runInContext(`state.lastPlay = ${new Date(new Date().getFullYear(), now.getMonth(), now.getDate()).getTime()};`, sandbox);
playDay(0);
const s2 = vm.runInContext('state', sandbox);
console.log('same-day replay: streak=', s2.streak, '(should stay 1)');

// Simulate a gap (missed day) -> streak resets to 1 but does not double-count
const twoDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2).getTime();
vm.runInContext(`state.lastPlay = ${twoDaysAgo}; state.streak = 5;`, sandbox);
playDay(0);
const s3 = vm.runInContext('state', sandbox);
console.log('after 2-day gap: streak=', s3.streak, '(should be 1 — reset)');

// Milestone: simulate 7 consecutive days by faking lastPlay yesterday + streak 6
vm.runInContext(`state.lastPlay = ${yestStart}; state.streak = 6; state.streakClaimed = {}; state.coins = 0;`, sandbox);
playDay(0);
const s4 = vm.runInContext('state', sandbox);
console.log('milestone day7: streak=', s4.streak, 'coins=', s4.coins, '(expect 7 and 500)');
// claiming twice should not double-pay
playDay(0);
const s5 = vm.runInContext('state', sandbox);
console.log('same-day after claim: coins=', s5.coins, '(expect still 500)');

// renderStreak produces widget html without throwing
try { vm.runInContext('renderStreak();', sandbox); console.log('renderStreak: OK (no throw)'); }
catch (e) { console.log('renderStreak THREW:', e.message); process.exit(1); }
console.log('\nALL STREAK CHECKS DONE');