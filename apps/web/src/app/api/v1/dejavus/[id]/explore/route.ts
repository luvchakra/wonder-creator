import { DomainError } from "@wonder/core";
import { activeStudioSession, createArtifact, exploreDejaVuIn, openStudioSession } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { assertUuid } from "@/lib/studio";

const schema = z.object({ artifactId: z.string().uuid().nullish(), fresh: z.boolean().optional() });

/**
 * POST /api/v1/dejavus/:id/explore — "Explore in Studio" (Phase 04 §5). Opens the Studio the creator was last in (or the
 * Creation they name, or a new one) with the DejaVu's context available on the Working Table. Nothing is imported and
 * the Canvas is untouched until they act.
 */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    assertUuid(id);
    const b = schema.parse(await readJson(req));
    const { data: dv } = await db.from("dejavus").select("id, name").eq("id", id).maybeSingle();
    if (!dv) throw new DomainError("not_found", "We couldn't find that DejaVu.");
    let artifactId = b.artifactId ?? (b.fresh ? null : ((await activeStudioSession(db, creatorId))?.artifactId ?? null));
    if (!artifactId)
      artifactId = (await createArtifact(db, creatorId, { artifactType: "story", title: dv.name, content: "", authorKind: "creator", provenance: { origin: "typed", details: { dejavuId: dv.id } } })).id;
    const s = await openStudioSession(db, creatorId, artifactId);
    await exploreDejaVuIn(db, s.id, dv.id);
    return { artifactId, sessionId: s.id };
  },
  { feature: "dejavu_enabled", rateLimit: 20 },
);
