import { DomainError } from "@wonder/core";
import { deletePost, getPost, updatePostSettings } from "@wonder/creator-library";
import { readJson, requireUuid, withApi } from "@/lib/api";

export const GET = withApi<{ id: string }>(async ({ db, creatorId }, { id }) => {
  const post = await getPost(db, creatorId, requireUuid(id, "post"));
  if (!post) throw new DomainError("not_found", "We couldn't find that post.");
  return post;
});

/** Who can see it and who can reply (the author only). */
export const PATCH = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  await updatePostSettings(db, requireUuid(id, "post"), await readJson(req));
  return { ok: true };
});

export const DELETE = withApi<{ id: string }>(async ({ db }, { id }) => {
  await deletePost(db, requireUuid(id, "post"));
  return { ok: true };
});
