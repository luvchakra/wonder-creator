import { attachEntity, createDejaVu, searchDejaVus } from "@wonder/creator-moments";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";

/**
 * GET /api/v1/dejavus?q — the creator's DejaVus, most recently used first (searched when `q` is given).
 * POST /api/v1/dejavus `{name, description?, attach?: {entityType, entityId}}` — a new DejaVu, or the one already
 * named that way; `attach` gives it an entity straight away (the Add sheet's `Create "…"`).
 */
export const GET = withApi(async ({ db, req }) => {
  const p = req.nextUrl.searchParams;
  return { dejavus: await searchDejaVus(db, (p.get("q") ?? "").slice(0, 60), Number(p.get("limit")) || 12) };
});

export const POST = withApi(async ({ db, creatorId, req }) => {
  const body = (await readJson(req)) as Record<string, unknown>;
  const attach = z.object({ entityType: z.string().max(40), entityId: z.string().uuid() }).optional().parse(body.attach);
  const r = await createDejaVu(db, creatorId, { name: body.name, description: body.description });
  const moment = attach ? await attachEntity(db, creatorId, r.dejavu.id, attach) : null;
  return { ...r, momentId: moment?.id ?? null };
});
