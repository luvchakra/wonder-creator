import { patchStudioSession, workingSetView } from "@wonder/creator-studio";
import { readJson, withApi } from "@/lib/api";
import { assertUuid, studioSigner } from "@/lib/studio";

/** GET /api/v1/studio-sessions/:id — the Working Set ("What's influencing this?"). PATCH — autosave: draft, output mode, intent. */
export const GET = withApi<{ id: string }>(async ({ db }, { id }) => {
  assertUuid(id);
  return { workingSet: await workingSetView(db, id, studioSigner(db)) };
});

export const PATCH = withApi<{ id: string }>(
  async ({ db, req }, { id }) => {
    assertUuid(id);
    await patchStudioSession(db, id, await readJson(req));
    return { ok: true };
  },
  { rateLimit: 600 },
);
