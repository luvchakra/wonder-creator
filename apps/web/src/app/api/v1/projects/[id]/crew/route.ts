import { startCrew } from "@wonder/creator-projects";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** Start the project's crew (the project's owner only; one per project). */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => ({ crew: await startCrew(db, creatorId, requireUuid(id, "Creative Room"), await readJson(req)) }), { rateLimit: 10 });
