import { removeMomentFromDejaVu } from "@wonder/creator-moments";
import { requireUuid, withApi } from "@/lib/api";

/** DELETE — take the Moment off this DejaVu. The Moment and its entity are untouched. */
export const DELETE = withApi<{ id: string; momentId: string }>(async ({ db }, { id, momentId }) => {
  await removeMomentFromDejaVu(db, requireUuid(id, "DejaVu"), requireUuid(momentId, "Moment"));
  return { ok: true };
}, { feature: "dejavu_enabled" });
