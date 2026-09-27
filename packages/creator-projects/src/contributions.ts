import { DomainError, fromDbError, must } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";
import { ATTRIBUTION_LABEL, CONTRIBUTION_KINDS, CONTRIBUTION_KIND_LABEL, RIGHTS_RELATIONSHIP_LABEL, type ContributionKind } from "./options";

/**
 * Contribution & attribution ledger (P1-07). Facts are immutable and entries are never deleted (a retraction stays
 * on record). Descriptive fields change only through contribution_update(), which keeps a history. Percentages
 * exist only when someone explicitly records them.
 */

const RIGHTS = ["contributor", "co_owner", "licensed", "work_for_hire", "none"] as const;
const ATTRIBUTION = ["required", "optional", "none"] as const;

export const recordContributionSchema = z
  .object({
    projectId: z.string().uuid().nullish(),
    artifactId: z.string().uuid().nullish(),
    versionId: z.string().uuid().nullish(),
    contributorId: z.string().uuid(),
    kind: z.enum(CONTRIBUTION_KINDS),
    description: z.string().trim().min(1, "Say what they contributed.").max(1000),
    attribution: z.enum(ATTRIBUTION).default("required"),
    creditLine: z.string().trim().max(200).optional(),
    rights: z.enum(RIGHTS).default("contributor"),
    compensation: z.string().trim().max(500).optional(),
    sharePercent: z.number().gt(0).max(100).optional(),
  })
  .refine((c) => c.projectId || c.artifactId, { message: "A contribution belongs to a Creative Room or a Creation." });

export const updateContributionSchema = z.object({
  description: z.string().trim().max(1000).optional(),
  attribution: z.enum(ATTRIBUTION).optional(),
  creditLine: z.string().trim().max(200).optional(),
  rights: z.enum(RIGHTS).optional(),
  compensation: z.string().trim().max(500).optional(),
  sharePercent: z.number().gt(0).max(100).nullable().optional(),
});

function ledgerError(e: { code?: string; message?: string }) {
  const msg = e.message ?? "";
  if (msg.includes("shares exceed 100")) return new DomainError("validation", "Defined shares can't add up to more than 100%.");
  if (msg.includes("retracted")) return new DomainError("conflict", "That contribution was retracted; it stays on record as it was.");
  if (msg.includes("reason required")) return new DomainError("validation", "Say why it's being retracted.");
  if (msg.includes("not found")) return new DomainError("not_found", "We couldn't find that contribution.");
  if (msg.includes("not allowed") || e.code === "42501") return new DomainError("forbidden", "You can't change that.");
  return fromDbError(e);
}

export interface ContributionView {
  id: string;
  contributor: { id: string; name: string; handle: string | null };
  kind: ContributionKind;
  kindLabel: string;
  source: "version" | "shared_item" | "task" | "manual";
  description: string;
  attribution: (typeof ATTRIBUTION)[number];
  creditLine: string | null;
  rights: (typeof RIGHTS)[number];
  compensation: string | null;
  sharePercent: number | null;
  related: { artifact: { id: string; title: string } | null; versionNumber: number | null; material: string | null };
  recordedBy: string | null;
  retracted: { at: string; reason: string | null } | null;
  edited: number;
  at: string;
  mine: boolean;
}

type Scope = { projectId: string } | { artifactId: string };

/** The ledger for a project (including pieces linked to it) or a piece, newest first. */
export async function listContributions(db: Db, viewerId: string, scope: Scope): Promise<ContributionView[]> {
  let q = db
    .from("contributions")
    .select(
      "*, contributor:creators!contributions_contributor_creator_id_fkey(display_name, handle), recorder:creators!contributions_recorded_by_fkey(display_name), artifacts(id, title), artifact_versions(version_number), creative_materials(title), contribution_edits(count)",
    )
    .order("created_at", { ascending: false })
    .limit(1000);
  if ("projectId" in scope) {
    const { data: links } = await db.from("project_items").select("artifact_id").eq("project_id", scope.projectId).eq("kind", "artifact").limit(500);
    const ids = (links ?? []).map((l) => l.artifact_id).filter((x): x is string => !!x);
    q = ids.length ? q.or(`project_id.eq.${scope.projectId},artifact_id.in.(${ids.join(",")})`) : q.eq("project_id", scope.projectId);
  } else {
    q = q.eq("artifact_id", scope.artifactId);
  }
  const { data, error } = await q;
  if (error) throw fromDbError(error);
  return (data ?? []).map((c) => {
    const who = c.contributor as { display_name: string; handle: string | null } | null;
    return {
      id: c.id,
      contributor: { id: c.contributor_creator_id, name: who?.display_name ?? "Creator", handle: who?.handle ?? null },
      kind: c.kind as ContributionKind,
      kindLabel: CONTRIBUTION_KIND_LABEL[c.kind as ContributionKind] ?? c.kind,
      source: c.source as ContributionView["source"],
      description: c.description,
      attribution: c.attribution as ContributionView["attribution"],
      creditLine: c.credit_line,
      rights: c.rights_relationship as ContributionView["rights"],
      compensation: c.compensation_note,
      sharePercent: c.share_percent === null ? null : Number(c.share_percent),
      related: {
        artifact: (c.artifacts as { id: string; title: string } | null) ?? null,
        versionNumber: (c.artifact_versions as { version_number: number } | null)?.version_number ?? null,
        material: (c.creative_materials as { title: string | null } | null)?.title ?? null,
      },
      recordedBy: (c.recorder as { display_name: string } | null)?.display_name ?? null,
      retracted: c.retracted_at ? { at: c.retracted_at, reason: c.retracted_reason } : null,
      edited: ((c.contribution_edits ?? []) as unknown as Array<{ count: number }>)[0]?.count ?? 0,
      at: c.created_at,
      mine: c.contributor_creator_id === viewerId,
    };
  });
}

