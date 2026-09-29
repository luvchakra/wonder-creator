import { entityDejaVus } from "@wonder/creator-moments";
import { requireUuid, withApi } from "@/lib/api";

/** GET /api/v1/moments/by-entity?entityType&entityId — an entity's DejaVus for its chips (never creates a Moment). */
export const GET = withApi(async ({ db, req }) => {
  const p = req.nextUrl.searchParams;
  return entityDejaVus(db, (p.get("entityType") ?? "").slice(0, 40), requireUuid(p.get("entityId") ?? undefined));
});
