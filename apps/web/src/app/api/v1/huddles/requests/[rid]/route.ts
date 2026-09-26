import { resolveRequest } from "@wonder/creator-huddle";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** Approve/decline — authorized in the database: only a joined participant who isn't the requester. */
export const POST = withApi<{ rid: string }>(async ({ db, req }, { rid }) => {
  const { approve } = z.object({ approve: z.boolean() }).parse(await readJson(req));
  await resolveRequest(db, requireUuid(rid, "request"), approve);
  return { ok: true };
});
