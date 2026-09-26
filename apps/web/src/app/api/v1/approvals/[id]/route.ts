import { getApproval } from "@wonder/creator-brain";
import { requireUuid, withApi } from "@/lib/api";

/** One approval: the exact action and parameters, consequences, rights implications, cost and expiry. */
export const GET = withApi<{ id: string }>(async ({ db }, { id }) => ({ approval: await getApproval(db, requireUuid(id, "approval")) }));
