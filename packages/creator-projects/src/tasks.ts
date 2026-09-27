import { DomainError, fromDbError, must } from "@wonder/core";
import type { Db, TablesUpdate } from "@wonder/db";
import { z } from "zod";
import { TASK_STATUSES, type TaskStatus } from "./options";

/**
 * Crew tasks & milestones (P1-05): light creative coordination. The database decides who may do what: the project's
 * owner and crew admins manage; crew members add tasks, take them on and move their own; tasks that need approval
 * are marked done only by the owner or an admin.
 */

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-01.")
  .nullable();

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Give the task a title.").max(200),
  description: z.string().trim().max(4000).optional(),
  dueOn: day.optional(),
  milestoneId: z.string().uuid().nullable().optional(),
  itemId: z.string().uuid().nullable().optional(),
  dependsOn: z.string().uuid().nullable().optional(),
  needsApproval: z.boolean().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  assigneeIds: z.array(z.string().uuid()).max(10).optional(),
});

export const updateTaskSchema = taskSchema.omit({ assigneeIds: true }).partial();

export const milestoneSchema = z.object({
  title: z.string().trim().min(1, "Give the milestone a name.").max(160),
  description: z.string().trim().max(2000).optional(),
  dueOn: day.optional(),
  done: z.boolean().optional(),
});

function taskError(e: { code?: string; message?: string }) {
  const msg = e.message ?? "";
  if (msg.includes("needs approval")) return new DomainError("forbidden", "This task needs approval: move it to Review, and the owner or an admin will mark it done.");
  if (msg.includes("change approval")) return new DomainError("forbidden", "Only the owner or an admin can decide whether a task needs approval.");
  if (msg.includes("not in this project")) return new DomainError("validation", "That has to be part of this Creative Room.");
  if (e.code === "42501") return new DomainError("forbidden", "You can't change that task.");
  return fromDbError(e);
}

export interface TaskView {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueOn: string | null;
  overdue: boolean;
  milestone: { id: string; title: string } | null;
  itemId: string | null;
  dependsOn: { id: string; title: string; done: boolean } | null;
  needsApproval: boolean;
  approvedBy: string | null;
  completedAt: string | null;
  createdBy: string | null;
  assignees: Array<{ id: string; name: string }>;
  comments: number;
  createdAt: string;
}

