import { disconnectDestination } from "@wonder/creator-studio";
import { requireUuid, withApi } from "@/lib/api";

/** Disconnect a destination: nothing more is sent to it (history stays). */
export const DELETE = withApi<{ id: string }>(async ({ db }, { id }) => {
  await disconnectDestination(db, requireUuid(id, "destination"));
  return { ok: true };
});
