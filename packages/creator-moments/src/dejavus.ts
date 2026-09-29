import { DomainError, fromDbError, must } from "@wonder/core";
import type { Db, Tables } from "@wonder/db";
import { z } from "zod";
import { ensureMomentForEntity, getMoments, type MomentPage } from "./moments";
import { MOMENT_FILTERS, cleanDejaVuName, filterOf, normalizeDejaVuName, type DejaVu, type MomentEntityType, type MomentFilter } from "./shared";

type Row = Tables<"dejavus">;
const toDejaVu = (r: Row): DejaVu => ({ id: r.id, name: r.name, description: r.description, archived: !!r.archived_at, lastUsedAt: r.last_used_at });

export const dejaVuSchema = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(60, "Keep it under 60 characters."),
  description: z.string().trim().max(500).optional(),
});
export const updateDejaVuSchema = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(60, "Keep it under 60 characters.").optional(),
  description: z.string().trim().max(500).nullable().optional(),
  archived: z.boolean().optional(),
});

const likeTerm = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

async function byNormalizedName(db: Db, name: string): Promise<Row | null> {
  const { data, error } = await db.from("dejavus").select("*").eq("normalized_name", normalizeDejaVuName(name)).maybeSingle();
  if (error) throw fromDbError(error);
  return data;
}

/**
 * A new DejaVu — or the one already named that way ("Railways" when "railways" exists), brought back if it was archived.
 * `existed` says which, so the UI can say "Added to Railways" rather than "Created".
 */
export async function createDejaVu(db: Db, creatorId: string, raw: unknown): Promise<{ dejavu: DejaVu; existed: boolean }> {
  const input = dejaVuSchema.parse(raw);
  const name = cleanDejaVuName(input.name);
  if (!name) throw new DomainError("validation", "Give it a name.");
  const found = await byNormalizedName(db, name);
  if (found) {
    if (found.archived_at) {
      const { data, error } = await db.from("dejavus").update({ archived_at: null }).eq("id", found.id).select("*").single();
      if (error) throw fromDbError(error);
      return { dejavu: toDejaVu(data), existed: true };
    }
    return { dejavu: toDejaVu(found), existed: true };
  }
  const { data, error } = await db.from("dejavus").insert({ creator_id: creatorId, name, description: input.description || null }).select("*").single();
  if (error?.code === "23505") {
    const again = await byNormalizedName(db, name);
    if (again) return { dejavu: toDejaVu(again), existed: true };
  }
  if (error) throw fromDbError(error);
  return { dejavu: toDejaVu(data), existed: false };
}

/** Rename, describe, archive or bring back. A name another DejaVu already has is refused (never silently merged). */
export async function updateDejaVu(db: Db, id: string, raw: unknown): Promise<DejaVu> {
  const input = updateDejaVuSchema.parse(raw);
  const patch: Partial<Pick<Row, "name" | "description" | "archived_at">> = {};
  if (input.name !== undefined) {
    const name = cleanDejaVuName(input.name);
    const other = await byNormalizedName(db, name);
    if (other && other.id !== id) throw new DomainError("conflict", `You already have a DejaVu called “${other.name}”.`);
    patch.name = name;
  }
  if (input.description !== undefined) patch.description = input.description || null;
  if (input.archived !== undefined) patch.archived_at = input.archived ? new Date().toISOString() : null;
  const res = await db.from("dejavus").update(patch).eq("id", id).select("*");
  if (res.error) throw res.error.code === "23505" ? new DomainError("conflict", "You already have a DejaVu with that name.") : fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "We couldn't find that DejaVu.");
  return toDejaVu(res.data[0]!);
}

/** Archive rather than delete: the thread and its links stay, it just leaves the lists. */
export const archiveDejaVu = (db: Db, id: string) => updateDejaVu(db, id, { archived: true });

/** Search existing first (§11): name contains the text, most recently used first. */
export async function searchDejaVus(db: Db, q: string, limit = 12): Promise<DejaVu[]> {
  let query = db.from("dejavus").select("*").is("archived_at", null).order("last_used_at", { ascending: false }).limit(Math.min(limit, 50));
  const term = normalizeDejaVuName(q);
  if (term) query = query.ilike("normalized_name", likeTerm(term));
  const { data, error } = await query;
  if (error) throw fromDbError(error);
  return (data ?? []).map(toDejaVu);
}

export const getRecentDejaVus = (db: Db, limit = 8) => searchDejaVus(db, "", limit);

export async function getDejaVu(db: Db, id: string): Promise<DejaVu & { total: number; counts: Record<MomentFilter, number> }> {
  const d = must(await db.from("dejavus").select("*").eq("id", id).maybeSingle(), "We couldn't find that DejaVu.");
  const { data, error } = await db.from("dejavu_moments").select("moment_references!inner(entity_type, subtype, deleted_at)").eq("dejavu_id", id).limit(5000);
  if (error) throw fromDbError(error);
  const counts = Object.fromEntries(MOMENT_FILTERS.map((f) => [f, 0])) as Record<MomentFilter, number>;
  let total = 0;
  for (const r of data ?? []) {
    const m = r.moment_references as unknown as { entity_type: MomentEntityType; subtype: string | null; deleted_at: string | null };
    if (m.deleted_at) continue;
    counts[filterOf({ entityType: m.entity_type, subtype: m.subtype })]++;
    total++;
  }
  return { ...toDejaVu(d), total, counts };
}

export function getDejaVuMoments(db: Db, id: string, opts: { filter?: MomentFilter | null; dateFrom?: string | null; dateTo?: string | null; cursor?: string | null; limit?: number } = {}): Promise<MomentPage> {
  return getMoments(db, { ...opts, dejavuId: id });
}

