import { markThreadRead } from "@wonder/creator-projects";
import { requireUuid, withApi } from "@/lib/api";

export const POST = withApi<{ threadId: string }>(async ({ db, creatorId }, { threadId }) => {
  await markThreadRead(db, creatorId, requireUuid(threadId, "conversation"));
  return { ok: true };
});
