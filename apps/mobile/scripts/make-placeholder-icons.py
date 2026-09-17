#!/usr/bin/env python3
"""
Generate placeholder app icons (solid amber + a cream "dram" glass glyph) with
no dependencies beyond the standard library. Replace with real brand assets
before the store release; keep this script so a fresh clone can always build.

    python3 scripts/make-placeholder-icons.py
"""
import struct
import zlib
from pathlib import Path

AMBER = (200, 121, 42, 255)
CREAM = (251, 247, 241, 255)
WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)

OUT = Path(__file__).resolve().parent.parent / "assets" / "images"


def png(path: Path, size: int, pixel):
    """Write an RGBA PNG of `size`×`size`; `pixel(x, y)` returns an RGBA tuple."""
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter type: none
        for x in range(size):
            raw.extend(pixel(x, y))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b""))


def glass(size: int, fg, bg, scale=1.0):
    """A rocks glass: a rounded rectangle with a 'pour' line, centered."""
    cx = size / 2
    w = size * 0.42 * scale
    h = size * 0.46 * scale
    top = size / 2 - h / 2
    bottom = size / 2 + h / 2
    r = size * 0.06 * scale
    pour = bottom - h * 0.42
    wall = max(2.0, size * 0.035 * scale)

    def inside(x, y, x0, x1, y0, y1, rad):
        if not (x0 <= x <= x1 and y0 <= y <= y1):
            return False
        # rounded bottom corners only
        for cxr, cyr in ((x0 + rad, y1 - rad), (x1 - rad, y1 - rad)):
            if (x < x0 + rad and y > y1 - rad and (x - cxr) ** 2 + (y - cyr) ** 2 > rad**2 and x < cxr and y > cyr):
                return False
            if (x > x1 - rad and y > y1 - rad and (x - cxr) ** 2 + (y - cyr) ** 2 > rad**2 and x > cxr and y > cyr):
                return False
        return True

    def pixel(x, y):
        x0, x1 = cx - w / 2, cx + w / 2
        outer = inside(x + 0.5, y + 0.5, x0, x1, top, bottom, r)
        inner = inside(x + 0.5, y + 0.5, x0 + wall, x1 - wall, top - wall, bottom - wall, max(r - wall, 1))
        if outer and not inner:
            return fg
        if inner and y + 0.5 >= pour:
            return fg  # the whiskey
        return bg

    return pixel


def main():
    png(OUT / "icon.png", 1024, glass(1024, CREAM, AMBER, 0.9))
    png(OUT / "android-icon-background.png", 1024, lambda x, y: AMBER)
    png(OUT / "android-icon-foreground.png", 1024, glass(1024, CREAM, CLEAR, 0.62))
    png(OUT / "android-icon-monochrome.png", 1024, glass(1024, WHITE, CLEAR, 0.62))
    png(OUT / "splash-icon.png", 512, glass(512, CREAM, CLEAR, 0.9))
    png(OUT / "favicon.png", 48, glass(48, CREAM, AMBER, 0.9))
    print(f"wrote 6 placeholder icons to {OUT}")


if __name__ == "__main__":
    main()
