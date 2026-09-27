import { DomainError } from "@wonder/core";
import { addCarouselSlide } from "@wonder/creator-brain";
import { z } from "zod";
import { checkBudget, readJson, withApi } from "@/lib/api";
import { runRevisionAfter, UUID } from "@/lib/carousel-jobs";
import { imageDeps } from "@/lib/images";

export const maxDuration = 300;

/** POST /api/v1/carousels/:id/slides — "Generate one more": exactly one new slide, appended. */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    if (!UUID.test(id)) throw new DomainError("not_found", "That Creation isn't available.");
    const b = z.object({ instruction: z.string().trim().max(300).nullish(), idempotencyKey: z.string().min(8).max(80).optional() }).parse(await readJson(req));
    await checkBudget(`imagegen:${creatorId}:revise`, 20);
    const out = await addCarouselSlide(imageDeps(db, creatorId), id, b);
    if (out.kind === "queued" && out.queued) runRevisionAfter(out.revisionId);
    return { state: out.kind };
  },
  { rateLimit: 20 },
);
