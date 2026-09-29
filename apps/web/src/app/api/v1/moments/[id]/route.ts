import { DomainError } from "@wonder/core";
import { getMoment } from "@wonder/creator-moments";
import { requireUuid, withApi } from "@/lib/api";

/** GET /api/v1/moments/:id — one Moment, only while its entity is still the caller's to open. */
export const GET = withApi<{ id: string }>(async ({ db }, { id }) => {
  const moment = await getMoment(db, requireUuid(id, "Moment"));
  if (!moment) throw new DomainError("not_found", "We couldn't find that Moment.");
  return { moment };
});
