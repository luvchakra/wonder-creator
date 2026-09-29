import { dismissSuggestion } from "@wonder/creator-moments";
import { requireUuid, withApi } from "@/lib/api";
import { track } from "@/lib/telemetry";

/** POST …/dismiss — not this one. */
export const POST = withApi<{ id: string; suggestionId: string }>(async ({ db, creatorId }, { id, suggestionId }) => {
  await dismissSuggestion(db, requireUuid(id, "Moment"), requireUuid(suggestionId, "suggestion"));
  track("dejavu_suggestion_dismissed", creatorId);
  return { ok: true };
}, { feature: "moments_enabled" });
