import { reopenProject } from "@wonder/creator-projects";
import { requireUuid, withApi } from "@/lib/api";

/** Reopen a completed or archived project (a crew dissolved with it becomes active again). */
export const POST = withApi<{ id: string }>(async ({ db }, { id }) => {
  await reopenProject(db, requireUuid(id, "Creative Room"));
  return { ok: true };
});
