#!/usr/bin/env python3
"""Generate real PNG assets for RETRO ARCADE HUB (audit #10,11,12).
Pure-stdlib: custom minimal PNG encoder + 5x7 pixel bitmap font.
Outputs:
  assets/icon-192.png / icon-512.png / icon-512-maskable.png
  assets/og-cover.png          (1200x630, pixel-font title — share-ready)
  assets/favicon-32.png / favicon-16.png
"""
import struct, zlib, math, os

# ---------- 5x7 pixel font (A-Z, 0-9, space, -, ., !) ----------
FONT = {
'A':[0,1,1,1,0, 1,0,0,0,1, 1,1,1,1,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1],
'B':[1,1,1,1,0, 1,0,0,0,1, 1,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,1,1,1,0],
'C':[0,1,1,1,0, 1,0,0,0,1, 1,0,0,0,0, 1,0,0,0,0, 1,0,0,0,0, 1,0,0,0,1, 0,1,1,1,0],
'D':[1,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,1,1,1,0],
'E':[1,1,1,1,1, 1,0,0,0,0, 1,1,1,1,0, 1,0,0,0,0, 1,0,0,0,0, 1,0,0,0,0, 1,1,1,1,1],
'F':[1,1,1,1,1, 1,0,0,0,0, 1,1,1,1,0, 1,0,0,0,0, 1,0,0,0,0, 1,0,0,0,0, 1,0,0,0,0],
'G':[0,1,1,1,0, 1,0,0,0,1, 1,0,0,0,0, 1,0,1,1,1, 1,0,0,0,1, 1,0,0,0,1, 0,1,1,1,0],
'H':[1,0,0,0,1, 1,0,0,0,1, 1,1,1,1,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1],
'I':[0,1,1,1,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,1,1,1,0],
'J':[0,0,1,1,1, 0,0,0,1,0, 0,0,0,1,0, 0,0,0,1,0, 0,0,0,1,0, 1,0,0,1,0, 0,1,1,0,0],
'K':[1,0,0,0,1, 1,0,0,1,0, 1,0,1,0,0, 1,1,0,0,0, 1,0,1,0,0, 1,0,0,1,0, 1,0,0,0,1],
'L':[1,0,0,0,0, 1,0,0,0,0, 1,0,0,0,0, 1,0,0,0,0, 1,0,0,0,0, 1,0,0,0,0, 1,1,1,1,1],
'M':[1,0,0,0,1, 1,1,0,1,1, 1,0,1,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1],
'N':[1,0,0,0,1, 1,1,0,0,1, 1,0,1,0,1, 1,0,0,1,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1],
'O':[0,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 0,1,1,1,0],
'P':[1,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 1,1,1,1,0, 1,0,0,0,0, 1,0,0,0,0, 1,0,0,0,0],
'Q':[0,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,1,0,1, 1,0,0,1,0, 0,1,1,0,1],
'R':[1,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 1,1,1,1,0, 1,0,1,0,0, 1,0,0,1,0, 1,0,0,0,1],
'S':[0,1,1,1,0, 1,0,0,0,1, 1,0,0,0,0, 0,1,1,1,0, 0,0,0,0,1, 1,0,0,0,1, 0,1,1,1,0],
'T':[1,1,1,1,1, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0],
'U':[1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 0,1,1,1,0],
'V':[1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 0,1,0,1,0, 0,0,1,0,0],
'W':[1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,1,0,1, 1,0,1,0,1, 1,1,0,1,1, 1,0,0,0,1],
'X':[1,0,0,0,1, 1,0,0,0,1, 0,1,0,1,0, 0,0,1,0,0, 0,1,0,1,0, 1,0,0,0,1, 1,0,0,0,1],
'Y':[1,0,0,0,1, 1,0,0,0,1, 0,1,0,1,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0],
'Z':[1,1,1,1,1, 0,0,0,0,1, 0,0,0,1,0, 0,0,1,0,0, 0,1,0,0,0, 1,0,0,0,0, 1,1,1,1,1],
'0':[0,1,1,1,0, 1,0,0,0,1, 1,0,0,1,1, 1,0,1,0,1, 1,1,0,0,1, 1,0,0,0,1, 0,1,1,1,0],
'1':[0,0,1,0,0, 0,1,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,1,1,1,0],
'2':[0,1,1,1,0, 1,0,0,0,1, 0,0,0,0,1, 0,0,0,1,0, 0,0,1,0,0, 0,1,0,0,0, 1,1,1,1,1],
'3':[1,1,1,1,0, 0,0,0,0,1, 0,0,0,0,1, 0,1,1,1,0, 0,0,0,0,1, 0,0,0,0,1, 1,1,1,1,0],
'4':[0,0,0,1,0, 0,0,1,1,0, 0,1,0,1,0, 1,0,0,1,0, 1,1,1,1,1, 0,0,0,1,0, 0,0,0,1,0],
'5':[1,1,1,1,1, 1,0,0,0,0, 1,1,1,1,0, 0,0,0,0,1, 0,0,0,0,1, 1,0,0,0,1, 0,1,1,1,0],
'6':[0,1,1,1,0, 1,0,0,0,0, 1,0,0,0,0, 1,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 0,1,1,1,0],
'7':[1,1,1,1,1, 0,0,0,0,1, 0,0,0,1,0, 0,0,1,0,0, 0,1,0,0,0, 0,1,0,0,0, 0,1,0,0,0],
'8':[0,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 0,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 0,1,1,1,0],
'9':[0,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 0,1,1,1,1, 0,0,0,0,1, 0,0,0,0,1, 0,1,1,1,0],
' ':[0,0,0,0,0]*7,
'-':[0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 1,1,1,1,1, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0],
'.':[0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,1,1,0, 0,0,1,1,0],
'!':[0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,0,0,0, 0,0,1,0,0],
':':[0,0,0,0,0, 0,0,1,1,0, 0,0,1,1,0, 0,0,0,0,0, 0,0,1,1,0, 0,0,1,1,0, 0,0,0,0,0],
}

