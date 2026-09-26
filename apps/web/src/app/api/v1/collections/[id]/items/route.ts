import { addToCollection, MAX_BATCH, removeFromCollection, reorderCollection } from "@wonder/creator-library";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

// One material ({ materialId }) or several at once ({ materialIds }).
const body = z
  .object({ materialId: z.string().uuid().optional(), materialIds: z.array(z.string().uuid()).min(1).max(MAX_BATCH).optional() })
  .refine((b) => b.materialId || b.materialIds, "Choose at least one material.")
  .transform((b) => (b.materialIds ?? []).concat(b.materialId ? [b.materialId] : []));
const order = z.object({ order: z.array(z.string().uuid()).min(1).max(MAX_BATCH) });

export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => {
  const added = await addToCollection(db, creatorId, requireUuid(id, "collection"), body.parse(await readJson(req)));
  return { ok: true, added };
});

/** Removes from the collection only; the materials themselves are kept. */
export const DELETE = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  await removeFromCollection(db, requireUuid(id, "collection"), body.parse(await readJson(req)));
  return { ok: true };
});

export const PUT = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  await reorderCollection(db, requireUuid(id, "collection"), order.parse(await readJson(req)).order);
  return { ok: true };
});
