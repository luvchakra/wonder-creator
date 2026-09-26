import { decideAutonomy, getAutonomy, type ActionKind, type AutonomyDomain, type AutonomyDecision } from "@wonder/creator-identity";
import { DomainError, fromDbError, must, publishEvent } from "@wonder/core";
import type { Db, JsonValue, Tables } from "@wonder/db";
import { artifactType, isKnownArtifactType } from "@wonder/creator-studio/types";

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

/** A pending, unexpired proposal (expired ones are marked so on the way). */
export async function getPendingProposal(db: Db, id: string): Promise<Proposal> {
  const p = must(await db.from("ai_proposals").select("*").eq("id", id).maybeSingle(), "We couldn't find that proposal.");
  if (p.status !== "pending") throw new DomainError("conflict", "That proposal has already been handled.");
  if (new Date(p.expires_at).getTime() <= Date.now()) {
    await db.from("ai_proposals").update({ status: "expired", resolved_at: new Date().toISOString() }).eq("id", id).eq("status", "pending");
    throw new DomainError("conflict", "That proposal has expired. Ask CreatorBrain again.");
  }
  return p;
}

/**
 * The creator's approval, for exactly this proposal: pending → approved, atomically, so it can only be
 * executed once. The caller executes the stored parameters (never client-supplied ones), then records the
 * outcome with `resolveProposal(… "executed" | "failed")`.
 */
export async function claimProposal(db: Db, id: string): Promise<Proposal> {
  const p = await getPendingProposal(db, id);
  const res = await db.from("ai_proposals").update({ status: "approved" }).eq("id", id).eq("status", "pending").select("*");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("conflict", "That proposal has already been handled.");
  return { ...p, status: "approved" };
}

export async function resolveProposal(db: Db, id: string, status: "executed" | "failed" | "rejected" | "cancelled", note?: string | null) {
  const from = status === "executed" || status === "failed" ? ["approved", "pending"] : ["pending"];
  const res = await db
    .from("ai_proposals")
    .update({ status, resolved_at: new Date().toISOString(), ...(note ? { decision_note: note.slice(0, 500) } : {}) })
    .eq("id", id)
    .in("status", from)
    .select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("conflict", "That proposal has already been handled.");
  await publishEvent(db, {
    type: status === "executed" ? "AiProposalApproved" : "AiProposalRejected",
    aggregate: "ai_proposal",
    aggregateId: id,
    payload: { status },
  });
}

// ---------------------------------------------------------------------------
// Approval Center (read side)
// ---------------------------------------------------------------------------
const DOMAIN_LABEL: Record<string, string> = {
  creative_generation: "Creative generation",
  research: "Research",
  transformation: "Transformation",
  organization: "Organization",
  collaboration: "Collaboration",
  communication: "Communication",
  publishing: "Publishing",
  commerce: "Commerce",
  rights: "Rights",
  destructive_actions: "Destructive actions",
};
const RIGHTS_DOMAINS = new Set(["rights", "commerce", "publishing"]);

export type ApprovalState = "pending" | "approved" | "declined" | "expired" | "cancelled" | "executed" | "failed";

export interface ApprovalView {
  id: string;
  state: ApprovalState;
  action: string;
  actionLabel: string;
  domain: string;
  domainLabel: string;
  understood: string;
  plan: string;
  impact: string;
  target: { kind: "artifact" | "conversation" | "none"; id: string | null; title: string | null };
  parameters: Array<{ label: string; value: string }>;
  rightsImplications: boolean;
  cost: string;
  createdAt: string;
  expiresAt: string;
  /** Still waiting and expiring within a day. */
  urgent: boolean;
  resolvedAt: string | null;
  decisionNote: string | null;
  supersedes: string | null;
  editable: boolean;
}

function stateOf(p: Proposal): ApprovalState {
  if (p.status === "pending" && new Date(p.expires_at).getTime() <= Date.now()) return "expired";
  return p.status === "rejected" ? "declined" : (p.status as ApprovalState);
}

/** The exact parameters, in plain words (never raw JSON, never private content beyond short excerpts). */
function parametersOf(p: Proposal): Array<{ label: string; value: string }> {
  const d = (p.payload ?? {}) as Record<string, unknown>;
  const out: Array<{ label: string; value: string }> = [];
  if (typeof d.artifactType === "string") out.push({ label: "Kind of piece", value: d.artifactType.replace(/_/g, " ") });
  if (typeof d.instruction === "string") out.push({ label: "Request", value: d.instruction.slice(0, 300) });
  if (Array.isArray(d.materialIds)) out.push({ label: "Material", value: `${d.materialIds.length} piece${d.materialIds.length === 1 ? "" : "s"}` });
  if (typeof d.baseVersionId === "string") out.push({ label: "Based on", value: "the version current when this was proposed" });
  if (typeof d.changeSummary === "string") out.push({ label: "Change", value: d.changeSummary.slice(0, 300) });
  return out;
}

