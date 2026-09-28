import { DomainError } from "@wonder/core";
import { refineSlideWords } from "@wonder/creator-brain";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { brainDeps } from "@/lib/brain";
import { UUID } from "@/lib/carousel-jobs";

export const maxDuration = 60;

const schema = z.object({ instruction: z.string().trim().min(1).max(300) });

/** POST /api/v1/carousel-slides/:id/refine-text — new words for this slide, as a suggestion. Nothing changes until the creator uses them. */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req, requestId }, { id }) => {
    if (!UUID.test(id)) throw new DomainError("not_found", "That slide isn't available.");
    const b = schema.parse(await readJson(req));
    const { data: s } = await db.from("carousel_slides").select("display_text, source_text, artifact_id").eq("id", id).maybeSingle();
    if (!s) throw new DomainError("not_found", "That slide isn't available.");
    const { data: a } = await db.from("artifacts").select("title").eq("id", s.artifact_id).maybeSingle();
    return refineSlideWords(await brainDeps(db, creatorId, { correlationId: requestId }), {
      creationTitle: a?.title ?? "",
      words: s.display_text || s.source_text,
      sourceText: s.source_text,
      instruction: b.instruction,
    });
  },
  { rateLimit: 30 },
);
