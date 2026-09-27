import { removeFromShortlist } from "@wonder/creator-identity";
import { requireUuid, withApi } from "@/lib/api";

export const DELETE = withApi<{ entryId: string }>(async ({ db }, { entryId }) => {
  await removeFromShortlist(db, requireUuid(entryId, "shortlist entry"));
  return { ok: true };
});
