import { suggestToPart } from "@wonder/creator-projects";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** POST /api/v1/projects/:id/parts/:partId/suggest — new words for another part; its people accept or decline (step 2). */
export const POST = withApi<{ id: string; partId: string }>(async ({ db, req }, { partId }) => ({ proposalId: await suggestToPart(db, requireUuid(partId, "Part"), await readJson(req, 600_000)) }), { rateLimit: 30 });
