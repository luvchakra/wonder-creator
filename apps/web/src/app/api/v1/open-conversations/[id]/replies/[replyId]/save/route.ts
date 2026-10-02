import { saveThought } from "@wonder/creator-community";
import { withApi } from "@/lib/api";
import { assertUuid } from "@/lib/studio";
import { track } from "@/lib/telemetry";

/** POST /api/v1/open-conversations/:id/replies/:replyId/save — "Save thought": the reply, quoted and credited, as a note in your Materials. */
export const POST = withApi<{ id: string; replyId: string }>(
  async ({ db, creatorId }, { id, replyId }) => {
    assertUuid(id, replyId);
    const r = await saveThought(db, creatorId, replyId);
    track(db, "community_thought_saved", creatorId);
    return r;
  },
  { feature: "open_conversations_enabled", rateLimit: 30 },
);
