"""One-off script to rasterize the app icon. Not part of the shipped app."""
from PIL import Image, ImageDraw

BG = (236, 48, 19)  # --color-accent
FG = (255, 255, 255)


def draw_bug(draw, cx, cy, scale):
    # Simple geometric insect glyph: head, body, 6 legs, 2 antennae.
    body_w, body_h = 0.34 * scale, 0.46 * scale
    head_r = 0.13 * scale
    stroke = max(2, int(0.045 * scale))

    # Antennae
    draw.line([cx - 0.06 * scale, cy - 0.38 * scale, cx - 0.16 * scale, cy - 0.5 * scale], fill=FG, width=stroke)
    draw.line([cx + 0.06 * scale, cy - 0.38 * scale, cx + 0.16 * scale, cy - 0.5 * scale], fill=FG, width=stroke)

    # Head
    draw.ellipse([cx - head_r, cy - 0.34 * scale - head_r, cx + head_r, cy - 0.34 * scale + head_r], fill=FG)

    # Body
    draw.ellipse([cx - body_w / 2, cy - body_h / 2, cx + body_w / 2, cy + body_h / 2], fill=FG)

    # Legs (3 pairs)
    for i, dy in enumerate([-0.08 * scale, 0.06 * scale, 0.2 * scale]):
        y = cy + dy
        draw.line([cx - body_w / 2, y, cx - body_w / 2 - 0.22 * scale, y - 0.1 * scale + i * 0.03 * scale], fill=FG, width=stroke)
        draw.line([cx + body_w / 2, y, cx + body_w / 2 + 0.22 * scale, y - 0.1 * scale + i * 0.03 * scale], fill=FG, width=stroke)


def make(size, path, padding_ratio=0.0):
    img = Image.new("RGB", (size, size), BG)
    draw = ImageDraw.Draw(img)
    scale = size * (1 - padding_ratio * 2)
    draw_bug(draw, size / 2, size / 2, scale)
    img.save(path)


make(192, "icon-192.png")
make(512, "icon-512.png")
make(512, "maskable-512.png", padding_ratio=0.12)
print("done")
