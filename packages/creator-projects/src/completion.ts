import { DomainError, fromDbError } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";
import { listContributions } from "./contributions";
import { getProject } from "./projects";
import { listAssertions, projectRightsSummary } from "./rights";
import { listTasks, projectPeople } from "./tasks";

/**
 * Crew dissolution / project completion (P1-09). A guided review of what's still open, then an explicit completion
 * (typed project name; open items acknowledged). Nothing is deleted: completing or archiving only changes status,
 * and a dissolved crew keeps its members and history but takes no one new.
 */

export const completionSchema = z.object({
  outcome: z.enum(["completed", "archived"]),
  dissolveCrew: z.boolean().default(false),
  confirmTitle: z.string().trim().min(1, "Type the project's name to confirm.").max(200),
  acknowledgeOpen: z.boolean().default(false),
  note: z.string().trim().max(2000).nullish(),
});

export interface OpenItems {
  tasks: number;
  proposals: number;
  claims: number;
  licence_requests: number;
  approvals: number;
}

function completionError(e: { code?: string; message?: string }) {
  const msg = e.message ?? "";
  if (msg.includes("confirmation mismatch")) return new DomainError("validation", "Type the project's name exactly to confirm.");
  if (msg.includes("open items")) return new DomainError("conflict", "Some things are still open. Resolve them, or confirm that they stay open on record.");
  if (msg.includes("already")) return new DomainError("conflict", "The project is already closed that way.");
  if (msg.includes("not closed")) return new DomainError("conflict", "The project isn't completed or archived.");
  if (msg.includes("use the completion checklist")) return new DomainError("conflict", "Use the completion checklist to complete, archive or reopen a project with a crew.");
  if (msg.includes("not allowed") || e.code === "42501") return new DomainError("forbidden", "Only the project's owner can do that.");
  return fromDbError(e);
}

export async function openItems(db: Db, projectId: string): Promise<OpenItems> {
  const { data, error } = await db.rpc("project_open_items_of", {
    p_project: projectId,
  });
  if (error) throw completionError(error);
  const d = (data ?? {}) as Partial<OpenItems>;
  return {
    tasks: d.tasks ?? 0,
    proposals: d.proposals ?? 0,
    claims: d.claims ?? 0,
    licence_requests: d.licence_requests ?? 0,
    approvals: d.approvals ?? 0,
  };
}

/** Everything the completion checklist walks through, in the plan's order. */
export async function completionReview(db: Db, viewerId: string, projectId: string) {
  const data = await getProject(db, projectId);
  if (!data) throw new DomainError("not_found", "We couldn't find that project.");
  const { project, items } = data;
  const artifactIds = items.filter((i) => i.kind === "artifact").map((i) => i.itemId);
  const [open, taskData, rights, assertions, ledger, people, crew, proposals, completions] = await Promise.all([
    openItems(db, projectId),
    listTasks(db, projectId),
    projectRightsSummary(db, projectId),
    listAssertions(db, viewerId, projectId),
    listContributions(db, viewerId, { projectId }),
    projectPeople(db, projectId),
    db.from("crews").select("id, name, status, crew_members(status)").eq("project_id", projectId).maybeSingle(),
    artifactIds.length
      ? db.from("artifact_change_proposals").select("id, artifact_id, summary, artifacts(title)").in("artifact_id", artifactIds).eq("status", "open").limit(100)
      : Promise.resolve({ data: [], error: null }),
    db
      .from("project_completions")
      .select("*, completer:creators!project_completions_completed_by_fkey(display_name), reopener:creators!project_completions_reopened_by_fkey(display_name)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (crew.error) throw fromDbError(crew.error);
  if (completions.error) throw fromDbError(completions.error);

  const credited = new Set(ledger.filter((c) => !c.retracted).map((c) => c.contributor.id));
  const members = (crew.data?.crew_members ?? []) as Array<{ status: string }>;
  return {
    project: {
      id: project.id,
      title: project.title,
      status: project.status,
      ownerId: project.creator_id,
    },
    crew: crew.data
      ? {
          id: crew.data.id,
          name: crew.data.name,
          status: crew.data.status,
          active: members.filter((m) => m.status === "active").length,
          invited: members.filter((m) => m.status === "invited").length,
        }
      : null,
    open,
    tasks: taskData.tasks
      .filter((t) => t.status !== "done")
      .map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        assignees: t.assignees,
        needsApproval: t.needsApproval,
      })),
    pieces: items
      .filter((i) => i.kind === "artifact")
      .map((i) => ({
        id: i.itemId,
        title: i.title,
        status: i.artifact?.status ?? null,
        available: i.available,
        href: i.href,
      })),
    materials: items.filter((i) => i.kind !== "artifact").length,
    proposals: (proposals.data ?? []).map((p) => ({
      id: p.id,
      artifactId: p.artifact_id,
      summary: p.summary,
      title: (p.artifacts as { title: string } | null)?.title ?? "A piece",
    })),
    rights: {
      unrecorded: rights.filter((r) => !r.recorded).map((r) => ({ id: r.artifactId, title: r.title })),
      exclusive: rights.filter((r) => r.exclusiveLicenses > 0).map((r) => ({ id: r.artifactId, title: r.title })),
      claims: assertions.filter((a) => a.status === "asserted" || a.status === "disputed"),
    },
    people,
    attribution: {
      contributions: ledger.filter((c) => !c.retracted).length,
      uncredited: people.filter((p) => p.id !== project.creator_id && !credited.has(p.id)),
    },
    history: (completions.data ?? []).map((c) => ({
      id: c.id,
      outcome: c.outcome as "completed" | "archived",
      crewDissolved: c.crew_dissolved,
      acknowledgedOpen: c.acknowledged_open,
      openItems: c.open_items as Partial<OpenItems>,
      note: c.note,
      by: (c.completer as { display_name: string } | null)?.display_name ?? null,
      at: c.created_at,
      reopened: c.reopened_at
        ? {
            at: c.reopened_at,
            by: (c.reopener as { display_name: string } | null)?.display_name ?? null,
          }
        : null,
    })),
  };
}

export async function completeProject(db: Db, projectId: string, raw: unknown): Promise<string> {
  const c = completionSchema.parse(raw);
  const { data, error } = await db.rpc("complete_project", {
    p_project: projectId,
    p_outcome: c.outcome,
    p_dissolve_crew: c.dissolveCrew,
    p_confirm_title: c.confirmTitle,
    p_acknowledge_open: c.acknowledgeOpen,
    p_note: c.note ?? undefined,
  });
  if (error) throw completionError(error);
  return data as string;
}

export async function reopenProject(db: Db, projectId: string) {
  const { error } = await db.rpc("reopen_project", { p_project: projectId });
  if (error) throw completionError(error);
}
