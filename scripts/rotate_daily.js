#!/usr/bin/env node
/* ============================================================
   RETRO ARCADE HUB — daily rotation (GitHub Actions cron, 4x/day)
   Rotates: featured games, shop deal, daily challenge, bot scores.
   Does NOT touch code — only live_state.json (safe, never breaks CI).
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STATE_FILE = path.join(ROOT, 'live_state.json');

// ---- current (static) app constants mirrored for rotation ----
// KEEP IN SYNC with `const GAMES = [...]` in app.js: an id that is not in
// GAMES is silently dropped by the app, so only real ids belong here.
const ALL_FEATURED = ['2048', 'neon-flap', 'fruit-fury'];
const FEATURED_SHOW = ALL_FEATURED.length;
const SHOP_ITEMS = [
  { id: 'skin-dragon', name: 'DRAGON SKIN' }, { id: 'skin-cyber', name: 'NEON PHANTOM' },
  { id: 'skin-gold', name: 'GOLD LEGEND' }, { id: 'veh-falcon', name: 'FALCON X' },
  { id: 'veh-viper', name: 'VIPER GT' }, { id: 'veh-phantom', name: 'PHANTOM CYCLE' },
  { id: 'fx-fire', name: 'FIRE TRAIL' }, { id: 'fx-rainbow', name: 'RAINBOW' },
  { id: 'fx-stars', name: 'STARBURST' }, { id: 'boost-2x', name: '2X SCORE' },
  { id: 'boost-shield', name: 'SHIELD' }, { id: 'boost-slow', name: 'SLOW MOTION' }
];
const CHALLENGE_POOL = ['2048', 'neon-flap'];
const BOT_COUNT = 8;

function nextState(prev) {
  const rot = (typeof prev.rot === 'number' ? prev.rot : 0) + 1;

  // featured: rotating window over the featured pool. Sized by the pool (not
  // by a fixed constant) so a short pool still yields a full, non-empty list.
  const featured = [];
  if (ALL_FEATURED.length) {
    const show = Math.min(FEATURED_SHOW, ALL_FEATURED.length);
    for (let i = 0; i < show; i++) {
      const g = ALL_FEATURED[(rot + i) % ALL_FEATURED.length];
      if (g && !featured.includes(g)) featured.push(g);
    }
  }

  // deal: rotate through shop items
  const dealItem = SHOP_ITEMS[rot % SHOP_ITEMS.length];
  const deal = { item: dealItem.id, name: dealItem.name, pct: [10, 15, 20, 25, 30][rot % 5] };

  // challenge: pick by rot (stable within the day slot)
  const challenge = CHALLENGE_POOL.length ? CHALLENGE_POOL[rot % CHALLENGE_POOL.length] : null;

  // bots: small deterministic drift (never huge; keeps leaderboard lively)
  const botBoost = [];
  for (let i = 0; i < BOT_COUNT; i++) {
    const base = [1.0, 1.2, 1.4, 1.6, 1.8][(rot + i) % 5];
    botBoost.push(+(base + ((rot * 7 + i * 13) % 10) / 100).toFixed(2));
  }

  return { rot, updated: new Date().toISOString(), featured, deal, challenge, botBoost };
}

// Never write a state the workflow or the app would reject: fail here and the
// previous good live_state.json stays on disk instead of being poisoned.
function assertSane(s) {
  const bad = [];
  if (!Array.isArray(s.featured) || s.featured.length === 0) bad.push('featured');
  if (!s.deal || !s.deal.item) bad.push('deal');
  if (!s.challenge) bad.push('challenge');
  if (!Array.isArray(s.botBoost) || s.botBoost.length !== BOT_COUNT) bad.push('botBoost');
  if (bad.length) throw new Error('refusing to write invalid live_state: ' + bad.join(', '));
}

function main() {
  let prev = { rot: 0, featured: [], deal: { item: null }, challenge: null, botBoost: [] };
  try { prev = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (e) {}

  const next = nextState(prev);
  assertSane(next);

  fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2) + '\n');
  console.log('rot=' + next.rot);
  console.log('featured=' + next.featured.join(','));
  console.log('deal=' + next.deal.item + ' ' + next.deal.pct + '%');
  console.log('challenge=' + next.challenge);
  console.log('bots=' + next.botBoost.join(','));

  // expose rot to the workflow as steps.rot.outputs.rot
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, 'rot=' + next.rot + '\n');
  }
}
main();
