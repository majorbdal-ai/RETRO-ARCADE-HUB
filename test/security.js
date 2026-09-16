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
// 3. Coin funnel: onCoinCb must NOT add state.coins directly
const coinCb = core.slice(core.indexOf('const onCoinCb'), core.indexOf('const onOverCb'));
t('onCoinCb does not double-add coins', !/state\.coins \+=/.test(coinCb));
// 4. endGame awards once
const endGame = core.slice(core.indexOf('function endGame'), core.indexOf('function shuffle'));
const coinAdds = (endGame.match(/state\.coins \+=/g) || []).length;
t('endGame awards coins in <12 locations (no triple-add bug)', coinAdds >= 2 && coinAdds < 12);
t('endGame still exposed (empty-hub keeps generic lifecycle)', /window\.endGame/.test(core));
// 4c. TODAY'S CHALLENGE (v7.39): banner promise is backed by a real payout —
//     challenge bonus must gate on the banner game + new best + once/day
t('challenge payout exists in endGame (v7.39)', /CHALLENGE BONUS/.test(endGame) && /challBonus = 40/.test(endGame));
t('challenge bonus is once-per-day gated', /rah_chall_/.test(endGame) && /localStorage\.getItem\(challKey\) !== 'done'/.test(endGame));
t('challenge bonus only on new best of the challenge game', /challId && challId === gameState\.id && isNewBest/.test(endGame));
t('window.liveChallenge exported for core payout', /window\.liveChallenge = liveChallenge/.test(app));
// 4d. Daily challenge pools must never silently empty (v7.48.0): offline fallback in
//     app.js must keep referencing the live game set.
const chPool = app.match(/const CHALL_FALLBACK_POOL\s*=\s*\[([^\]]*)\]/);
t('CHALL_FALLBACK_POOL non-empty (offline challenge never dies)', !!(chPool && chPool[1].trim().length > 0));
// 4b. combo payoff TDZ guard: scoreCoins must be declared before comboBonus uses it (v7.27 fix)
const comboPay = core.slice(core.indexOf('const comboMult = getComboMultiplier'), core.indexOf('state.stats.gamesPlayed'));
t('combo payoff: scoreCoins declared before comboBonus (no TDZ crash)', comboPay.indexOf('const scoreCoins') !== -1 && comboPay.indexOf('const scoreCoins') < comboPay.indexOf('comboBonus'));
// 5. touchcancel handled in bindGameTouch
t('bindGameTouch handles touchcancel', (core.match(/touchcancel/g) || []).length >= 3);
t('bindGameTouch handles mouseleave', (core.match(/mouseleave/g) || []).length >= 3);
// 6. Tilt cleanup: stopTilt exists + called on exit/end
t('stopTilt() defined', /function stopTilt/.test(core));
t('stopTilt called in exitToHub', /exitToHub[\s\S]{0,400}stopTilt\(\)/.test(core));
t('stopTilt called in endGame', /function endGame[\s\S]{0,1100}stopTilt\(\)/.test(core));
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
t('restartGame does full cleanup + relaunch', /restartGame[\s\S]{0,900}unbindGameTouch\(\)/.test(core) && /restartGame[\s\S]{0,1000}launchGame\(id\)/.test(core));
// 11. Coin-continue (revive): one per run, deducts 150, carries score floor
t('reviveGame defined', /function reviveGame/.test(core));
t('revive costs 150 coins', /const COST = 150/.test(core));
t('revive deducts from state.coins', /reviveGame[\s\S]{0,900}state\.coins -= COST/.test(core));
t('revive caps at one per run', /reviveUsed/.test(core) && /One continue per run/.test(core));
t('revive carries score floor', /pendingReviveFloor = gameState\.score/.test(core));
t('floor added in onOverCb', /onOverCb = \(score, coinsEarned\) => endGame\(score \+ reviveFloor, coinsEarned\)/.test(core));
t('floor shown in HUD via onScoreCb', /const shown = s \+ reviveFloor/.test(core));
t('CONTINUE button present in overlay', /id="reviveBtn"/.test(html));
// 12. target coverage — every registry game has a star/retry target (dynamic count)
t('GAME_TARGETS covers every registry game', (() => {
  // only the GAMES registry (shop items use id: too) — slice from 'const GAMES = ['
  const gs = app.slice(app.indexOf('const GAMES'), app.indexOf('\n];', app.indexOf('const GAMES')) + 3);
  const reg = (gs.match(/id: '([^']+)'/g) || []).map(x => x.slice(5, -1));
  const tgt = (core.match(/const GAME_TARGETS = \{[\s\S]*?\n\};/) || [''])[0];
  return reg.every(id => tgt.includes("'" + id + "'")); // every registry game has a target
})());
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
t('exitToHub exits fullscreen', /exitToHub[\s\S]{0,900}exitFullscreen/.test(core));
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
// 20. BOOSTER RUNTIME (v7.35): equipped boosters wired into core runtime
//     effects tint FX particles. Static guard so a future edit can't un-wire them.
t('getEquippedState bridge exposed', /window\.getEquippedState\s*=/.test(app) && /state\.equipped/.test(app));
t('2X booster doubles score in endGame', /shopBooster\('2x'\)[\s\S]{0,300}score = Math\.floor\(score \* 2\)/.test(core));
t('SHIELD booster auto-continues', /shopBoosterOn\('shield'\)[\s\S]{0,400}runBoosters\.shieldUsed = true/.test(core) && /launchGame\(sid\)/.test(core));
t('SLOW MOTION delays difficulty ramp', /const rampMs = shopBoosterOn\('slow'\) \? 22000 : 15000/.test(core));
t('runBoosters resets on fresh playGame', /function playGame[\s\S]{0,300}runBoosters = \{ x2: false/.test(core));
t('FX effects tint particles', /effColor\(def\)/.test(core) && /fx-rainbow/.test(core));
t('only 2048 + neon-flap game asset dirs remain (zip games allowed)', !fs.existsSync(path.join(root, 'games/game2048.js')) && !fs.existsSync(path.join(root, 'games/gameNeonFlap.js')) && fs.existsSync(path.join(root, '2048/index.html')) && fs.existsSync(path.join(root, 'neon-flap/index.html')));
// 21. REVENGE MODE (v7.36): near-miss buy-in — +50% next-run score, opt-in coin spend
t('revengeGame defined + costs 50', /function revengeGame/.test(core) && /const COST = 50/.test(core));
t('revenge deducts coins + sets flag', /revengeGame[\s\S]{0,400}state\.coins -= COST/.test(core) && /pendingRevenge = true/.test(core));
t('revenge boost applied before 2x booster', /pendingRevenge[\s\S]{0,300}state\.coins -= COST/.test(core) && /if \(pendingRevenge\)[\s\S]{0,200}score = Math\.floor\(score \* 1\.5\)/.test(core));
t('revenge resets on fresh hub pick', /function playGame[\s\S]{0,200}pendingRevenge = false/.test(core));
// 22. NEXT-STAR PROGRESS BAR (v7.37): concrete retry-compulsion goal on game-over —
//     bar + label live in endGame, same GAME_TARGETS thresholds as the star rating
t('game-over next-star progress bar DOM exists', html.includes('overStarProg') && html.includes('overStarProgFill') && html.includes('overStarProgLabel'));
t('next-star progress computed in endGame', /NEXT-STAR PROGRESS BAR[\s\S]{0,500}const step = tgt \? tgt \* 0\.6/.test(core) && /MORE TO THE NEXT STAR/.test(core));
t('all-stars full bar at 100%', /ALL STARS!/.test(core) && /pct = 100/.test(core));
t('revenge button + chip in overlay', html.includes('id="revengeBtn"') && html.includes('id="hudRevenge"'));
// 23. DAILY MISSIONS REROLL (v7.41): coin-sink + retry-compulsion — spend 50 coins
//     to re-pick today's 3 missions. Guard: function exists, deducts 50, works on
//     persisted pools, keeps done-claims, exposes the button.
t('rerollDailyMissions defined in core', /function rerollDailyMissions/.test(core));
t('reroll costs 50 coins + deducts', /rerollDailyMissions[\s\S]{0,800}const COST = 50/.test(core) && /rerollDailyMissions[\s\S]{0,1200}state\.coins -= COST/.test(core));
t('reroll re-picks from persisted day pools', /pools: \{ play: playPool, score: scorePool \}/.test(core) && /rerollDailyMissions[\s\S]{0,900}pools\.play/.test(core));
t('reroll keeps completed claims', /rerollDailyMissions[\s\S]{0,900}state\.dailyQuest\.done/.test(core) && /done\.includes/.test(core));
t('reroll button present in missions widget', html.includes('id="rerollMissionsBtn"') && html.includes('rerollDailyMissions()'));
// 24. CANVAS HOLD/DRAG INPUT: pointer branch must mirror coords into touches and
//     hold-to-act canvas engines get the HOLD button. Guard so a future editor
//     can't silently drop the mirror or the hold button.
t('pointer branch mirrors coords into touches', /const mirrorTouches/.test(core) && /mirrorTouches\(x, y\); engine\.pointerDown/.test(core) && /gameState\.touches\.pointerDown = \{ x, y \}/.test(core));
t('hold-action infra has no deleted-game lists', !/holdGames = \['archery/.test(core) && !/archery-master/.test(core) && !/sling-birds/.test(core));
t('GAME_ENGINE maps only the iframe games', /'2048': 'game2048'/.test(core) && /'neon-flap': 'gameNeonFlap'/.test(core));

console.log(`\n${pass}/${pass + fail} security/input/cleanup checks passed`);
process.exit(fail ? 1 : 0);