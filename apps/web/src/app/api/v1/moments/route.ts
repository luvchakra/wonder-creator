import { MOMENT_FILTERS, ensureMomentForEntity, getMoments, type MomentFilter } from "@wonder/creator-moments";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";

/**
 * GET /api/v1/moments — the creator's Moments across domains, newest first (`filter`, `from`, `to`, `cursor`, `limit`).
 * POST /api/v1/moments `{entityType, entityId}` — the Moment for an entity, made if it has none (idempotent).
 */
export const GET = withApi(async ({ db, req }) => {
  const p = req.nextUrl.searchParams;
  const f = p.get("filter");
  return getMoments(db, {
    filter: f && (MOMENT_FILTERS as readonly string[]).includes(f) ? (f as MomentFilter) : null,
    dateFrom: p.get("from"),
    dateTo: p.get("to"),
    cursor: p.get("cursor"),
    limit: Number(p.get("limit")) || undefined,
  });
}, { feature: "moments_enabled" });

export const POST = withApi(async ({ db, creatorId, req }) => {
  const b = z.object({ entityType: z.string().max(40), entityId: z.string().uuid() }).parse(await readJson(req));
  return { moment: await ensureMomentForEntity(db, creatorId, b) };
}, { feature: "moments_enabled" });
