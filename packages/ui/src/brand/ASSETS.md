# Wonder Creator brand assets

Source of truth: the supplied brand board (`assets/brand-board-reference.png`) and the supplied
background image set (`assets/backgrounds/background-set-source.png`). Nothing here is redrawn,
regenerated or reinterpreted. Every file in `apps/web/public/brand/` (outside `watercolor/`) is a **pixel crop** of one
of those two supplied images — no recolouring, no effects.

| Published file (`apps/web/public/brand/…`) | Derived from | Crop (x0,y0,x1,y1) | Use |
|---|---|---|---|
| `logo-primary.png` | brand board, panel 1 "Primary Logo" | 30,60,425,235 | Header / sign-in wordmark on white/ivory surfaces |
| `logo-mark.png` | brand board, panel 4 "Favicon / Monogram" | 1185,60,1330,180 | Compact mark (mobile header, small spaces) |
| `app-icon.png` | brand board, panel 3 "App Icon" (gradient variant) | 935,58,1035,158 | Favicon, PWA icon |
| `brand-elements.png` | brand board, panel 9 "Brand Elements" | 1262,352,1528,668 | Faint decorative framing (`BrandDecor`) |
| `watercolor/*.{avif,webp}` (60 files) | owner-supplied watercolor set (27 Sep 2026): `Watercolor-PNG-5000px-part1-florals-TL-TR-BR.zip`, `…-part2-BL-palette-wash.zip` (the matching `Watercolor-Vectors-SVG.zip` is the vector master, not published) | trimmed to opaque bounds, downscaled only (430/768/1024/1440/1920w; the palette motif 96–768w), AVIF + WebP, content-hashed names — `scripts/prepare-watercolor-assets.mjs` | Palette trigger motif; floral corners and peach wash as sparse decoration (≤1–2 per mobile viewport). Registry: `brand/watercolor.ts`, component `Watercolor` |
| `kit/*` (152 files) | owner-supplied **Wonder Creator Vector Kit** (27 Sep 2026, `Wonder-Creator-Vector-Kit.zip`: logos, app icons, Palette button, tool icons, botanicals, washes, UI-component specs, gradients/overlays, illustrations, textures, patterns) | vectors ≤ 64 KB published byte-for-byte; heavy painted pieces from the kit's own PNG renders, downscaled only (AVIF + WebP); app-icon PNGs 512/192/180 from the kit's 1024 render; all content-hashed — `scripts/prepare-brand-kit.mjs` | Logo (all variants), favicon/PWA icons, Palette trigger, Palette icons (`Kit*Icon`, stroke → currentColor only), sign-in botanicals, Home start vignette, empty-state blossom, CreativeMind sparkles. Registry: `brand/kit.ts`; components `Logo`, `KitArt` |
| `backgrounds/*.webp` (11 files) | supplied background set, one tile each | see `scripts/extract-brand-assets.py` | Atmospheric hero/empty-state/onboarding backgrounds |

Fonts: **Inter** (UI) and **Playfair Display** (display/headings), exactly as named on the brand
board, loaded through `next/font/google` (self-hosted at build time).

