import { contributionHistory } from "@wonder/creator-projects";
import { requireUuid, withApi } from "@/lib/api";

export const GET = withApi<{ contributionId: string }>(async ({ db }, { contributionId }) => ({ history: await contributionHistory(db, requireUuid(contributionId, "contribution")) }));
