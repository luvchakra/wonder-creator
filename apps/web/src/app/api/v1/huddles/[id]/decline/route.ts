import { declineInvite } from "@wonder/creator-huddle";
import { requireUuid, withApi } from "@/lib/api";

/** Decline an invitation to a Huddle. */
export const POST = withApi<{ id: string }>(async ({ db }, { id }) => {
  await declineInvite(db, requireUuid(id, "Huddle"));
  return { ok: true };
}, { rateLimit: 20 });
