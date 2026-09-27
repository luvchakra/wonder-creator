import { withApi } from "@/lib/api";
import { listNotifications } from "@/lib/notifications";

/** Things waiting on the caller (pending approvals, join requests, invitations, failed sends). */
// Read-only and polled on every page, so it allows more requests than the default (still per user).
export const GET = withApi(async ({ db, creatorId }) => ({ notifications: await listNotifications(db, creatorId) }), { rateLimit: 300 });
