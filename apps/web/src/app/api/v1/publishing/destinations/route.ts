import { addWebhookDestination, listDestinations } from "@wonder/creator-studio";
import { readJson, withApi } from "@/lib/api";

/** The creator's connected publishing destinations (webhooks they own). */
export const GET = withApi(async ({ db }) => ({ destinations: await listDestinations(db) }));

export const POST = withApi(async ({ db, creatorId, req }) => ({ destination: await addWebhookDestination(db, creatorId, await readJson(req)) }), { rateLimit: 20 });
