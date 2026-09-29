import { communityResponses } from "@wonder/creator-studio";
import { withApi } from "@/lib/api";
import { assertUuid } from "@/lib/studio";

/** GET /api/v1/studio-sessions/:id/community-responses — replies to what the creator asked about this Creation (Phase 04 §14). */
export const GET = withApi<{ id: string }>(async ({ db }, { id }) => {
  assertUuid(id);
  return await communityResponses(db, id);
}, { feature: "community_to_studio_enabled" });
