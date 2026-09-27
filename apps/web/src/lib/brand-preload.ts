import { KIT, WATERCOLOR, type WatercolorKey } from "@wonder/ui";
import { preload } from "react-dom";

/**
 * Preload one watercolor piece (AVIF, the format every supported browser picks from the <picture>). Used only for the
 * Palette motif and the single Home decoration (UI redesign §46) — everything else stays lazy.
 */
export function preloadWatercolor(name: WatercolorKey, sizes: string) {
  const a = WATERCOLOR[name];
  preload(a.avif[0]!.src, { as: "image", type: "image/avif", imageSrcSet: a.avif.map((v) => `${v.src} ${v.width}w`).join(", "), imageSizes: sizes, fetchPriority: "high" });
}

/** Preload the Palette trigger's artwork (a small SVG from the Vector Kit) — it's on every signed-in screen. */
export function preloadPaletteButton() {
  preload(KIT.paletteButton.svg, { as: "image", type: "image/svg+xml", fetchPriority: "high" });
}
