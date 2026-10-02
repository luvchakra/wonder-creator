import { joinCommunity } from "@wonder/creator-community";
import { requireUuid, withApi } from "@/lib/api";
import { track } from "@/lib/telemetry";

/** POST /api/v1/communities/:id/join — anyone signed in may join (owner: "which anyone can join"). */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId }, { id }) => {
    const crewId = await joinCommunity(db, requireUuid(id, "community"));
    track(db, "community_joined", creatorId);
    return { ok: true, crewId };
  },
  { feature: "communities_enabled", rateLimit: 20 },
);
