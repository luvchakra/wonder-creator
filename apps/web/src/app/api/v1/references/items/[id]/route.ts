import { removeReference, updateReference } from "@wonder/creator-library";
import { readJson, requireUuid, withApi } from "@/lib/api";

export const PATCH = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  await updateReference(db, requireUuid(id, "reference"), await readJson(req));
  return { ok: true };
});
export const DELETE = withApi<{ id: string }>(async ({ db }, { id }) => {
  await removeReference(db, requireUuid(id, "reference"));
  return { ok: true };
});
