import { inviteToConversation } from "@wonder/creator-community";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** POST `{creatorIds}` — owner adds people to a Limited conversation (only people they may see; never across a block). */
export const POST = withApi<{ id: string }>(
  async ({ db, req }, { id }) => {
    const { creatorIds } = z.object({ creatorIds: z.array(z.string().uuid()).min(1).max(20) }).parse(await readJson(req));
    return { added: await inviteToConversation(db, requireUuid(id, "conversation"), creatorIds) };
  },
  { feature: "open_conversations_enabled", rateLimit: 20 },
);
