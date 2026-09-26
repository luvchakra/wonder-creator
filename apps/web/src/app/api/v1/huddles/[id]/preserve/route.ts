import { preserve } from "@wonder/creator-huddle";
import { readJson, requireUuid, withApi } from "@/lib/api";

export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => ({ material: await preserve(db, creatorId, requireUuid(id, "Huddle"), await readJson(req, 50_000)) }));
