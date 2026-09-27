import { leaveCrew } from "@wonder/creator-projects";
import { requireUuid, withApi } from "@/lib/api";

/** Leave the crew. What you contributed stays credited to you. */
export const POST = withApi<{ id: string }>(async ({ db }, { id }) => {
  await leaveCrew(db, requireUuid(id, "crew"));
  return { ok: true };
});
