# DESIGN — RETRO ARCADE HUB

## Design System
- **Palette tokens:** CSS custom properties on `:root` — `--bg`, `--bg-glow-1/2`, `--bg-grid`, `--cyan`, `--cyan2`, `--pink`, `--purple`, `--yellow`, `--green`, `--red`, `--accent`, `--glow`, `--space-*`, `--radius-*`, `--font-*`.
- **Theming:** 6 palettes (neon, neon2, void, sunset, matrix, royal) in `THEMES[]` (app.js). `applyTheme(id)` sets vars at runtime. Skin-by-game: `GAME_SKIN{gameId→theme}` applied on `bootGame`, reverted on `exitToHub`.
- **Background FX:** single `<canvas id="themeCanvas">` — theme-aware particle systems (neon web, matrix rain, starfield, sunset glow, gold dust), bloom + trails + touch ripples. Auto-pauses on hidden tab; disabled under `prefers-reduced-motion`.

## Animation Language
- Pages: CSS transform/opacity transitions via `.page.active` toggles.
- Modal/overlay: scale+fade+blur spring.
- Score pop: `popScore()` spring-elastic float.
- Touch: `ripple()` ink burst + haptic `navigator.vibrate`.
- Motion-safe: global `prefers-reduced-motion` kills animation/transition durations.

## Controls (18 types)
Defined in `games/controls.js` `CONTROL_LAYOUT`; rendered by `drawControls()` in `games/core.js`. Types: tap, taphold, drag, swipe-zone, joystick, dual, tilt, dpad, move-mine, radial, steer, wheel, pinch, gyro, swap, canvas (+ variants). Accessibility mode scales targets to ≥92px.

## Progression Data Model (localStorage)
- `rah_profile` { username, avatar, level, xp }
- `rah_coins`, `rah_inventory[]`, `rah_equipped{}`
- `rah_best{gameId→score}`, `rah_stats{ gamesPlayed, totalScore, bestCombo }`
- `rah_achievements[]`, `rah_dailyQuest{ date, list[], done[] }`
- XP: `max(1, floor(score/100)) + 25 (new best) + 10 (win)`; level curve `100·lvl^1.35`; level-up bonus `50·lvl` coins.

## PWA / SW Strategy (sw.js)
- `STATIC_CORE` (shell) → cache-first (offline-first).
- `games/*.js` → stale-while-revalidate (instant offline, background update), pre-cached at install in `CACHE-engines`.
- Others → network-first w/ cache fallback → `index.html` offline fallback.
- Versioned cache names (`retro-arcade-hub-vX.Y.Z`) with aggressive cleanup on activate.

## CI/CD
- `ci.yml`: syntax check all JS → `node test/run_all.js` (66 engines) → `test/consistency.js` (registry agreement).
- `deploy.yml`: Pages deploy on main.
- `daily-rotation.yml`: cron — rotates daily deal / quests / auto-commit.

## Conventions
- Every game engine: `function(gameId)(canvas, ctx, onScore, onGameOver, onCoins)` — plays, reports score, ends.
- New game requires: engine file, `GAMES[]` entry (app.js), engine map (core.js), `CONTROL_LAYOUT` entry (controls.js), optional `GAME_SKIN` entry, and version bump.
- Keep engine files self-contained (no DOM refs) so headless tests pass.