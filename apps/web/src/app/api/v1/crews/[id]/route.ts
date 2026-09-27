import { DomainError } from "@wonder/core";
import { getCrew, updateCrew } from "@wonder/creator-projects";
import { readJson, requireUuid, withApi } from "@/lib/api";

export const GET = withApi<{ id: string }>(async ({ db, creatorId }, { id }) => {
  const crew = await getCrew(db, creatorId, requireUuid(id, "crew"));
  if (!crew) throw new DomainError("not_found", "We couldn't find that crew.");
  return crew;
});

/** Name, purpose and status (owner or admins). */
export const PATCH = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  await updateCrew(db, requireUuid(id, "crew"), await readJson(req));
  return { ok: true };
});
