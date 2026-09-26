import { toTsQuery } from "@wonder/creator-library";
import { liveCards } from "@wonder/creator-huddle";
import { withApi } from "@/lib/api";

/**
 * Unified search. Every query runs through the caller's RLS-scoped client, so private content
 * of other creators is never searchable. Creators are matched only among visible profiles.
 */
export const GET = withApi(async ({ db, creatorId, req }) => {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200);
  if (q.length < 2) return { materials: [], artifacts: [], creators: [], conversations: [], huddles: [] };
  const ts = toTsQuery(q);
  const like = `%${q.replace(/[%_\\]/g, "")}%`;
  const [materials, artifacts, creators, messages, huddles] = await Promise.all([
    db.from("creative_materials").select("id, title, type, created_at").eq("creator_id", creatorId).textSearch("search", ts, { config: "simple" }).limit(10),
    db.from("artifacts").select("id, title, artifact_type, status, creator_id").textSearch("search", ts, { config: "simple" }).limit(10),
    db.from("creators").select("id, display_name, handle, bio").or(`display_name.ilike.${like},handle.ilike.${like}`).not("handle", "is", null).limit(8),
    db.from("conversation_messages").select("id, conversation_id, content, conversations(title)").eq("creator_id", creatorId).textSearch("search", ts, { config: "simple" }).limit(8),
    liveCards(db, { limit: 50 }),
  ]);
  const ql = q.toLowerCase();
  return {
    materials: materials.data ?? [],
    artifacts: artifacts.data ?? [],
    creators: creators.data ?? [],
    conversations: (messages.data ?? []).map((m) => ({ id: m.id, conversationId: m.conversation_id, title: (m.conversations as { title: string } | null)?.title ?? "Conversation", snippet: m.content.slice(0, 140) })),
    huddles: huddles.filter((h) => (h.topic ?? "").toLowerCase().includes(ql) || h.participantNames.some((n) => n.toLowerCase().includes(ql))).slice(0, 6),
  };
}, { rateLimit: 60 });
