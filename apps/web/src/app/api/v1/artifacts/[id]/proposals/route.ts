import { proposeChange } from "@wonder/creator-studio";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** Propose a change to the current version ({ baseVersionId, content, summary }). The owner accepts or declines. */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => ({ id: await proposeChange(db, creatorId, requireUuid(id, "piece"), await readJson(req, 2_000_000)) }), { rateLimit: 30 });
