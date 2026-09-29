import { archiveDejaVu, getDejaVu, updateDejaVu } from "@wonder/creator-moments";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** GET / PATCH (rename, describe, archive or bring back) / DELETE (archives — the thread and its links are kept). */
export const GET = withApi<{ id: string }>(async ({ db }, { id }) => ({ dejavu: await getDejaVu(db, requireUuid(id, "DejaVu")) }));
export const PATCH = withApi<{ id: string }>(async ({ db, req }, { id }) => ({ dejavu: await updateDejaVu(db, requireUuid(id, "DejaVu"), await readJson(req)) }));
export const DELETE = withApi<{ id: string }>(async ({ db }, { id }) => ({ dejavu: await archiveDejaVu(db, requireUuid(id, "DejaVu")) }));
