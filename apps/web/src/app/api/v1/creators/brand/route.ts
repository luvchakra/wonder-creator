import { getBrandProfile, saveBrandProfile } from "@wonder/creator-identity";
import { readJson, withApi } from "@/lib/api";

/** Your brand-work profile (P1-15). Others only see the short summary, and only if you opt in. */
export const GET = withApi(async ({ db, creatorId }) => ({ profile: await getBrandProfile(db, creatorId) }));

export const PUT = withApi(async ({ db, creatorId, req }) => ({ profile: await saveBrandProfile(db, creatorId, await readJson(req)) }), { rateLimit: 30 });
