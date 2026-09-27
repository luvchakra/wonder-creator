import { transform } from "@wonder/creator-brain";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";
import { brainDeps } from "@/lib/brain";

export const maxDuration = 300;

const schema = z.object({ targetType: z.string().max(40), instruction: z.string().trim().max(2000).default(""), versionId: z.string().uuid().nullable().optional(), madeFor: z.string().trim().min(1).max(60).nullish() });

export const POST = withApi<{ id: string }>(async ({ db, creatorId, req, requestId }, { id }) => {
  const b = schema.parse(await readJson(req));
  const res = await transform(await brainDeps(db, creatorId, { correlationId: requestId }), { artifactId: requireUuid(id, "Creation"), targetType: b.targetType, instruction: b.instruction || "Adapt this piece.", versionId: b.versionId ?? null, madeFor: b.madeFor ?? null });
  return { artifact: res.artifact, offline: res.offline, inherited: res.inherited };
}, { rateLimit: 20, reindex: true });
