import { saveStoryboard } from "@wonder/creator-studio";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** Save a Video's storyboard as a new version (creation-pages.md, step 5). */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => ({ version: await saveStoryboard(db, creatorId, requireUuid(id, "Creation"), await readJson(req, 300_000)) }), { rateLimit: 60, reindex: true });
