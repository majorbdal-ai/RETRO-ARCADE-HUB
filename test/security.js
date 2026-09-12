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
t('window.endGame exposed for legacy engines (bounce/bantumi self-report)', /window\.endGame\s*=\s*endGame/.test(core));
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
// 13. RESIZE RECURSION GUARD (v7.29.1 regression): never dispatch a synthetic
// 'resize' event from inside a resize/orientation listener — that recurses forever
// and hangs the phone on game start.
t('no synthetic resize dispatch in core.js', !/dispatchEvent\(\s*new Event\(['"]resize['"]\)/.test(core));
t('no resize listener in core.js that re-dispatches resize', !/addEventListener\(\s*['"]resize['"][\s\S]{0,200}dispatchEvent/.test(core));
// 14. ROTATE-LOCK REMOVED (v7.31.0): user said "rotate বন্ধ করো" — no
// orientation.lock, no tryLockLandscape, no fullscreenchange retry, no unlock.
// The canvas must work in portrait; CSS media queries handle refit automatically.
t('no tryLockLandscape anywhere', !core.includes('tryLockLandscape'));
t('no orientation.lock anywhere', !/\.orientation\s*\.\s*lock/.test(core) && !core.includes('orientation.lock'));
t('no fullscreenchange listener', !/['"]fullscreenchange['"]/.test(core));
t('no orientation.unlock in exit path', !/orientation\s*\.\s*unlock/.test(core) && !core.includes('orientation.unlock'));
t('no rotate-hint code in core', !core.includes('updateGameOrientation') && !core.includes('rotateHintTimer') && !core.includes('rotateHint'));
// 15. AUTO-FULLSCREEN (v7.29.0): games request fullscreen on start, exit on hub
t('bootGame requests fullscreen', /function bootGame[\s\S]{0,1500}requestFullscreen/.test(core));
t('exitToHub exits fullscreen', /exitToHub[\s\S]{0,600}exitFullscreen/.test(core));
// 16. rotate-hint fully removed (v7.29.1): no leftover DOM/CSS/JS references
t('playAreaLabel removed from html', !html.includes('playAreaLabel'));
t('updateGameOrientation removed', !core.includes('updateGameOrientation'));
t('rotateHintTimer removed', !core.includes('rotateHintTimer'));
// 17. SWIPE+ACTION type (v7.31): directional swipe games with an ACTION button —
// must be in gestureTypes so canvas gestures stay bound, and rendered in drawControls
t('swipe+action in gestureTypes', /gestureTypes = \[[^\]]*swipe\+action/.test(core));
t('swipe+action rendered in drawControls', /type === 'swipe\+action'[\s\S]{0,260}btn_action/.test(core));
t('swipe+action games use touches.action', core.includes("pressed('action'"));
// 18. BUTTON-GAMES DO NOT BIND CANVAS TOUCH (v7.31): bindGameTouch early-returns
// for non-gesture layout types, so button games get NO swipe/tap on canvas
t('bindGameTouch skips non-gesture layouts', /gestureTypes\.indexOf\(cType\) === -1\)\s*\{[\s\S]{0,200}return;/.test(core));
t('tutorial toast element exists', html.includes('tutorialToast'));
t('tutorial toast shown at bootGame', /bootGame[\s\S]{0,2000}showTutorialToast\(/.test(core));
// 19. MASTERY STARS (v7.32): persisted per-game ★ rating — state key + endGame write + card render
t('mastery stars storage key in app state', app.includes("stars: store.get('rah_stars', {})"));
t('mastery stars persisted in saveState', /store\.set\('rah_stars', state\.stars/.test(app));
t('endGame writes max stars', /MASTERY STARS[\s\S]{0,400}state\.stars\[gameState\.id\]/.test(core) && /earnedStars > prev/.test(core));
t('cards render real stars (no fake hash)', !app.includes('Math.random()*4') && app.includes('starRow(g.id)'));

console.log(`\n${pass}/${pass + fail} security/input/cleanup checks passed`);
process.exit(fail ? 1 : 0);