import "server-only";
import type { BrainDeps } from "@wonder/creator-brain";
import { isDomainError } from "@wonder/core";
import type { Db } from "@wonder/db";
import { after } from "next/server";
import { brainDeps } from "./brain";

/**
 * Runs CreatorBrain work and streams its progress as newline-delimited JSON:
 *   {"type":"run","runId":…} {"type":"progress","label":…} … {"type":"done",…} | {"type":"error",…}
 * The work is registered with `after()`, so it finishes even if the creator navigates away or the
 * connection drops; writes after the reader leaves are dropped instead of failing the run. The run's
 * persisted steps (see /create/runs/[id]) are the source of truth for anyone who comes back later.
 */
export function streamBrainWork(db: Db, creatorId: string, requestId: string, work: (deps: BrainDeps) => Promise<object>): Response {
  const encoder = new TextEncoder();
  const box: { controller?: ReadableStreamDefaultController<Uint8Array> } = {};
  let open = true;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      box.controller = c;
    },
    cancel() {
      open = false;
    },
  });
  const send = (obj: unknown) => {
    if (!open || !box.controller) return;
    try {
      box.controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
    } catch {
      open = false;
    }
  };
  const job = (async () => {
    try {
      const deps = brainDeps(db, creatorId, {
        correlationId: requestId,
        onProgress: (e) => send({ type: "progress", step: e.step, label: e.label }),
        onRunStarted: (runId, intent) => send({ type: "run", runId, intent }),
      });
      send({ type: "done", ...(await work(deps)) });
    } catch (e) {
      send({ type: "error", message: isDomainError(e) ? e.message : "Something went wrong. Nothing you shared was lost — please try again.", code: isDomainError(e) ? e.code : "internal" });
    } finally {
      if (open && box.controller) {
        try {
          box.controller.close();
        } catch {
          /* reader already gone */
        }
      }
    }
  })();
  after(job);
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
