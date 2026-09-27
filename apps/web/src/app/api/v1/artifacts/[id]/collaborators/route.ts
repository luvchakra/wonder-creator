import { addCollaborator, removeCollaborator, updateCollaborator } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** Add a collaborator ({ creatorId, role, access: comment | propose | edit }). The owner only. */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => {
  await addCollaborator(db, creatorId, requireUuid(id, "piece"), await readJson(req));
  return { ok: true };
});

export const PATCH = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => {
  await updateCollaborator(db, creatorId, requireUuid(id, "piece"), await readJson(req));
  return { ok: true };
});

/** The owner removes a collaborator, or a collaborator leaves. What they wrote stays credited to them. */
export const DELETE = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  await removeCollaborator(db, requireUuid(id, "piece"), z.object({ creatorId: z.string().uuid() }).parse(await readJson(req)).creatorId);
  return { ok: true };
});
