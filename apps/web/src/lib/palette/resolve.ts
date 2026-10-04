import { GLOBAL_ITEMS, rulesFor } from "./rules";
import type { PaletteContext, PaletteModel } from "./types";

/** First-level contextual actions: three (owner, 4 Oct 2026: "reduce options on palette"); the rest under More…. */
export const MAX_PRIMARY = 3;

/**
 * resolvePalette (§17): page rules → entity / lifecycle rules (inside the page rules) → permissions → no dangerous
 * actions at the first level → de-duplicate → rank → first three; the rest go under More…. Deterministic, no AI.
 */
export function resolvePalette(ctx: PaletteContext): PaletteModel {
  const { title, items } = rulesFor(ctx);
  const allowed = items.filter((x) => !x.requires || (ctx.permissions ?? []).includes(x.requires));
  const seen = new Set<string>();
  const unique = allowed.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
  const ranked = [...unique].sort((x, y) => y.score - x.score);
  const isGlobal = ctx.page === "global" || ctx.page === "home";
  if (isGlobal) return { title, primary: ranked, more: [], global: true };
  const safe = ranked.filter((x) => x.class !== "dangerous");
  return { title, primary: safe.slice(0, MAX_PRIMARY), more: [...safe.slice(MAX_PRIMARY), ...ranked.filter((x) => x.class === "dangerous")], global: false };
}

/** The global destinations — Create, Materials, Explore, Me (and Home elsewhere) — reached from Home or "Go to…". */
export function globalPalette(pathname = ""): PaletteModel {
  return { title: null, primary: GLOBAL_ITEMS(pathname), more: [], global: true };
}


export type { PaletteContext, PaletteModel } from "./types";
