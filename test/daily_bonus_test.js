// Headless smoke test for the v7.17 Daily Bonus (7-day escalating coin claim) logic in app.js
// Mirrors test/streak_test.js sandbox pattern. Verifies the state machine:
//   day1 claimable → claim pays amount + advances day → same-day cannot re-claim
//   missed day resets to day 1 → 7-day cycle wraps
const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('app.js', 'utf8');

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
  toast(){}, showVersionBadge(){}, renderProfile(){}, renderDailyBonus(){},
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'app.js' });

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

// Force a clean slate
vm.runInContext('state.dailyBonus = null; state.coins = 0;', sandbox);

// --- DAY 1: claimable at index 0 (120) ---
let d = vm.runInContext('dailyBonusInfo()', sandbox);
check('day1 claimable index 0', d.day === 0 && d.claimedToday === false);
check('day1 amount = 120', d.amount === 120);
vm.runInContext('claimDailyBonus()', sandbox);
let s = vm.runInContext('state', sandbox);
check('claim pays 120', s.coins === 120);
check('advances to day 2 (index 1)', s.dailyBonus.day === 1);
d = vm.runInContext('dailyBonusInfo()', sandbox);
check('same-day claimed', d.claimedToday === true);
vm.runInContext('claimDailyBonus()', sandbox);
s = vm.runInContext('state', sandbox);
check('no double-claim same day', s.coins === 120);

// --- DAY 2: next calendar day, consecutive → index 1 (150) ---
const now = new Date();
const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
vm.runInContext(`state.dailyBonus.lastClaim = ${todayStart - 86400000};`, sandbox);
d = vm.runInContext('dailyBonusInfo()', sandbox);
check('day2 claimable index 1', d.day === 1 && d.claimedToday === false);
vm.runInContext('claimDailyBonus()', sandbox);
s = vm.runInContext('state', sandbox);
check('day2 pays 150 (cumulative 270)', s.coins === 270);

// --- MISSED DAY: gap > 1 day → reset to index 0 ---
vm.runInContext(`state.dailyBonus = { day: 4, lastClaim: ${todayStart - 3 * 86400000} };`, sandbox);
d = vm.runInContext('dailyBonusInfo()', sandbox);
check('missed day resets to index 0', d.day === 0 && d.amount === 120);

// --- 7-DAY CYCLE WRAP: claim day 7 (600) → next is day 1 (120) ---
vm.runInContext(`state.dailyBonus = { day: 6, lastClaim: ${todayStart - 86400000} };`, sandbox);
d = vm.runInContext('dailyBonusInfo()', sandbox);
check('day7 claimable index 6', d.day === 6 && d.amount === 600);
vm.runInContext('claimDailyBonus()', sandbox);
s = vm.runInContext('state', sandbox);
check('after day7 wraps to day1 (index 0)', s.dailyBonus.day === 0);

// --- renderDailyBonus + bonusChipHtml don't throw ---
try { vm.runInContext('renderDailyBonus(); bonusChipHtml(dailyBonusInfo());', sandbox); check('renderDailyBonus/bonusChipHtml render OK', true); }
catch (e) { check('renderDailyBonus/bonusChipHtml render OK (' + e.message + ')', false); }

console.log(`\nDAILY BONUS: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);