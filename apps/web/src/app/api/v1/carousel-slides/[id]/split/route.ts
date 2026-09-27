import { DomainError } from "@wonder/core";
import { splitCarouselSlide } from "@wonder/creator-brain";
import { withApi } from "@/lib/api";
import { UUID } from "@/lib/carousel-jobs";
import { serviceClient } from "@/lib/supabase/service";

/** POST /api/v1/carousel-slides/:id/split — Split into two slides: this slide keeps the first part; a new slide after it gets the rest. No generation. */
export const POST = withApi<{ id: string }>(async ({ db, creatorId }, { id }) => {
  if (!UUID.test(id)) throw new DomainError("not_found", "That slide isn't available.");
  return splitCarouselSlide({ db, service: serviceClient(), creatorId }, id);
});
