import { deleteReply } from "@wonder/creator-library";
import { requireUuid, withApi } from "@/lib/api";

/** Your own reply, or any reply on your own post. */
export const DELETE = withApi<{ rid: string }>(async ({ db }, { rid }) => {
  await deleteReply(db, requireUuid(rid, "reply"));
  return { ok: true };
});
