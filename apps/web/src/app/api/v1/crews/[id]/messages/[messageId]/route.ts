import { deleteCrewMessage } from "@wonder/creator-projects";
import { requireUuid, withApi } from "@/lib/api";

/** Remove a message: your own, or any as the crew's owner or an admin. */
export const DELETE = withApi<{ id: string; messageId: string }>(async ({ db }, { id, messageId }) => {
  await deleteCrewMessage(db, requireUuid(id, "crew"), requireUuid(messageId, "message"));
  return { ok: true };
});
