import { listConversations } from "@wonder/creator-talk";
import { withApi } from "@/lib/api";

export const GET = withApi(async ({ db }) => ({ conversations: await listConversations(db, 40) }));
