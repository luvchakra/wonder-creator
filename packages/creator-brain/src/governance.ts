import { decideAutonomy, getAutonomy, type ActionKind, type AutonomyDomain, type AutonomyDecision } from "@wonder/creator-identity";
import { DomainError, fromDbError, must, publishEvent } from "@wonder/core";
import type { Db, JsonValue, Tables } from "@wonder/db";

/**
 * Governed tools: the only way CreatorBrain can cause a state change. Each tool declares its
 * autonomy domain and action kind; authorization is deterministic and recorded.
 */
export const TOOLS = {
  create_artifact: { domain: "creative_generation", action: "execute", label: "Create a new piece" },
  derive_artifact: { domain: "transformation", action: "draft", label: "Create a derivative piece" },
  apply_revision: { domain: "transformation", action: "execute", label: "Apply a revision as the current version" },
  save_memory: { domain: "organization", action: "draft", label: "Remember something about your practice" },
  organize_material: { domain: "organization", action: "execute", label: "Organize your material" },
  research: { domain: "research", action: "execute", label: "Research references" },
  invite_creator: { domain: "collaboration", action: "execute", label: "Invite a creator" },
  publish: { domain: "publishing", action: "execute", label: "Publish" },
  change_rights: { domain: "rights", action: "execute", label: "Change rights or licenses" },
  commerce: { domain: "commerce", action: "execute", label: "Sell or license commercially" },
  delete: { domain: "destructive_actions", action: "execute", label: "Delete permanently" },
} as const satisfies Record<string, { domain: AutonomyDomain; action: ActionKind; label: string }>;

export type ToolName = keyof typeof TOOLS;

export async function authorizeTool(db: Db, creatorId: string, tool: ToolName, runId: string | null): Promise<AutonomyDecision> {
  const def = TOOLS[tool];
  const policy = await getAutonomy(db, creatorId);
  const decision = decideAutonomy(def.domain, policy[def.domain], def.action);
  const res = await db.from("ai_tool_calls").insert({
    run_id: runId,
    creator_id: creatorId,
    tool,
    autonomy_domain: def.domain,
    decision: decision.outcome,
    decision_reason: decision.outcome === "allowed" ? null : decision.reason,
  });
  if (res.error) throw fromDbError(res.error);
  return decision;
}

export type Proposal = Tables<"ai_proposals">;

export interface ProposalInput {
  tool: ToolName;
  understood: string;
  plan: string;
  impact: string;
  payload: Record<string, unknown>;
  runId?: string | null;
  conversationId?: string | null;
}

/** "What I understood / What I plan to do / Impact" + Confirm · Change · Cancel. */
export async function createProposal(db: Db, creatorId: string, p: ProposalInput): Promise<Proposal> {
  const def = TOOLS[p.tool];
  const row = must(
    await db
      .from("ai_proposals")
      .insert({
        creator_id: creatorId,
        run_id: p.runId ?? null,
        conversation_id: p.conversationId ?? null,
        domain: def.domain,
        action: p.tool,
        understood: p.understood.slice(0, 2000),
        plan: p.plan.slice(0, 2000),
        impact: p.impact.slice(0, 1000),
        payload: p.payload as JsonValue,
      })
      .select("*")
      .single(),
  );
  await publishEvent(db, { type: "AiProposalCreated", aggregate: "ai_proposal", aggregateId: row.id, payload: { action: p.tool } });
  return row;
}

export async function getPendingProposal(db: Db, id: string): Promise<Proposal> {
  const p = must(await db.from("ai_proposals").select("*").eq("id", id).maybeSingle(), "We couldn't find that proposal.");
  if (p.status !== "pending") throw new DomainError("conflict", "That proposal has already been handled.");
  if (Date.now() - new Date(p.created_at).getTime() > 7 * 24 * 3600 * 1000) {
    await db.from("ai_proposals").update({ status: "expired", resolved_at: new Date().toISOString() }).eq("id", id);
    throw new DomainError("conflict", "That proposal has expired. Ask CreatorBrain again.");
  }
  return p;
}

export async function resolveProposal(db: Db, id: string, status: "executed" | "rejected" | "failed") {
  const res = await db.from("ai_proposals").update({ status, resolved_at: new Date().toISOString() }).eq("id", id).eq("status", "pending").select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("conflict", "That proposal has already been handled.");
  await publishEvent(db, {
    type: status === "rejected" ? "AiProposalRejected" : "AiProposalApproved",
    aggregate: "ai_proposal",
    aggregateId: id,
    payload: { status },
  });
}
