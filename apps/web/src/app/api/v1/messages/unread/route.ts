import { unreadMessages } from "@wonder/creator-projects";
import { withApi } from "@/lib/api";

/** Crews and conversations with messages you haven't read. */
export const GET = withApi(async ({ db }) => ({ unread: await unreadMessages(db) }), { rateLimit: 300 });
