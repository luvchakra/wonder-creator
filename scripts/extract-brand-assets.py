"""Re-create the published brand derivatives from the supplied source images (pixel crops only).

Usage: python3 scripts/extract-brand-assets.py   (requires Pillow)
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "packages/ui/src/brand/assets"
OUT = ROOT / "apps/web/public/brand"

board = Image.open(SRC / "brand-board-reference.png")
OUT.mkdir(parents=True, exist_ok=True)
board.crop((30, 60, 425, 235)).save(OUT / "logo-primary.png", optimize=True)
board.crop((1185, 60, 1330, 180)).save(OUT / "logo-mark.png", optimize=True)
board.crop((935, 58, 1035, 158)).save(OUT / "app-icon.png", optimize=True)
board.crop((1262, 352, 1528, 668)).save(OUT / "brand-elements.png", optimize=True)

sheet = Image.open(SRC / "backgrounds/background-set-source.png").convert("RGB")
i = 3
tiles = {
    "sunset-coast-creator": (0, 0, 657, 290),
    "coastal-village-sunset": (665, 0, 1320, 290),
    "misty-mountains-dawn": (1328, 0, 1983, 290),
    "studio-desk-camera": (0, 297, 491, 530),
    "botanical-leaves-glow": (498, 297, 988, 530),
    "arches-sea-view": (995, 297, 1484, 530),
    "terrace-laptop-sunset": (1492, 297, 1983, 530),
    "waves-gradient": (0, 537, 491, 793),
    "soft-gradient-forms": (498, 537, 988, 793),
    "leaf-shadow-wall": (995, 537, 1484, 793),
    "pastel-clouds": (1492, 537, 1983, 793),
}
(OUT / "backgrounds").mkdir(exist_ok=True)
for name, (x0, y0, x1, y1) in tiles.items():
    sheet.crop((x0 + i, y0 + i, x1 - i, y1 - i)).save(OUT / "backgrounds" / f"{name}.webp", quality=90)
print("done")

