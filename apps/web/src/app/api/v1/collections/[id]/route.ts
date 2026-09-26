import { DomainError } from "@wonder/core";
import { deleteCollection, getCollection, updateCollection } from "@wonder/creator-library";
import { readJson, requireUuid, withApi } from "@/lib/api";

export const GET = withApi<{ id: string }>(async ({ db }, { id }) => getCollection(db, requireUuid(id, "collection")));

export const PATCH = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  await updateCollection(db, requireUuid(id, "collection"), await readJson(req));
  return { ok: true };
});

/** Deletes the collection only; its materials stay in the Creative Space. */
export const DELETE = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  if (req.nextUrl.searchParams.get("confirm") !== "true") throw new DomainError("validation", "Please confirm before deleting.");
  await deleteCollection(db, requireUuid(id, "collection"));
  return { ok: true };
});
