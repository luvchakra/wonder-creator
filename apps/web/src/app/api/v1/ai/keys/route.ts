import { providerReadiness } from "@wonder/creator-brain";
import { readJson, withApi } from "@/lib/api";
import { connectKey, listKeys } from "@/lib/byok";

/** Your connected AI keys (hints only) and the platform provider's state. */
export const GET = withApi(async ({ db }) => ({ keys: await listKeys(db), platform: providerReadiness() }));

/** Connect or rotate a key: it's checked with the provider first, and nothing is saved if it's rejected. */
export const POST = withApi(async ({ creatorId, req }) => connectKey(creatorId, await readJson(req, 2_000)), { rateLimit: 10 });
