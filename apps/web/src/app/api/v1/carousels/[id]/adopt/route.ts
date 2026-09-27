import { DomainError } from "@wonder/core";
import { adoptCarouselSet } from "@wonder/creator-brain";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { UUID } from "@/lib/carousel-jobs";
import { serviceClient } from "@/lib/supabase/service";

/** POST /api/v1/carousels/:id/adopt — use this Creation's existing images as its slides (no new generation). */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => {
  if (!UUID.test(id)) throw new DomainError("not_found", "That Creation isn't available.");
  const b = z.object({ generationId: z.string().uuid() }).parse(await readJson(req));
  await adoptCarouselSet({ db, service: serviceClient(), creatorId }, id, b.generationId);
  return { ok: true };
});
