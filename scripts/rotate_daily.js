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
const ALL_FEATURED = [
  'neon-racer', 'cyber-shooter', 'pixel-dungeon', 'light-cycle',
  'tank-battle', 'bubble-shooter', 'neon-dash', 'sling-birds', 'cricket-sixer'
];
const FEATURED_SHOW = 6;
const SHOP_ITEMS = [
  { id: 'skin-dragon', name: 'DRAGON SKIN' }, { id: 'skin-cyber', name: 'NEON PHANTOM' },
  { id: 'skin-gold', name: 'GOLD LEGEND' }, { id: 'veh-falcon', name: 'FALCON X' },
  { id: 'veh-viper', name: 'VIPER GT' }, { id: 'veh-phantom', name: 'PHANTOM CYCLE' },
  { id: 'fx-fire', name: 'FIRE TRAIL' }, { id: 'fx-rainbow', name: 'RAINBOW' },
  { id: 'fx-stars', name: 'STARBURST' }, { id: 'boost-2x', name: '2X SCORE' },
  { id: 'boost-shield', name: 'SHIELD' }, { id: 'boost-slow', name: 'SLOW MOTION' }
];
const CHALLENGE_POOL = [
  'neon-racer', 'cyber-shooter', 'pixel-dungeon', 'neon-snake', 'brick-breaker',
  'tetris-blitz', 'flappy-neon', 'pac-runner', 'space-invaders', 'fruit-slash',
  'water-sort', '2048', 'pinball', 'crossy-neon', 'math-dash', 'ladder-climb',
  'trash-sorter', 'cricket-sixer', 'bowling-strike', 'helix-drop'
];
const BOT_COUNT = 8;

function rotCur(state) {
  const r = (state.rot + 1) % (ALL_FEATURED.length - FEATURED_SHOW + 1);
  return r;
}

function nextState(prev) {
  const rot = (typeof prev.rot === 'number' ? prev.rot : 0) + 1;
  // featured: rotate window over the 9 featured games
  const featured = [];
  for (let i = 0; i < FEATURED_SHOW; i++) {
    featured.push(ALL_FEATURED[(rot + i) % ALL_FEATURED.length]);
  }
  // deal: rotate through shop items
  const dealItem = SHOP_ITEMS[rot % SHOP_ITEMS.length];
  const deal = { item: dealItem.id, name: dealItem.name, pct: [10, 15, 20, 25, 30][rot % 5] };
  // challenge: pick by rot (stable within the day slot)
  const challenge = CHALLENGE_POOL[rot % CHALLENGE_POOL.length];
  // bots: small deterministic drift (never huge; keeps leaderboard lively)
  const botBoost = [];
  for (let i = 0; i < BOT_COUNT; i++) {
    const base = [1.0, 1.2, 1.4, 1.6, 1.8][(rot + i) % 5];
    botBoost.push(+(base + ((rot * 7 + i * 13) % 10) / 100).toFixed(2));
  }
  return { rot, updated: new Date().toISOString(), featured, deal, challenge, botBoost };
}

function main() {
  let prev = { rot: 0, featured: [], deal: { item: null }, challenge: null, botBoost: [] };
  try { prev = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (e) {}
  const next = nextState(prev);
  fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2) + '\n');
  console.log('rot=' + next.rot);
  console.log('featured=' + next.featured.join(','));
  console.log('deal=' + next.deal.item + ' ' + next.deal.pct + '%');
  console.log('challenge=' + next.challenge);
  console.log('bots=' + next.botBoost.join(','));
}
main();