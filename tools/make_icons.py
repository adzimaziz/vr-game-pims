"""App icons for the PWA: navy tile, TED-gradient hexagon, white "PI" + "VR GAMES". -> assets/icon-*.png"""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "assets"
BAHN = r"C:\Windows\Fonts\bahnschrift.ttf"


def hexpts(cx, cy, r):
    return [(cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))) for a in (-90, -30, 30, 90, 150, 210)]


def gradient(size, stops):
    """Diagonal gradient through (pos, rgb) stops."""
    im = Image.new("RGB", (size, size))
    px = im.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size - 2)
            for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
                if p0 <= t <= p1:
                    u = (t - p0) / (p1 - p0)
                    px[x, y] = tuple(int(c0[i] + (c1[i] - c0[i]) * u) for i in range(3))
                    break
    return im


def font(size, var="Bold"):
    f = ImageFont.truetype(BAHN, size); f.set_variation_by_name(var); return f


def icon(size, maskable=False):
    S = size * 4
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if maskable:
        d.rectangle([0, 0, S, S], fill=(5, 13, 28, 255))
    else:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 0.2, fill=(5, 13, 28, 255))
    # dot-matrix accent
    for gy in range(0, S, S // 24):
        for gx in range(int(S * 0.55), S, S // 24):
            if (gx * 7 + gy * 3) % 5 < 2:
                r = S * 0.006
                d.ellipse([gx - r, gy - r, gx + r, gy + r], fill=(95, 211, 232, 110))
    scale = 0.62 if maskable else 0.72
    R = S * scale / 2
    cx, cy = S / 2, S / 2
    grad = gradient(S, [(0.0, (24, 102, 175)), (0.55, (69, 133, 151)), (1.0, (143, 199, 78))]).convert("RGBA")
    mask = Image.new("L", (S, S), 0); ImageDraw.Draw(mask).polygon(hexpts(cx, cy, R), fill=255)
    im.paste(grad, (0, 0), mask)
    d.polygon(hexpts(cx, cy, R), outline=(255, 255, 255, 255), width=int(S * 0.018))
    f1, f2 = font(int(R * 0.95)), font(int(R * 0.22), "SemiBold")
    t1 = "PI"; w1 = d.textbbox((0, 0), t1, font=f1)
    d.text((cx - (w1[2] - w1[0]) / 2 - w1[0], cy - R * 0.62), t1, font=f1, fill=(255, 255, 255, 255))
    t2 = "VR GAMES"; w2 = d.textbbox((0, 0), t2, font=f2)
    d.text((cx - (w2[2] - w2[0]) / 2 - w2[0], cy + R * 0.38), t2, font=f2, fill=(255, 255, 255, 235))
    return im.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    for s in (192, 512):
        icon(s).save(OUT / f"icon-{s}.png", optimize=True)
        icon(s, maskable=True).save(OUT / f"icon-maskable-{s}.png", optimize=True)
    icon(180).save(OUT / "apple-touch-icon.png", optimize=True)
    print("icons written to", OUT)
