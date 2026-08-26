#!/usr/bin/env python3
"""
Turn a raw generated avatar into one ready for /superadmin's avatar picker.

    python3 scripts/avatar_prep.py raw.png [more.png ...] [--out DIR] [--size 512]

Why this exists: the generators return the coloured disc floating on a white
page, off-centre and not quite square. Both apps render a member photo as
`.scaledToFill()` into a square frame, then `.clipShape(.circle)` with a
terracotta ring on top (iOS `Avatar.swift`, Android's mirror). So the circle
the app cuts is the frame's INSCRIBED circle, not the artwork's disc — hand a
raw file over and the clip bites into the white margin and leaves pale slivers
inside the ring.

So: find the disc, crop a square centred on it, scale, and punch the corners
transparent. The result lines up with the app's clip exactly, and still reads
correctly anywhere it is drawn square (the superadmin tiles, the web).

⚠ The disc is detected as "clearly not the white page" (channel sum < 690).
A plain `!= white` test does NOT work — these files carry a near-white
compression artifact along the bottom row (239,241,238) that reads as content
and stretches the box to the image edge.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from collections import Counter

from PIL import Image, ImageDraw

WHITE_SUM = 690   # below this, a pixel is artwork rather than page
SS = 4            # mask supersampling, for a clean anti-aliased edge

# The brand palette (Theme.swift). ⚠ `terracotta` there is a GREEN — the name
# is historical. These are the disc colours dark enough to carry the cream
# figure; the light three are decorative rather than high-contrast.
PALETTE = {
    # From Theme.swift. Only these three are usable as a disc — see below.
    "navy": "1A2E1A", "sage": "6B7D5E", "gold": "8B7B4A",
    # ⚠ Present so a mistake is obvious, NOT for use: each sits within 28 of the
    # ring colour, so the app's stroke disappears against them.
    "terracottaDark": "2D4A2E", "terracotta": "3D5A3E", "sageDark": "4A5C3E",
    # ⚠ Clear the ring but are too light to carry the cream figure — tried on
    # the first nine and they came back washed out.
    "sageLight": "9BAF8E", "terracottaLight": "A8C4A0", "goldLight": "C4B88A",
    # A warm range beyond Theme.swift, added because the brand palette cannot
    # separate nine avatars at 28px without washing the figure out. Every one
    # clears the ring by 60+ AND beats sage/gold on figure contrast (4.5:1 to
    # 8.8:1 against the cream, vs 3.8:1 for gold). Muted to sit beside the
    # greens rather than shout over them.
    "clay": "9C5B44", "dustyRed": "9E4F4F", "brick": "7A4634", "wine": "6B3340",
    "berry": "7E3F4F", "rose": "A2596B", "mauve": "8A6479", "orchid": "7A5A86",
    "plum": "6E4A63",
}


def _rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def recolour_disc(im: Image.Image, target: str, tol: int = 62) -> Image.Image:
    """Repaint the flat disc fill, leaving the figure and its outline alone.

    ⚠ Not a flood fill and not an exact-colour swap: the fill carries faint
    shading, and every boundary against the figure is anti-aliased. Both would
    leave a green fringe. Instead each pixel is moved toward the target in
    PROPORTION to how close it is to the fill colour, so a half-blended edge
    pixel gets half the shift and the outline (far from the fill) gets none.
    """
    tgt = _rgb(target)
    im = im.convert("RGB")          # called before the alpha mask goes on
    px = im.load()
    w, h = im.size
    # The fill colour is whatever dominates a thin annulus just inside the rim,
    # which is disc and nothing else whatever the figure is doing.
    ring = Counter()
    cx = cy = w / 2
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if 0.80 * w / 2 < d < 0.93 * w / 2:
                ring[px[x, y][:3]] += 1
    base = ring.most_common(1)[0][0]

    out = im.copy()
    op = out.load()
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            dist = sum((a - b) ** 2 for a, b in zip(p[:3], base)) ** 0.5
            if dist >= tol:
                continue
            k = 1.0 - dist / tol
            op[x, y] = tuple(
                max(0, min(255, round(c + (t - bc) * k)))
                for c, t, bc in zip(p, tgt, base)
            )
    return out


def disc_box(im: Image.Image) -> tuple[int, int, int, int]:
    px = im.load()
    w, h = im.size
    solid = lambda p: sum(p[:3]) < WHITE_SUM
    xs = [x for x in range(w) if any(solid(px[x, y]) for y in range(h))]
    ys = [y for y in range(h) if any(solid(px[x, y]) for x in range(w))]
    if not xs or not ys:
        raise ValueError("no artwork found — is the image blank?")
    return xs[0], ys[0], xs[-1], ys[-1]


def prepare(src: Path, out_dir: Path, size: int, disc: str | None = None) -> Path:
    im = Image.open(src).convert("RGB")
    l, t, r, b = disc_box(im)

    # ⚠ Crop to the disc's OWN box and stretch that to square — do NOT take a
    # square crop centred on it. These discs are not perfectly round (this one
    # was 376x380), so a square crop leaves a couple of pixels of slack on the
    # narrow axis, and the app's clip — which cuts the frame's inscribed circle
    # — then bites into the white page and leaves a pale sliver inside the
    # terracotta ring. Caught by sampling the output's edge midpoints, which
    # came back (253,252,251). The squash needed is around 1% and invisible;
    # the sliver is not.
    square = im.crop((l, t, r + 1, b + 1)).resize((size, size), Image.LANCZOS)

    # Corners transparent, so a square render shows the disc rather than a white box.
    mask = Image.new("L", (size * SS, size * SS), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * SS - 1, size * SS - 1), fill=255)
    if disc:
        square = recolour_disc(square, PALETTE.get(disc, disc))
    square.putalpha(mask.resize((size, size), Image.LANCZOS))

    out_dir.mkdir(parents=True, exist_ok=True)
    dest = out_dir / f"{src.stem}.png"
    square.save(dest, "PNG", optimize=True)
    print(f"{src.name}\n  disc {r-l+1}x{b-t+1} at ({l},{t}) -> {size}x{size}  {dest}")
    return dest


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("images", nargs="+", type=Path)
    ap.add_argument("--out", type=Path, default=None, help="default: a 'ready' folder beside the first image")
    ap.add_argument("--size", type=int, default=512)
    ap.add_argument("--disc", default=None,
                    help="Repaint the disc: a palette name (%s) or a hex value." % ", ".join(PALETTE))
    a = ap.parse_args()
    out = a.out or a.images[0].parent / "ready"
    for p in a.images:
        prepare(p, out, a.size, a.disc)
    return 0


if __name__ == "__main__":
    sys.exit(main())
