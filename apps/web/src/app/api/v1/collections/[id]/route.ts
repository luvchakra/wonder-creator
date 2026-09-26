import { deleteCollection } from "@wonder/creator-library";
import { requireUuid, withApi } from "@/lib/api";

export const DELETE = withApi<{ id: string }>(async ({ db }, { id }) => {
  await deleteCollection(db, requireUuid(id, "collection"));
  return { ok: true };
});
