import { report } from "@wonder/creator-huddle";
import { readJson, requireUuid, withApi } from "@/lib/api";

export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => {
  await report(db, creatorId, "huddle", requireUuid(id, "Huddle"), await readJson(req));
  return { ok: true };
}, { rateLimit: 10 });
