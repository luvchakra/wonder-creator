import { saveThought } from "@wonder/creator-community";
import { withApi } from "@/lib/api";
import { assertUuid } from "@/lib/studio";

/** POST /api/v1/open-conversations/:id/replies/:replyId/save — "Save thought": the reply, quoted and credited, as a note in your Materials. */
export const POST = withApi<{ id: string; replyId: string }>(
  async ({ db, creatorId }, { id, replyId }) => {
    assertUuid(id, replyId);
    return await saveThought(db, creatorId, replyId);
  },
  { rateLimit: 30 },
);
