import { deletePart, updatePart } from "@wonder/creator-projects";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** Rename, re-kind or reorder a part (the Room's owner or admins). */
export const PATCH = withApi<{ id: string; partId: string }>(async ({ db, req }, { partId }) => {
  await updatePart(db, requireUuid(partId, "Part"), await readJson(req));
  return { ok: true };
});

/** Remove a part. Its Creation, if any, stays with whoever made it. */
export const DELETE = withApi<{ id: string; partId: string }>(async ({ db }, { partId }) => {
  await deletePart(db, requireUuid(partId, "Part"));
  return { ok: true };
});
