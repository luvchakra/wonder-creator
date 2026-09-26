import { retryRun } from "@wonder/creator-talk";
import { requireUuid, withApi } from "@/lib/api";
import { streamBrainWork } from "@/lib/run-stream";

export const maxDuration = 300;

/** Retry a failed, cancelled or interrupted creation exactly as asked; streams like a turn. Duplicate-safe. */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, requestId }, { id }) => {
  const runId = requireUuid(id, "run");
  return streamBrainWork(db, creatorId, requestId, (deps) => retryRun(deps, runId));
}, { rateLimit: 10, reindex: true });
