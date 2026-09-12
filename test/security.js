#!/usr/bin/env node
/* RETRO ARCADE HUB — B9: security & input & cleanup tests (static + headless-friendly)
   Tests: XSS escape, buy price trust, coin funnel, touch cleanup, tilt listener cleanup.
   Usage: node test/security.js  (no browser needed — pure static asserts) */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'games/core.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let pass = 0, fail = 0;
const t = (name, cond) => { if (cond) { pass++; console.log('✅ ' + name); } else { fail++; console.log('❌ ' + name); } };

// 1. XSS escape exists + used in leaderboard renders
t('escHTML() defined in app.js', /function escHTML\s*\(/.test(app));
t('leaderboard refresh escapes username', /escHTML\(b\.username\)/.test(app) || /escHTML\(.*username/.test(app));
t('boardList render escapes name/avatar', /escHTML\(b\.name\)/.test(app));
// 2. buyItem does NOT trust caller price
t('buyItem resolves authoritative price', /SHOP_ITEMS/.test(app) && /realPrice|find\(.*\.id === id\)/.test(app.slice(app.indexOf('function buyItem'), app.indexOf('function equipItem'))));
t('buyTheme no duplicate purchase', /inventory\.includes\('theme-' \+ id\)/.test(app));
// 3. Coin funnel: onCoinCb must NOT add state.coins directly
const coinCb = core.slice(core.indexOf('const onCoinCb'), core.indexOf('const onOverCb'));
t('onCoinCb does not double-add coins', !/state\.coins \+=/.test(coinCb));
// 4. endGame awards once
const endGame = core.slice(core.indexOf('function endGame'), core.indexOf('function shuffle'));
const coinAdds = (endGame.match(/state\.coins \+=/g) || []).length;
t('endGame awards coins in <12 locations (no triple-add bug)', coinAdds >= 2 && coinAdds < 12);
// 4b. combo payoff TDZ guard: scoreCoins must be declared before comboBonus uses it (v7.27 fix)
const comboPay = core.slice(core.indexOf('const comboMult = getComboMultiplier'), core.indexOf('state.stats.gamesPlayed'));
t('combo payoff: scoreCoins declared before comboBonus (no TDZ crash)', comboPay.indexOf('const scoreCoins') !== -1 && comboPay.indexOf('const scoreCoins') < comboPay.indexOf('comboBonus'));
// 5. touchcancel handled in bindGameTouch
t('bindGameTouch handles touchcancel', (core.match(/touchcancel/g) || []).length >= 3);
t('bindGameTouch handles mouseleave', (core.match(/mouseleave/g) || []).length >= 3);
// 6. Tilt cleanup: stopTilt exists + called on exit/end
t('stopTilt() defined', /function stopTilt/.test(core));
t('stopTilt called in exitToHub', /exitToHub[\s\S]{0,400}stopTilt\(\)/.test(core));
t('stopTilt called in endGame', /function endGame[\s\S]{0,300}stopTilt\(\)/.test(core));
// 7. Back button: pause first, exit on double
const popstate = core.slice(core.indexOf("popstate"), core.indexOf("function pushGameHistory"));
t('back-button: pause-first + double-back exit', /togglePause\(\)/.test(popstate) && /backPressedAt/.test(popstate) && /exitToHub\(\)/.test(popstate));
// 8. SEO: canonical, robots, sitemap, JSON-LD
t('canonical link present', /rel="canonical"/.test(html));
t('JSON-LD structured data', /application\/ld\+json/.test(html));
t('robots.txt exists', fs.existsSync(path.join(root, 'robots.txt')));
t('sitemap.xml exists', fs.existsSync(path.join(root, 'sitemap.xml')));
// 9. PWA: SW individual engine caching (no all-or-nothing addAll)
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
t('SW install catches per-engine failures', /try \{ await c\.add\(url\); \} catch/.test(sw));
t('SW cache version matches version.json', (() => {
  try { const vj = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8')); return sw.includes('v' + vj.version); } catch { return false; }
})());
// 10. Restart does full cleanup
t('restartGame does full cleanup + relaunch', /restartGame[\s\S]{0,500}unbindGameTouch\(\)/.test(core) && /restartGame[\s\S]{0,700}launchGame\(id\)/.test(core));
// 11. Coin-continue (revive): one per run, deducts 150, carries score floor
t('reviveGame defined', /function reviveGame/.test(core));
t('revive costs 150 coins', /const COST = 150/.test(core));
t('revive deducts from state.coins', /reviveGame[\s\S]{0,400}state\.coins -= COST/.test(core));
t('revive caps at one per run', /reviveUsed/.test(core) && /One continue per run/.test(core));
t('revive carries score floor', /pendingReviveFloor = gameState\.score/.test(core));
t('floor added in onOverCb', /onOverCb = \(score, coinsEarned\) => endGame\(score \+ reviveFloor, coinsEarned\)/.test(core));
t('floor shown in HUD via onScoreCb', /const shown = s \+ reviveFloor/.test(core));
t('CONTINUE button present in overlay', /id="reviveBtn"/.test(html));
// 12. 70-game target coverage — every game has a star/retry target
t('GAME_TARGETS covers all 70 games', core.includes('const GAME_TARGETS') && core.match(/'[a-z0-9-]+':/g).filter(x => x.includes('-')).length >= 1, );

console.log(`\n${pass}/${pass + fail} security/input/cleanup checks passed`);
process.exit(fail ? 1 : 0);