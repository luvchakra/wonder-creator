import { withApi } from "@/lib/api";
import { listNotifications, takeNotificationsFromHome } from "@/lib/notifications";

/** Things waiting on the caller (pending approvals, join requests, invitations, failed sends). */
// Read-only and polled on every page, so it allows more requests than the default (still per user). The first read after
// Home rendered takes Home's copy instead of asking the database again; opening the list (`?fresh`) never does.
export const GET = withApi(
  async ({ db, creatorId, req }) => ({
    notifications: await ((req.nextUrl.searchParams.has("fresh") ? null : takeNotificationsFromHome(creatorId)) ?? listNotifications(db, creatorId)),
  }),
  { rateLimit: 300 },
);
