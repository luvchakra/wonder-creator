import { DomainError, fromDbError, must } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";

export const DEFAULT_SHELVES = ["Film References", "Visual Style", "Music Inspiration", "Writing References", "Locations", "People"];

export const shelfSchema = z.object({
  name: z.string().trim().min(1, "Give the shelf a name.").max(80),
  description: z.string().trim().max(300).optional(),
});

export const referenceSchema = z.object({
  materialId: z.string().uuid(),
  shelfId: z.string().uuid().nullable().optional(),
  note: z.string().trim().max(1000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
});

export async function listShelves(db: Db) {
  const { data, error } = await db.from("reference_shelves").select("*, reference_items(count)").order("position").order("created_at");
  if (error) throw fromDbError(error);
  return (data ?? []).map((s) => ({ ...s, count: (s.reference_items as unknown as Array<{ count: number }>)[0]?.count ?? 0 }));
}

export async function ensureDefaultShelves(db: Db, creatorId: string) {
  const { count, error } = await db.from("reference_shelves").select("id", { count: "exact", head: true });
  if (error) throw fromDbError(error);
  if ((count ?? 0) > 0) return;
  const ins = await db.from("reference_shelves").insert(DEFAULT_SHELVES.map((name, position) => ({ creator_id: creatorId, name, position })));
  if (ins.error && ins.error.code !== "23505") throw fromDbError(ins.error);
}

export async function createShelf(db: Db, creatorId: string, raw: unknown) {
  const s = shelfSchema.parse(raw);
  return must(await db.from("reference_shelves").insert({ creator_id: creatorId, name: s.name, description: s.description || null }).select("*").single());
}

export async function renameShelf(db: Db, id: string, raw: unknown) {
  const s = shelfSchema.parse(raw);
  const res = await db.from("reference_shelves").update({ name: s.name, description: s.description || null }).eq("id", id).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "We couldn't find that shelf.");
}

export async function deleteShelf(db: Db, id: string) {
  const res = await db.from("reference_shelves").delete().eq("id", id).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "We couldn't find that shelf.");
}

export async function listReferences(db: Db, opts: { shelfId?: string | null; limit?: number } = {}) {
  let q = db
    .from("reference_items")
    .select("*, creative_materials(id, type, title, text_content, source_url, storage_object_id, metadata, created_at)")
    .order("created_at", { ascending: false })
    .limit(Math.min(opts.limit ?? 100, 200));
  if (opts.shelfId) q = q.eq("shelf_id", opts.shelfId);
  const { data, error } = await q;
  if (error) throw fromDbError(error);
  return data ?? [];
}

export async function addReference(db: Db, creatorId: string, raw: unknown) {
  const r = referenceSchema.parse(raw);
  return must(
    await db
      .from("reference_items")
      .insert({ creator_id: creatorId, material_id: r.materialId, shelf_id: r.shelfId ?? null, note: r.note || null, tags: r.tags ?? [] })
      .select("*")
      .single(),
  );
}

export async function updateReference(db: Db, id: string, raw: unknown) {
  const r = referenceSchema.partial().parse(raw);
  const patch: { shelf_id?: string | null; note?: string | null; tags?: string[] } = {};
  if (r.shelfId !== undefined) patch.shelf_id = r.shelfId;
  if (r.note !== undefined) patch.note = r.note || null;
  if (r.tags !== undefined) patch.tags = r.tags;
  const res = await db.from("reference_items").update(patch).eq("id", id).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "We couldn't find that reference.");
}

export async function removeReference(db: Db, id: string) {
  const res = await db.from("reference_items").delete().eq("id", id).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "We couldn't find that reference.");
}
