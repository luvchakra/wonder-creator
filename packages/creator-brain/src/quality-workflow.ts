import { DomainError, fromDbError, must } from "@wonder/core";
import type { Db } from "@wonder/db";
import type { QualityCheck } from "./quality";

/**
 * P0.1-05 Quality review & selective refinement. Quality findings advise; they never rewrite on their own.
 * The creator picks findings, previews a revision that applies only those, and keeps or discards it.
 * Keeping it creates a new version whose summary says what changed and why.
 */

export const RIGHTS_CHECK_KEY = "rights_provenance";

export interface Finding {
  /** Stable within one report: "s0" for the first suggestion, "c:<check key>" for an attention check. */
  key: string;
  kind: "suggestion" | "check";
  title: string;
  detail: string;
  /** Rights/provenance findings can't be dismissed or "fixed" by rewriting. */
  locked: boolean;
  state: "open" | "dismissed" | "applied";
}

interface ReportRow {
  checks: unknown;
  suggestions: unknown;
  dismissed: unknown;
  applied: unknown;
}

/** Actionable findings in a report: every suggestion, plus every check that needs attention. */
export function findingsOf(report: ReportRow): Finding[] {
  const dismissed = new Set((report.dismissed as string[]) ?? []);
  const applied = new Set((report.applied as string[]) ?? []);
  const state = (key: string): Finding["state"] => (applied.has(key) ? "applied" : dismissed.has(key) ? "dismissed" : "open");
  const suggestions = ((report.suggestions as Array<{ title: string; detail: string }>) ?? []).map((s, i) => ({ key: `s${i}`, kind: "suggestion" as const, title: s.title, detail: s.detail, locked: false, state: state(`s${i}`) }));
  const checks = ((report.checks as QualityCheck[]) ?? [])
    .filter((c) => c.status === "attention")
    .map((c) => ({ key: `c:${c.key}`, kind: "check" as const, title: c.label, detail: c.note, locked: c.key === RIGHTS_CHECK_KEY, state: state(`c:${c.key}`) }));
  return [...checks, ...suggestions];
}

const EXTERNAL_ORIGIN: Record<string, string> = { url: "a web link", youtube: "a YouTube video", import: "an import", huddle: "a Huddle" };

/**
 * Deterministic rights & provenance check from where the material came from. Computed from provenance on
 * every review, so no regeneration can remove it; model checks can't override it (see `withRightsCheck`).
 */
export async function provenanceCheck(db: Db, materialIds: string[]): Promise<QualityCheck> {
  const ids = [...new Set(materialIds)];
  if (!ids.length) return { key: RIGHTS_CHECK_KEY, label: "Rights & provenance", status: "good", note: "Made without outside material." };
  const { data, error } = await db.from("creative_materials").select("id, source_url, provenance_records(origin)").in("id", ids);
  if (error) throw fromDbError(error);
  const counts = new Map<string, number>();
  for (const m of data ?? []) {
    const origin = (m.provenance_records as { origin: string } | null)?.origin ?? (m.source_url ? "url" : null);
    if (origin && EXTERNAL_ORIGIN[origin]) counts.set(origin, (counts.get(origin) ?? 0) + 1);
  }
  if (!counts.size) return { key: RIGHTS_CHECK_KEY, label: "Rights & provenance", status: "good", note: "Everything it draws on is your own material." };
  const parts = [...counts.entries()].map(([o, n]) => `${n} from ${EXTERNAL_ORIGIN[o]}`);
  return {
    key: RIGHTS_CHECK_KEY,
    label: "Rights & provenance",
    status: "attention",
    note: `Draws on material from outside your own work (${parts.join(", ")}). Make sure you have permission before sharing or licensing it.`,
  };
}

/** The provenance check always wins over any model check with the same key. */
export function withRightsCheck(checks: QualityCheck[], rights: QualityCheck): QualityCheck[] {
  return [...checks.filter((c) => c.key !== RIGHTS_CHECK_KEY), rights];
}

/** The material an artifact was made from or references (its lineage), for the provenance check. */
export async function artifactSourceMaterials(db: Db, artifactId: string): Promise<string[]> {
  const { data } = await db.from("lineage_edges").select("source_id").eq("target_type", "artifact").eq("target_id", artifactId).eq("source_type", "material");
  return (data ?? []).map((e) => e.source_id);
}

/** Load a report of this artifact (owner only, via RLS). */
export async function getReport(db: Db, artifactId: string, reportId: string) {
  return must(await db.from("quality_reports").select("*").eq("id", reportId).eq("artifact_id", artifactId).maybeSingle(), "We couldn't find that review.");
}

/** Set aside a finding. Rights/provenance findings can't be dismissed. */
export async function dismissFinding(db: Db, artifactId: string, reportId: string, key: string, dismissed = true) {
  const report = await getReport(db, artifactId, reportId);
  const finding = findingsOf(report).find((f) => f.key === key);
  if (!finding) throw new DomainError("not_found", "That finding isn't part of this review.");
  if (finding.locked) throw new DomainError("validation", "Rights and provenance notes stay visible. Check your permissions or set the Creation's rights instead.");
  const current = new Set((report.dismissed as string[]) ?? []);
  if (dismissed) current.add(key);
  else current.delete(key);
  const res = await db.from("quality_reports").update({ dismissed: [...current] }).eq("id", reportId).select("id");
  if (res.error) throw fromDbError(res.error);
}

/** Mark findings as applied once the revision that applied them has been kept. */
export async function markApplied(db: Db, reportId: string, keys: string[]) {
  const { data } = await db.from("quality_reports").select("applied").eq("id", reportId).maybeSingle();
  if (!data) return;
  const applied = new Set([...((data.applied as string[]) ?? []), ...keys]);
  await db.from("quality_reports").update({ applied: [...applied] }).eq("id", reportId);
}

/** The instruction for a revision that applies only the chosen findings, and the version summary. */
export function selectiveInstruction(findings: Finding[]): { instruction: string; summary: string } {
  const lines = findings.map((f) => `- ${f.title}: ${f.detail}`);
  return {
    instruction: `Apply only these improvements. Keep everything else exactly as it is — same voice, structure and wording wherever these don't require a change:\n${lines.join("\n")}`,
    summary: `Applied quality suggestions: ${findings.map((f) => f.title).join("; ")}`.slice(0, 480),
  };
}
