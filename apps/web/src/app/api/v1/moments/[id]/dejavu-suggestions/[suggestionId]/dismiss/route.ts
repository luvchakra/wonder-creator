import { dismissSuggestion } from "@wonder/creator-moments";
import { requireUuid, withApi } from "@/lib/api";

/** POST …/dismiss — not this one. */
export const POST = withApi<{ id: string; suggestionId: string }>(async ({ db }, { id, suggestionId }) => {
  await dismissSuggestion(db, requireUuid(id, "Moment"), requireUuid(suggestionId, "suggestion"));
  return { ok: true };
});
