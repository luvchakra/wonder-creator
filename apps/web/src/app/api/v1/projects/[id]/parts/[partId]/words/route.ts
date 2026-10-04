import { partWords } from "@wonder/creator-projects";
import { requireUuid, withApi } from "@/lib/api";

/** GET /api/v1/projects/:id/parts/:partId/words?from=<versionId> — a part's words as they stand, and as they stood (step 2). */
export const GET = withApi<{ id: string; partId: string }>(async ({ db, req }, { partId }) => {
  const from = new URL(req.url).searchParams.get("from");
  return { words: await partWords(db, requireUuid(partId, "Part"), from && /^[0-9a-f-]{36}$/i.test(from) ? from : null) };
});