export async function listApprovals(db: Db, opts: { state?: "open" | "closed"; limit?: number } = {}): Promise<ApprovalView[]> {
  let q = db.from("ai_proposals").select("*").order("created_at", { ascending: false }).limit(Math.min(opts.limit ?? 50, 100));
  if (opts.state === "open") q = q.eq("status", "pending");
  if (opts.state === "closed") q = q.neq("status", "pending");
  const { data, error } = await q;
  if (error) throw fromDbError(error);
  return approvalViews(db, data ?? []);
}

export async function getApproval(db: Db, id: string): Promise<ApprovalView> {
  const p = must(await db.from("ai_proposals").select("*").eq("id", id).maybeSingle(), "We couldn't find that approval.");
  return (await approvalViews(db, [p]))[0];
}

async function approvalViews(db: Db, rows: Proposal[]): Promise<ApprovalView[]> {
  const artifactIds = [...new Set(rows.map((p) => (p.payload as { artifactId?: string })?.artifactId).filter((x): x is string => !!x))];
  const convIds = [...new Set(rows.map((p) => p.conversation_id).filter((x): x is string => !!x))];
  const [arts, convs] = await Promise.all([
    artifactIds.length ? db.from("artifacts").select("id, title").in("id", artifactIds) : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
    convIds.length ? db.from("conversations").select("id, title").in("id", convIds) : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
  ]);
  const artTitle = new Map((arts.data ?? []).map((a) => [a.id, a.title]));
  const convTitle = new Map((convs.data ?? []).map((c) => [c.id, c.title]));
  return rows.map((p) => {
    const artifactId = (p.payload as { artifactId?: string })?.artifactId ?? null;
    const target: ApprovalView["target"] = artifactId
      ? { kind: "artifact", id: artifactId, title: artTitle.get(artifactId) ?? null }
      : p.conversation_id
        ? { kind: "conversation", id: p.conversation_id, title: convTitle.get(p.conversation_id) ?? null }
        : { kind: "none", id: null, title: null };
    const state = stateOf(p);
    return {
      id: p.id,
      state,
      action: p.action,
      actionLabel: TOOLS[p.action as ToolName]?.label ?? p.action.replace(/_/g, " "),
      domain: p.domain,
      domainLabel: DOMAIN_LABEL[p.domain] ?? p.domain,
      understood: p.understood,
      plan: p.plan,
      impact: p.impact,
      target,
      parameters: parametersOf(p),
      rightsImplications: RIGHTS_DOMAINS.has(p.domain),
      cost: "No cost",
      createdAt: p.created_at,
      expiresAt: p.expires_at,
      urgent: state === "pending" && new Date(p.expires_at).getTime() - Date.now() < 24 * 3600_000,
      resolvedAt: p.resolved_at,
      decisionNote: p.decision_note,
      supersedes: p.supersedes,
      editable: state === "pending" && p.action === "create_artifact",
    };
  });
}

/**
 * Edit a pending proposal's request: a new proposal with the changed parameters replaces it (the old one is
 * cancelled). Approvals are never stretched to cover different parameters.
 */
export async function editProposal(db: Db, creatorId: string, id: string, changes: { artifactType?: string; instruction?: string }): Promise<Proposal> {
  const old = await getPendingProposal(db, id);
  if (old.action !== "create_artifact") throw new DomainError("validation", "This kind of proposal can't be edited. Decline it and ask again.");
  if (changes.artifactType && !isKnownArtifactType(changes.artifactType)) throw new DomainError("validation", "Choose a kind of piece.");
  const payload = { ...(old.payload as Record<string, unknown>) };
  if (changes.artifactType) payload.artifactType = changes.artifactType;
  if (changes.instruction?.trim()) payload.instruction = changes.instruction.trim().slice(0, 4000);
  const row = must(
    await db
      .from("ai_proposals")
      .insert({
        creator_id: creatorId,
        run_id: old.run_id,
        conversation_id: old.conversation_id,
        domain: old.domain,
        action: old.action,
        understood: changes.instruction?.trim() ? `You asked: “${changes.instruction.trim().slice(0, 300)}”` : old.understood,
        plan: changes.artifactType ? `Draft a new ${artifactType(changes.artifactType).label.toLowerCase()} in your voice and save it as v1.` : old.plan,
        impact: old.impact,
        payload: payload as JsonValue,
        supersedes: old.id,
      })
      .select("*")
      .single(),
  );
  await resolveProposal(db, old.id, "cancelled", "Replaced by an edited request.");
  return row;
}
