import { DomainError } from "@wonder/core";
import { suggestSlideChunks } from "@wonder/creator-brain";
import { withApi } from "@/lib/api";
import { UUID } from "@/lib/carousel-jobs";
import { serviceClient } from "@/lib/supabase/service";

/** GET /api/v1/carousel-slides/:id/suggestions — other words from the source for this slide (the source never changes). */
export const GET = withApi<{ id: string }>(async ({ db, creatorId }, { id }) => {
  if (!UUID.test(id)) throw new DomainError("not_found", "That slide isn't available.");
  return { chunks: await suggestSlideChunks({ db, service: serviceClient(), creatorId }, id) };
});
