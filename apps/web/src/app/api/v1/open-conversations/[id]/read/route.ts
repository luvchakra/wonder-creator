import { markRead } from "@wonder/creator-community";
import { requireUuid, withApi } from "@/lib/api";

/** POST — the viewer has caught up (private to them). */
export const POST = withApi<{ id: string }>(async ({ db, creatorId }, { id }) => {
  await markRead(db, creatorId, requireUuid(id, "conversation"));
  return { ok: true };
});
