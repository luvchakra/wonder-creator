import { discover } from "@wonder/creator-brain";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { brainDeps } from "@/lib/brain";

export const maxDuration = 120;

const schema = z.object({ materialIds: z.array(z.string().uuid()).min(1).max(12), instruction: z.string().trim().max(2000).default("What could this become?") });

export const POST = withApi(async ({ db, creatorId, req, requestId }) => {
  const input = schema.parse(await readJson(req));
  return discover(brainDeps(db, creatorId, { correlationId: requestId }), input);
}, { rateLimit: 15 });
