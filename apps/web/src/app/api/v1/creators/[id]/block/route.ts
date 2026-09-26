import { block } from "@wonder/creator-identity";
import { readJson, requireUuid, withApi } from "@/lib/api";

export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => {
  const { on } = (await readJson(req)) as { on?: boolean };
  await block(db, creatorId, requireUuid(id, "creator"), on !== false);
  return { ok: true };
});
