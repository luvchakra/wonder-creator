import { DomainError } from "@wonder/core";
import { carouselView } from "@wonder/creator-brain";
import { withApi } from "@/lib/api";
import { UUID } from "@/lib/carousel-jobs";
import { serviceClient } from "@/lib/supabase/service";

/** GET /api/v1/carousels/:id — the Carousel Composer for a Creation: settings, slides, and anything in flight. */
export const GET = withApi<{ id: string }>(async ({ db, creatorId }, { id }) => {
  if (!UUID.test(id)) throw new DomainError("not_found", "That Creation isn't available.");
  return carouselView({ db, service: serviceClient(), creatorId }, id);
});
