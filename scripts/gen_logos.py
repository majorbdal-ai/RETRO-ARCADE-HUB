#!/usr/bin/env python3
"""Generate assets/logos.js — 70 neon-style SVG logos for RETRO-ARCADE-HUB.

Each logo: dark rounded tile + radial glow + per-game neon glyph in the
game's own color. Consistent stroke language: 4px main stroke, 9px low-
opacity glow stroke underneath, 3px fill accents.
"""
import json

# ---------------------------------------------------------------- helpers
def wrap(color, glyph, accent=None, bg_accent=None):
    """Compose a full 120x120 SVG tile from a glyph body."""
    ac = accent or color
    bg = bg_accent or color
    return f'''<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="tbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{bg}" stop-opacity=".28"/><stop offset="1" stop-color="{bg}" stop-opacity=".10"/></linearGradient>
<radialGradient id="tglow" cx=".5" cy=".42" r=".62"><stop offset=".55" stop-color="{color}" stop-opacity=".22"/><stop offset="1" stop-color="{color}" stop-opacity="0"/></radialGradient>
</defs>
<rect x="3" y="3" width="114" height="114" rx="20" fill="url(#tbg)" stroke="{color}" stroke-opacity=".5" stroke-width="2"/>
<circle cx="60" cy="60" r="46" fill="url(#tglow)"/>
<g stroke="{color}" stroke-width="3" stroke-opacity=".30" stroke-linecap="round" stroke-linejoin="round" fill="none">{glyph}</g>
<g stroke="{color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none">{glyph}</g>
<g fill="{ac}" fill-opacity=".95">{glyph}</g>
</svg>'''


def G(parts):
    """Join glyph parts (paths wrapped in their own <path>/<circle>...)."""
    return ''.join(parts)

# ---------------------------------------------------------------- glyphs
# Each returns list of svg fragment strings; the wrapper draws them 3x:
# glow stroke (3px @ .3), crisp stroke (1.6px), fill (.95).

def l_path(d, w=1.6):
    return f'<path d="{d}" stroke-width="{w}"/>'

def l_circ(cx, cy, r, fill=True):
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" stroke-width="1.6" fill-opacity="{1 if fill else 0}"/>'

def l_rect(x, y, w, h, rx=3):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" stroke-width="1.6" fill-opacity=".35"/>'

