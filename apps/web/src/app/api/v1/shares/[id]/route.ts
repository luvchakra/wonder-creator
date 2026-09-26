import { revokeShare } from "@wonder/creator-studio";
import { requireUuid, withApi } from "@/lib/api";

/** Revoke a share: the link or access stops working immediately. */
export const DELETE = withApi<{ id: string }>(async ({ db }, { id }) => ({ share: await revokeShare(db, requireUuid(id, "share")) }));
