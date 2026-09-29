import { dismissCommunityResponse } from "@wonder/creator-studio";
import { withApi } from "@/lib/api";
import { assertUuid } from "@/lib/studio";

/** DELETE /api/v1/studio-sessions/:id/community-responses/:replyId — "Dismiss": this Studio stops showing it (the reply is untouched). */
export const DELETE = withApi<{ id: string; replyId: string }>(async ({ db }, { id, replyId }) => {
  assertUuid(id, replyId);
  await dismissCommunityResponse(db, id, replyId);
  return { ok: true };
}, { feature: "community_to_studio_enabled" });
