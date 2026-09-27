import { getProjectRights, saveRightsPolicy } from "@wonder/creator-projects";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** The project's rights policy, per-piece rights summary, ownership claims and rights history. */
export const GET = withApi<{ id: string }>(async ({ db, creatorId }, { id }) => getProjectRights(db, creatorId, requireUuid(id, "Creative Room")));

/** Set the rights policy (the project's owner). */
export const PUT = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => {
  await saveRightsPolicy(db, creatorId, requireUuid(id, "Creative Room"), await readJson(req));
  return { ok: true };
});