/** Attach (idempotent). Both sides must be the creator's own; the database checks that too. */
export async function addMomentToDejaVu(db: Db, creatorId: string, dejavuId: string, momentId: string, source: "user" | "creativemind_suggestion_accepted" = "user"): Promise<void> {
  const { error } = await db.from("dejavu_moments").insert({ dejavu_id: dejavuId, moment_id: momentId, creator_id: creatorId, added_by: creatorId, source });
  if (error && error.code !== "23505") throw error.code === "42501" ? new DomainError("not_found", "We couldn't find that DejaVu.") : fromDbError(error);
}

/** Attach an entity (a Material, a Creation) by reference, making its Moment if it has none yet. */
export async function attachEntity(db: Db, creatorId: string, dejavuId: string, entity: { entityType: string; entityId: string }) {
  const moment = await ensureMomentForEntity(db, creatorId, entity);
  await addMomentToDejaVu(db, creatorId, dejavuId, moment.id);
  return moment;
}

/** Immediately reversible (§11): detaching never touches the Moment or the entity. */
export async function removeMomentFromDejaVu(db: Db, dejavuId: string, momentId: string): Promise<void> {
  const { error } = await db.from("dejavu_moments").delete().eq("dejavu_id", dejavuId).eq("moment_id", momentId);
  if (error) throw fromDbError(error);
}

export async function momentDejaVus(db: Db, momentId: string): Promise<DejaVu[]> {
  const { data, error } = await db.from("dejavu_moments").select("created_at, dejavus!inner(*)").eq("moment_id", momentId).order("created_at");
  if (error) throw fromDbError(error);
  return (data ?? []).map((r) => toDejaVu(r.dejavus as unknown as Row)).filter((d) => !d.archived);
}

/** An entity's DejaVus, for its chips (never creates a Moment). */
export async function entityDejaVus(db: Db, entityType: string, entityId: string): Promise<{ momentId: string | null; dejavus: DejaVu[] }> {
  const { data, error } = await db.from("moment_references").select("id").eq("entity_type", entityType).eq("entity_id", entityId).is("deleted_at", null).maybeSingle();
  if (error) throw fromDbError(error);
  return data ? { momentId: data.id, dejavus: await momentDejaVus(db, data.id) } : { momentId: null, dejavus: [] };
}

/* ------------------------------------------------------------------------------------------------ Suggestions */

export interface DejaVuSuggestion {
  id: string;
  name: string;
  existingDejaVuId: string | null;
  rationale: string | null;
}

/** CreativeMind's pending suggestions for a Moment — shown as suggestions, never attached on their own (§11). */
export async function listSuggestions(db: Db, momentId: string): Promise<DejaVuSuggestion[]> {
  const { data, error } = await db
    .from("dejavu_suggestions")
    .select("id, suggested_name, suggested_dejavu_id, rationale, dejavus(name, archived_at)")
    .eq("moment_id", momentId)
    .eq("status", "pending")
    .order("created_at");
  if (error) throw fromDbError(error);
  return (data ?? [])
    .map((s) => {
      const d = s.dejavus as unknown as { name: string; archived_at: string | null } | null;
      return { id: s.id, name: d?.name ?? s.suggested_name ?? "", existingDejaVuId: d ? s.suggested_dejavu_id : null, rationale: s.rationale };
    })
    .filter((s) => s.name);
}

async function resolve(db: Db, momentId: string, suggestionId: string, status: "accepted" | "dismissed") {
  const { data, error } = await db
    .from("dejavu_suggestions")
    .update({ status, resolved_at: new Date().toISOString() })
    .eq("id", suggestionId)
    .eq("moment_id", momentId)
    .eq("status", "pending")
    .select("suggested_name, suggested_dejavu_id");
  if (error) throw fromDbError(error);
  if (!data?.length) throw new DomainError("not_found", "That suggestion isn't available any more.");
  return data[0]!;
}

/** The creator says yes: the DejaVu (existing, or made now) gets the Moment, marked as an accepted suggestion. */
export async function acceptSuggestion(db: Db, creatorId: string, momentId: string, suggestionId: string): Promise<DejaVu> {
  const s = await resolve(db, momentId, suggestionId, "accepted");
  let dejavu: DejaVu | null = null;
  if (s.suggested_dejavu_id) {
    const { data } = await db.from("dejavus").select("*").eq("id", s.suggested_dejavu_id).maybeSingle();
    if (data) dejavu = data.archived_at ? await updateDejaVu(db, data.id, { archived: false }) : toDejaVu(data);
  }
  dejavu ??= (await createDejaVu(db, creatorId, { name: s.suggested_name ?? "" })).dejavu;
  await addMomentToDejaVu(db, creatorId, dejavu.id, momentId, "creativemind_suggestion_accepted");
  return dejavu;
}

export async function dismissSuggestion(db: Db, momentId: string, suggestionId: string): Promise<void> {
  await resolve(db, momentId, suggestionId, "dismissed");
}

/** Every active DejaVu with how many Moments carry it, most recently used first (the DejaVus index). */
export async function listDejaVus(db: Db, opts: { includeArchived?: boolean } = {}): Promise<Array<DejaVu & { count: number }>> {
  let q = db.from("dejavus").select("*, dejavu_moments(count)").order("last_used_at", { ascending: false }).limit(200);
  if (!opts.includeArchived) q = q.is("archived_at", null);
  const { data, error } = await q;
  if (error) throw fromDbError(error);
  return (data ?? []).map((r) => ({ ...toDejaVu(r as Row), count: (r.dejavu_moments as unknown as Array<{ count: number }>)[0]?.count ?? 0 }));
}
