import { deleteTask, updateTask } from "@wonder/creator-projects";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** Edit or move a task (its creator, assignees, or the owner and admins). */
export const PATCH = withApi<{ taskId: string }>(async ({ db, req }, { taskId }) => {
  await updateTask(db, requireUuid(taskId, "task"), await readJson(req, 20_000));
  return { ok: true };
});

export const DELETE = withApi<{ taskId: string }>(async ({ db }, { taskId }) => {
  await deleteTask(db, requireUuid(taskId, "task"));
  return { ok: true };
});
