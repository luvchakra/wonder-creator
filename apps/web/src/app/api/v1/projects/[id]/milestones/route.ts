import { createMilestone } from "@wonder/creator-projects";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** Add a milestone (the owner and admins). */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => ({ id: await createMilestone(db, creatorId, requireUuid(id, "Creative Room"), await readJson(req)) }));
