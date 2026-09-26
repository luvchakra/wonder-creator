import { DomainError, fromDbError, must } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";

export const collectionSchema = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(80),
  description: z.string().trim().max(300).optional(),
});

export async function listCollections(db: Db) {
  const { data, error } = await db
    .from("material_collections")
    .select("*, material_collection_items(count)")
    .order("created_at");
  if (error) throw fromDbError(error);
  return (data ?? []).map((c) => ({ ...c, count: (c.material_collection_items as unknown as Array<{ count: number }>)[0]?.count ?? 0 }));
}

export async function createCollection(db: Db, creatorId: string, raw: unknown) {
  const c = collectionSchema.parse(raw);
  return must(await db.from("material_collections").insert({ creator_id: creatorId, name: c.name, description: c.description || null }).select("*").single());
}

export async function addToCollection(db: Db, creatorId: string, collectionId: string, materialId: string) {
  const res = await db.from("material_collection_items").upsert({ collection_id: collectionId, material_id: materialId, creator_id: creatorId });
  if (res.error) throw fromDbError(res.error);
}

export async function removeFromCollection(db: Db, collectionId: string, materialId: string) {
  const res = await db.from("material_collection_items").delete().eq("collection_id", collectionId).eq("material_id", materialId);
  if (res.error) throw fromDbError(res.error);
}

export async function deleteCollection(db: Db, id: string) {
  const res = await db.from("material_collections").delete().eq("id", id).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "We couldn't find that collection.");
}
