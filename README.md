# 🎮 RETRO ARCADE HUB — HTML5 PWA Gaming Portal

> A premium, cyberpunk-themed retro arcade gaming hub with **66 fully playable HTML5 canvas games**, 6 dynamic themes, per-game skins, XP/levels, achievements, daily quests, coins/shop, leaderboard, and offline PWA support.

## 🌟 Live Preview
🌐 **Play it live:** https://majorbdal-ai.github.io/RETRO-ARCADE-HUB/

## 🕹️ Feature Highlights

| Area | Details |
|---|---|
| **Games** | 66 arcade games — action, puzzle, sports, Bangladesh viral, classic remakes. Every game = canvas engine with score/coins/restart |
| **Themes** | 6 switchable palettes (Neon, Neon², Void, Sunset, Matrix, Royal) + **skin-by-game** — each game auto-applies its own palette |
| **Animation** | SPA page transitions, spring score pop-ups, touch ripples, tile hover-glow, animated particle background |
| **Controls** | 18 control types (joystick, tilt, drag, tap, swipe-zone, D-pad, radial, steer, wheel, pinch, gyro, swap…) + haptic feedback + accessibility mode |
| **Progression** | XP + level curve (100·lvl^1.35), 8 achievements, 3 rotating daily quests, level-up bonuses |
| **Economy** | Coins, skins/vehicles/effects shop, live deal rotation, daily bonus |
| **PWA** | Offline-first service worker (pre-caches all 66 engines), install prompt, standalone display, shortcuts |
| **Accessibility** | High-contrast mode, WCAG focus rings, skip link, color-blind mode, reduced-motion support |
| **Audio** | WebAudio synth SFX (no files) — click/coin/launch/over/hit/pop/win, mute support |

## 🛠️ Tech Stack
- **Vanilla JS** (ES6+, no frameworks) + HTML5 Canvas API
- **CSS custom properties** — theming via runtime var overrides
- **LocalStorage** — persistent state (coins, inventory, best scores, XP, quests, achievements)
- **Service Worker** — offline play, versioned caching (cache-first shell, SWR engines)
- **GitHub Actions** — CI (syntax + 66-game headless lifecycle + registry consistency) + auto-deploy to Pages

## 🧪 Testing
```bash
node test/run_all.js      # headless lifecycle test — all 66 engines
node test/consistency.js  # registry consistency (app.js ↔ core.js ↔ controls.js ↔ version.json)
```

## 📁 Project Layout
```
app.js                 # boot, state, themes, shop, profile, background FX
games/core.js          # engine loader, controls renderer, game loop, endGame/progression
games/controls.js      # CONTROL_LAYOUT — per-game control type + hints (18 types)
games/<game>.js        # individual game engines (66)
index.html             # app shell, all page markup, design system CSS
sw.js                  # offline PWA caching (v6.6+ strategy)
manifest.webmanifest   # PWA manifest + shortcuts
test/run_all.js        # headless lifecycle tests
test/consistency.js    # registry consistency check
.github/workflows/     # ci.yml, deploy.yml, daily-rotation.yml
```

---
*© 2026 RETRO ARCADE HUB. All rights reserved.*