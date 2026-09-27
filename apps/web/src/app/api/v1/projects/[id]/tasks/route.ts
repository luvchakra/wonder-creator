import { createTask, listTasks, progressSummary } from "@wonder/creator-projects";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** The project's tasks and milestones, with a plain progress summary (counts only). */
export const GET = withApi<{ id: string }>(async ({ db }, { id }) => {
  const data = await listTasks(db, requireUuid(id, "project"));
  return { ...data, summary: progressSummary(data.tasks, data.milestones) };
});

/** Add a task. The owner and admins can assign anyone in the project; others can only assign themselves. */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => ({ id: await createTask(db, creatorId, requireUuid(id, "project"), await readJson(req, 20_000)) }), { rateLimit: 60 });
