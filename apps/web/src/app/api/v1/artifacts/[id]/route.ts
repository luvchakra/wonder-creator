import { DomainError } from "@wonder/core";
import { deleteArtifact, getArtifact, updateArtifact } from "@wonder/creator-studio";
import { readJson, requireUuid, withApi } from "@/lib/api";

export const GET = withApi<{ id: string }>(async ({ db }, { id }) => ({ artifact: await getArtifact(db, requireUuid(id, "piece")) }));

export const PATCH = withApi<{ id: string }>(async ({ db, req }, { id }) => ({ artifact: await updateArtifact(db, requireUuid(id, "piece"), await readJson(req)) }), { reindex: true });

export const DELETE = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  if (req.nextUrl.searchParams.get("confirm") !== "true") throw new DomainError("validation", "Please confirm before deleting.");
  await deleteArtifact(db, requireUuid(id, "piece"));
  return { ok: true };
});
