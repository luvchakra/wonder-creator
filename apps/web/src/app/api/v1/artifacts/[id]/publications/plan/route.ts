import { planPublishing } from "@wonder/creator-brain";
import { requireUuid, withApi } from "@/lib/api";
import { brainDeps } from "@/lib/brain";

export const maxDuration = 60;

/** CreatorBrain proposes where, how and when to publish (Publishing autonomy applies). Nothing is prepared or sent. */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, requestId }, { id }) => planPublishing(await brainDeps(db, creatorId, { correlationId: requestId }), requireUuid(id, "Creation")), { rateLimit: 10 });
