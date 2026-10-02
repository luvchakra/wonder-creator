import { checkBudget, readJson, requireUuid, withApi } from "@/lib/api";
import { startTopic } from "@wonder/creator-community";
import { track } from "@/lib/telemetry";

/**
 * POST /api/v1/communities/:id/topics — a member starts a topic: an Open Conversation (community visibility) linked to
 * the community. Rate-limited like any conversation.
 */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    await checkBudget(`community_topic:${creatorId}`, 20);
    const conversation = await startTopic(db, creatorId, requireUuid(id, "community"), await readJson(req));
    track(db, "community_topic_started", creatorId);
    return Response.json({ conversation }, { status: 201 });
  },
  { feature: "communities_enabled", rateLimit: 6 },
);
