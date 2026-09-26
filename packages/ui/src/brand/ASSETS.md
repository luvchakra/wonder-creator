# Wonder Creator brand assets

Source of truth: the supplied brand board (`assets/brand-board-reference.png`) and the supplied
background image set (`assets/backgrounds/background-set-source.png`). Nothing here is redrawn,
regenerated or reinterpreted. Every file in `apps/web/public/brand/` is a **pixel crop** of one
of those two supplied images — no recolouring, no effects.

| Published file (`apps/web/public/brand/…`) | Derived from | Crop (x0,y0,x1,y1) | Use |
|---|---|---|---|
| `logo-primary.png` | brand board, panel 1 "Primary Logo" | 30,60,425,235 | Header / sign-in wordmark on white/ivory surfaces |
| `logo-mark.png` | brand board, panel 4 "Favicon / Monogram" | 1185,60,1330,180 | Compact mark (mobile header, small spaces) |
| `app-icon.png` | brand board, panel 3 "App Icon" (gradient variant) | 935,58,1035,158 | Favicon, PWA icon |
| `brand-elements.png` | brand board, panel 9 "Brand Elements" | 1262,352,1528,668 | Faint decorative framing (`BrandDecor`) |
| `backgrounds/*.webp` (11 files) | supplied background set, one tile each | see `scripts/extract-brand-assets.py` | Atmospheric hero/empty-state/onboarding backgrounds |

Fonts: **Inter** (UI) and **Playfair Display** (display/headings), exactly as named on the brand
board, loaded through `next/font/google` (self-hosted at build time).

Colours: `tokens.css` mirrors the brand board palette 1:1 (Indigo #5B5CFF, Purple #8B5CF6,
Pink #F472B6, Orange #F59E0B; Blue #3B82F6, Teal #14B8A6, Mint #10B881, Peach #FB923C,
Lavender #A78BFA; Navy #0F172A, Slate #334155, Gray #64748B, Light Gray #E2E8F0, Cream #FEF7F0,
White #FEFFFF). No other prominent colours are introduced.

## Missing assets (asset dependencies — not to be substituted)

1. **Vector logo files** (SVG) for the primary logo, stacked logo, dark-background logo,
   wordmark-only and monogram. The current PNGs are raster crops from the board (≈395 px wide);
   they must be replaced with the official exports when supplied. The logo crops carry the board's
   near-white background, so they are only placed on white/ivory surfaces.
2. **Dark-background logo variant** as a standalone file (board panel 2 shows it; not supplied).
3. **High-resolution background originals.** The supplied set is a single 1983×793 contact sheet;
   each tile is ~480–650 px wide. Replace `backgrounds/*.webp` with full-resolution originals when
   available (file names can stay the same).
4. **Tagline lock-up** ("Ideas Become Real.") artwork — rendered as live text in Playfair Display
   until an approved asset is supplied.
