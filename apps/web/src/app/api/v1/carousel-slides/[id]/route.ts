import { DomainError } from "@wonder/core";
import { removeCarouselSlide, updateCarouselSlide } from "@wonder/creator-brain";
import { readJson, withApi } from "@/lib/api";
import { UUID } from "@/lib/carousel-jobs";
import { serviceClient } from "@/lib/supabase/service";

/** PATCH /api/v1/carousel-slides/:id — autosave words, overlay and crop (owner or edit access). */
export const PATCH = withApi<{ id: string }>(
  async ({ db, req }, { id }) => {
    if (!UUID.test(id)) throw new DomainError("not_found", "That slide isn't available.");
    await updateCarouselSlide(db, id, await readJson(req));
    return { ok: true };
  },
  { rateLimit: 240 },
);

/** DELETE /api/v1/carousel-slides/:id — remove a slide (its image stays in the history). */
export const DELETE = withApi<{ id: string }>(async ({ db, creatorId }, { id }) => {
  if (!UUID.test(id)) throw new DomainError("not_found", "That slide isn't available.");
  await removeCarouselSlide({ db, service: serviceClient(), creatorId }, id);
  return { ok: true };
});
