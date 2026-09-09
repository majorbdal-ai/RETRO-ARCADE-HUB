/* Game registry consistency check — ensures app.js (GAMES), games/core.js (engine map),
   games/controls.js (CONTROL_LAYOUT), and version.json all agree on the same game set. */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'games/core.js'), 'utf8');
const ctrl = fs.readFileSync(path.join(root, 'games/controls.js'), 'utf8');

const GAMES_BLOCK = app.match(/const GAMES\s*=\s*\[([\s\S]*?)\n\];/);
if (!GAMES_BLOCK) { console.error('Could not locate GAMES array in app.js'); process.exit(1); }
const ids = [...GAMES_BLOCK[1].matchAll(/id: '([a-z0-9-]+)'/g)].map(m => m[1]);
const engineIds = [...core.matchAll(/^\s*'([a-z0-9-]+)':/gm)].map(m => m[1]);
const ctrlIds = [...ctrl.matchAll(/^\s*'([a-z0-9-]+)':/gm)].map(m => m[1]);

let fail = false;
if (ids.length !== engineIds.length || ids.length !== ctrlIds.length) {
  console.error('COUNT MISMATCH: app.js=' + ids.length + ' core.js=' + engineIds.length + ' controls.js=' + ctrlIds.length);
  fail = true;
}
const missing = ids.filter(i => !engineIds.includes(i))
  .concat(engineIds.filter(i => !ids.includes(i)))
  .concat(ids.filter(i => !ctrlIds.includes(i)));
if (missing.length) {
  console.error('MISSING/UNREGISTERED:', missing.join(', '));
  fail = true;
}
try {
  const vj = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8'));
  if (vj.games !== ids.length) {
    console.error('version.json games (' + vj.games + ') != registry (' + ids.length + ')');
    fail = true;
  }
} catch (e) {
  console.error('version.json unreadable:', e.message);
  fail = true;
}

if (fail) process.exit(1);
console.log('OK: ' + ids.length + ' games consistent across app.js / core.js / controls.js / version.json');