import { requestSync } from "@wonder/creator-sources/server";
import { after } from "next/server";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { drainSync, sourcesDeps } from "@/lib/sources";

export const maxDuration = 60;

const schema = z.object({ connectionId: z.string().uuid().optional(), mode: z.literal("quick").default("quick") });

/**
 * POST /api/v1/personal-sources/sync — Sync one source or all of them (spec §9). Returns 202 at once with the job(s);
 * a repeated tap gets the same job back. The work runs after the response in bounded, checkpointed slices.
 */
export const POST = withApi(
  async ({ creatorId, req }) => {
    const b = schema.parse(await readJson(req));
    const out = await requestSync(sourcesDeps(), creatorId, { connectionId: b.connectionId, mode: b.mode });
    if (out.jobs.some((j) => !j.reused)) after(() => drainSync(creatorId));
    return Response.json(out, { status: 202 });
  },
  { feature: "personal_sources_enabled", rateLimit: 20 },
);
