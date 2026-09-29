import { getOpenTo, saveOpenTo } from "@wonder/creator-community";
import { readJson, withApi } from "@/lib/api";

/** GET / PATCH `{preferences}` — what you're open to (§9): explicit, never inferred. */
export const GET = withApi(async ({ db, creatorId }) => ({ preferences: await getOpenTo(db, creatorId) }));
export const PATCH = withApi(async ({ db, creatorId, req }) => ({ preferences: await saveOpenTo(db, creatorId, await readJson(req)) }), { rateLimit: 30 });
