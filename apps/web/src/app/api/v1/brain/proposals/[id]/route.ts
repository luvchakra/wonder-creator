import { approveProposal, editProposal, getApproval, rejectProposal, resolveProposal } from "@wonder/creator-brain";
import { isKnownArtifactType } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";
import { brainDeps } from "@/lib/brain";

export const maxDuration = 300;

const body = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve") }),
  z.object({ decision: z.literal("reject"), note: z.string().trim().max(500).optional() }),
  z.object({ decision: z.literal("cancel") }),
  z.object({ decision: z.literal("edit"), artifactType: z.string().refine(isKnownArtifactType, "Choose a kind of piece.").optional(), instruction: z.string().trim().min(1).max(4000).optional() }),
]);

/**
 * Approve, decline, cancel or edit a CreatorBrain proposal. The creator's click is the approval; nothing else
 * is. Approval runs the parameters stored with the proposal, once. Editing makes a new proposal.
 */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, req, requestId }, { id }) => {
  const proposalId = requireUuid(id, "proposal");
  const b = body.parse(await readJson(req));
  const deps = await brainDeps(db, creatorId, { correlationId: requestId });
  if (b.decision === "reject") {
    await rejectProposal(deps, proposalId, b.note);
    return { ok: true };
  }
  if (b.decision === "cancel") {
    await getApproval(db, proposalId);
    await resolveProposal(db, proposalId, "cancelled");
    return { ok: true };
  }
  if (b.decision === "edit") {
    const next = await editProposal(db, creatorId, proposalId, { artifactType: b.artifactType, instruction: b.instruction });
    return { approval: await getApproval(db, next.id) };
  }
  return approveProposal(deps, proposalId);
}, { rateLimit: 20, reindex: true });
