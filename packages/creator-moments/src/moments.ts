import { DomainError, fromDbError } from "@wonder/core";
import type { Db, Tables } from "@wonder/db";
import { MOMENT_ADAPTERS } from "./adapters";
import { NOTE_MATERIAL_TYPES, isLiveMomentType, type MomentEntityType, type MomentFilter, type MomentReference } from "./shared";

type Row = Tables<"moment_references">;

export const toMoment = (r: Row): MomentReference => ({
  id: r.id,
  entityType: r.entity_type as MomentEntityType,
  entityId: r.entity_id,
  occurredAt: r.occurred_at,
  visibility: r.visibility as MomentReference["visibility"],
  title: r.title,
  excerpt: r.excerpt,
  previewAssetId: r.preview_asset_id,
  previewKind: r.preview_kind as MomentReference["previewKind"],
  subtype: r.subtype,
});

/** Keyset cursor over (occurred_at desc, id desc): stable across mixed entity types and new arrivals. */
export function encodeCursor(m: { occurredAt: string; id: string }): string {
  return Buffer.from(`${m.occurredAt}|${m.id}`, "utf8").toString("base64url");
}
export function decodeCursor(cursor: string | null | undefined): { occurredAt: string; id: string } | null {
  if (!cursor) return null;
  try {
    const [occurredAt, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (!occurredAt || !id || Number.isNaN(Date.parse(occurredAt)) || !/^[0-9a-f-]{36}$/i.test(id)) return null;
    return { occurredAt, id };
  } catch {
    return null;
  }
}

/**
 * The creator's Moment for an entity, made the first time it's needed (idempotent). Nothing is copied: the Moment holds
 * a reference and a small preview. It starts private — as or more restrictive than the entity, never less — and the
 * database refuses a reference to anything the creator can't open.
 */
export async function ensureMomentForEntity(db: Db, creatorId: string, input: { entityType: string; entityId: string }): Promise<MomentReference> {
  const { entityType, entityId } = input;
  if (!isLiveMomentType(entityType)) throw new DomainError("validation", "That can't be a Moment yet.");
  if (!/^[0-9a-f-]{36}$/i.test(entityId)) throw new DomainError("not_found", "We couldn't find that.");
  const existing = await findMoment(db, entityType, entityId);
  if (existing && !existing.deleted_at) return toMoment(existing);
  const preview = (await MOMENT_ADAPTERS[entityType].load(db, [entityId])).get(entityId);
  if (!preview) throw new DomainError("not_found", "We couldn't find that.");
  const fields = { title: preview.title, excerpt: preview.excerpt, preview_asset_id: preview.previewAssetId, preview_kind: preview.previewKind, subtype: preview.subtype };
  if (existing) {
    const { data, error } = await db.from("moment_references").update({ ...fields, deleted_at: null }).eq("id", existing.id).select("*").single();
    if (error) throw fromDbError(error);
    return toMoment(data);
  }
  const { data, error } = await db
    .from("moment_references")
    .insert({ creator_id: creatorId, entity_type: entityType, entity_id: entityId, occurred_at: preview.occurredAt, visibility: "private", ...fields })
    .select("*")
    .single();
  if (error?.code === "23505") {
    const again = await findMoment(db, entityType, entityId);
    if (again) return toMoment(again);
  }
  if (error) throw error.code === "42501" ? new DomainError("not_found", "We couldn't find that.") : fromDbError(error);
  return toMoment(data);
}

async function findMoment(db: Db, entityType: string, entityId: string): Promise<Row | null> {
  const { data, error } = await db.from("moment_references").select("*").eq("entity_type", entityType).eq("entity_id", entityId).maybeSingle();
  if (error) throw fromDbError(error);
  return data;
}

/** The creator's Moment for an entity, if there is one (never creates). */
export async function lookupMoment(db: Db, entityType: string, entityId: string): Promise<MomentReference | null> {
  const r = await findMoment(db, entityType, entityId);
  return r && !r.deleted_at ? toMoment(r) : null;
}

export async function getMoment(db: Db, id: string): Promise<MomentReference | null> {
  const { data, error } = await db.from("moment_references").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) return null;
  const [live] = await keepVisible(db, [data]);
  return live ? toMoment(live) : null;
}