def text_width(txt, scale, spacing=1):
    return sum((5 + spacing) * scale for _ in txt) - spacing * scale

def draw_text(px, x0, y0, txt, scale, color, spacing=1):
    """Draw 5x7 pixel text. px = rows-of-rows [[r,g,b,a],..], w = width."""
    w = len(px[0])
    x = x0
    for ch in txt:
        glyph = FONT.get(ch, FONT[' '])
        for r in range(7):
            for c in range(5):
                if glyph[r * 5 + c]:
                    for yy in range(scale):
                        for xx in range(scale):
                            X, Y = x + c * scale + xx, y0 + r * scale + yy
                            if 0 <= X < w and 0 <= Y < len(px):
                                px[Y][X] = [color[0], color[1], color[2], 255]
        x += (5 + spacing) * scale

def png_chunk(tag, data):
    c = struct.pack('>I', len(data)) + tag + data
    c += struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    return c

def write_png(path, w, h, rgba_rows):
    raw = b''
    for row in rgba_rows:
        raw += b'\x00' + bytes(v for px in row for v in px)
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        f.write(png_chunk(b'IHDR', ihdr))
        f.write(png_chunk(b'IDAT', zlib.compress(raw, 9)))
        f.write(png_chunk(b'IEND', b''))

def lerp(a, b, t): return a + (b - a) * t

def bg_gradient(x, y, w, h, c1, c2):
    t = (x / max(1, w - 1) + y / max(1, h - 1)) / 2
    return (int(lerp(c1[0], c2[0], t)), int(lerp(c1[1], c2[1], t)), int(lerp(c1[2], c2[2], t)), 255)

def glow_circle(pxc, pyc, radius, color, strength):
    def apply(x, y, px_arr):
        dx, dy = x - pxc, y - pyc
        d2 = dx * dx + dy * dy
        if d2 > radius * radius: return
        f = (1 - d2 / (radius * radius)) ** 2
        a = int(255 * f * strength)
        if a <= 0: return
        for c in range(3):
            px_arr[y][x][c] = min(255, px_arr[y][x][c] + int(color[c] * a / 255))
    return apply

def rounded_rect_mask(w, h, rx):
    mask = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            in_r = True
            if x < rx and y < rx:
                dx, dy = rx - x - 0.5, rx - y - 0.5
                in_r = dx * dx + dy * dy <= rx * rx
            elif x >= w - rx and y < rx:
                dx, dy = x - (w - rx) + 0.5, rx - y - 0.5
                in_r = dx * dx + dy * dy <= rx * rx
            elif x < rx and y >= h - rx:
                dx, dy = rx - x - 0.5, y - (h - rx) + 0.5
                in_r = dx * dx + dy * dy <= rx * rx
            elif x >= w - rx and y >= h - rx:
                dx, dy = x - (w - rx) + 0.5, y - (h - rx) + 0.5
                in_r = dx * dx + dy * dy <= rx * rx
            mask[y][x] = in_r
    return mask

