import { DomainError } from "@wonder/core";
import { reorderCarousel } from "@wonder/creator-brain";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { UUID } from "@/lib/carousel-jobs";

/** POST /api/v1/carousels/:id/order — Arrange: every slide id, once, in the new order. Never generates. */
export const POST = withApi<{ id: string }>(
  async ({ db, req }, { id }) => {
    if (!UUID.test(id)) throw new DomainError("not_found", "That Creation isn't available.");
    const b = z.object({ slideIds: z.array(z.string().uuid()).min(1).max(12) }).parse(await readJson(req));
    await reorderCarousel(db, id, b.slideIds);
    return { ok: true };
  },
  { rateLimit: 60 },
);
