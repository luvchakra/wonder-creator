import { completeProject, completionReview } from "@wonder/creator-projects";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** The completion checklist: open tasks, pieces, rights, attribution and what's still waiting on someone. */
export const GET = withApi<{ id: string }>(async ({ db, creatorId }, { id }) => completionReview(db, creatorId, requireUuid(id, "project")));

/** Complete or archive the project (optionally dissolving its crew). Needs the typed project name; nothing is deleted. */
export const POST = withApi<{ id: string }>(async ({ db, req }, { id }) => ({ id: await completeProject(db, requireUuid(id, "project"), await readJson(req)) }), { rateLimit: 20 });