/** Re-read the preview from the owning domain (titles, excerpts and covers change). */
export async function refreshPreview(db: Db, momentId: string): Promise<void> {
  const { data: r } = await db.from("moment_references").select("*").eq("id", momentId).maybeSingle();
  if (!r || !isLiveMomentType(r.entity_type)) return;
  const p = (await MOMENT_ADAPTERS[r.entity_type].load(db, [r.entity_id])).get(r.entity_id);
  const patch = p
    ? { title: p.title, excerpt: p.excerpt, preview_asset_id: p.previewAssetId, preview_kind: p.previewKind, subtype: p.subtype, deleted_at: null }
    : { deleted_at: new Date().toISOString() };
  const { error } = await db.from("moment_references").update(patch).eq("id", momentId);
  if (error) throw fromDbError(error);
}

/** The caller's own Moment for this entity goes (its DejaVu links with it). The entity itself is untouched. */
export async function deleteMomentForEntity(db: Db, entityType: string, entityId: string): Promise<void> {
  const { error } = await db.from("moment_references").delete().eq("entity_type", entityType).eq("entity_id", entityId);
  if (error) throw fromDbError(error);
}

/**
 * Only what the caller can still open (checked by each owning domain, as the caller). A Moment whose entity is gone
 * or out of reach is marked deleted so it drops out everywhere, and nothing of it is returned.
 */
async function keepVisible(db: Db, rows: Row[]): Promise<Row[]> {
  const byType = new Map<string, string[]>();
  for (const r of rows) byType.set(r.entity_type, [...(byType.get(r.entity_type) ?? []), r.entity_id]);
  const alive = new Set<string>();
  for (const [type, ids] of byType) {
    if (!isLiveMomentType(type)) continue;
    for (const id of (await MOMENT_ADAPTERS[type].load(db, ids)).keys()) alive.add(`${type}:${id}`);
  }
  const gone = rows.filter((r) => !alive.has(`${r.entity_type}:${r.entity_id}`));
  if (gone.length)
    await db
      .from("moment_references")
      .update({ deleted_at: new Date().toISOString() })
      .in(
        "id",
        gone.map((r) => r.id),
      );
  return rows.filter((r) => alive.has(`${r.entity_type}:${r.entity_id}`));
}

/** PostgREST filter for a first-level type filter (§9). */
export function filterClause(f: MomentFilter): string {
  const notes = NOTE_MATERIAL_TYPES.join(",");
  switch (f) {
    case "creations":
      return "entity_type.in.(creation,creation_fragment,published_work)";
    case "conversations":
      return "entity_type.in.(conversation,conversation_reply)";
    case "notes":
      return `entity_type.in.(quick_text_note,voice_note,scrapbook_entry),and(entity_type.eq.material,subtype.in.(${notes}))`;
    case "materials":
      return `entity_type.in.(huddle,huddle_moment,person_interaction,collaboration_request,project_activity,creative_room_activity),and(entity_type.eq.material,subtype.not.in.(${notes}))`;
  }
}

export interface MomentPage {
  items: MomentReference[];
  nextCursor: string | null;
}

/** The creator's Moments, newest first, one page at a time; optionally only those carrying a DejaVu. */
export async function getMoments(
  db: Db,
  opts: { dejavuId?: string; filter?: MomentFilter | null; entityTypes?: MomentEntityType[]; dateFrom?: string | null; dateTo?: string | null; cursor?: string | null; limit?: number } = {},
): Promise<MomentPage> {
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 60);
  let q = db
    .from("moment_references")
    .select(opts.dejavuId ? "*, dejavu_moments!inner(dejavu_id)" : "*")
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (opts.dejavuId) q = q.eq("dejavu_moments.dejavu_id", opts.dejavuId);
  if (opts.filter) q = q.or(filterClause(opts.filter));
  if (opts.entityTypes?.length) q = q.in("entity_type", opts.entityTypes);
  if (opts.dateFrom && !Number.isNaN(Date.parse(opts.dateFrom))) q = q.gte("occurred_at", new Date(opts.dateFrom).toISOString());
  if (opts.dateTo && !Number.isNaN(Date.parse(opts.dateTo))) q = q.lt("occurred_at", new Date(Date.parse(opts.dateTo) + 86_400_000).toISOString());
  const after = decodeCursor(opts.cursor);
  if (after) q = q.or(`occurred_at.lt."${after.occurredAt}",and(occurred_at.eq."${after.occurredAt}",id.lt.${after.id})`);
  const { data, error } = await q;
  if (error) throw fromDbError(error);
  const rows = (data ?? []) as unknown as Row[];
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const visible = await keepVisible(db, page);
  return { items: visible.map(toMoment), nextCursor: rows.length > limit && last ? encodeCursor({ occurredAt: last.occurred_at, id: last.id }) : null };
}
