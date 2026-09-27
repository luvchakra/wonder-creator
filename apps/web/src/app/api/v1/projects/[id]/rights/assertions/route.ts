import { assertOwnership } from "@wonder/creator-projects";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** Record an ownership claim about a piece in the project (people who worked on it). */
export const POST = withApi<{ id: string }>(async ({ db, req }, { id }) => ({ id: await assertOwnership(db, requireUuid(id, "project"), await readJson(req)) }), { rateLimit: 30 });
