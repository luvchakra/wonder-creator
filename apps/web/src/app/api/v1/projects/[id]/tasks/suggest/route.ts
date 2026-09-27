import { suggestProjectTasks } from "@wonder/creator-brain";
import { DomainError } from "@wonder/core";
import { brainDeps } from "@/lib/brain";
import { requireUuid, withApi } from "@/lib/api";

/** CreatorBrain suggests next tasks (suggestions only: nothing saved, nobody assigned). The owner and admins only. */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, requestId }, { id }) => {
    const projectId = requireUuid(id, "Creative Room");
    const { data: role } = await db.rpc("project_role_of", { p_project: projectId });
    if (role !== "owner" && role !== "admin") throw new DomainError("forbidden", "Only the owner or an admin can ask CreativeMind for tasks.");
    return suggestProjectTasks(await brainDeps(db, creatorId, { correlationId: requestId }), projectId);
  },
  { rateLimit: 10 },
);
