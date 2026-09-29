import { removeReply } from "@wonder/creator-community";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** POST `{reason?}` — the conversation's owner or a moderator removes a reply (audited). */
export const POST = withApi<{ replyId: string }>(async ({ db, req }, { replyId }) => {
  const { reason } = z.object({ reason: z.string().trim().max(300).optional() }).parse(await readJson(req));
  await removeReply(db, requireUuid(replyId, "reply"), reason);
  return { ok: true };
});
