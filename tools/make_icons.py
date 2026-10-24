# Makes the home-screen icons (a little neon arcade cabinet in pixel art).
# Pure Python, no libraries needed. Run: python tools/make_icons.py
import os, struct, zlib

OUT = os.path.join(os.path.dirname(__file__), "..", "icons")
N = 32  # the art is drawn on a 32x32 grid, then scaled up with hard pixel edges

BG = (11, 0, 26)
GLOW = (40, 6, 70)
BODY = (120, 20, 190)
EDGE = (255, 60, 200)
MARQ = (255, 214, 60)
MARQ_DARK = (200, 120, 20)
SCREEN = (6, 30, 40)
SCAN = (10, 50, 60)
SHIP = (80, 255, 230)
STAR = (255, 255, 255)
PANEL = (70, 10, 110)
RED = (255, 50, 80)
BLUE = (60, 160, 255)
STICK = (230, 230, 230)

grid = [[BG] * N for _ in range(N)]

def rect(x, y, w, h, c):
    for j in range(y, y + h):
        for i in range(x, x + w):
            if 0 <= i < N and 0 <= j < N:
                grid[j][i] = c

# soft glow behind the cabinet
rect(7, 3, 18, 27, GLOW)
# cabinet body with neon edge
rect(8, 4, 16, 25, EDGE)
rect(9, 5, 14, 23, BODY)
# marquee
rect(9, 5, 14, 4, MARQ)
rect(10, 6, 12, 2, MARQ_DARK)
for i in range(11, 21, 2):
    grid[6][i] = MARQ
# screen
rect(10, 10, 12, 9, SCREEN)
for j in range(10, 19, 2):
    rect(10, j, 12, 1, SCAN)
# little ship and stars on the screen
rect(15, 15, 2, 2, SHIP)
rect(14, 16, 4, 1, SHIP)
rect(15, 14, 2, 1, SHIP)
grid[11][12] = STAR
grid[12][19] = STAR
grid[13][11] = STAR
# control panel
rect(9, 20, 14, 4, PANEL)
rect(11, 20, 1, 2, STICK)
rect(10, 22, 3, 1, RED)
rect(16, 21, 2, 2, RED)
rect(19, 21, 2, 2, BLUE)
# coin slot
rect(14, 25, 4, 2, (30, 0, 50))
rect(15, 25, 2, 2, MARQ)


def save(path, size, pad):
    """pad = fraction of empty border (maskable icons need a safe zone)."""
    inner = int(size * (1 - 2 * pad))
    scale = inner / N
    off = (size - inner) // 2
    rows = []
    for y in range(size):
        row = bytearray([0])
        gy = int((y - off) / scale) if off <= y < off + inner else -1
        for x in range(size):
            gx = int((x - off) / scale) if off <= x < off + inner else -1
            c = grid[gy][gx] if gy >= 0 and gx >= 0 and gy < N and gx < N else BG
            row += bytes(c)
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


os.makedirs(OUT, exist_ok=True)
save(os.path.join(OUT, "apple-touch-icon.png"), 180, 0.0)
save(os.path.join(OUT, "icon-192.png"), 192, 0.0)
save(os.path.join(OUT, "icon-512.png"), 512, 0.0)
save(os.path.join(OUT, "icon-maskable-512.png"), 512, 0.12)
save(os.path.join(OUT, "favicon-32.png"), 32, 0.0)
print("icons written to", os.path.abspath(OUT))
