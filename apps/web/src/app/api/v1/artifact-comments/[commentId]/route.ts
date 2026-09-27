import { deleteArtifactComment, resolveArtifactComment } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** Resolve or reopen (the owner or the comment's author). */
export const PATCH = withApi<{ commentId: string }>(async ({ db, creatorId, req }, { commentId }) => {
  await resolveArtifactComment(db, creatorId, requireUuid(commentId, "comment"), z.object({ resolved: z.boolean() }).parse(await readJson(req)).resolved);
  return { ok: true };
});

export const DELETE = withApi<{ commentId: string }>(async ({ db }, { commentId }) => {
  await deleteArtifactComment(db, requireUuid(commentId, "comment"));
  return { ok: true };
});
