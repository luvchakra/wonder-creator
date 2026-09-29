import { deleteConversation, getConversation, updateConversation } from "@wonder/creator-community";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** GET (as the viewer may see it) · PATCH (owner: title, body, intent, visibility) · DELETE (owner). */
export const GET = withApi<{ id: string }>(async ({ db, creatorId }, { id }) => ({ detail: await getConversation(db, creatorId, requireUuid(id, "conversation")) }), { feature: "open_conversations_enabled" });
export const PATCH = withApi<{ id: string }>(async ({ db, req }, { id }) => ({ conversation: await updateConversation(db, requireUuid(id, "conversation"), await readJson(req, 20_000)) }), { feature: "open_conversations_enabled" });
export const DELETE = withApi<{ id: string }>(async ({ db }, { id }) => {
  await deleteConversation(db, requireUuid(id, "conversation"));
  return { ok: true };
}, { feature: "open_conversations_enabled" });
