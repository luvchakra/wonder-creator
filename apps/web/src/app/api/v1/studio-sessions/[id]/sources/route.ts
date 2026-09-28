import { addSources, addSourcesSchema, workingSetView } from "@wonder/creator-studio";
import { readJson, withApi } from "@/lib/api";
import { assertUuid, studioSigner } from "@/lib/studio";

/** POST /api/v1/studio-sessions/:id/sources — bring things into the Working Set (references only; the owning domain decides access). */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    assertUuid(id);
    const b = addSourcesSchema.parse(await readJson(req));
    const added = await addSources(db, creatorId, id, b.items, b.state);
    return { added, workingSet: await workingSetView(db, id, studioSigner(db)) };
  },
  { rateLimit: 60 },
);
