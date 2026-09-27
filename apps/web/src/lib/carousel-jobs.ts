import "server-only";
import { runImageGeneration, runImageRevision } from "@wonder/creator-brain";
import { log } from "@wonder/core";
import { after } from "next/server";
import { imageWorkerDeps } from "./images";

/** Run image work after the response; the jobs table retries anything interrupted (the page never waits). */
export function runGenerationAfter(generationId: string) {
  after(async () => {
    const w = imageWorkerDeps();
    try {
      await runImageGeneration(w, generationId);
      await w.service.from("jobs").update({ status: "succeeded" }).eq("idempotency_key", `imagegen:${generationId}`);
    } catch {
      log("warn", "image_generation_job_deferred", { generationId });
    }
  });
}

export function runRevisionAfter(revisionId: string) {
  after(async () => {
    const w = imageWorkerDeps();
    try {
      await runImageRevision(w, revisionId);
      await w.service.from("jobs").update({ status: "succeeded" }).eq("idempotency_key", `imagerev:${revisionId}`);
    } catch {
      log("warn", "image_revision_job_deferred", {});
    }
  });
}

export const UUID = /^[0-9a-f-]{36}$/i;