export interface MilestoneView {
  id: string;
  title: string;
  description: string | null;
  dueOn: string | null;
  doneAt: string | null;
  tasks: number;
  tasksDone: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function listTasks(db: Db, projectId: string): Promise<{ tasks: TaskView[]; milestones: MilestoneView[] }> {
  const [t, m] = await Promise.all([
    db
      .from("project_tasks")
      .select("*, project_task_assignees(creator_id, creators!project_task_assignees_creator_id_fkey(display_name)), project_task_comments(count)")
      .eq("project_id", projectId)
      .order("created_at")
      .limit(500),
    db.from("project_milestones").select("*").eq("project_id", projectId).order("due_on", { ascending: true, nullsFirst: false }).order("created_at").limit(100),
  ]);
  if (t.error) throw fromDbError(t.error);
  if (m.error) throw fromDbError(m.error);
  const rows = t.data ?? [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const milestoneTitle = new Map((m.data ?? []).map((x) => [x.id, x.title]));
  const now = today();
  const tasks: TaskView[] = rows.map((r) => {
    const dep = r.depends_on ? byId.get(r.depends_on) : undefined;
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status as TaskStatus,
      dueOn: r.due_on,
      overdue: !!r.due_on && r.due_on < now && r.status !== "done",
      milestone: r.milestone_id ? { id: r.milestone_id, title: milestoneTitle.get(r.milestone_id) ?? "Milestone" } : null,
      itemId: r.item_id,
      dependsOn: dep ? { id: dep.id, title: dep.title, done: dep.status === "done" } : null,
      needsApproval: r.needs_approval,
      approvedBy: r.approved_by,
      completedAt: r.completed_at,
      createdBy: r.created_by,
      assignees: ((r.project_task_assignees ?? []) as Array<{ creator_id: string; creators: { display_name: string } | null }>).map((a) => ({ id: a.creator_id, name: a.creators?.display_name ?? "Someone" })),
      comments: ((r.project_task_comments ?? []) as unknown as Array<{ count: number }>)[0]?.count ?? 0,
      createdAt: r.created_at,
    };
  });
  const milestones = (m.data ?? []).map((x) => {
    const mine = tasks.filter((k) => k.milestone?.id === x.id);
    return { id: x.id, title: x.title, description: x.description, dueOn: x.due_on, doneAt: x.done_at, tasks: mine.length, tasksDone: mine.filter((k) => k.status === "done").length };
  });
  return { tasks, milestones };
}

/** A plain progress summary (counts, never scores). */
export function progressSummary(tasks: TaskView[], milestones: MilestoneView[]) {
  const by = (s: TaskStatus) => tasks.filter((t) => t.status === s).length;
  const now = today();
  const next = milestones.filter((m) => !m.doneAt).sort((a, b) => (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999"))[0] ?? null;
  return {
    total: tasks.length,
    todo: by("todo"),
    inProgress: by("in_progress"),
    review: by("review"),
    done: by("done"),
    blocked: by("blocked") + tasks.filter((t) => t.status !== "done" && t.status !== "blocked" && t.dependsOn && !t.dependsOn.done).length,
    overdue: tasks.filter((t) => t.overdue).length,
    nextMilestone: next ? { title: next.title, dueOn: next.dueOn, overdue: !!next.dueOn && next.dueOn < now } : null,
  };
}

export async function createTask(db: Db, creatorId: string, projectId: string, raw: unknown) {
  const t = taskSchema.parse(raw);
  const res = await db
    .from("project_tasks")
    .insert({
      project_id: projectId,
      created_by: creatorId,
      title: t.title,
      description: t.description || null,
      due_on: t.dueOn ?? null,
      milestone_id: t.milestoneId ?? null,
      item_id: t.itemId ?? null,
      depends_on: t.dependsOn ?? null,
      needs_approval: t.needsApproval ?? false,
      status: t.status ?? "todo",
    })
    .select("id")
    .single();
  if (res.error?.code === "42501" && !res.error.message.includes("approval")) throw new DomainError("forbidden", "Only the Creative Room's owner and crew can add tasks.");
  if (res.error) throw taskError(res.error);
  const id = res.data.id;
  if (t.assigneeIds?.length) {
    const a = await db.from("project_task_assignees").insert([...new Set(t.assigneeIds)].map((c) => ({ task_id: id, creator_id: c, assigned_by: creatorId })));
    if (a.error) {
      await db.from("project_tasks").delete().eq("id", id);
      throw a.error.code === "42501" ? new DomainError("forbidden", "Only the owner or an admin can assign other people. You can take a task on yourself.") : fromDbError(a.error);
    }
  }
  return id;
}

export async function updateTask(db: Db, taskId: string, raw: unknown) {
  const u = updateTaskSchema.parse(raw);
  const patch: TablesUpdate<"project_tasks"> = {};
  if (u.title !== undefined) patch.title = u.title;
  if (u.description !== undefined) patch.description = u.description || null;
  if (u.dueOn !== undefined) patch.due_on = u.dueOn;
  if (u.milestoneId !== undefined) patch.milestone_id = u.milestoneId;
  if (u.itemId !== undefined) patch.item_id = u.itemId;
  if (u.dependsOn !== undefined) patch.depends_on = u.dependsOn;
  if (u.needsApproval !== undefined) patch.needs_approval = u.needsApproval;
  if (u.status !== undefined) patch.status = u.status;
  if (!Object.keys(patch).length) return;
  const res = await db.from("project_tasks").update(patch).eq("id", taskId).select("id");
  if (res.error) throw taskError(res.error);
  if (!res.data?.length) throw new DomainError("forbidden", "You can change tasks you created or are assigned to (or all of them, as the owner or an admin).");
}

export async function deleteTask(db: Db, taskId: string) {
  const res = await db.from("project_tasks").delete().eq("id", taskId).select("id");
  if (res.error) throw taskError(res.error);
  if (!res.data?.length) throw new DomainError("forbidden", "You can remove tasks you created (or any, as the owner or an admin).");
}

/** Assign someone (the owner/admins), or take a task on yourself. */
export async function assignTask(db: Db, actorId: string, taskId: string, creatorId: string) {
  const res = await db.from("project_task_assignees").upsert({ task_id: taskId, creator_id: creatorId, assigned_by: actorId }, { onConflict: "task_id,creator_id", ignoreDuplicates: true });
  if (res.error?.code === "42501") throw new DomainError("forbidden", creatorId === actorId ? "Only people in the Creative Room can take tasks on." : "Only the owner or an admin can assign other people.");
  if (res.error) throw fromDbError(res.error);
}

export async function unassignTask(db: Db, taskId: string, creatorId: string) {
  const res = await db.from("project_task_assignees").delete().eq("task_id", taskId).eq("creator_id", creatorId).select("task_id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("forbidden", "Only the owner, an admin or the person themselves can change that.");
}

export async function listTaskComments(db: Db, taskId: string) {
  const { data, error } = await db.from("project_task_comments").select("id, body, created_at, creator_id, creators(display_name)").eq("task_id", taskId).order("created_at").limit(200);
  if (error) throw fromDbError(error);
  return (data ?? []).map((c) => ({ id: c.id, body: c.body, at: c.created_at, author: { id: c.creator_id, name: (c.creators as { display_name: string } | null)?.display_name ?? "Someone" } }));
}

export async function addTaskComment(db: Db, creatorId: string, taskId: string, raw: unknown) {
  const { body } = z.object({ body: z.string().trim().min(1, "Write a comment first.").max(2000) }).parse(raw);
  const res = await db.from("project_task_comments").insert({ task_id: taskId, creator_id: creatorId, body }).select("id").single();
  if (res.error?.code === "42501") throw new DomainError("forbidden", "Only people in the Creative Room can comment.");
  return must(res);
}

export async function deleteTaskComment(db: Db, commentId: string) {
  const res = await db.from("project_task_comments").delete().eq("id", commentId).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("forbidden", "You can remove your own comments.");
}

export async function createMilestone(db: Db, creatorId: string, projectId: string, raw: unknown) {
  const m = milestoneSchema.parse(raw);
  const res = await db
    .from("project_milestones")
    .insert({ project_id: projectId, created_by: creatorId, title: m.title, description: m.description || null, due_on: m.dueOn ?? null, done_at: m.done ? new Date().toISOString() : null })
    .select("id")
    .single();
  if (res.error?.code === "42501") throw new DomainError("forbidden", "Only the owner or an admin can plan milestones.");
  return must(res).id;
}

export async function updateMilestone(db: Db, milestoneId: string, raw: unknown) {
  const m = milestoneSchema.partial().parse(raw);
  const patch: TablesUpdate<"project_milestones"> = {};
  if (m.title !== undefined) patch.title = m.title;
  if (m.description !== undefined) patch.description = m.description || null;
  if (m.dueOn !== undefined) patch.due_on = m.dueOn;
  if (m.done !== undefined) patch.done_at = m.done ? new Date().toISOString() : null;
  const res = await db.from("project_milestones").update(patch).eq("id", milestoneId).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("forbidden", "Only the owner or an admin can change milestones.");
}

export async function deleteMilestone(db: Db, milestoneId: string) {
  const res = await db.from("project_milestones").delete().eq("id", milestoneId).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("forbidden", "Only the owner or an admin can remove milestones.");
}

/** Who can hold tasks here (owner and active crew), for assignment pickers. */
export async function projectPeople(db: Db, projectId: string): Promise<Array<{ id: string; name: string }>> {
  const { data: p } = await db.from("projects").select("creator_id, creators(display_name)").eq("id", projectId).maybeSingle();
  if (!p) return [];
  const { data: crew } = await db.from("crews").select("id").eq("project_id", projectId).maybeSingle();
  const members = crew
    ? ((await db.from("crew_members").select("creator_id, creators!crew_members_creator_id_fkey(display_name)").eq("crew_id", crew.id).eq("status", "active")).data ?? [])
    : [];
  const out = new Map<string, string>([[p.creator_id, (p.creators as { display_name: string } | null)?.display_name ?? "Owner"]]);
  for (const m of members) out.set(m.creator_id, (m.creators as { display_name: string } | null)?.display_name ?? "Someone");
  return [...out].map(([id, name]) => ({ id, name }));
}
