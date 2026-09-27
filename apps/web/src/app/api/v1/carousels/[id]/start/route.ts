import { DomainError } from "@wonder/core";
import { startCarousel } from "@wonder/creator-brain";
import { z } from "zod";
import { checkBudget, readJson, withApi } from "@/lib/api";
import { runGenerationAfter, UUID } from "@/lib/carousel-jobs";
import { imageDeps } from "@/lib/images";

export const maxDuration = 300;

/** POST /api/v1/carousels/:id/start — choose how many images (and style, aspect) and create the first set. */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    if (!UUID.test(id)) throw new DomainError("not_found", "That Creation isn't available.");
    const b = z
      .object({ count: z.number().int().min(1).max(12), visualStyle: z.enum(["auto", "editorial", "atmospheric", "minimal"]).default("auto"), aspectRatio: z.enum(["1:1", "4:5", "16:9"]).default("4:5"), idempotencyKey: z.string().min(8).max(80).optional(), retry: z.boolean().optional() })
      .parse(await readJson(req));
    await checkBudget(`imagegen:${creatorId}:carousel`, 10);
    const out = await startCarousel(imageDeps(db, creatorId), id, b);
    if (out.kind === "generation" && out.jobGenerationId) runGenerationAfter(out.jobGenerationId);
    return { state: out.kind };
  },
  { rateLimit: 10 },
);
