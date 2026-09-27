import { DomainError } from "@wonder/core";
import { deleteProject, getProject, updateProject } from "@wonder/creator-projects";
import { readJson, requireUuid, withApi } from "@/lib/api";

export const GET = withApi<{ id: string }>(async ({ db }, { id }) => getProject(db, requireUuid(id, "Creative Room")));

export const PATCH = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  await updateProject(db, requireUuid(id, "Creative Room"), await readJson(req, 20_000));
  return { ok: true };
});

/** Deletes the project and its links only; the material, pieces and conversations it referenced are kept. */
export const DELETE = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  if (req.nextUrl.searchParams.get("confirm") !== "true") throw new DomainError("validation", "Please confirm before deleting.");
  await deleteProject(db, requireUuid(id, "Creative Room"));
  return { ok: true };
});
