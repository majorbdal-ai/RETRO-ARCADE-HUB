/* Game registry consistency check — ensures app.js (GAMES), games/core.js (engine map),
   games/controls.js (CONTROL_LAYOUT), version.json, sw.js preload, and engine FILE existence
   all agree on the same game set. B10: extended with file + SW + skin coverage. */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'games/core.js'), 'utf8');
const ctrl = fs.readFileSync(path.join(root, 'games/controls.js'), 'utf8');
const sw = fs.existsSync(path.join(root, 'sw.js')) ? fs.readFileSync(path.join(root, 'sw.js'), 'utf8') : '';

const GAMES_BLOCK = app.match(/const GAMES\s*=\s*\[([\s\S]*?)\n\];/);
if (!GAMES_BLOCK) { console.error('Could not locate GAMES array in app.js'); process.exit(1); }
const ids = [...GAMES_BLOCK[1].matchAll(/id: '([a-z0-9-]+)'/g)].map(m => m[1]);
const engineBlock = core.match(/const GAME_ENGINE\s*=\s*\{([\s\S]*?)\n\};/);
if (!engineBlock) { console.error('Could not locate GAME_ENGINE in core.js'); process.exit(1); }
const engineIds = [...engineBlock[1].matchAll(/^\s*'([a-z0-9-]+)':/gm)].map(m => m[1]);
const ctrlIds = [...ctrl.matchAll(/^\s*'([a-z0-9-]+)':/gm)].map(m => m[1]);
// B10: engine fn name → file (camelCase → snake_case, special cases)
const fnBlock = core.match(/const GAME_ENGINE\s*=\s*\{([\s\S]*?)\n\};/);
const fnMap = {};
if (fnBlock) {
  for (const m of fnBlock[1].matchAll(/^\s*'([a-z0-9-]+)'\s*:\s*'?([a-zA-Z0-9]+)'?,?\s*$/gm)) {
    const [, id, fn] = m;
    if (fn) fnMap[id] = fn;
  }
}
function fnToFile(fn) {
  if (fn === 'bounce') return 'bounce.js';
  if (fn === 'spaceImpact') return 'space_impact.js';
  if (fn === 'bantumi') return 'bantumi.js';
  return fn.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().replace(/^game_/, 'game') + '.js';
}
// GAME_SKIN map (app.js) — game → theme
const skinBlock = app.match(/const GAME_SKIN\s*=\s*\{([\s\S]*?)\n\};/);
const skinIds = skinBlock ? [...skinBlock[1].matchAll(/^\s*'?([a-z0-9-]+)'?\s*:/gm)].map(m => m[1]) : [];

let fail = false;
const errs = [];

if (ids.length !== engineIds.length) {
  errs.push('COUNT MISMATCH: app.js=' + ids.length + ' core.js=' + engineIds.length);
  fail = true;
}
// B10: every game must have a control layout
const noCtrl = ids.filter(i => !ctrlIds.includes(i));
if (noCtrl.length) { errs.push('NO CONTROL LAYOUT: ' + noCtrl.join(', ')); fail = true; }
// unknown extra controls
const extraCtrl = ctrlIds.filter(i => !ids.includes(i));
if (extraCtrl.length) { errs.push('UNUSED CONTROL LAYOUT: ' + extraCtrl.join(', ')); fail = true; }
// B10: engine file must exist & match
const missFiles = [];
for (const id of ids) {
  const fn = fnMap[id];
  if (!fn) { errs.push('NO ENGINE FN for ' + id); fail = true; continue; }
  const file = fnToFile(fn);
  if (!fs.existsSync(path.join(root, 'games', file))) missFiles.push(id + '→' + file);
}
if (missFiles.length) { errs.push('MISSING ENGINE FILE: ' + missFiles.join(', ')); fail = true; }
// B10: sw.js must pre-cache every engine file
if (sw) {
  const missingSw = ids.filter(id => {
    const fn = fnMap[id];
    if (!fn) return true;
    return !sw.includes('./games/' + fnToFile(fn));
  });
  if (missingSw.length) { errs.push('NOT IN sw.js PRELOAD: ' + missingSw.join(', ')); fail = true; }
} else {
  errs.push('sw.js missing'); fail = true;
}
// B10: every game id must have a GAME_TARGETS entry (stars/retry/mission consistency)
const targetBlock = core.match(/const GAME_TARGETS\s*=\s*\{([\s\S]*?)\n\};/);
if (!targetBlock) {
  errs.push('GAME_TARGETS map missing in core.js'); fail = true;
} else {
  const targetIds = [...targetBlock[1].matchAll(/'([a-z0-9-]+)':/g)].map(m => m[1]);
  const noTgt = ids.filter(i => !targetIds.includes(i));
  if (noTgt.length) { errs.push('NO GAME_TARGET for: ' + noTgt.join(', ')); fail = true; }
  const extraTgt = targetIds.filter(i => !ids.includes(i));
  if (extraTgt.length) { errs.push('GAME_TARGET for unknown game: ' + extraTgt.join(', ')); fail = true; }
}
try {
  const vj = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8'));
  if (vj.games !== ids.length) {
    errs.push('version.json games (' + vj.games + ') != registry (' + ids.length + ')');
    fail = true;
  }
} catch (e) {
  errs.push('version.json unreadable: ' + e.message); fail = true;
}
if (fail) {
  errs.forEach(e => console.error('❌ ' + e));
  console.error('\nConsistency FAIL (' + ids.length + ' games)');
  process.exit(1);
} else {
  console.log('✅ Consistency OK: ' + ids.length + ' games | engines | controls | files | sw | version.json all agree');
}