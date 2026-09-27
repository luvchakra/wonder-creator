import { addTaskComment, deleteTaskComment, listTaskComments } from "@wonder/creator-projects";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

export const GET = withApi<{ taskId: string }>(async ({ db }, { taskId }) => ({ comments: await listTaskComments(db, requireUuid(taskId, "task")) }));

export const POST = withApi<{ taskId: string }>(async ({ db, creatorId, req }, { taskId }) => ({ comment: await addTaskComment(db, creatorId, requireUuid(taskId, "task"), await readJson(req)) }), { rateLimit: 60 });

/** Remove a comment: your own, or any as the owner or an admin. */
export const DELETE = withApi<{ taskId: string }>(async ({ db, req }, { taskId }) => {
  requireUuid(taskId, "task");
  await deleteTaskComment(db, z.object({ commentId: z.string().uuid() }).parse(await readJson(req)).commentId);
  return { ok: true };
});
