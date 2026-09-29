import { createConversation } from "@wonder/creator-community";
import { linkPublicationConversation } from "@wonder/creator-studio";
import { z } from "zod";
import { checkBudget, readJson, requireUuid, withApi } from "@/lib/api";

const schema = z.object({ question: z.string().trim().min(3, "Ask something short.").max(140) });

/**
 * POST /api/v1/artifacts/:id/publication/conversation `{question}` — "Open a conversation about this" (§20): an Open
 * Conversation about the published work, linked from its public page. Never on by default. DELETE unlinks it.
 */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => {
    const artifactId = requireUuid(id, "Creation");
    await checkBudget(`community:start:${creatorId}`, 20);
    const { question } = schema.parse(await readJson(req));
    const conversation = await createConversation(db, creatorId, { title: question, intent: "discuss", visibility: "community", source: { type: "creation", id: artifactId } });
    await linkPublicationConversation(db, artifactId, conversation.id);
    return { conversation };
  },
  { feature: "open_conversations_enabled", rateLimit: 6 },
);

export const DELETE = withApi<{ id: string }>(async ({ db }, { id }) => {
  await linkPublicationConversation(db, requireUuid(id, "Creation"), null);
  return { ok: true };
});
