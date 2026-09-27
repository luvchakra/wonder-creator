import { getCollaborationProfile, saveCollaborationProfile } from "@wonder/creator-identity";
import { readJson, withApi } from "@/lib/api";

/** Your collaboration profile (P1-14). Others read it through the profile page, which applies your rate choice. */
export const GET = withApi(async ({ db, creatorId }) => ({ profile: await getCollaborationProfile(db, creatorId) }));

export const PUT = withApi(async ({ db, creatorId, req }) => ({ profile: await saveCollaborationProfile(db, creatorId, await readJson(req)) }), { rateLimit: 30 });
