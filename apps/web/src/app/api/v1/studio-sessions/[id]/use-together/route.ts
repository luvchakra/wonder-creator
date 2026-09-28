import { summariesOf, useTogetherIdea } from "@wonder/creator-brain";
import { directionsFor, workingSetView } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { brainDeps } from "@/lib/brain";
import { assertUuid, studioSigner } from "@/lib/studio";

export const maxDuration = 60;

/**
 * POST /api/v1/studio-sessions/:id/use-together — one concise possibility for the selected sources (§16–17).
 * Directions come from the sources' roles (always); the one-line idea only from a live CreativeMind model.
 */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    assertUuid(id);
    const b = z.object({ ids: z.array(z.string().uuid()).min(1).max(20), instruction: z.string().trim().max(300).optional() }).parse(await readJson(req));
    const set = await workingSetView(db, id, studioSigner(db));
    const chosen = set.sources.filter((s) => b.ids.includes(s.id) && s.available);
    const { data: a } = await db.from("artifacts").select("title").eq("id", set.artifactId).maybeSingle();
    const ai = await useTogetherIdea(await brainDeps(db, creatorId), { creationTitle: a?.title ?? "", sources: summariesOf(chosen), instruction: b.instruction });
    return { live: ai.live, idea: ai.idea, suggestedFormat: ai.suggestedFormat, directions: directionsFor(chosen) };
  },
  { rateLimit: 30 },
);
