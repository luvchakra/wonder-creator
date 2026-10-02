/**
 * What a creator may do with something they didn't make (Phase 04 §8, docs/studio-integration.md §Rights). Deterministic
 * and client-safe: computed from recorded facts — who made it, the licence the provider states — never inferred by
 * CreativeMind, and never a legal opinion.
 *
 * - reuse_permitted: may go into the output under its terms (the creator's own work; CC0 / Public Domain Mark; the
 *   Pixabay, Unsplash and Pexels licences).
 * - attribution_required: may go into the output with its credit kept (CC BY, CC BY-SA).
 * - reference_only: may steer an idea, a tone or a look, but isn't copied into the output (someone else's Community
 *   words or Creations; licences that forbid changes).
 * - unknown: no licence on record — never silently inserted.
 * - restricted: an incompatible use is blocked outright.
 */
export const RIGHTS_STATES = ["reuse_permitted", "attribution_required", "reference_only", "unknown", "restricted"] as const;
export type RightsState = (typeof RIGHTS_STATES)[number];

export const RIGHTS_LABEL: Record<RightsState, string> = {
  reuse_permitted: "Reuse permitted",
  attribution_required: "Attribution required",
  reference_only: "Reference only",
  unknown: "Rights unknown",
  restricted: "Restricted",
};

/** A short line under a source: why it can or can't go into the piece. */
export const RIGHTS_HINT: Record<RightsState, string> = {
  reuse_permitted: "Can be used in the piece.",
  attribution_required: "Can be used in the piece with its credit kept.",
  reference_only: "Can shape the idea or look, but isn't copied into the piece.",
  unknown: "No licence on record, so it won't be placed in the piece.",
  restricted: "Its terms don't allow this use.",
};

/** May this source be placed into the output itself (a slide image, words on a slide, text in the draft)? */
export const canInsert = (r: RightsState) => r === "reuse_permitted" || r === "attribution_required";

/** The rights a stated licence gives, read literally. Anything unrecognised is `unknown`, never assumed open. */
export function licenseRights(license: string | null | undefined): RightsState {
  const l = (license ?? "").trim().toUpperCase();
  if (!l) return "unknown";
  if (/^(CC0|PDM)\b/.test(l) || l.startsWith("PUBLIC DOMAIN")) return "reuse_permitted";
  if (l === "PIXABAY CONTENT LICENSE" || l === "UNSPLASH LICENSE" || l === "PEXELS LICENSE") return "reuse_permitted";
  if (/^CC BY\b/.test(l)) {
    // No-derivatives licences don't allow the changes a Creation makes (crops, text on the picture).
    if (/\bND\b/.test(l)) return "reference_only";
    return "attribution_required";
  }
  return "unknown";
}

/** "Photo: Maya Rao · CC BY 4.0 · Openverse" — the credit kept with a source that needs one. */
export function attributionLine(a: { creator?: string | null; license?: string | null; provider?: string | null }): string | null {
  const parts = [a.creator ? `By ${a.creator}` : null, a.license || null, a.provider || null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
