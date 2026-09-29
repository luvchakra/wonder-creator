import type { Db } from "@wonder/db";
import { normalizeDejaVuName } from "./shared";

/** Up to this many suggestions per Moment, so a note never turns into a wall of chips. */
export const MAX_SUGGESTIONS = 3;

/**
 * Which of the creator's DejaVus a piece of text plainly mentions — whole words, any case ("railways" in "the old
 * Railways station" matches Railways; "rail" doesn't). Pure: no model, nothing inferred beyond the words themselves.
 */
export function mentionedDejaVus<T extends { name: string }>(text: string, dejavus: T[]): T[] {
  // "Dad's railway story" mentions Dad and Railways: possessives drop away, and singular/plural count as one word.
  const words = (t: string) =>
    normalizeDejaVuName(t.replace(/['’]s\b/giu, "").replace(/[^\p{L}\p{M}\p{N}\s'’-]/gu, " "))
      .split(" ")
      .filter(Boolean)
      .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
  const hay = ` ${words(text).join(" ")} `;
  return dejavus.filter((d) => {
    const n = words(d.name).join(" ");
    return n.length >= 2 && hay.includes(` ${n} `);
  });
}

/**
 * After a capture is saved (and a voice note transcribed), suggest the DejaVus its words mention. Pipeline-owned: runs
 * with the service client, always scoped to the server-resolved creator, and only ever writes *suggestions* — the
 * creator accepts or ignores them (docs/phases/02-home-quick-capture.md §7). Idempotent: nothing already attached or
 * already suggested is suggested again.
 */
export async function suggestDejaVusFromText(service: Db, creatorId: string, momentId: string, text: string): Promise<number> {
  if (!text.trim()) return 0;
  const [{ data: dejavus }, { data: attached }, { data: open }] = await Promise.all([
    service.from("dejavus").select("id, name").eq("creator_id", creatorId).is("archived_at", null).order("last_used_at", { ascending: false }).limit(500),
    service.from("dejavu_moments").select("dejavu_id").eq("moment_id", momentId).eq("creator_id", creatorId),
    service.from("dejavu_suggestions").select("suggested_dejavu_id").eq("moment_id", momentId).eq("creator_id", creatorId),
  ]);
  const skip = new Set([...(attached ?? []).map((r) => r.dejavu_id), ...(open ?? []).map((r) => r.suggested_dejavu_id)]);
  const picks = mentionedDejaVus(text, (dejavus ?? []).filter((d) => !skip.has(d.id))).slice(0, MAX_SUGGESTIONS);
  if (!picks.length) return 0;
  const { error } = await service
    .from("dejavu_suggestions")
    .insert(picks.map((d) => ({ creator_id: creatorId, moment_id: momentId, suggested_dejavu_id: d.id, rationale: `Mentions “${d.name}”` })));
  return error ? 0 : picks.length;
}
