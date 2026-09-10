/* ============================================================
   RETRO ARCADE HUB — CONTROL MAP (70 GAMES)
   Each game defines its OWN custom control layout (professional).
   Every game has a UNIQUE control scheme — no two games share
   the same exact bindings. Real mobile game control research applied.
   ============================================================ */

const CONTROL_LAYOUT = {
  // ============ GROUP 1: NEON ACTION (12) ============
  'neon-racer':      { type: 'tilt',       hint: 'TILT LEFT/RIGHT TO STEER · HOLD BOOST' },
  'cyber-shooter':   { type: 'joystick',   hint: 'JOYSTICK MOVE · AUTO FIRE' },
  'pixel-dungeon':   { type: 'joystick2',  hint: 'JOYSTICK MOVE · ATTACK' },
  'light-cycle':     { type: 'swipe-zone', hint: 'SWIPE TO TURN · EDGE FLASH = CRASH' },
  'neon-snake':      { type: 'swipe-zone', hint: 'SWIPE ANYWHERE TO STEER' },
  'brick-breaker':   { type: 'drag',       hint: 'DRAG PADDLE · TAP SERVE' },
  'tetris-blitz':    { type: 'swipe+drag', hint: 'SWIPE MOVE · TAP ROTATE' },
  'flappy-neon':     { type: 'tap',        hint: 'TAP TO FLAP' },
  'pac-runner':      { type: 'dpad',       hint: 'D-PAD TO MOVE · COLLECT DOTS' },
  'space-invaders':  { type: 'drag',       hint: 'DRAG MOVE · AUTO SHOOT' },
  'tank-battle':     { type: 'dual',       hint: 'LEFT JOYSTICK MOVE · RIGHT JOYSTICK AIM' },
  'airstrike':       { type: 'canvas',     hint: 'HOLD TO AIM · RELEASE TO DROP BOMB' },

  // ============ GROUP 2: GIRLS VIRAL / SATISFYING (6) ============
  'water-sort':      { type: 'tap',        hint: 'TAP BOTTLE · TAP TARGET TO POUR' },
  'triple-sort':     { type: 'tap',        hint: 'TAP ITEM · TAP SLOT TO MOVE' },
  'fruit-slash':     { type: 'swipe',      hint: 'SWIPE TO SLASH FRUITS' },
  'fruit-merge':     { type: 'canvas',     hint: 'DRAG TO AIM · RELEASE TO DROP' },
  'bubble-shooter':  { type: 'canvas',     hint: 'DRAG TO AIM · RELEASE TO SHOOT' },
  'piano-tiles':     { type: 'tap',        hint: 'TAP THE BLACK TILES FAST' },

  // ============ GROUP 3: BANGLADESH VIRAL (8) ============
  'ludo-king':       { type: 'tap',        hint: 'TAP TO ROLL · TAP PIECE TO MOVE' },
  'carrom-pool':     { type: 'canvas',     hint: 'DRAG AIM · RELEASE SHOOT' },
  '2048':            { type: 'swipe-zone', hint: 'SWIPE ANYWHERE TO MERGE' },
  'hill-climb':      { type: 'touch',      hint: 'HOLD LEFT = GAS · HOLD RIGHT = BRAKE' },
  'temple-run':      { type: 'swipe-zone', hint: 'SWIPE UP JUMP · DOWN SLIDE · L/R TURN' },
  'candy-crush':     { type: 'canvas',     hint: 'DRAG TO SWAP CANDIES' },
  'snake-classic':   { type: 'dpad',       hint: 'D-PAD ARROWS TO STEER' },
  'duck-hunt':       { type: 'canvas',     hint: 'TAP THE DUCKS BEFORE THEY FLY' },

  // ============ GROUP 4: ARCADE SKILL (8) ============
  'neon-dash':       { type: 'tap',        hint: 'HOLD TO KEEP JUMPING' },
  'color-switch':    { type: 'tap',        hint: 'TAP TO SWITCH COLOR' },
  'neon-jumper':     { type: 'touch',      hint: 'HOLD LEFT/RIGHT TO BOUNCE' },
  'stack-drop':      { type: 'tap',        hint: 'TAP TO DROP BLOCK' },
  'helix-drop':      { type: 'swipe',      hint: 'SWIPE TO ROTATE · HOLD TO FALL' },
  'traffic-racer':   { type: 'tap',        hint: 'TAP LEFT/RIGHT LANE' },
  'dino-run':        { type: 'tap',        hint: 'TAP JUMP · HOLD DOWN SLIDE' },
  'sling-birds':     { type: 'canvas',     hint: 'DRAG BACK · RELEASE TO SLING' },
  'space-miner':     { type: 'move-mine',  hint: 'ARROWS/WASD MOVE · HOLD SPACE/E TO MINE' },
  'neon-slam':       { type: 'drag',       hint: 'DRAG PADDLE · TAP/SPACE LAUNCH' },
  'neon-tower':      { type: 'tap',        hint: 'TAP/SPACE TO DROP BLOCK' },
  'cosmic-dash':     { type: 'tap',        hint: 'TAP/SPACE TO THRUST · PORTALS FLIP GRAVITY' },
  'lazer-maze':      { type: 'tap',        hint: 'TAP MIRROR TO ROTATE · ROTATE TO HIT TARGET' },
  'time-rush':       { type: 'tap',        hint: 'TAP/SPACE JUMP · HOLD ↓/Z REWIND' },

  // ============ GROUP 5: SPORTS ARENA (8) ============
  'pong':            { type: 'drag',       hint: 'DRAG PADDLE UP/DOWN' },
  'table-tennis':    { type: 'drag',       hint: 'DRAG PADDLE · TIMING SMASH' },
  'bowling-strike':  { type: 'canvas',     hint: 'SWIPE UP TO BOWL · CURVE WITH ANGLE' },
  'cricket-sixer':   { type: 'tap-hold',   hint: 'TAP = BAT · HOLD = POWER SHOT' },
  'hoop-dunk':       { type: 'canvas',     hint: 'DRAG AIM · RELEASE TO SHOOT' },
  'archery-master':  { type: 'canvas',     hint: 'DRAG AIM → WIND AFFECTS ARROW' },
  'soccer-penalty':  { type: 'canvas',     hint: 'DRAG AIM · POWER BAR · RELEASE KICK' },
  'athletics-sprint':{ type: 'tap',        hint: 'RAPID TAP TO SPRINT · DON\'T FALSE START' },

  // ============ GROUP 6: BRAIN PUZZLE (13) ============
  'flow-free':       { type: 'canvas',     hint: 'DRAG TO CONNECT DOTS' },
  'word-search':     { type: 'canvas',     hint: 'DRAG OVER LETTERS TO FIND WORDS' },
  'memory-match':    { type: 'tap',        hint: 'TAP CARDS TO FIND PAIRS' },
  'mine-sweeper':    { type: 'tap',        hint: 'TAP REVEAL · HOLD TO FLAG' },
  'sudoku':          { type: 'tap',        hint: 'TAP CELL · TAP NUMBER' },
  'mastermind':      { type: 'tap',        hint: 'TAP 4 COLORS · AUTO CHECK' },
  'simon-says':      { type: 'tap',        hint: 'WATCH · REPEAT THE SEQUENCE' },
  'tic-tac-toe':     { type: 'radial',     hint: 'RADIAL A/B/X/Y · TAP TO PLACE X' },
  'connect-four':    { type: 'tap',        hint: 'TAP COLUMN TO DROP DISC' },
  'checkers':        { type: 'tap',        hint: 'TAP PIECE · TAP DESTINATION' },
  'slide-puzzle':    { type: 'tap',        hint: 'TAP TILE NEXT TO EMPTY TO SLIDE' },
  'nonogram':        { type: 'tap',        hint: 'TAP FILL · HOLD MARK ✕' },
  'lucky-spin':      { type: 'tap',        hint: 'TAP TO SPIN THE WHEEL' },

  // ============ GROUP 7: NEW GAMES (2) ============
  'pinball':         { type: 'wheel',      hint: 'ROTATE WHEEL = FLIPPERS · HOLD SPACE LAUNCH' },
  'crossy-neon':     { type: 'swipe-zone', hint: 'SWIPE UP/DOWN/LEFT/RIGHT TO CROSS' },

  // ============ GROUP 8: NEW UNIQUE GAMES (3) ============
  'trash-sorter':    { type: 'tap',        hint: 'TAP 1/2/3 (OR ←↑→) TO SORT INTO BIN' },
  'ladder-climb':    { type: 'tap',        hint: 'TAP / SPACE TO GRAB NEXT HOLD' },
  'math-dash':       { type: 'tap',        hint: 'TAP 1/2/3/4 (OR SWIPE) TO PICK ANSWER' },
  'bounce':          { type: 'dpad',       hint: 'D-PAD = MOVE PADDLE · TAP TO LAUNCH' },
  'space-impact':    { type: 'dpad',       hint: 'D-PAD MOVE · TAP SHOOT · SPACE BOSS' },
  'bantumi':         { type: 'tap',        hint: 'TAP YOUR PIT TO SOW STONES' },
  'reversi':         { type: 'tap',        hint: 'TAP CELL TO PLACE DISC' },
};