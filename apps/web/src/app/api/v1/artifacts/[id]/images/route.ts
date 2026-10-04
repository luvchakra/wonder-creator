import { saveImageSet } from "@wonder/creator-studio";
import { readJson, requireUuid, withApi } from "@/lib/api";

/**
 * POST /api/v1/artifacts/:id/images — keep the Images page's pictures and what was done to them as a new version
 * (creation-pages.md, step 2). Stale keeps are refused; a new picture must be the creator's own; originals never change.
 */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => ({ version: await saveImageSet(db, creatorId, requireUuid(id, "Creation"), await readJson(req)) }), {
  rateLimit: 60,
  reindex: true,
});
