import { withApi } from "@/lib/api";
import { listNotifications } from "@/lib/notifications";

/** Things waiting on the caller (pending approvals, join requests, invitations, failed sends). */
export const GET = withApi(async ({ db, creatorId }) => ({ notifications: await listNotifications(db, creatorId) }));
