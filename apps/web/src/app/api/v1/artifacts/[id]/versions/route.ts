import { listVersions, saveCreatorVersion } from "@wonder/creator-studio";
import { readJson, requireUuid, withApi } from "@/lib/api";

export const GET = withApi<{ id: string }>(async ({ db }, { id }) => ({ versions: await listVersions(db, requireUuid(id, "Creation")) }));

/** Creator edit → new immutable version (stale saves are rejected, never overwrite). */
export const POST = withApi<{ id: string }>(async ({ db, req }, { id }) => ({ version: await saveCreatorVersion(db, requireUuid(id, "Creation"), await readJson(req, 600_000)) }), { reindex: true });
