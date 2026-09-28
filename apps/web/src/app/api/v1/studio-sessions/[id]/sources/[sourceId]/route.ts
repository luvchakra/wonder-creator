import { removeSource, updateSource, workingSetView } from "@wonder/creator-studio";
import { readJson, withApi } from "@/lib/api";
import { assertUuid, studioSigner } from "@/lib/studio";

/** PATCH /api/v1/studio-sessions/:id/sources/:sourceId — Available / In use / Pinned, or its roles. DELETE — take it off the table. */
export const PATCH = withApi<{ id: string; sourceId: string }>(
  async ({ db, req }, { id, sourceId }) => {
    assertUuid(id, sourceId);
    await updateSource(db, sourceId, await readJson(req));
    return { workingSet: await workingSetView(db, id, studioSigner(db)) };
  },
  { rateLimit: 120 },
);

export const DELETE = withApi<{ id: string; sourceId: string }>(
  async ({ db }, { id, sourceId }) => {
    assertUuid(id, sourceId);
    await removeSource(db, sourceId);
    return { workingSet: await workingSetView(db, id, studioSigner(db)) };
  },
  { rateLimit: 60 },
);
