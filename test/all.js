#!/usr/bin/env node
/* RETRO ARCADE HUB — full test suite: consistency + security + all engines
   Usage: node test/all.js */
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const dir = __dirname;

const suites = [
  ['consistency.js', 'registry'],
  ['security.js',    'security/input/cleanup'],
  ['run_all.js',     'engine lifecycle'],
];
let total = 0, failed = 0;
for (const [file, label] of suites) {
  console.log('\n=== ' + label + ' (' + file + ') ===');
  const r = spawnSync(process.execPath, [path.join(dir, file)], { stdio: 'inherit' });
  total++;
  if (r.status !== 0) failed++;
}
console.log(failed === 0
  ? `\n🎮 ALL ${total} SUITES PASSED — ready to ship`
  : `\n❌ ${failed}/${total} suites failed`);
process.exit(failed ? 1 : 0);