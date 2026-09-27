import { createCampaign, listCampaigns } from "@wonder/creator-projects";
import { readJson, withApi } from "@/lib/api";

/** Campaigns (P1-16): the ones you run and the brand invitations you've accepted or can answer. */
export const GET = withApi(async ({ db, creatorId }) => listCampaigns(db, creatorId));
export const POST = withApi(async ({ db, creatorId, req }) => ({ campaign: await createCampaign(db, creatorId, await readJson(req)) }), { rateLimit: 20 });
