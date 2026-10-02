import { decideTestimonial } from "@wonder/creator-identity";
import { readJson, requireUuid, withApi } from "@/lib/api";
import { track } from "@/lib/telemetry";

/** PATCH /api/v1/testimonials/:id `{action: show|hide, onCreatorPage?}` — the receiver decides. */
export const PATCH = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    const body = await readJson(req);
    await decideTestimonial(db, requireUuid(id, "testimonial"), body);
    if ((body as { action?: string }).action === "show") track(db, "testimonial_shown", creatorId);
    return { ok: true };
  },
  { feature: "testimonials_enabled", rateLimit: 30 },
);