Colours: `tokens.css` mirrors the brand board palette 1:1 (Indigo #5B5CFF, Purple #8B5CF6,
Pink #F472B6, Orange #F59E0B; Blue #3B82F6, Teal #14B8A6, Mint #10B881, Peach #FB923C,
Lavender #A78BFA; Navy #0F172A, Slate #334155, Gray #64748B, Light Gray #E2E8F0, Cream #FEF7F0,
White #FEFFFF). No other prominent colours are introduced.

## Creator Page background library (owner request, 30 Sep 2026)

The owner supplied a reference board — `docs/ui-redesign/boards/creator-page-backgrounds-2026-09-30.png`, "Creator Page
Background Asset Library" — and asked for **high-resolution vector graphics** of it for the Creator Page work. This is an
explicit owner instruction, so these pieces are **authored** (not pixel crops): vector art generated in code from seeded
randomness by `scripts/creator-page-art/` (`templates.mjs`, `decorations.mjs`), reproducible byte-for-byte. They are
interpretations in the board's style and palette, not traces of it; the brand logo and the supplied Kit/watercolour art
are untouched. Painterly photographic scenes (the board's hero landscape, cinematic room, collage photographs) are
rendered as stylised vector scenes; if exact painted originals are wanted, supply them and they replace these files.

| Registry (`brand/creator-page.ts`) | Pieces | Files |
|---|---|---|
| `CREATOR_PAGE_TEMPLATES` | Immersive Artistic Hero (+ a 2:1 banner), Minimal Editorial Paper, Cinematic Dark, Creative Collage, Soft Gradient & Minimal — each with its five board swatches | SVG (1920×2560, banner 2880×1440) + AVIF/WebP renders 430–1920w **without grain** (lay `grainOverlay` over them) |
| `CREATOR_PAGE_DECORATIONS` | Botanical Corner Cluster, Slim Branch, Watercolor Wash, Translucent Gradient Blob, Paper Tape, Torn Paper Strip, Ink Scribble, Soft Shadow Card, Grain Overlay (512² tile), Light Leak, Cloud & Mist, Handwritten Note | SVG, transparent where the board shows them as elements |

Republish with `node scripts/creator-page-art/publish.mjs` (needs Chromium; `CHROMIUM_PATH` overrides). Files are
content-hashed under `apps/web/public/brand/creator-page/`. Render any vector with `KitArt art={….vector}`; use `….image`
for full-bleed backgrounds on phones (their paint filters are costly to rasterise live).

## Missing assets (asset dependencies — not to be substituted)

1. ~~Vector logo files~~ — supplied in the Vector Kit (full, no-tagline, stacked, mono ink, reversed, symbol ×3).
   `Logo` now renders them; the board crops (`logo-primary.png`, `logo-mark.png`, `app-icon.png`) are superseded.
2. ~~Dark-background logo variant~~ — supplied (`wonder-creator-logo-reversed.svg`, `symbol-white.svg`).
3. **High-resolution background originals.** The supplied set is a single 1983×793 contact sheet;
   each tile is ~480–650 px wide. Replace `backgrounds/*.webp` with full-resolution originals when
   available (file names can stay the same).
4. **Tagline lock-up** ("Ideas Become Real.", confirmed by the owner 27 Sep 2026) artwork — rendered as live text in
   Playfair Display (`<Tagline>`) until an approved asset is supplied.
5. ~~Palette motif~~ — supplied 27 Sep 2026 (`watercolor-paint-palette`); now the Creative Palette trigger.
6. ~~Composable botanical/watercolour pieces~~ — supplied 27 Sep 2026: four floral corners (TL/TR/BL/BR) and a peach
   wash. The 5000px PNG sources and SVG masters stay with the owner (not committed); re-run the script to republish.

## Vector Kit notes (27 Sep 2026)

- **Tagline — "Ideas Become Real."** (owner's decision, 27 Sep 2026). The kit's tagline artwork ("Same ideas.
  Brighter tomorrows.") and the logo lock-ups that include it (full, mono ink, reversed) are published but not used;
  the tagline is live Playfair text (`<Tagline>`), as the brand board sets it.
- **Accessible primary button.** The kit's primary-button gradient (#8C7BFF → #7A64FA) gives white labels 3.3–4.2:1.
  `--gradient-primary` keeps the kit's pill, gradient and glow but runs #6D5BF5 → #5B47E0 (4.7–6.1:1, WCAG AA).
  Violet text uses `--color-accent-ink` #5B47E0; the kit's #8A84A8 grey is placeholder-only (3.3:1).
- **Tokens from the kit:** ink #1E1B4B, accent #6D5BF5, borders #E7E1F2 / #EDE7F7, violet-tinted shadows
  (#6B5B95), warm card fill #FFFDFA → #FBF5EE, 24 px card radius, pill buttons, inputs and segmented tabs.
- The kit's UI-component files (buttons, cards, input, segmented tab, icon button) are specifications, implemented in
  code in `packages/ui`; they aren't served as images.
