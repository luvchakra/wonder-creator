import { commitStudioSources } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { assertUuid } from "@/lib/studio";

/**
 * POST /api/v1/studio-sessions/:id/commit `{versionId}` — after "Save version": record what the version was made from
 * (the sources in use or pinned, with roles, use, rights and credit). Nothing else in the Working Set is recorded.
 */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    assertUuid(id);
    const { versionId } = z.object({ versionId: z.string().uuid() }).parse(await readJson(req));
    return { recorded: await commitStudioSources(db, creatorId, id, versionId) };
  },
  { rateLimit: 30 },
);
