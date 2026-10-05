import { partMix, setPartMix } from "@wonder/creator-projects";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** The Room's mix (Listen together): where each part's take starts and how loud it is. */
export const GET = withApi<{ id: string }>(async ({ db }, { id }) => partMix(db, requireUuid(id, "Room")));

/** Replace the mix — the people making the work (on a part, or in the crew); the database decides. */
export const PUT = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  await setPartMix(db, requireUuid(id, "Room"), await readJson(req, 10_000));
  return { ok: true };
});
