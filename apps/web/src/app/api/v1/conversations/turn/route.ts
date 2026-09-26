import { isDomainError } from "@wonder/core";
import { handleTurn } from "@wonder/creator-talk";
import { readJson, withApi } from "@/lib/api";
import { brainDeps } from "@/lib/brain";

export const maxDuration = 300;

/**
 * A CreatorTalk turn, streamed as newline-delimited JSON:
 *   {"type":"progress","label":"Understanding your material"} … {"type":"done","conversationId":…,"messages":[…]}
 * Long creative generation shows purposeful progress instead of blocking the page.
 */
export const POST = withApi(async ({ db, creatorId, req, requestId }) => {
  const body = await readJson(req, 100_000);
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      try {
        const deps = brainDeps(db, creatorId, { correlationId: requestId, onProgress: (e) => send({ type: "progress", step: e.step, label: e.label }) });
        const result = await handleTurn(deps, body);
        send({ type: "done", ...result });
      } catch (e) {
        send({ type: "error", message: isDomainError(e) ? e.message : "Something went wrong. Nothing you shared was lost — please try again.", code: isDomainError(e) ? e.code : "internal" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}, { rateLimit: 20, reindex: true });