def draw_joystick(px, py, s, color):
    """Clear joystick: outer ring base + ball + stick pointing down-right."""
    # base ring
    for y in range(int(py - s * 3.4 - 1), int(py + s * 3.4 + 2)):
        for x in range(int(px - s * 3.4 - 1), int(px + s * 3.4 + 2)):
            d = math.hypot(x - px, y - py)
            if s * 2.2 <= d <= s * 3.4:
                yield x, y, color
    # stick (down)
    for y in range(int(py + s * 1.6), int(py + s * 4.6) + 1):
        for x in range(int(px - s * 0.5), int(px + s * 0.5) + 1):
            yield x, y, color
    # stick end cap (wider)
    yb = int(py + s * 4.0)
    for y in range(yb, yb + int(s * 1.0)):
        for x in range(int(px - s * 1.1), int(px + s * 1.1) + 1):
            yield x, y, color
    # ball (filled, on top of stick)
    for y in range(int(py - s * 1.9), int(py + s * 1.9) + 1):
        for x in range(int(px - s * 1.9), int(px + s * 1.9) + 1):
            if math.hypot(x - px, y - py) <= s * 1.9:
                yield x, y, color

def draw_dpad(cx, cy, s, color):
    """Classic gamepad D-pad (cross shape) — unambiguous arcade icon.
    Horizontal + vertical bars crossing at center; center gap. s = scale."""
    bar_w = int(s * 1.0)      # bar thickness
    arm = int(s * 3.0)        # arm length from center
    # vertical bar (up arm + down arm)
    for y in range(int(cy - arm), int(cy + arm) + 1):
        for x in range(int(cx - bar_w // 2), int(cx + bar_w // 2) + 1):
            yield x, y, color
    # horizontal bar
    for x in range(int(cx - arm), int(cx + arm) + 1):
        for y in range(int(cy - bar_w // 2), int(cy + bar_w // 2) + 1):
            yield x, y, color

def render_icon(size, maskable=False):
    w = h = size
    dpr = size / 512.0
    px = [[[0, 0, 0, 0] for _ in range(w)] for _ in range(h)]
    c1, c2 = (10, 14, 26), (21, 10, 36)
    rx = int(20 * dpr) if not maskable else 0
    if maskable:
        for y in range(h):
            for x in range(w):
                px[y][x] = list(bg_gradient(x, y, w, h, c1, c2))
        m = int(size * 0.09)
        for y in range(m, h - m):
            for x in range(m, w - m):
                px[y][x] = list(bg_gradient(x, y, w, h, (13, 18, 34), (27, 13, 46)))
    else:
        mask = rounded_rect_mask(w, h, rx)
        for y in range(h):
            for x in range(w):
                if mask[y][x]:
                    px[y][x] = list(bg_gradient(x, y, w, h, c1, c2))
    cx, cy, gs = w / 2, h * 0.52, dpr * 22
    glow = glow_circle(cx, cy, gs * 3.2, (0, 255, 255), 0.5)
    for y in range(h):
        for x in range(w):
            glow(x, y, px)
    # neon grid
    for i in range(1, 4):
        yy = int(h * (0.62 + i * 0.12))
        if yy >= h: continue
        for x in range(w):
            px[yy][x][0] = min(255, px[yy][x][0] + 18)
            px[yy][x][1] = min(255, px[yy][x][1] + 26)
            px[yy][x][2] = min(255, px[yy][x][2] + 30)
    # D-pad
    for item in draw_dpad(cx, cy, gs, (0, 255, 255)):
        if len(item) == 3:
            x, y, color = item
            if 0 <= x < w and 0 <= y < h:
                px[y][x] = [color[0], color[1], color[2], 255]
    # four A/B/start buttons (small circles) at corners of the pad
    btn = [(0.34, 0.30), (0.66, 0.30), (0.34, 0.74), (0.66, 0.74)]
    colors = [(255, 16, 240), (0, 255, 255), (255, 230, 0), (56, 189, 248)]
    for (bx, by), col in zip(btn, colors):
        acx, acy, r = int(w * bx), int(h * by), dpr * 6
        for y in range(int(acy - r), int(acy + r) + 1):
            for x in range(int(acx - r), int(acx + r) + 1):
                if 0 <= x < w and 0 <= y < h and math.hypot(x - acx, y - acy) <= r:
                    px[y][x] = [col[0], col[1], col[2], 255]
    return [px[y][x] for y in range(h) for x in range(w)], w, h

def render_og(w=1200, h=630):
    px = [[[0, 0, 0, 0] for _ in range(w)] for _ in range(h)]
    c1, c2 = (10, 14, 26), (21, 10, 36)
    for y in range(h):
        for x in range(w):
            px[y][x] = list(bg_gradient(x, y, w, h, c1, c2))
    g = glow_circle(w / 2, h / 2, 260, (0, 255, 255), 0.35)
    for y in range(h):
        for x in range(w):
            g(x, y, px)
    # neon grid
    for i in range(1, 4):
        yy = int(h * (0.82 + i * 0.06))
        if yy >= h: continue
        for x in range(w):
            px[yy][x][0] = min(255, px[yy][x][0] + 16)
            px[yy][x][1] = min(255, px[yy][x][1] + 24)
            px[yy][x][2] = min(255, px[yy][x][2] + 28)
    for x in range(0, w + 1, 120):
        if x >= w: continue
        for dd in range(24):
            yy = int(h * 0.82) + dd
            if yy < h:
                px[yy][x][1] = min(255, px[yy][x][1] + 14)
    # corner icon circles
    for (ax, ay, col) in [(0.12, 0.16, (0, 255, 255)), (0.88, 0.16, (255, 16, 240)), (0.12, 0.82, (255, 230, 0)), (0.88, 0.82, (56, 189, 248))]:
        acx, acy, r = int(w * ax), int(h * ay), int(h * 0.085)
        for y in range(acy - r, acy + r + 1):
            for x in range(acx - r, acx + r + 1):
                if 0 <= x < w and 0 <= y < h:
                    d = math.hypot(x - acx, y - acy)
                    if d <= r * 0.92:
                        px[y][x] = [col[0], col[1], col[2], 255]
                    elif d <= r:
                        px[y][x] = [int(col[0] * 0.45), int(col[1] * 0.45), int(col[2] * 0.45), 255]
    # pixel-font title: RETRO ARCADE HUB (scale 9 → 45px tall)
    title = 'RETRO ARCADE HUB'
    tw = text_width(title, 9)
    x0 = int((w - tw) / 2)
    draw_text(px, x0, int(h * 0.34), title, 9, (0, 255, 255), spacing=2)
    # subtitle: 70 FREE GAMES (scale 6 → 30px tall)
    sub = '70 FREE GAMES'
    sw_ = text_width(sub, 6)
    draw_text(px, int((w - sw_) / 2), int(h * 0.60), sub, 6, (255, 16, 240), spacing=2)
    # tagline
    tag = 'SNAKE - TETRIS - PINBALL - RACING - PUZZLE'
    tw2 = text_width(tag, 4)
    x0 = int((w - tw2) / 2)
    draw_text(px, x0, int(h * 0.74), tag, 4, (255, 230, 0), spacing=1)
    return [px[y][x] for y in range(h) for x in range(w)], w, h

def render_favicon(size):
    w = h = size
    dpr = size / 32.0
    px = [[[0, 0, 0, 0] for _ in range(w)] for _ in range(h)]
    c1, c2 = (10, 14, 26), (21, 10, 36)
    rx = int(7 * dpr)
    mask = rounded_rect_mask(w, h, rx)
    for y in range(h):
        for x in range(w):
            if mask[y][x]:
                px[y][x] = list(bg_gradient(x, y, w, h, c1, c2))
    cx, cy = w / 2, h / 2
    g = glow_circle(cx, cy, dpr * 8, (0, 255, 255), 0.8)
    for y in range(h):
        for x in range(w):
            g(x, y, px)
    for item in draw_dpad(cx, cy, dpr * 3.6, (0, 255, 255)):
        if len(item) == 3:
            x, y, color = item
            if 0 <= x < w and 0 <= y < h:
                px[y][x] = [color[0], color[1], color[2], 255]
    return [px[y][x] for y in range(h) for x in range(w)], w, h

os.makedirs('assets', exist_ok=True)
for (path, fn) in [
    ('assets/icon-192.png', lambda: render_icon(192)),
    ('assets/icon-512.png', lambda: render_icon(512)),
    ('assets/icon-512-maskable.png', lambda: render_icon(512, maskable=True)),
    ('assets/og-cover.png', render_og),
    ('assets/favicon-32.png', lambda: render_favicon(32)),
    ('assets/favicon-16.png', lambda: render_favicon(16)),
]:
    data, w, h = fn()
    rows = [data[y * w:(y + 1) * w] for y in range(h)]
    write_png(path, w, h, rows)
    print(f'{path}: {w}x{h} {os.path.getsize(path)} bytes')