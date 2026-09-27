import { draftPublicationCopy } from "@wonder/creator-brain";
import { requireUuid, withApi } from "@/lib/api";
import { brainDeps } from "@/lib/brain";

export const maxDuration = 60;

/** CreatorBrain drafts a title, caption and description for the creator to edit (Publishing autonomy applies). */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, requestId }, { id }) => draftPublicationCopy(await brainDeps(db, creatorId, { correlationId: requestId }), requireUuid(id, "Creation")), { rateLimit: 10 });
