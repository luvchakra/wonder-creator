import { deleteDirectMessage } from "@wonder/creator-projects";
import { requireUuid, withApi } from "@/lib/api";

/** Remove a message you sent. */
export const DELETE = withApi<{ messageId: string }>(async ({ db }, { messageId }) => {
  await deleteDirectMessage(db, requireUuid(messageId, "message"));
  return { ok: true };
});
