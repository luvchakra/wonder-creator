import { ASPECT_RATIOS, IMAGE_PURPOSES, IMAGE_QUALITY_INTENTS, requestImageGeneration, runImageGeneration } from "@wonder/creator-brain";
import { log } from "@wonder/core";
import { after } from "next/server";
import { z } from "zod";
import { checkBudget, readJson, withApi } from "@/lib/api";
import { imageDeps, imageWorkerDeps } from "@/lib/images";

export const maxDuration = 300;

const Body = z.object({
  creationId: z.string().uuid().nullish(),
  materialIds: z.array(z.string().uuid()).max(4).optional(),
  purpose: z.enum(IMAGE_PURPOSES),
  aspectRatio: z.enum(ASPECT_RATIOS).optional(),
  qualityIntent: z.enum(IMAGE_QUALITY_INTENTS).optional(),
  count: z.number().int().min(1).max(5).optional(),
  idempotencyKey: z.string().min(8).max(80).nullish(),
  lookupOnly: z.boolean().optional(),
});

/**
 * POST /api/v1/image-generations — cache-first contextual images (docs/image-generation.md §22–25). Returns a stored
 * generation for the same context at once; otherwise queues one and answers immediately (the page never waits on the
 * provider). `lookupOnly` never starts anything. States: generation · none · unavailable · no_context.
 */
export const POST = withApi(
  async ({ db, creatorId, req }) => {
    const b = Body.parse(await readJson(req));
    const deps = imageDeps(db, creatorId);
    const available = deps.provider.live;
    if (!b.creationId && !b.materialIds?.length) return { state: "no_context", available };
    // Cost-bearing starts have their own hourly budget per quality tier (§48); lookups don't spend it.
    if (!b.lookupOnly) await checkBudget(`imagegen:${creatorId}:${b.qualityIntent ?? "default"}`, b.qualityIntent === "premium" ? 5 : b.qualityIntent === "standard" ? 20 : 30);
    const out = await requestImageGeneration(deps, { artifactId: b.creationId ?? null, materialIds: b.materialIds, purpose: b.purpose, aspectRatio: b.aspectRatio, qualityIntent: b.qualityIntent, count: b.count, idempotencyKey: b.idempotencyKey, lookupOnly: b.lookupOnly });
    if (out.jobGenerationId) {
      const id = out.jobGenerationId;
      // Generate after the response; the jobs table retries if this is interrupted.
      after(async () => {
        const w = imageWorkerDeps();
        try {
          await runImageGeneration(w, id);
          await w.service.from("jobs").update({ status: "succeeded" }).eq("idempotency_key", `imagegen:${id}`);
        } catch {
          log("warn", "image_generation_job_deferred", { generationId: id });
        }
      });
    }
    return out.kind === "generation" ? { state: "generation", generation: out.view, available } : { state: out.kind, available };
  },
  { rateLimit: 60 },
);
