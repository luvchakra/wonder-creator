import { DomainError, log } from "@wonder/core";
import { regenerateImageGeneration, runImageGeneration } from "@wonder/creator-brain";
import { after } from "next/server";
import { checkBudget, withApi } from "@/lib/api";
import { imageDeps, imageWorkerDeps } from "@/lib/images";

export const maxDuration = 300;

/** POST /api/v1/image-generations/:id/regenerate — "Try another direction": a new variation; the old one stays (§17). */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId }, { id }) => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new DomainError("not_found", "That isn't available.");
    await checkBudget(`imagegen:${creatorId}:regenerate`, 20);
    const out = await regenerateImageGeneration(imageDeps(db, creatorId), id);
    if (out.jobGenerationId) {
      const gid = out.jobGenerationId;
      after(async () => {
        const w = imageWorkerDeps();
        try {
          await runImageGeneration(w, gid);
          await w.service.from("jobs").update({ status: "succeeded" }).eq("idempotency_key", `imagegen:${gid}`);
        } catch {
          log("warn", "image_generation_job_deferred", { generationId: gid });
        }
      });
    }
    return out.kind === "generation" ? { state: "generation", generation: out.view } : { state: out.kind };
  },
  { rateLimit: 6 },
);
