import { addFromDejaVu, workingSetView } from "@wonder/creator-studio";
import { readJson, withApi } from "@/lib/api";
import { assertUuid, studioSigner } from "@/lib/studio";

/**
 * POST /api/v1/studio-sessions/:id/sources/from-dejavu — `Bring in → DejaVu` (Phase 04 §4): the chosen Moments of one
 * DejaVu join the Working Table as Available sources. Never the whole DejaVu, never onto the Canvas.
 */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    assertUuid(id);
    const r = await addFromDejaVu(db, creatorId, id, await readJson(req));
    return { ...r, workingSet: await workingSetView(db, id, studioSigner(db)) };
  },
  { rateLimit: 60 },
);
