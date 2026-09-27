import { getThread, sendDirectMessage } from "@wonder/creator-projects";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** Messages in a conversation, newest last (`before` pages back). */
export const GET = withApi<{ threadId: string }>(async ({ db, creatorId, req }, { threadId }) =>
  getThread(db, creatorId, requireUuid(threadId, "conversation"), { before: req.nextUrl.searchParams.get("before") ?? undefined }),
);

/** Send a message (optionally about a project or piece you can both open). */
export const POST = withApi<{ threadId: string }>(async ({ db, creatorId, req }, { threadId }) => ({ id: await sendDirectMessage(db, creatorId, requireUuid(threadId, "conversation"), await readJson(req)) }), { rateLimit: 60 });
