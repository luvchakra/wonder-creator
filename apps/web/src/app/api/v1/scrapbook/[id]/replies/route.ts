import { replyToPost } from "@wonder/creator-library";
import { readJson, requireUuid, withApi } from "@/lib/api";

export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => ({ reply: await replyToPost(db, creatorId, requireUuid(id, "post"), await readJson(req)) }), { rateLimit: 30 });
