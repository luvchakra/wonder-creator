import { useCommunityResponse, workingSetView } from "@wonder/creator-studio";
import { withApi } from "@/lib/api";
import { assertUuid, studioSigner } from "@/lib/studio";

/** POST /api/v1/studio-sessions/:id/community-responses/:replyId/use — "Use in Studio": the reply joins the Working Table as feedback. */
export const POST = withApi<{ id: string; replyId: string }>(
  async ({ db, creatorId }, { id, replyId }) => {
    assertUuid(id, replyId);
    await useCommunityResponse(db, creatorId, id, replyId);
    return { workingSet: await workingSetView(db, id, studioSigner(db)) };
  },
  { rateLimit: 60 },
);
