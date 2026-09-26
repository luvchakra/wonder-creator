import { handleTurn } from "@wonder/creator-talk";
import { readJson, withApi } from "@/lib/api";
import { streamBrainWork } from "@/lib/run-stream";

export const maxDuration = 300;

/**
 * A CreatorTalk turn, streamed as newline-delimited JSON (see `streamBrainWork`). Long creative generation
 * shows purposeful progress instead of blocking the page, and keeps going if the creator leaves.
 */
export const POST = withApi(async ({ db, creatorId, req, requestId }) => {
  const body = await readJson(req, 100_000);
  return streamBrainWork(db, creatorId, requestId, (deps) => handleTurn(deps, body));
}, { rateLimit: 20, reindex: true });