/** Per person: how many contributions of which kinds, and a share only where one was explicitly defined. */
export function contributionSummary(entries: ContributionView[]) {
  const live = entries.filter((e) => !e.retracted);
  const people = new Map<string, { id: string; name: string; count: number; kinds: Set<string>; definedShare: number | null }>();
  for (const e of live) {
    const p = people.get(e.contributor.id) ?? { id: e.contributor.id, name: e.contributor.name, count: 0, kinds: new Set<string>(), definedShare: null };
    p.count += 1;
    p.kinds.add(e.kindLabel);
    if (e.sharePercent !== null) p.definedShare = (p.definedShare ?? 0) + e.sharePercent;
    people.set(e.contributor.id, p);
  }
  return {
    total: live.length,
    people: [...people.values()].sort((a, b) => b.count - a.count).map((p) => ({ ...p, kinds: [...p.kinds] })),
  };
}

export async function recordContribution(db: Db, recorderId: string, raw: unknown) {
  const c = recordContributionSchema.parse(raw);
  const res = await db
    .from("contributions")
    .insert({
      project_id: c.projectId ?? null,
      artifact_id: c.artifactId ?? null,
      version_id: c.versionId ?? null,
      contributor_creator_id: c.contributorId,
      kind: c.kind,
      source: "manual",
      description: c.description,
      attribution: c.attribution,
      credit_line: c.creditLine || null,
      rights_relationship: c.rights,
      compensation_note: c.compensation || null,
      share_percent: c.sharePercent ?? null,
      recorded_by: recorderId,
    })
    .select("id")
    .single();
  if (res.error?.code === "42501") throw new DomainError("forbidden", "Only the Creative Room's owner and admins (or the Creation's owner) record contributions, for people involved in it.");
  if (res.error) throw ledgerError(res.error);
  return must(res).id;
}

export async function updateContribution(db: Db, id: string, raw: unknown) {
  const u = updateContributionSchema.parse(raw);
  const { error } = await db.rpc("contribution_update", {
    p_id: id,
    p_description: u.description,
    p_attribution: u.attribution,
    p_credit_line: u.creditLine,
    p_rights: u.rights,
    p_compensation: u.compensation,
    p_share: u.sharePercent ?? undefined,
    p_clear_share: u.sharePercent === null,
  });
  if (error) throw ledgerError(error);
}

export async function retractContribution(db: Db, id: string, reason: string) {
  const { error } = await db.rpc("contribution_retract", { p_id: id, p_reason: reason });
  if (error) throw ledgerError(error);
}

export async function contributionHistory(db: Db, id: string) {
  const { data, error } = await db.from("contribution_edits").select("id, changes, created_at, creators(display_name)").eq("contribution_id", id).order("created_at");
  if (error) throw fromDbError(error);
  return (data ?? []).map((e) => ({ id: e.id, changes: e.changes as Record<string, unknown>, at: e.created_at, editor: (e.creators as { display_name: string } | null)?.display_name ?? "Someone" }));
}

function csvCell(v: string): string {
  const s = /^[=+\-@]/.test(v) ? `'${v}` : v; // no spreadsheet formulas
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Credits for export. Plain text groups people with their credit line (or kinds of contribution); CSV lists every
 * live entry. People who asked for no credit are left out of the credits (but stay in the ledger).
 */
export function exportCredits(title: string, entries: ContributionView[], format: "txt" | "csv"): string {
  const live = entries.filter((e) => !e.retracted);
  if (format === "csv") {
    const head = ["Contributor", "Contribution", "Description", "Related", "Credit", "Credit line", "Rights", "Compensation", "Share (%)", "Date"];
    const rows = live.map((e) => [
      e.contributor.name,
      e.kindLabel,
      e.description,
      [e.related.artifact?.title, e.related.versionNumber ? `v${e.related.versionNumber}` : null, e.related.material].filter(Boolean).join(" · "),
      ATTRIBUTION_LABEL[e.attribution],
      e.creditLine ?? "",
      RIGHTS_RELATIONSHIP_LABEL[e.rights],
      e.compensation ?? "",
      e.sharePercent === null ? "" : String(e.sharePercent),
      e.at.slice(0, 10),
    ]);
    return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
  }
  const credited = new Map<string, { name: string; lines: Set<string> }>();
  for (const e of live) {
    if (e.attribution === "none") continue;
    const p = credited.get(e.contributor.id) ?? { name: e.contributor.name, lines: new Set<string>() };
    p.lines.add(e.creditLine ?? e.kindLabel);
    credited.set(e.contributor.id, p);
  }
  const body = [...credited.values()].map((p) => `${p.name} — ${[...p.lines].join(", ")}`).join("\n");
  return `${title}\n\nCredits\n\n${body || "(no credits yet)"}\n`;
}
