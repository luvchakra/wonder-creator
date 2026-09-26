import { refine } from "@wonder/creator-brain";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";
import { brainDeps } from "@/lib/brain";

export const maxDuration = 300;

const schema = z.object({ instruction: z.string().trim().min(1).max(2000), action: z.string().max(40).optional() });

export const POST = withApi<{ id: string }>(async ({ db, creatorId, req, requestId }, { id }) => {
  const b = schema.parse(await readJson(req));
  return refine(brainDeps(db, creatorId, { correlationId: requestId }), { artifactId: requireUuid(id, "piece"), instruction: b.instruction, action: b.action ?? null });
}, { rateLimit: 20 });
