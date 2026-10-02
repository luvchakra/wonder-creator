import { leaveCommunity } from "@wonder/creator-community";
import { requireUuid, withApi } from "@/lib/api";

/** POST /api/v1/communities/:id/leave — leave; you can join again later. */
export const POST = withApi<{ id: string }>(
  async ({ db }, { id }) => {
    await leaveCommunity(db, requireUuid(id, "community"));
    return { ok: true };
  },
  { feature: "communities_enabled", rateLimit: 20 },
);
