import { removeTopic } from "@wonder/creator-community";
import { requireUuid, withApi } from "@/lib/api";

/** DELETE /api/v1/communities/:id/topics/:topicId — the owner or a moderator takes a topic out of the community. */
export const DELETE = withApi<{ id: string; topicId: string }>(
  async ({ db, req }, { id, topicId }) => {
    await removeTopic(db, requireUuid(id, "community"), requireUuid(topicId, "topic"), req.nextUrl.searchParams.get("reason")?.slice(0, 300) ?? undefined);
    return { ok: true };
  },
  { feature: "communities_enabled", rateLimit: 30 },
);