GLYPHS = {
    # ---- ACTION ----
    'neon-racer': lambda c: G([
        l_path('M22 74 L28 58 L44 52 L56 44 L66 46 L92 58 L98 74 Z', 2.2),
        l_path('M22 74 L98 74 L98 80 Q72 88 22 80 Z', 1.6),
        l_circ(36, 72, 6), l_circ(86, 72, 6),
        l_path('M46 52 L50 36 L58 34 L56 48', 1.4),
    ]),
    'cyber-shooter': lambda c: G([
        l_path('M60 18 L68 40 L60 34 L52 40 Z', 1.8),
        l_path('M60 40 L60 58 M60 56 L44 74 M60 56 L76 74', 1.6),
        l_circ(60, 74, 10, False), l_path('M60 64 L60 84', 1.6),
    ]),
    'pixel-dungeon': lambda c: G([
        l_rect(44, 30, 32, 40, 4), l_path('M52 30 L60 20 L68 30', 1.6),
        l_path('M60 20 L60 16 M48 52 L38 52 L38 62 L48 62 M72 52 L82 52 L82 62 L72 62', 1.4),
        l_path('M60 70 L60 78 M56 78 L64 78', 1.6), l_circ(60, 60, 5, True),
    ]),
    'light-cycle': lambda c: G([
        l_path('M26 74 Q40 30 60 44 Q76 54 96 62', 2.2),
        l_path('M96 62 L96 68', 2.4), l_circ(26, 74, 5), l_circ(96, 66, 5),
    ]),
    'tank-battle': lambda c: G([
        l_path('M34 66 L34 50 L50 50 L50 42 L70 42 L70 50 L86 50 L86 66 Z', 1.8),
        l_path('M60 42 L60 34 L68 30', 1.6), l_path('M26 66 L94 66 L94 74 L26 74 Z', 1.6),
        l_path('M28 82 L34 74 M92 82 L86 74', 1.6), l_circ(60, 58, 4, True),
    ]),
    'airstrike': lambda c: G([
        l_path('M50 28 L70 28 L66 46 L54 46 Z', 1.8), l_path('M60 46 L60 70', 1.6),
        l_circ(60, 80, 7, True), l_path('M36 30 L30 24 M84 30 L90 24', 1.5),
    ]),
    'hill-climb': lambda c: G([
        l_path('M24 78 L44 52 L56 66 L70 44 L96 78 Z', 1.8),
        l_path('M56 66 L56 54 M70 44 L70 34', 1.4),
        l_circ(52, 72, 6), l_circ(78, 68, 6), l_path('M30 86 L90 86', 1.2),
    ]),
    'temple-run': lambda c: G([
        l_path('M46 74 L42 56 L58 48 L74 56 L78 66 L64 62 L62 74 Z', 1.8),
        l_path('M50 48 L50 36 M58 46 L64 38 M66 48 L74 40', 1.4),
        l_path('M34 78 L86 78', 1.2),
    ]),
    'neon-dash': lambda c: G([
        l_path('M62 22 L40 58 L54 58 L44 98 L76 52 L60 52 Z', 2.0),
    ]),
    'traffic-racer': lambda c: G([
        l_path('M28 40 L92 40 L92 64 L28 64 Z', 1.8),
        l_path('M36 40 L36 34 L84 34 L84 40 M36 64 L36 70 L84 70 L84 64', 1.4),
        l_circ(42, 66, 5), l_circ(78, 66, 5), l_path('M48 52 L72 52', 1.2),
    ]),
    'dino-run': lambda c: G([
        l_path('M40 50 L40 74 L48 74 L48 70 L60 70 L60 78 L72 78 L72 66 L82 66 L82 56 L72 56 L72 44 L60 44 L60 50 Z', 1.6),
        l_circ(68, 52, 3, True), l_path('M86 58 L98 62 L92 72 L84 66', 1.5),
        l_path('M40 74 L40 84 L48 84 L48 74 M60 78 L60 86 L68 86 L68 78', 1.4),
    ]),
    'sling-birds': lambda c: G([
        l_path('M28 64 Q38 34 58 48', 2.0), l_path('M28 64 L28 76 L40 68', 1.6),
        l_circ(66, 56, 10, False), l_circ(66, 56, 4, True),
        l_path('M66 46 L66 30 M66 30 L56 22 M66 30 L76 22', 1.4),
    ]),
    'space-miner': lambda c: G([
        l_path('M44 40 L76 40 L60 56 L44 40 Z', 1.8), l_path('M60 56 L60 74 L54 84 L66 84 L60 74', 1.5),
        l_path('M38 28 L34 20 M46 26 L44 16 M54 30 L56 18', 1.4), l_circ(60, 62, 4, True),
    ]),
    'neon-slam': lambda c: G([
        l_circ(60, 34, 8, False), l_circ(60, 34, 3, True),
        l_path('M30 34 L90 34 M30 34 L30 42 M90 34 L90 42 M26 42 L94 42', 1.4),
        l_path('M34 78 L86 78 L86 86 L34 86 Z', 1.8),
    ]),
    'neon-tower': lambda c: G([
        l_rect(36, 68, 48, 12, 3), l_rect(44, 52, 32, 12, 3),
        l_rect(52, 36, 16, 12, 3), l_path('M60 36 L60 24 M54 24 L66 24', 1.6),
    ]),
    'cosmic-dash': lambda c: G([
        l_path('M60 22 L66 40 L60 36 L54 40 Z', 1.8), l_path('M60 40 L60 62', 1.6),
        l_circ(60, 68, 6, False), l_path('M36 70 Q30 80 40 86 M84 70 Q90 80 80 86', 1.4),
        l_circ(60, 92, 3, True),
    ]),
    'lazer-maze': lambda c: G([
        l_path('M22 52 L44 52 L58 66 L98 66', 2.2), l_circ(22, 52, 5, True),
        l_path('M48 38 L64 70 L70 66 L54 34 Z', 1.6), l_circ(92, 66, 5, False),
    ]),
    'time-rush': lambda c: G([
        l_path('M60 24 L60 60 L82 74', 2.0), l_circ(60, 60, 30, False),
        l_path('M28 78 A18 18 0 1 1 34 92', 1.8), l_path('M28 78 L28 92 L42 92', 1.2),
    ]),
    # ---- ARCADE ----
    'neon-snake': lambda c: G([
        l_path('M36 78 Q30 62 44 60 Q58 58 56 46 Q54 36 68 36 Q82 38 84 28', 2.4),
        l_circ(84, 28, 4, True), l_circ(60, 46, 3, True),
    ]),
    'brick-breaker': lambda c: G([
        l_rect(24, 30, 26, 12, 3), l_rect(56, 44, 26, 12, 3), l_rect(30, 60, 20, 10, 3),
        l_circ(60, 34, 6, False), l_circ(60, 34, 2.5, True),
        l_path('M34 78 L86 78 L86 86 L34 86 Z', 1.8),
    ]),
    'tetris-blitz': lambda c: G([
        l_rect(34, 34, 18, 18, 3), l_rect(52, 34, 18, 18, 3), l_rect(52, 52, 18, 18, 3),
        l_rect(70, 52, 18, 18, 3), l_rect(34, 70, 18, 18, 3),
    ]),
    'flappy-neon': lambda c: G([
        l_circ(52, 48, 9, False), l_circ(57, 44, 2.5, True),
        l_path('M52 42 L44 36 L46 30 M44 54 Q36 54 38 62', 1.4),
        l_path('M70 30 L92 30 L92 50 L70 50 Z M62 58 L88 58 L88 88 L62 88 Z', 1.6),
    ]),
    'pac-runner': lambda c: G([
        l_path('M60 32 A28 28 0 1 0 60 88 Q70 60 60 32 Z', 2.0),
        l_circ(86, 44, 9, False), l_circ(92, 48, 2.4, True),
        l_path('M80 66 L94 66', 1.6),
    ]),
    'space-invaders': lambda c: G([
        l_path('M42 40 L56 40 L56 50 L66 50 L66 40 L80 40 L80 58 L70 58 L70 52 L60 52 L54 58 L44 58 Z', 1.6),
        l_path('M42 58 L40 70 M80 58 L82 70 M50 48 L48 44 M72 48 L74 44', 1.4),
        l_circ(56, 46, 2, True), l_circ(66, 46, 2, True),
    ]),
    'fruit-slash': lambda c: G([
        l_circ(50, 52, 12, False), l_circ(74, 60, 10, False), l_circ(58, 76, 9, False),
        l_path('M50 46 L50 58 M44 52 L56 52 M74 54 L74 66 M68 60 L80 60', 1.3),
        l_path('M30 30 L88 88', 2.4), l_path('M26 30 L36 30 M26 30 L26 40', 1.6),
    ]),
    'fruit-merge': lambda c: G([
        l_circ(44, 52, 13, False), l_circ(78, 60, 13, False),
        l_circ(60, 84, 16, False),
        l_path('M44 45 L44 59 M37 52 L51 52 M78 53 L78 67 M71 60 L85 60', 1.3),
        l_path('M54 74 Q60 68 66 74 M54 74 Q60 80 66 74', 1.2),
    ]),
    'bubble-shooter': lambda c: G([
        l_circ(70, 34, 7, False), l_circ(38, 50, 7, False), l_circ(58, 60, 7, False),
        l_circ(84, 62, 7, False), l_circ(46, 78, 7, False), l_circ(72, 82, 7, False),
    ]),
    'piano-tiles': lambda c: G([
        l_rect(26, 38, 68, 6, 2), l_rect(38, 44, 14, 26, 2), l_rect(68, 44, 14, 26, 2),
        l_rect(32, 70, 18, 16, 2), l_rect(62, 70, 16, 16, 2), l_circ(50, 78, 3, True),
    ]),
    '2048': lambda c: G([
        l_rect(34, 30, 26, 26, 4), l_rect(64, 30, 26, 26, 4), l_rect(34, 60, 26, 26, 4), l_rect(64, 60, 26, 26, 4),
    ]),
    'candy-crush': lambda c: G([
        l_circ(40, 42, 9, False), l_circ(62, 56, 9, False), l_circ(48, 74, 9, False),
        l_circ(78, 40, 9, False), l_circ(80, 70, 9, False),
        l_path('M40 36 L40 48 M34 42 L46 42', 1.2),
    ]),
    'snake-classic': lambda c: G([
        l_path('M34 70 Q26 56 40 52 Q56 48 54 36 Q52 26 66 28 Q80 32 82 22', 2.2),
        l_circ(82, 22, 3.5, True), l_rect(38, 72, 14, 8, 2), l_rect(58, 76, 12, 6, 2),
    ]),
    'duck-hunt': lambda c: G([
        l_circ(52, 42, 9, False), l_path('M52 34 L40 28 L46 22 M46 44 Q36 46 38 56', 1.4),
        l_path('M60 34 L74 32 L80 24 M80 40 L92 40 L90 52 L78 48', 1.4),
        l_circ(52, 42, 3, True), l_path('M30 88 L90 88', 1.2),
        l_path('M48 82 L52 74 M56 86 L62 76', 1.2),
    ]),
    'color-switch': lambda c: G([
        l_path('M66 24 A24 24 0 1 1 54 40 A12 12 0 1 0 52 44', 2.0),
        l_circ(66, 24, 5, True),
    ]),
    'neon-jumper': lambda c: G([
        l_circ(60, 40, 10, False), l_circ(65, 36, 3, True),
        l_path('M60 50 L60 68 M60 60 L48 72 L50 80 M60 68 L72 80 L70 88', 1.6),
        l_path('M40 90 L80 90', 1.2), l_path('M36 84 L40 90 M84 84 L80 90', 1.2),
    ]),
    'stack-drop': lambda c: G([
        l_rect(28, 64, 64, 14, 4), l_rect(36, 44, 48, 14, 4),
        l_rect(44, 24, 32, 14, 4), l_circ(60, 84, 4, True),
    ]),
    'helix-drop': lambda c: G([
        l_path('M58 22 A16 16 0 0 1 74 36 Q80 52 58 56 Q36 60 42 74 Q48 88 64 88', 2.2),
        l_circ(60, 32, 4, True), l_path('M58 22 L58 18', 1.4),
    ]),
    # ---- PUZZLE ----
    'tetris-blitz': None,  # placeholder dedupe
    'water-sort': lambda c: G([
        l_path('M34 34 L34 48 L28 66 L42 42 Z', 1.6), l_path('M52 34 L52 48 L46 66 L60 42 Z', 1.6),
        l_path('M70 34 L70 48 L64 66 L78 42 Z', 1.6), l_path('M88 34 L88 48 L82 66 L96 42 Z', 1.6),
        l_path('M26 76 L34 66 M44 76 L52 66 M62 76 L70 66 M80 76 L88 66', 1.4),
        l_path('M24 84 L96 84', 1.2),
    ]),
    'triple-sort': lambda c: G([
        l_rect(28, 44, 20, 34, 4), l_rect(50, 32, 20, 46, 4), l_rect(72, 40, 20, 38, 4),
        l_path('M38 54 L38 66 M60 42 L60 66 M82 50 L82 66', 1.4),
    ]),
    'flow-free': lambda c: G([
        l_circ(34, 38, 6, True), l_circ(88, 40, 6, True), l_circ(40, 84, 6, True), l_circ(86, 82, 6, True),
        l_path('M34 38 Q40 58 58 56 Q74 54 76 68 Q78 78 88 82 M40 84 Q52 72 60 70', 1.8),
    ]),
    'word-search': lambda c: G([
        l_rect(28, 26, 64, 64, 6), l_path('M28 44 L92 44 M28 62 L92 62 M28 80 L92 80', 1.2),
        l_path('M46 26 L46 90 M64 26 L64 90 M82 26 L82 90', 1.2),
        l_circ(37, 35, 3, True), l_circ(55, 53, 3, True), l_circ(73, 71, 3, True), l_circ(82, 53, 3, True),
    ]),
    'memory-match': lambda c: G([
        l_rect(32, 32, 24, 30, 5), l_rect(64, 32, 24, 30, 5),
        l_rect(32, 68, 24, 24, 5), l_rect(64, 68, 24, 24, 5),
        l_circ(44, 42, 4, True), l_path('M64 42 L88 42 L88 54 L72 54 L64 62', 1.6),
        l_path('M40 80 L48 88 M48 80 L40 88', 1.6), l_circ(76, 80, 5, True),
    ]),
    'mine-sweeper': lambda c: G([
        l_rect(28, 28, 64, 64, 6), l_path('M28 44 L92 44 M28 60 L92 60 M28 76 L92 76 M44 28 L44 92 M60 28 L60 92 M76 28 L76 92', 1.0),
        l_circ(44, 38, 5, True), l_path('M60 60 L76 76 M76 60 L60 76', 1.8),
        l_circ(60, 60, 5, True),
    ]),
    'sudoku': lambda c: G([
        l_rect(30, 30, 60, 60, 6), l_path('M30 50 L90 50 M30 70 L90 70 M50 30 L50 90 M70 30 L70 90', 1.8),
        l_path('M38 42 L42 42 M58 38 L62 38 M78 44 L82 44 M38 62 L42 62 M58 66 L62 66 M78 58 L82 58', 1.2),
        l_path('M38 80 L42 80 M62 82 L66 82 M78 78 L82 78', 1.2),
    ]),
    'mastermind': lambda c: G([
        l_rect(30, 56, 60, 30, 8), l_circ(42, 70, 6, True), l_circ(60, 70, 6, True), l_circ(78, 70, 6, True),
        l_circ(42, 86, 6, True), l_circ(60, 86, 6, True), l_circ(78, 86, 6, True),
        l_rect(40, 30, 40, 14, 6), l_circ(52, 37, 4, True), l_circ(68, 37, 4, True),
    ]),
    'simon-says': lambda c: G([
        l_circ(60, 58, 30, False), l_path('M60 58 L60 28 M60 58 L90 58', 1.6),
        l_circ(48, 46, 11, False), l_circ(72, 46, 11, False), l_circ(48, 70, 11, False), l_circ(72, 70, 11, False),
        l_circ(48, 46, 4, True), l_circ(48, 70, 4, True),
    ]),
    'tic-tac-toe': lambda c: G([
        l_path('M36 36 L56 56 M56 36 L36 56', 2.2), l_circ(76, 76, 11, False),
        l_path('M30 30 L90 30 L90 90 L30 90 Z', 1.3),
    ]),
    'connect-four': lambda c: G([
        l_rect(34, 26, 52, 62, 8), l_circ(44, 40, 6, True), l_circ(60, 40, 6, True), l_circ(76, 40, 6, True),
        l_circ(44, 56, 6, True), l_circ(60, 56, 6, True), l_circ(76, 56, 6, True),
        l_circ(60, 72, 6, True), l_circ(76, 72, 6, True), l_path('M44 72 L52 72', 1.2),
    ]),
    'checkers': lambda c: G([
        l_rect(28, 28, 64, 64, 6), l_path('M28 44 L92 44 M28 60 L92 60 M28 76 L92 76 M44 28 L44 92 M60 28 L60 92 M76 28 L76 92', 1.0),
        l_circ(44, 44, 7, True), l_circ(68, 44, 7, False), l_circ(44, 68, 7, False), l_circ(76, 76, 7, True),
        l_circ(68, 68, 7, False),
    ]),
    'slide-puzzle': lambda c: G([
        l_rect(28, 28, 64, 64, 6), l_path('M28 44 L92 44 M28 60 L92 60 M44 28 L44 92 M60 28 L60 92', 1.2),
        l_rect(32, 32, 8, 8, 2), l_rect(48, 32, 8, 8, 2), l_rect(48, 48, 8, 8, 2),
        l_rect(32, 48, 8, 8, 2), l_rect(64, 64, 8, 8, 2), l_rect(80, 64, 8, 8, 2), l_rect(80, 80, 8, 8, 2),
    ]),
    'nonogram': lambda c: G([
        l_rect(28, 28, 64, 64, 6), l_path('M28 44 L92 44 M28 60 L92 60 M28 76 L92 76 M44 28 L44 92 M60 28 L60 92 M76 28 L76 92', 1.0),
        l_rect(44, 44, 16, 16, 3), l_rect(76, 28, 16, 16, 3), l_rect(28, 60, 16, 16, 3),
        l_circ(60, 76, 6, True),
    ]),
    'lucky-spin': lambda c: G([
        l_circ(60, 58, 26, False), l_path('M60 32 L60 58 A26 26 0 0 1 86 58 Z', 1.6),
        l_path('M60 58 L60 84 M34 58 L60 58 M86 58 L60 58', 1.2),
        l_circ(60, 58, 5, True), l_path('M60 58 L60 40', 1.8),
    ]),
    # ---- SPORTS ----
    'pong': lambda c: G([
        l_circ(60, 44, 8, False), l_circ(60, 44, 3, True),
        l_rect(24, 34, 6, 22, 3), l_rect(90, 54, 6, 22, 3),
        l_path('M24 45 L90 65', 1.0, ), l_path('M28 24 L92 96', 0.8),
    ]),
    'table-tennis': lambda c: G([
        l_circ(72, 40, 10, False), l_circ(72, 40, 3.5, True),
        l_path('M60 46 L28 70 L24 68 L32 76 L58 54', 1.8), l_path('M24 68 L28 76', 1.6),
    ]),
    'bowling-strike': lambda c: G([
        l_path('M44 40 L44 76 L52 76 L52 40 Z', 1.8), l_circ(60, 40, 4, True),
        l_path('M72 44 L72 76 L80 76 L80 44 Z', 1.8), l_circ(60, 32, 7, False),
        l_path('M32 84 L44 76 M88 84 L80 76', 1.4),
    ]),
    'cricket-sixer': lambda c: G([
        l_circ(70, 44, 10, False), l_path('M62 50 L30 78 L26 74', 2.0),
        l_path('M62 50 L38 30 L26 74', 1.0), l_circ(24, 76, 4, False),
        l_path('M82 30 L96 30 M78 26 L78 40', 1.4),
    ]),
    'hoop-dunk': lambda c: G([
        l_circ(60, 38, 10, False), l_path('M60 48 L60 70', 1.4),
        l_path('M32 70 L88 70 L84 78 L36 78 Z', 1.6), l_path('M36 78 L36 84 L84 84 L84 78', 1.4),
        l_path('M32 70 L32 76 M88 70 L88 76', 1.2),
    ]),
    'archery-master': lambda c: G([
        l_circ(60, 60, 24, False), l_circ(60, 60, 15, False), l_circ(60, 60, 6, True),
        l_path('M40 26 L84 70 L74 80 L80 86 L92 74 L82 68', 2.2),
    ]),
    'soccer-penalty': lambda c: G([
        l_circ(60, 58, 22, False), l_path('M60 36 L60 58 L74 66', 1.2),
        l_path('M52 48 L48 60 L58 70 M60 36 L44 50 M74 66 L86 80', 1.0),
        l_path('M28 86 L52 74 M92 86 L68 74', 1.4),
    ]),
    'athletics-sprint': lambda c: G([
        l_circ(58, 36, 8, False), l_path('M58 44 L58 66 M58 50 L44 62 L46 72 M58 62 L72 74 L70 84', 1.6),
        l_path('M58 66 L50 80 L54 86 M40 24 L44 30', 1.3),
        l_path('M80 88 L96 62 M84 88 L100 62', 1.5),
    ]),
    'crossy-neon': lambda c: G([
        l_circ(52, 42, 9, False), l_circ(52, 42, 3, True),
        l_path('M52 34 L40 28 M52 34 L42 22 M46 50 L36 58', 1.4),
        l_path('M58 52 L58 66 L46 74 L44 86 L52 86 L54 76 L64 76 L66 86 L74 86 L72 74 L60 66', 1.4),
        l_path('M28 64 L92 64', 1.0, ), l_path('M32 52 L88 52', 1.0),
    ]),
    # ---- RETRO ----
    'pinball': lambda c: G([
        l_path('M36 74 L36 40 Q36 26 60 26 Q84 26 84 40 L84 74 Z', 2.0),
        l_circ(48, 48, 7, False), l_circ(72, 48, 7, False), l_circ(60, 66, 8, False),
        l_path('M28 78 L44 70 L76 70 L92 78 L92 86 L28 86 Z', 1.6),
        l_path('M36 78 L36 86 M84 78 L84 86', 1.5),
    ]),
    'trash-sorter': lambda c: G([
        l_path('M40 40 L36 84 L84 84 L80 40 Z', 1.8), l_path('M52 40 L52 34 L68 34 L68 40 M32 44 L88 44', 1.6),
        l_path('M48 52 L52 74 M56 52 L56 74 M64 52 L64 74 M72 52 L68 74', 1.3),
    ]),
    'ladder-climb': lambda c: G([
        l_path('M30 40 L60 40 L90 74 L60 74 Z', 2.0),
        l_path('M38 40 L38 74 M56 40 L56 74 M74 40 L74 74', 1.2),
        l_circ(60, 34, 8, False),
    ]),
    'math-dash': lambda c: G([
        l_path('M40 44 L40 64 M30 54 L50 54', 2.2), l_path('M64 40 L80 68 M80 40 L64 68', 2.2),
        l_path('M28 76 L92 76', 1.2),
    ]),
    'bounce': lambda c: G([
        l_circ(60, 36, 9, False), l_circ(60, 36, 3, True),
        l_rect(24, 28, 16, 8, 2), l_rect(24, 42, 16, 8, 2), l_rect(24, 56, 16, 8, 2),
        l_rect(80, 34, 16, 8, 2), l_rect(80, 48, 16, 8, 2),
        l_path('M32 78 L88 78 L88 86 L32 86 Z', 1.8),
    ]),
    'space-impact': lambda c: G([
        l_path('M52 30 L68 30 L64 44 L56 44 Z', 1.8), l_path('M60 44 L60 58', 1.4),
        l_circ(60, 64, 8, False), l_path('M30 52 L22 44 M34 56 L24 62 M90 52 L98 44 M86 56 L96 62', 1.3),
        l_path('M36 82 Q48 74 60 82 Q72 74 84 82', 1.6), l_circ(60, 78, 4, True),
    ]),
    # ---- BOARD ----
    'ludo-king': lambda c: G([
        l_rect(32, 32, 56, 56, 6), l_path('M32 60 L88 60 M60 32 L60 88', 1.2),
        l_path('M60 32 L88 60 L60 88 L32 60 Z', 1.2), l_circ(46, 46, 8, True),
        l_circ(74, 46, 8, False), l_circ(46, 74, 8, False), l_circ(74, 74, 8, True),
        l_circ(60, 60, 5, True),
    ]),
    'carrom-pool': lambda c: G([
        l_rect(28, 28, 64, 64, 8), l_circ(44, 44, 7, True), l_circ(76, 44, 7, False),
        l_circ(44, 76, 7, False), l_circ(76, 76, 7, True), l_circ(60, 60, 10, True),
        l_path('M28 28 L44 44 M92 28 L76 44 M28 92 L44 76 M92 92 L76 76', 1.6),
    ]),
    'bantumi': lambda c: G([
        l_rect(28, 36, 64, 46, 10), l_path('M28 58 L92 58 M28 50 L92 50', 1.0),
        l_circ(35, 44, 5, True), l_circ(48, 44, 5, False), l_circ(61, 44, 5, True),
        l_circ(74, 44, 5, False), l_circ(35, 68, 5, False), l_circ(48, 68, 5, True),
        l_circ(61, 68, 5, False), l_circ(74, 68, 5, True), l_rect(34, 82, 52, 12, 5),
        l_circ(60, 88, 4, True),
    ]),
    'reversi': lambda c: G([
        l_rect(28, 28, 64, 64, 8), l_path('M28 44 L92 44 M28 60 L92 60 M28 76 L92 76 M44 28 L44 92 M60 28 L60 92 M76 28 L76 92', 1.0),
        l_circ(52, 52, 9, True), l_circ(68, 52, 9, False), l_circ(52, 68, 9, False), l_circ(68, 68, 9, True),
    ]),
}

