import { deleteOwnReply } from "@wonder/creator-community";
import { requireUuid, withApi } from "@/lib/api";

/** DELETE — take your own reply back. */
export const DELETE = withApi<{ replyId: string }>(async ({ db }, { replyId }) => {
  await deleteOwnReply(db, requireUuid(replyId, "reply"));
  return { ok: true };
});
