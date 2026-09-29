import { acceptSuggestion } from "@wonder/creator-moments";
import { requireUuid, withApi } from "@/lib/api";

/** POST …/accept — the creator says yes: the suggested DejaVu gets this Moment. */
export const POST = withApi<{ id: string; suggestionId: string }>(async ({ db, creatorId }, { id, suggestionId }) => ({
  dejavu: await acceptSuggestion(db, creatorId, requireUuid(id, "Moment"), requireUuid(suggestionId, "suggestion")),
}));
