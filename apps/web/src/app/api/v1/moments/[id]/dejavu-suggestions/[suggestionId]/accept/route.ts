import { acceptSuggestion } from "@wonder/creator-moments";
import { requireUuid, withApi } from "@/lib/api";
import { track } from "@/lib/telemetry";

/** POST …/accept — the creator says yes: the suggested DejaVu gets this Moment. */
export const POST = withApi<{ id: string; suggestionId: string }>(async ({ db, creatorId }, { id, suggestionId }) => {
  const dejavu = await acceptSuggestion(db, creatorId, requireUuid(id, "Moment"), requireUuid(suggestionId, "suggestion"));
  track(db, "dejavu_suggestion_accepted", creatorId);
  return { dejavu };
}, { feature: "moments_enabled" });
