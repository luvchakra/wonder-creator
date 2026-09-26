import { addToCollection, removeFromCollection } from "@wonder/creator-library";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

const body = z.object({ materialId: z.string().uuid() });

export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => {
  const { materialId } = body.parse(await readJson(req));
  await addToCollection(db, creatorId, requireUuid(id, "collection"), materialId);
  return { ok: true };
});

export const DELETE = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  const { materialId } = body.parse(await readJson(req));
  await removeFromCollection(db, requireUuid(id, "collection"), materialId);
  return { ok: true };
});
