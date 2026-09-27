import { DomainError, fromDbError } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";
import {
  ASSERTION_STATUS_LABEL,
  ATTRIBUTION_POLICIES,
  DERIVATIVE_POLICIES,
  DERIVATIVE_POLICY_LABEL,
  OWNERSHIP_CLAIMS,
  OWNERSHIP_CLAIM_LABEL,
  type AssertionStatus,
  type AttributionPolicy,
  type DerivativePolicy,
  type OwnershipClaim,
} from "./options";

/**
 * Crew rights & permissions (P1-08). A project's rights policy, ownership assertions, publication sign-off and an
 * immutable rights history. Contribution never implies ownership: assertions are statements people make and the
 * piece's owner responds to; nothing here rewrites a piece's rights record.
 */

export const rightsPolicySchema = z.object({
  derivatives: z.enum(DERIVATIVE_POLICIES),
  publicationSignoff: z.boolean(),
  attribution: z.enum(ATTRIBUTION_POLICIES),
  agreement: z.string().trim().max(5000).nullish(),
});

export const assertionSchema = z
  .object({
    artifactId: z.string().uuid(),
    claim: z.enum(OWNERSHIP_CLAIMS),
    statement: z
      .string()
      .trim()
      .min(1, "Say what your claim is based on.")
      .max(2000),
    sharePercent: z.number().gt(0).max(100).nullish(),
  })
  .refine((a) => a.sharePercent == null || a.claim === "co_owner", {
    message: "A share only applies to a co-ownership claim.",
    path: ["sharePercent"],
  });

export const assertionResponseSchema = z.object({
  response: z.enum(["acknowledge", "dispute", "withdraw"]),
  note: z.string().trim().max(1000).nullish(),
});
export const signoffSchema = z.object({
  decision: z.enum(["approve", "object"]),
  note: z.string().trim().max(1000).nullish(),
});

function rightsError(e: { code?: string; message?: string }) {
  const msg = e.message ?? "";
  if (msg.includes("not in project"))
    return new DomainError(
      "forbidden",
      "Only people in the project can do that.",
    );
  if (msg.includes("piece not in project"))
    return new DomainError(
      "validation",
      "That piece isn't part of this project.",
    );
  if (msg.includes("not involved"))
    return new DomainError(
      "forbidden",
      "Only people who worked on a piece can make a claim about it.",
    );
  if (msg.includes("share only"))
    return new DomainError(
      "validation",
      "A share only applies to a co-ownership claim.",
    );
  if (msg.includes("already asserted"))
    return new DomainError(
      "conflict",
      "You already have an open claim on this piece. Withdraw it to make a new one.",
    );
  if (msg.includes("assertion withdrawn"))
    return new DomainError("conflict", "That claim was withdrawn.");
  if (msg.includes("assertion not found"))
    return new DomainError("not_found", "We couldn't find that claim.");
  if (msg.includes("no sign-off needed"))
    return new DomainError(
      "forbidden",
      "Your sign-off isn't needed for this piece.",
    );
  if (msg.includes("not allowed") || e.code === "42501")
    return new DomainError("forbidden", "You can't do that.");
  return fromDbError(e);
}

export interface RightsPolicy {
  derivatives: DerivativePolicy;
  publicationSignoff: boolean;
  attribution: AttributionPolicy;
  agreement: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

const DEFAULT_POLICY: RightsPolicy = {
  derivatives: "owner_approval",
  publicationSignoff: false,
  attribution: "credit_all",
  agreement: null,
  updatedAt: null,
  updatedBy: null,
};

export async function getRightsPolicy(
  db: Db,
  projectId: string,
): Promise<RightsPolicy> {
  const { data, error } = await db
    .from("project_rights_policies")
    .select("*, creators(display_name)")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) return DEFAULT_POLICY;
  return {
    derivatives: data.derivatives as DerivativePolicy,
    publicationSignoff: data.publication_signoff,
    attribution: data.attribution as AttributionPolicy,
    agreement: data.agreement,
    updatedAt: data.updated_at,
    updatedBy:
      (data.creators as { display_name: string } | null)?.display_name ?? null,
  };
}

