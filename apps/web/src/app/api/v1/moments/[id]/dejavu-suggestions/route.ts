import { listSuggestions } from "@wonder/creator-moments";
import { requireUuid, withApi } from "@/lib/api";

/** GET /api/v1/moments/:id/dejavu-suggestions — CreativeMind's pending suggestions (never attached on their own). */
export const GET = withApi<{ id: string }>(async ({ db }, { id }) => ({ suggestions: await listSuggestions(db, requireUuid(id, "Moment")) }));
