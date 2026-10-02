import { DomainError } from "@wonder/core";
import { sharedContexts, testimonialsOf, withdrawTestimonial, writeTestimonial } from "@wonder/creator-identity";
import { readJson, requireUuid, withApi } from "@/lib/api";
import { track } from "@/lib/telemetry";

/** GET /api/v1/testimonials?creator=<id> — someone's testimonials as the caller may see them; `&shared=1` adds what the two share. */
export const GET = withApi(
  async ({ db, creatorId, req }) => {
    const target = requireUuid(req.nextUrl.searchParams.get("creator") ?? "", "creator");
    const [testimonials, shared] = await Promise.all([testimonialsOf(db, target), req.nextUrl.searchParams.get("shared") ? sharedContexts(db, creatorId, target) : Promise.resolve([])]);
    return { testimonials, shared };
  },
  { feature: "testimonials_enabled" },
);

/** POST /api/v1/testimonials `{to, body, context?}` — write (or rewrite) yours for someone. It waits for their decision. */
export const POST = withApi(
  async ({ db, creatorId, req }) => {
    const id = await writeTestimonial(db, await readJson(req));
    track(db, "testimonial_written", creatorId);
    return Response.json({ id }, { status: 201 });
  },
  { feature: "testimonials_enabled", rateLimit: 10 },
);

/** DELETE /api/v1/testimonials?to=<id> — withdraw what you wrote for someone. */
export const DELETE = withApi(
  async ({ db, req }) => {
    const to = req.nextUrl.searchParams.get("to");
    if (!to) throw new DomainError("validation", "Say whose testimonial to withdraw.");
    await withdrawTestimonial(db, requireUuid(to, "creator"));
    return { ok: true };
  },
  { feature: "testimonials_enabled", rateLimit: 20 },
);
