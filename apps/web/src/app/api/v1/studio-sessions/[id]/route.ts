import { workingSetView } from "@wonder/creator-studio";
import { withApi } from "@/lib/api";
import { assertUuid, studioSigner } from "@/lib/studio";

/** GET /api/v1/studio-sessions/:id — the Working Set ("What's influencing this?"). */
export const GET = withApi<{ id: string }>(async ({ db }, { id }) => {
  assertUuid(id);
  return { workingSet: await workingSetView(db, id, studioSigner(db)) };
});
