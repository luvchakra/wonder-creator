import { proposeDeliverable } from "@wonder/creator-projects";
import { readJson, withApi } from "@/lib/api";

/** Propose a deliverable for a creator who joined; the other side agrees. */
export const POST = withApi<{ id: string }>(async ({ db, req }, { id }) => ({ id: await proposeDeliverable(db, id, await readJson(req)) }), { rateLimit: 30 });
