import { DomainError, fromDbError, must } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";

export const collectionSchema = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(80),
  description: z.string().trim().max(300).optional(),
});

export const updateCollectionSchema = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(80).optional(),
  description: z.string().trim().max(300).optional(),
  status: z.enum(["active", "archived"]).optional(),
  coverMaterialId: z.string().uuid().nullable().optional(),
});

export { COLLECTION_SUGGESTIONS } from "./suggestions";

/** Most materials a single collection action (add, reorder) takes at once. */
export const MAX_BATCH = 100;

function nameTaken(e: { code?: string } | null): boolean {
  return e?.code === "23505";
}

export async function listCollections(db: Db, opts: { includeArchived?: boolean } = {}) {
  let q = db.from("material_collections").select("*, material_collection_items(count)").order("created_at");
  if (!opts.includeArchived) q = q.eq("status", "active");
  const { data, error } = await q;
  if (error) throw fromDbError(error);
  return (data ?? []).map((c) => ({ ...c, count: (c.material_collection_items as unknown as Array<{ count: number }>)[0]?.count ?? 0 }));
}

/**
 * Collections with a representative image: the chosen cover, else the first image in the collection's order.
 * Returns storage object ids to sign; RLS keeps everything to the owner.
 */
export async function collectionCards(db: Db, opts: { includeArchived?: boolean } = {}) {
  const cols = await listCollections(db, opts);
  if (!cols.length) return [];
  const { data: items, error } = await db
    .from("material_collection_items")
    .select("collection_id, material_id, position, added_at, creative_materials!inner(id, type, storage_object_id, status)")
    .in(
      "collection_id",
      cols.map((c) => c.id),
    )
    .in("creative_materials.type", ["image", "sketch"])
    .order("position", { ascending: true, nullsFirst: false })
    .order("added_at", { ascending: false });
  if (error) throw fromDbError(error);
  const firstImage = new Map<string, string>();
  const objectOf = new Map<string, string>();
  for (const i of items ?? []) {
    const m = i.creative_materials as unknown as { id: string; storage_object_id: string | null; status: string };
    if (m.storage_object_id) objectOf.set(m.id, m.storage_object_id);
    if (m.storage_object_id && m.status === "active" && !firstImage.has(i.collection_id)) firstImage.set(i.collection_id, m.storage_object_id);
  }
  const coverIds = cols.map((c) => c.cover_material_id).filter((x): x is string => !!x && !objectOf.has(x));
  if (coverIds.length) {
    const { data } = await db.from("creative_materials").select("id, storage_object_id").in("id", coverIds);
    for (const m of data ?? []) if (m.storage_object_id) objectOf.set(m.id, m.storage_object_id);
  }
  return cols.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    status: c.status,
    count: c.count,
    coverObjectId: (c.cover_material_id && objectOf.get(c.cover_material_id)) || firstImage.get(c.id) || null,
  }));
}

export async function getCollection(db: Db, id: string) {
  const c = must(await db.from("material_collections").select("*").eq("id", id).maybeSingle(), "We couldn't find that collection.");
  const { data, error } = await db
    .from("material_collection_items")
    .select("material_id, position, added_at, creative_materials!inner(id, type, title, text_content, storage_object_id, processing_state, status, created_at, source_url, metadata)")
    .eq("collection_id", id)
    .order("position", { ascending: true, nullsFirst: false })
    .order("added_at", { ascending: false });
  if (error) throw fromDbError(error);
  const items = (data ?? []).map((i) => i.creative_materials as unknown as {
    id: string;
    type: string;
    title: string | null;
    text_content: string | null;
    storage_object_id: string | null;
    processing_state: string;
    status: string;
    created_at: string;
    source_url: string | null;
    metadata: Record<string, unknown>;
  });
  return { collection: c, items };
}

export async function createCollection(db: Db, creatorId: string, raw: unknown) {
  const c = collectionSchema.parse(raw);
  const res = await db.from("material_collections").insert({ creator_id: creatorId, name: c.name, description: c.description || null }).select("*").single();
  if (nameTaken(res.error)) throw new DomainError("conflict", "You already have a collection with that name.");
  return must(res);
}

export async function updateCollection(db: Db, id: string, raw: unknown) {
  const input = updateCollectionSchema.parse(raw);
  const patch: { name?: string; description?: string | null; status?: string; cover_material_id?: string | null } = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description || null;
  if (input.status !== undefined) patch.status = input.status;
  if (input.coverMaterialId !== undefined) {
    if (input.coverMaterialId) {
      const inIt = await db.from("material_collection_items").select("material_id").eq("collection_id", id).eq("material_id", input.coverMaterialId).maybeSingle();
      if (!inIt.data) throw new DomainError("validation", "The cover has to be something in this collection.");
    }
    patch.cover_material_id = input.coverMaterialId;
  }
  if (!Object.keys(patch).length) return;
  const res = await db.from("material_collections").update(patch).eq("id", id).select("id");
  if (nameTaken(res.error)) throw new DomainError("conflict", "You already have a collection with that name.");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "We couldn't find that collection.");
}

/** Adds the creator's own materials (RLS rejects anyone else's); already-present ones are left as they are. */
export async function addToCollection(db: Db, creatorId: string, collectionId: string, materialIds: string | string[]) {
  const ids = [...new Set(Array.isArray(materialIds) ? materialIds : [materialIds])].slice(0, MAX_BATCH);
  if (!ids.length) return 0;
  const res = await db
    .from("material_collection_items")
    .upsert(
      ids.map((material_id) => ({ collection_id: collectionId, material_id, creator_id: creatorId })),
      { onConflict: "collection_id,material_id", ignoreDuplicates: true },
    )
    .select("material_id");
  if (res.error) throw fromDbError(res.error);
  return res.data?.length ?? 0;
}

/** Removes materials from the collection only; the materials themselves are untouched. */
export async function removeFromCollection(db: Db, collectionId: string, materialIds: string | string[]) {
  const ids = [...new Set(Array.isArray(materialIds) ? materialIds : [materialIds])].slice(0, MAX_BATCH);
  if (!ids.length) return;
  const res = await db.from("material_collection_items").delete().eq("collection_id", collectionId).in("material_id", ids);
  if (res.error) throw fromDbError(res.error);
  const c = await db.from("material_collections").select("cover_material_id").eq("id", collectionId).maybeSingle();
  if (c.data?.cover_material_id && ids.includes(c.data.cover_material_id)) {
    await db.from("material_collections").update({ cover_material_id: null }).eq("id", collectionId);
  }
}

/** Sets the manual order: the given ids first, in that order; anything not listed keeps following after them. */
export async function reorderCollection(db: Db, collectionId: string, orderedMaterialIds: string[]) {
  const ids = [...new Set(orderedMaterialIds)].slice(0, MAX_BATCH);
  for (const [position, material_id] of ids.entries()) {
    const res = await db.from("material_collection_items").update({ position }).eq("collection_id", collectionId).eq("material_id", material_id);
    if (res.error) throw fromDbError(res.error);
  }
}

export async function deleteCollection(db: Db, id: string) {
  const res = await db.from("material_collections").delete().eq("id", id).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "We couldn't find that collection.");
}