# dedupe placeholder
GLYPHS.pop('tetris-blitz', None)
GLYPHS['tetris-blitz'] = lambda c: G([
    l_rect(34, 34, 18, 18, 3), l_rect(52, 34, 18, 18, 3), l_rect(52, 52, 18, 18, 3),
    l_rect(70, 52, 18, 18, 3), l_rect(34, 70, 18, 18, 3),
])

COLORS = {
    'neon-racer': '#00FFFF', 'cyber-shooter': '#FF10F0', 'pixel-dungeon': '#FFE600',
    'light-cycle': '#39FF88', 'neon-snake': '#22D3EE', 'brick-breaker': '#F59E0B',
    'tetris-blitz': '#A855F7', 'flappy-neon': '#D946EF', 'pac-runner': '#FBBF24',
    'space-invaders': '#F97316', 'tank-battle': '#84CC16', 'airstrike': '#EAB308',
    'water-sort': '#38BDF8', 'triple-sort': '#22D3EE', 'fruit-slash': '#F87171',
    'fruit-merge': '#A3E635', 'bubble-shooter': '#60A5FA', 'piano-tiles': '#C084FC',
    'ludo-king': '#F59E0B', 'carrom-pool': '#EAB308', '2048': '#84CC16',
    'hill-climb': '#F97316', 'temple-run': '#EF4444', 'candy-crush': '#EC4899',
    'snake-classic': '#22C55E', 'duck-hunt': '#FBBF24', 'neon-dash': '#22D3EE',
    'color-switch': '#F472B6', 'neon-jumper': '#4ADE80', 'stack-drop': '#F59E0B',
    'helix-drop': '#38BDF8', 'traffic-racer': '#F97316', 'dino-run': '#A3E635',
    'sling-birds': '#FB923C', 'space-miner': '#FFD700', 'neon-slam': '#00FFFF',
    'neon-tower': '#7B61FF', 'cosmic-dash': '#00FFFF', 'lazer-maze': '#FF3B6B',
    'time-rush': '#7B61FF', 'pong': '#00FFFF', 'table-tennis': '#FF10F0',
    'bowling-strike': '#60A5FA', 'cricket-sixer': '#FBBF24', 'hoop-dunk': '#FB923C',
    'archery-master': '#4ADE80', 'soccer-penalty': '#22C55E', 'athletics-sprint': '#F59E0B',
    'flow-free': '#22D3EE', 'word-search': '#F472B6', 'memory-match': '#C084FC',
    'mine-sweeper': '#F97316', 'sudoku': '#38BDF8', 'mastermind': '#FF10F0',
    'simon-says': '#F87171', 'tic-tac-toe': '#00FFFF', 'connect-four': '#FBBF24',
    'checkers': '#4ADE80', 'slide-puzzle': '#A855F7', 'nonogram': '#60A5FA',
    'lucky-spin': '#FF10F0', 'pinball': '#F97316', 'crossy-neon': '#4ADE80',
    'trash-sorter': '#38BDF8', 'ladder-climb': '#F59E0B', 'math-dash': '#22D3EE',
    'bounce': '#FF3B3B', 'space-impact': '#00FF44', 'bantumi': '#D4A574', 'reversi': '#4ADE80',
}

logos = {}
for gid, fn in GLYPHS.items():
    color = COLORS.get(gid, '#00FFFF')
    logos[gid] = wrap(color, fn(color))

# emit JS
lines = ['// Auto-generated neon SVG logos — one per game (viewBox 120x120).',
         '// DO NOT hand-edit; regenerate via scripts/gen_logos.py',
         'window.GAME_LOGOS = {']
for gid in sorted(logos):
    lines.append(f"  {json.dumps(gid)}: {json.dumps(logos[gid])},")
lines.append('};')

with open('assets/logos.js', 'w') as f:
    f.write('\n'.join(lines))

body = '\n'.join(lines)
print(f"Generated {len(logos)} logos -> assets/logos.js ({len(body)} bytes)")