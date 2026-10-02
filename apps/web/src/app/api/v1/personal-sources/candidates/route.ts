import { withApi } from "@/lib/api";
import { candidateCards } from "@/lib/sources";

/** GET /api/v1/personal-sources/candidates — at most five things worth exploring, best first. */
export const GET = withApi(async ({ db }) => ({ candidates: await candidateCards(db) }), { feature: "personal_sources_enabled" });