export async function saveRightsPolicy(
  db: Db,
  creatorId: string,
  projectId: string,
  raw: unknown,
) {
  const p = rightsPolicySchema.parse(raw);
  const { error } = await db
    .from("project_rights_policies")
    .upsert(
      {
        project_id: projectId,
        derivatives: p.derivatives,
        publication_signoff: p.publicationSignoff,
        attribution: p.attribution,
        agreement: p.agreement || null,
        updated_by: creatorId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id" },
    );
  if (error?.code === "42501")
    throw new DomainError(
      "forbidden",
      "Only the project's owner can set its rights policy.",
    );
  if (error) throw rightsError(error);
}

export interface PieceRights {
  artifactId: string;
  title: string;
  owner: { id: string; name: string };
  recorded: boolean;
  ownershipKind: "sole" | "joint" | "transferred" | null;
  copyrightHolder: string | null;
  attributionRequired: boolean;
  derivativesAllowed: boolean;
  coOwners: Array<{ name: string; creatorId: string | null; share: number }>;
  collaborators: Array<{
    creatorId: string;
    name: string;
    role: string | null;
    access: "comment" | "propose" | "edit";
  }>;
  signoffs: Array<{
    creatorId: string;
    name: string;
    decision: "approve" | "object" | null;
    note: string | null;
    at: string | null;
  }>;
  activeLicenses: number;
  exclusiveLicenses: number;
}

export async function projectRightsSummary(
  db: Db,
  projectId: string,
): Promise<PieceRights[]> {
  const { data, error } = await db.rpc("project_rights_summary", {
    p_project: projectId,
  });
  if (error) throw rightsError(error);
  return (data ?? []).map((r) => ({
    artifactId: r.artifact_id,
    title: r.title,
    owner: { id: r.owner_id, name: r.owner_name },
    recorded: r.ownership_kind !== null,
    ownershipKind: r.ownership_kind as PieceRights["ownershipKind"],
    copyrightHolder: r.copyright_holder,
    attributionRequired: r.attribution_required,
    derivativesAllowed: r.derivatives_allowed,
    coOwners: (
      (r.co_owners ?? []) as Array<{
        name: string;
        creatorId: string | null;
        share: number;
      }>
    ).map((o) => ({ ...o, share: Number(o.share) })),
    collaborators: (r.collaborators ?? []) as PieceRights["collaborators"],
    signoffs: (r.signoffs ?? []) as PieceRights["signoffs"],
    activeLicenses: r.active_licenses,
    exclusiveLicenses: r.exclusive_licenses,
  }));
}

export interface AssertionView {
  id: string;
  artifact: { id: string; title: string };
  creator: { id: string; name: string };
  claim: OwnershipClaim;
  claimLabel: string;
  sharePercent: number | null;
  statement: string;
  status: AssertionStatus;
  statusLabel: string;
  response: { by: string | null; note: string | null; at: string } | null;
  at: string;
  mine: boolean;
}

export async function listAssertions(
  db: Db,
  viewerId: string,
  projectId: string,
): Promise<AssertionView[]> {
  const { data, error } = await db
    .from("ownership_assertions")
    .select(
      "*, artifacts(id, title), creator:creators!ownership_assertions_creator_id_fkey(display_name), responder:creators!ownership_assertions_responded_by_fkey(display_name)",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw fromDbError(error);
  return (data ?? []).map((a) => ({
    id: a.id,
    artifact: (a.artifacts as { id: string; title: string } | null) ?? {
      id: a.artifact_id,
      title: "A piece",
    },
    creator: {
      id: a.creator_id,
      name:
        (a.creator as { display_name: string } | null)?.display_name ??
        "Someone",
    },
    claim: a.claim as OwnershipClaim,
    claimLabel: OWNERSHIP_CLAIM_LABEL[a.claim as OwnershipClaim],
    sharePercent: a.share_percent === null ? null : Number(a.share_percent),
    statement: a.statement,
    status: a.status as AssertionStatus,
    statusLabel: ASSERTION_STATUS_LABEL[a.status as AssertionStatus],
    response: a.responded_at
      ? {
          by:
            (a.responder as { display_name: string } | null)?.display_name ??
            null,
          note: a.response_note,
          at: a.responded_at,
        }
      : null,
    at: a.created_at,
    mine: a.creator_id === viewerId,
  }));
}

export async function assertOwnership(
  db: Db,
  projectId: string,
  raw: unknown,
): Promise<string> {
  const a = assertionSchema.parse(raw);
  const { data, error } = await db.rpc("assert_ownership", {
    p_project: projectId,
    p_artifact: a.artifactId,
    p_claim: a.claim,
    p_statement: a.statement,
    p_share: a.sharePercent ?? undefined,
  });
  if (error) throw rightsError(error);
  return data as string;
}

export async function respondToAssertion(
  db: Db,
  assertionId: string,
  raw: unknown,
) {
  const r = assertionResponseSchema.parse(raw);
  const { error } = await db.rpc("respond_ownership_assertion", {
    p_assertion: assertionId,
    p_response: r.response,
    p_note: r.note ?? undefined,
  });
  if (error) throw rightsError(error);
}

export type SignoffStatus = Array<{
  creatorId: string;
  name: string;
  decision: "approve" | "object" | null;
  note: string | null;
  at: string | null;
}>;

/** Who must sign off on the piece's current version before it can be published (empty when no project requires it). */
export async function publicationSignoffs(
  db: Db,
  artifactId: string,
): Promise<SignoffStatus> {
  const { data, error } = await db.rpc("publication_signoff_status", {
    p_artifact: artifactId,
  });
  if (error) throw rightsError(error);
  return (data ?? []).map((s) => ({
    creatorId: s.creator_id,
    name: s.name,
    decision: s.decision as "approve" | "object" | null,
    note: s.note,
    at: s.decided_at,
  }));
}

export async function signOffPublication(
  db: Db,
  artifactId: string,
  raw: unknown,
) {
  const s = signoffSchema.parse(raw);
  const { error } = await db.rpc("sign_off_publication", {
    p_artifact: artifactId,
    p_decision: s.decision,
    p_note: s.note ?? undefined,
  });
  if (error) throw rightsError(error);
}

export interface RightsEventView {
  id: string;
  title: string;
  actor: string | null;
  at: string;
}

function describe(
  event: string,
  d: Record<string, unknown>,
  titles: Map<string, string>,
): string {
  const piece =
    typeof d.artifact === "string"
      ? `“${titles.get(d.artifact) ?? "a piece"}”`
      : "a piece";
  switch (event) {
    case "policy_updated": {
      const parts = [
        `derivatives: ${DERIVATIVE_POLICY_LABEL[d.derivatives as DerivativePolicy]?.label ?? d.derivatives}`,
        d.publication_signoff
          ? "sign-off required to publish"
          : "no sign-off required",
      ];
      if (d.agreement_changed) parts.push("agreement updated");
      return `Rights policy set (${parts.join("; ")})`;
    }
    case "assertion_made":
      return `Made a claim on ${piece}: ${OWNERSHIP_CLAIM_LABEL[d.claim as OwnershipClaim] ?? d.claim}${typeof d.share === "number" ? ` (${d.share}%)` : ""}`;
    case "assertion_acknowledged":
      return `Acknowledged a claim on ${piece}`;
    case "assertion_disputed":
      return `Disputed a claim on ${piece}`;
    case "assertion_withdrawn":
      return `Withdrew a claim on ${piece}`;
    case "publication_signed_off":
      return `Signed off on publishing ${piece}`;
    case "publication_objected":
      return `Objected to publishing ${piece}`;
    default:
      return event.replace(/_/g, " ");
  }
}

export async function listRightsEvents(
  db: Db,
  projectId: string,
  titles: Map<string, string>,
): Promise<RightsEventView[]> {
  const { data, error } = await db
    .from("project_rights_events")
    .select("id, event, details, created_at, creators(display_name)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw fromDbError(error);
  return (data ?? []).map((e) => ({
    id: e.id,
    title: describe(
      e.event,
      (e.details ?? {}) as Record<string, unknown>,
      titles,
    ),
    actor:
      (e.creators as { display_name: string } | null)?.display_name ?? null,
    at: e.created_at,
  }));
}

/** Everything the project's Rights tab shows. */
export async function getProjectRights(
  db: Db,
  viewerId: string,
  projectId: string,
) {
  const [policy, pieces, assertions] = await Promise.all([
    getRightsPolicy(db, projectId),
    projectRightsSummary(db, projectId),
    listAssertions(db, viewerId, projectId),
  ]);
  const titles = new Map(pieces.map((p) => [p.artifactId, p.title]));
  const history = await listRightsEvents(db, projectId, titles);
  return { policy, pieces, assertions, history };
}
