import { getPublishingPreferences, savePublishingPreferences } from "@wonder/creator-studio";
import { readJson, withApi } from "@/lib/api";

/** Publishing preferences: defaults that prefill preparation. They never approve or publish anything. */
export const GET = withApi(async ({ db, creatorId }) => ({ preferences: await getPublishingPreferences(db, creatorId) }));

export const PUT = withApi(async ({ db, creatorId, req }) => ({ preferences: await savePublishingPreferences(db, creatorId, await readJson(req)) }));
