import { assignTask, unassignTask } from "@wonder/creator-projects";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

const body = z.object({ creatorId: z.string().uuid() });

/** Assign someone (the owner and admins) or take a task on yourself. */
export const POST = withApi<{ taskId: string }>(async ({ db, creatorId, req }, { taskId }) => {
  await assignTask(db, creatorId, requireUuid(taskId, "task"), body.parse(await readJson(req)).creatorId);
  return { ok: true };
});

export const DELETE = withApi<{ taskId: string }>(async ({ db, req }, { taskId }) => {
  await unassignTask(db, requireUuid(taskId, "task"), body.parse(await readJson(req)).creatorId);
  return { ok: true };
});
