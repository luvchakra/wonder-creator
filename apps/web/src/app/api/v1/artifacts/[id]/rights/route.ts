import { getRights, saveRights } from "@wonder/creator-studio";
import { readJson, requireUuid, withApi } from "@/lib/api";

export const GET = withApi<{ id: string }>(async ({ db }, { id }) => ({ rights: await getRights(db, requireUuid(id, "piece")) }));

/** Rights changes are made by the creator directly (CreatorBrain's autonomy for rights is capped). Audited by the database. */
export const PUT = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => {
  await saveRights(db, creatorId, requireUuid(id, "piece"), await readJson(req));
  return { rights: await getRights(db, id) };
});
