/* ============================================================
   RETRO ARCADE HUB — CONTROL MAP
   Game registry is empty until games return from backup.
   Each game defines its OWN custom control layout (professional).
   Every game has a UNIQUE control scheme — no two games share
   the same exact bindings. Real mobile game control research applied.
   ============================================================ */

const CONTROL_LAYOUT = {
  '2048': { gesture: 'swipe4', type: 'swipe4', hint: 'Swipe to merge tiles' },
  'neon-flap': { gesture: 'tap', type: 'tap', hint: 'Tap to flap' },
  'fruit-fury': { gesture: 'swipe', type: 'swipe', hint: 'Swipe to slice fruit' },
  'neon-snake': { gesture: 'swipe4', type: 'swipe4', hint: 'Swipe to steer the snake' },
};