import { saveAudioTake } from "@wonder/creator-studio";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** POST /api/v1/artifacts/:id/audio — keep a take on the Audio page as a new version (creation-pages.md, step 3). */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => ({ version: await saveAudioTake(db, creatorId, requireUuid(id, "Creation"), await readJson(req, 600_000)) }), {
  rateLimit: 60,
  reindex: true,
});
