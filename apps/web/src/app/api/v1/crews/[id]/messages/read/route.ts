import { markCrewRead } from "@wonder/creator-projects";
import { requireUuid, withApi } from "@/lib/api";

export const POST = withApi<{ id: string }>(async ({ db, creatorId }, { id }) => {
  await markCrewRead(db, creatorId, requireUuid(id, "crew"));
  return { ok: true };
});
