import { applyQualityFindings } from "@wonder/creator-brain";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";
import { brainDeps } from "@/lib/brain";

export const maxDuration = 300;

const schema = z.object({ reportId: z.string().uuid(), keys: z.array(z.string().min(1).max(60)).min(1).max(20) });

/** Preview a revision applying only the chosen findings (always a proposal to keep or discard). */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, req, requestId }, { id }) => {
  const b = schema.parse(await readJson(req));
  return applyQualityFindings(await brainDeps(db, creatorId, { correlationId: requestId }), requireUuid(id, "Creation"), b);
}, { rateLimit: 20 });
