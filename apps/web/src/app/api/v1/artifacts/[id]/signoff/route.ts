import { publicationSignoffs, signOffPublication } from "@wonder/creator-projects";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** Who needs to sign off on publishing the current version, and what they decided. */
export const GET = withApi<{ id: string }>(async ({ db }, { id }) => ({ signoffs: await publicationSignoffs(db, requireUuid(id, "piece")) }));

/** Approve or object to publishing the current version (collaborators who can propose/edit, and co-owners). */
export const POST = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  await signOffPublication(db, requireUuid(id, "piece"), await readJson(req));
  return { ok: true };
});
