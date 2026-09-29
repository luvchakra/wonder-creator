import { momentDejaVus } from "@wonder/creator-moments";
import { requireUuid, withApi } from "@/lib/api";

/** GET /api/v1/moments/:id/dejavus — the DejaVus this Moment carries. */
export const GET = withApi<{ id: string }>(async ({ db }, { id }) => ({ dejavus: await momentDejaVus(db, requireUuid(id, "Moment")) }), { feature: "moments_enabled" });
