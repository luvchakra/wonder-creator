import { deleteMilestone, updateMilestone } from "@wonder/creator-projects";
import { readJson, requireUuid, withApi } from "@/lib/api";

export const PATCH = withApi<{ milestoneId: string }>(async ({ db, req }, { milestoneId }) => {
  await updateMilestone(db, requireUuid(milestoneId, "milestone"), await readJson(req));
  return { ok: true };
});

/** Removes the milestone; its tasks stay. */
export const DELETE = withApi<{ milestoneId: string }>(async ({ db }, { milestoneId }) => {
  await deleteMilestone(db, requireUuid(milestoneId, "milestone"));
  return { ok: true };
});
