import { DomainError, log } from "@wonder/core";
import { requestAssetRevision, runImageRevision } from "@wonder/creator-brain";
import { after } from "next/server";
import { z } from "zod";
import { checkBudget, readJson, withApi } from "@/lib/api";
import { imageDeps, imageWorkerDeps } from "@/lib/images";

export const maxDuration = 300;

/**
 * POST /api/v1/image-generations/:id/assets/:assetId/revise — change one image with the creator's own instruction.
 * Answers at once with the set (the image shows as changing); the new image takes its place when ready.
 */
export const POST = withApi<{ id: string; assetId: string }>(
  async ({ db, creatorId, req }, { id, assetId }) => {
    if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(assetId)) throw new DomainError("not_found", "That isn't available.");
    const b = z.object({ instruction: z.string().trim().min(1).max(300), idempotencyKey: z.string().min(8).max(80).optional() }).parse(await readJson(req));
    await checkBudget(`imagegen:${creatorId}:revise`, 20);
    const out = await requestAssetRevision(imageDeps(db, creatorId), id, assetId, b);
    if (out.kind === "unavailable") return { state: "unavailable" };
    if (out.queued) {
      const rid = out.revisionId;
      after(async () => {
        const w = imageWorkerDeps();
        try {
          await runImageRevision(w, rid);
          await w.service.from("jobs").update({ status: "succeeded" }).eq("idempotency_key", `imagerev:${rid}`);
        } catch {
          log("warn", "image_revision_job_deferred", {});
        }
      });
    }
    return { state: "generation", generation: out.view };
  },
  { rateLimit: 20 },
);
