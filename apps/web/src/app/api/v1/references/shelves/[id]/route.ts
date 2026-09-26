import { deleteShelf, renameShelf } from "@wonder/creator-library";
import { readJson, requireUuid, withApi } from "@/lib/api";

export const PATCH = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  await renameShelf(db, requireUuid(id, "shelf"), await readJson(req));
  return { ok: true };
});
export const DELETE = withApi<{ id: string }>(async ({ db }, { id }) => {
  await deleteShelf(db, requireUuid(id, "shelf"));
  return { ok: true };
});
