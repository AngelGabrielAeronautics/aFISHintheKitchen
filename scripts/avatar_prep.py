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
import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw

WHITE_SUM = 690   # below this, a pixel is artwork rather than page
SS = 4            # mask supersampling, for a clean anti-aliased edge


def disc_box(im: Image.Image) -> tuple[int, int, int, int]:
    px = im.load()
    w, h = im.size
    solid = lambda p: sum(p[:3]) < WHITE_SUM
    xs = [x for x in range(w) if any(solid(px[x, y]) for y in range(h))]
    ys = [y for y in range(h) if any(solid(px[x, y]) for x in range(w))]
    if not xs or not ys:
        raise ValueError("no artwork found — is the image blank?")
    return xs[0], ys[0], xs[-1], ys[-1]


def prepare(src: Path, out_dir: Path, size: int) -> Path:
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
    a = ap.parse_args()
    out = a.out or a.images[0].parent / "ready"
    for p in a.images:
        prepare(p, out, a.size)
    return 0


if __name__ == "__main__":
    sys.exit(main())
