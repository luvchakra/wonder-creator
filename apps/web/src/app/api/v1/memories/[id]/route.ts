import { editMemory, removeMemory } from "@wonder/creator-brain";
import { readJson, requireUuid, withApi } from "@/lib/api";

export const PATCH = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => {
  await editMemory(db, creatorId, requireUuid(id, "memory"), await readJson(req));
  return { ok: true };
});

export const DELETE = withApi<{ id: string }>(async ({ db, creatorId }, { id }) => {
  await removeMemory(db, creatorId, requireUuid(id, "memory"));
  return { ok: true };
});
