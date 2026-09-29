import type { Db } from "@wonder/db";
import { isMeaningfulName } from "./connections";
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
  const [{ data: dejavus }, { data: attached }, { data: open }, { data: dismissed }] = await Promise.all([
    service.from("dejavus").select("id, name").eq("creator_id", creatorId).is("archived_at", null).order("last_used_at", { ascending: false }).limit(500),
    service.from("dejavu_moments").select("dejavu_id").eq("moment_id", momentId).eq("creator_id", creatorId),
    service.from("dejavu_suggestions").select("suggested_dejavu_id").eq("moment_id", momentId).eq("creator_id", creatorId),
    service
      .from("dejavu_suggestions")
      .select("suggested_dejavu_id")
      .eq("creator_id", creatorId)
      .eq("status", "dismissed")
      .gt("resolved_at", new Date(Date.now() - 60 * 86_400_000).toISOString())
      .limit(500),
  ]);
  // Dismissed twice lately: stop offering it (Phase 05 §6, "dismissed suggestions should reduce repetition").
  const tired = repeatedlyDismissed((dismissed ?? []).map((r) => r.suggested_dejavu_id));
  const skip = new Set([...(attached ?? []).map((r) => r.dejavu_id), ...(open ?? []).map((r) => r.suggested_dejavu_id), ...tired]);
  const picks = mentionedDejaVus(text, (dejavus ?? []).filter((d) => !skip.has(d.id))).slice(0, MAX_SUGGESTIONS);
  if (!picks.length) return 0;
  const { error } = await service
    .from("dejavu_suggestions")
    .insert(picks.map((d) => ({ creator_id: creatorId, moment_id: momentId, suggested_dejavu_id: d.id, rationale: `Mentions “${d.name}”` })));
  return error ? 0 : picks.length;
}

/** DejaVus the creator turned down at least twice (ids; nulls ignored). */
export function repeatedlyDismissed(ids: Array<string | null>, times = 2): string[] {
  const n = new Map<string, number>();
  for (const id of ids) if (id) n.set(id, (n.get(id) ?? 0) + 1);
  return [...n].filter(([, c]) => c >= times).map(([id]) => id);
}

/**
 * A new DejaVu worth suggesting (Phase 05 §6): a human concept that keeps coming back — a tag on this Material that
 * the creator's other Materials carry at least twice more — that isn't a DejaVu yet and wasn't turned down before.
 * Metadata-ish words (Photo, Blue, Tuesday, Content) never qualify. At most one, and only when none of the creator's
 * own DejaVus was suggested for this Moment (theirs come first). Suggestions only.
 */
export async function suggestNewDejaVu(service: Db, creatorId: string, momentId: string, materialId: string): Promise<string | null> {
  const [{ data: mine }, { data: open }, { data: dejavus }, { data: refused }] = await Promise.all([
    service.from("creative_material_tags").select("tag").eq("creator_id", creatorId).eq("material_id", materialId).limit(20),
    service.from("dejavu_suggestions").select("id").eq("creator_id", creatorId).eq("moment_id", momentId).eq("status", "pending"),
    service.from("dejavus").select("normalized_name").eq("creator_id", creatorId).limit(1000),
    service.from("dejavu_suggestions").select("suggested_name").eq("creator_id", creatorId).eq("status", "dismissed").not("suggested_name", "is", null).limit(500),
  ]);
  if (open?.length) return null;
  const taken = new Set([...(dejavus ?? []).map((d) => d.normalized_name), ...(refused ?? []).map((r) => normalizeDejaVuName(r.suggested_name ?? ""))]);
  for (const { tag } of mine ?? []) {
    const name = tag.trim();
    if (!isMeaningfulName(name) || taken.has(normalizeDejaVuName(name))) continue;
    const { count } = await service.from("creative_material_tags").select("material_id", { count: "exact", head: true }).eq("creator_id", creatorId).ilike("tag", name).neq("material_id", materialId);
    if ((count ?? 0) < 2) continue;
    const pretty = name.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
    const { error } = await service.from("dejavu_suggestions").insert({ creator_id: creatorId, moment_id: momentId, suggested_name: pretty.slice(0, 60), rationale: `“${pretty}” keeps coming back in your Materials` });
    return error ? null : pretty;
  }
  return null;
}
