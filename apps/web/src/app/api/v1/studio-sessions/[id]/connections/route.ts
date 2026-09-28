import { findStudioConnections, summariesOf } from "@wonder/creator-brain";
import { workingSetView } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { brainDeps } from "@/lib/brain";
import { assertUuid, studioSigner } from "@/lib/studio";

export const maxDuration = 60;

/** POST /api/v1/studio-sessions/:id/connections — up to 3 quiet connections between what's on the table (§27–30); the UI shows one at a time. */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    assertUuid(id);
    const b = z.object({ selectionText: z.string().max(2000).nullish() }).parse(await readJson(req).catch(() => ({})));
    const set = await workingSetView(db, id, studioSigner(db));
    const { data: a } = await db.from("artifacts").select("title").eq("id", set.artifactId).maybeSingle();
    const r = await findStudioConnections(await brainDeps(db, creatorId), { creationTitle: a?.title ?? "", sources: summariesOf(set.sources), selectionText: b.selectionText });
    return r;
  },
  { rateLimit: 30 },
);
