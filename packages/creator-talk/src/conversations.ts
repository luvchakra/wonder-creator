import { DomainError, fromDbError, must, publishEvent } from "@wonder/core";
import type { Db, JsonValue, Tables } from "@wonder/db";

export type Conversation = Tables<"conversations">;
export type Message = Tables<"conversation_messages">;

export async function listConversations(db: Db, limit = 30) {
  const { data, error } = await db.from("conversations").select("*").eq("status", "active").order("updated_at", { ascending: false }).limit(limit);
  if (error) throw fromDbError(error);
  return data ?? [];
}

export async function getConversation(db: Db, id: string) {
  const conversation = must(await db.from("conversations").select("*").eq("id", id).maybeSingle(), "We couldn't find that conversation.");
  const { data, error } = await db
    .from("conversation_messages")
    .select("*, conversation_attachments(material_id, artifact_id)")
    .eq("conversation_id", id)
    .order("created_at");
  if (error) throw fromDbError(error);
  return { conversation, messages: data ?? [] };
}

export function titleFrom(message: string): string {
  const t = message.trim().replace(/\s+/g, " ");
  if (!t) return "New conversation";
  const first = t.split(/(?<=[.!?])\s/)[0];
  return (first.length > 60 ? `${first.slice(0, 57).trimEnd()}…` : first).replace(/[.!?]$/, "");
}

export async function startConversation(db: Db, creatorId: string, firstMessage: string): Promise<Conversation> {
  const c = must(await db.from("conversations").insert({ creator_id: creatorId, title: titleFrom(firstMessage) }).select("*").single());
  await publishEvent(db, { type: "ConversationStarted", aggregate: "conversation", aggregateId: c.id });
  return c;
}

export async function appendMessage(
  db: Db,
  creatorId: string,
  conversationId: string,
  m: {
    role: "creator" | "brain";
    kind?: Message["kind"];
    content: string;
    payload?: Record<string, unknown>;
    inputMode?: "text" | "voice";
    aiRunId?: string | null;
    materialIds?: string[];
    artifactIds?: string[];
  },
): Promise<Message> {
  const msg = must(
    await db
      .from("conversation_messages")
      .insert({
        conversation_id: conversationId,
        creator_id: creatorId,
        role: m.role,
        kind: m.kind ?? "text",
        content: m.content,
        payload: (m.payload ?? {}) as JsonValue,
        input_mode: m.inputMode ?? "text",
        ai_run_id: m.aiRunId ?? null,
      })
      .select("*")
      .single(),
  );
  const attachments = [
    ...(m.materialIds ?? []).map((material_id) => ({ message_id: msg.id, creator_id: creatorId, material_id })),
    ...(m.artifactIds ?? []).map((artifact_id) => ({ message_id: msg.id, creator_id: creatorId, artifact_id })),
  ];
  if (attachments.length) {
    const res = await db.from("conversation_attachments").insert(attachments);
    if (res.error) throw fromDbError(res.error);
  }
  await db.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
  await publishEvent(db, { type: "ConversationMessageCreated", aggregate: "conversation", aggregateId: conversationId, payload: { role: m.role, kind: m.kind ?? "text" } });
  return msg;
}

export async function renameConversation(db: Db, id: string, title: string) {
  const t = title.trim().slice(0, 160);
  if (!t) throw new DomainError("validation", "Give it a name.");
  const res = await db.from("conversations").update({ title: t }).eq("id", id).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "We couldn't find that conversation.");
}

export async function archiveConversation(db: Db, id: string) {
  const res = await db.from("conversations").update({ status: "archived" }).eq("id", id).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "We couldn't find that conversation.");
  await publishEvent(db, { type: "ConversationCompleted", aggregate: "conversation", aggregateId: id });
}
