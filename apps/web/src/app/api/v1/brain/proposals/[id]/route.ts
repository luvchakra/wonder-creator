import { approveProposal, rejectProposal } from "@wonder/creator-brain";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";
import { brainDeps } from "@/lib/brain";

export const maxDuration = 300;

/** Confirm or Cancel a CreatorBrain proposal. The creator's click is the approval; nothing else is. */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, req, requestId }, { id }) => {
  const { decision } = z.object({ decision: z.enum(["approve", "reject"]) }).parse(await readJson(req));
  const deps = brainDeps(db, creatorId, { correlationId: requestId });
  if (decision === "reject") {
    await rejectProposal(deps, requireUuid(id, "proposal"));
    return { ok: true };
  }
  return approveProposal(deps, requireUuid(id, "proposal"));
}, { rateLimit: 20, reindex: true });
