import { setTestimonialsFrom, testimonialsFromOf } from "@wonder/creator-identity";
import { readJson, withApi } from "@/lib/api";

/** GET / PATCH `{from}` — who may write a testimonial for you: anyone who can see your profile, people you worked with, or nobody. */
export const GET = withApi(async ({ db, creatorId }) => ({ from: await testimonialsFromOf(db, creatorId) }), { feature: "testimonials_enabled" });
export const PATCH = withApi(async ({ db, req }) => ({ from: await setTestimonialsFrom(db, await readJson(req)) }), { feature: "testimonials_enabled", rateLimit: 20 });
