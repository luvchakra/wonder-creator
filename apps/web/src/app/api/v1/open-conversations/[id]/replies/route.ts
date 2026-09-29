import { replyToConversation } from "@wonder/creator-community";
import { checkBudget, readJson, requireUuid, withApi } from "@/lib/api";

/** POST — reply (closed conversations, blocks and Limited access are enforced by the database). Spam-limited. */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    await checkBudget(`community:reply:${creatorId}`, 120);
    return { reply: await replyToConversation(db, creatorId, requireUuid(id, "conversation"), await readJson(req, 10_000)) };
  },
  { rateLimit: 20 },
);
