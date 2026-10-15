import { DomainError } from "@wonder/core";
import { slideMadeFrom } from "@wonder/creator-studio";
import { withApi } from "@/lib/api";
import { UUID } from "@/lib/carousel-jobs";

/** GET /api/v1/carousel-slides/:id/made-from — what this slide's picture and words came from, on request (§39). */
export const GET = withApi<{ id: string }>(async ({ db }, { id }) => {
  if (!UUID.test(id)) throw new DomainError("not_found", "That slide isn't available.");
  return { sources: await slideMadeFrom(db, id) };
});
