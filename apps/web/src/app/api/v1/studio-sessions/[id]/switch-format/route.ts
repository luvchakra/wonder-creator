import { transform } from "@wonder/creator-brain";
import { MODE_DEFAULT_TYPE, OUTPUT_MODES, copyWorkingSet, workingSetView } from "@wonder/creator-studio";
import { isKnownArtifactType } from "@wonder/creator-studio/types";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { brainDeps } from "@/lib/brain";
import { assertUuid, studioSigner } from "@/lib/studio";

export const maxDuration = 300;

/**
 * POST /api/v1/studio-sessions/:id/switch-format — the same ingredients under a new lens (§24–25): a new Creation of
 * the chosen kind (Transform, with lineage back to this one) whose Studio carries this Working Set over.
 */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req, requestId }, { id }) => {
    assertUuid(id);
    const b = z.object({ mode: z.enum(OUTPUT_MODES.map((m) => m.key) as [string, ...string[]]).optional(), artifactType: z.string().max(40).optional(), instruction: z.string().trim().max(2000).optional() }).parse(await readJson(req));
    const set = await workingSetView(db, id, studioSigner(db));
    const target = b.artifactType && isKnownArtifactType(b.artifactType) ? b.artifactType : MODE_DEFAULT_TYPE[(b.mode ?? "writing") as keyof typeof MODE_DEFAULT_TYPE];
    const res = await transform(await brainDeps(db, creatorId, { correlationId: requestId }), { artifactId: set.artifactId, targetType: target, instruction: b.instruction || `Make this a ${target.replace(/_/g, " ")} from the same ingredients.`, versionId: null });
    const sessionId = await copyWorkingSet(db, creatorId, id, res.artifact.id);
    return { artifactId: res.artifact.id, sessionId, offline: res.offline };
  },
  { rateLimit: 20, reindex: true },
);
