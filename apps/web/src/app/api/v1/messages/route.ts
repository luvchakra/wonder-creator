import { listThreads, openDirectThread } from "@wonder/creator-projects";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";

/** Your direct conversations, newest first, with unread counts. */
export const GET = withApi(async ({ db, creatorId }) => ({ threads: await listThreads(db, creatorId) }));

/** Open (or find) the conversation with another creator. */
export const POST = withApi(
  async ({ db, req }) => ({ threadId: await openDirectThread(db, z.object({ creatorId: z.string().uuid() }).parse(await readJson(req)).creatorId) }),
  { rateLimit: 30 },
);
