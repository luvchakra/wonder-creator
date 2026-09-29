import { DomainError } from "@wonder/core";
import { MOMENT_FILTERS, addMomentToDejaVu, attachEntity, getDejaVuMoments, type MomentFilter } from "@wonder/creator-moments";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";
import { withThumbs } from "@/lib/moments";

/**
 * GET /api/v1/dejavus/:id/moments — its Moments across domains, newest first, only those the caller can still open.
 * POST `{momentId}` or `{entityType, entityId}` — attach (idempotent; immediately reversible with DELETE).
 */
export const GET = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  const p = req.nextUrl.searchParams;
  const f = p.get("filter");
  const page = await getDejaVuMoments(db, requireUuid(id, "DejaVu"), {
    filter: f && (MOMENT_FILTERS as readonly string[]).includes(f) ? (f as MomentFilter) : null,
    dateFrom: p.get("from"),
    dateTo: p.get("to"),
    cursor: p.get("cursor"),
    limit: Number(p.get("limit")) || undefined,
  });
  return withThumbs(db, page);
});

export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => {
  const dejavuId = requireUuid(id, "DejaVu");
  const b = z.object({ momentId: z.string().uuid().optional(), entityType: z.string().max(40).optional(), entityId: z.string().uuid().optional() }).parse(await readJson(req));
  if (b.momentId) {
    await addMomentToDejaVu(db, creatorId, dejavuId, b.momentId);
    return { momentId: b.momentId };
  }
  if (!b.entityType || !b.entityId) throw new DomainError("validation", "Say what to add.");
  const moment = await attachEntity(db, creatorId, dejavuId, { entityType: b.entityType, entityId: b.entityId });
  return { momentId: moment.id };
});
