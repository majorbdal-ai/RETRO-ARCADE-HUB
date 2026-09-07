/* ============================================================
   RETRO ARCADE HUB — CONTROL MAP
   Each game defines its own custom control layout (professional).
   ============================================================ */

// Layout types per game for the touch-control panel
const CONTROL_LAYOUT = {
  // GROUP 1: NEON ACTION
  'neon-racer':     { joystick: false, btns: ['boost', 'drift'], label: 'STEER L/R · BOOST' },
  'cyber-shooter':  { joystick: true,  btns: ['action'],         label: 'JOYSTICK MOVE · AUTO FIRE' },
  'pixel-dungeon':  { joystick: true,  btns: ['action'],         label: 'JOYSTICK MOVE · ATTACK' },
  'light-cycle':    { joystick: false, btns: [],                 label: 'SWIPE TO TURN' },
  'neon-snake':     { joystick: false, btns: [],                 label: 'SWIPE TO TURN' },
  'brick-breaker':  { joystick: false, btns: ['action'],         label: 'DRAG PADDLE · TAP SERVE' },
  'tetris-blitz':   { joystick: true,  btns: ['action'],         label: 'JOYSTICK MOVE · TAP ROTATE' },
  'flappy-neon':    { joystick: false, btns: ['action'],         label: 'TAP TO FLAP' },
  'pac-runner':     { joystick: false, btns: [],                 label: 'SWIPE TO TURN' },
  'space-invaders': { joystick: true,  btns: [],                 label: 'DRAG MOVE · AUTO SHOOT' },

  // GROUP 2: GIRLS VIRAL
  'water-sort':     { joystick: false, btns: ['action'],         label: 'TAP BOTTLE TO POUR' },
  'triple-sort':    { joystick: false, btns: ['action'],         label: 'TAP ITEM TO MOVE' },
  'fruit-slash':    { joystick: false, btns: [],                 label: 'SWIPE TO SLASH' },

  // GROUP 3: BANGLADESH VIRAL
  'ludo-king':      { joystick: false, btns: ['action'],         label: 'TAP TO ROLL · TAP PIECE' },
  'carrom-pool':    { joystick: false, btns: [],                 label: 'DRAG AIM · RELEASE SHOOT' },
  '2048':           { joystick: false, btns: [],                 label: 'SWIPE TO MERGE' },
  'hill-climb':     { joystick: false, btns: ['boost','drift'],  label: 'HOLD GAS · BRAKE' },
  'temple-run':     { joystick: false, btns: [],                 label: 'SWIPE UP/JUMP · DOWN/SLIDE' },
  'candy-crush':    { joystick: false, btns: [],                 label: 'DRAG TO SWAP' },
  'snake-classic':  { joystick: false, btns: [],                 label: 'SWIPE OR ARROWS' }
};
