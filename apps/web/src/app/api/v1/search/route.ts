import { selectProvider, semanticMatches, type SemanticMatch } from "@wonder/creator-brain";
import { toTsQuery } from "@wonder/creator-library";
import { liveCards } from "@wonder/creator-huddle";
import type { Db } from "@wonder/db";
import { withApi } from "@/lib/api";

/**
 * Unified search. Every query runs through the caller's RLS-scoped client, so private content
 * of other creators is never searchable. Creators are matched only among visible profiles.
 * Keyword (full-text) matches come first; when the AI provider can embed, the caller's own
 * materials and artifacts that are close in meaning follow (marked `related`).
 */
export const GET = withApi(async ({ db, creatorId, req }) => {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200);
  if (q.length < 2) return { materials: [], artifacts: [], creators: [], conversations: [], huddles: [] };
  const ts = toTsQuery(q);
  const like = `%${q.replace(/[%_\\]/g, "")}%`;
  const [materials, artifacts, creators, messages, huddles, semantic] = await Promise.all([
    db.from("creative_materials").select("id, title, type, created_at").eq("creator_id", creatorId).textSearch("search", ts, { config: "simple" }).limit(10),
    db.from("artifacts").select("id, title, artifact_type, status, creator_id").textSearch("search", ts, { config: "simple" }).limit(10),
    db.from("creators").select("id, display_name, handle, bio").or(`display_name.ilike.${like},handle.ilike.${like}`).not("handle", "is", null).limit(8),
    db.from("conversation_messages").select("id, conversation_id, content, conversations(title)").eq("creator_id", creatorId).textSearch("search", ts, { config: "simple" }).limit(8),
    liveCards(db, { limit: 50 }),
    semanticMatches(db, selectProvider(), q, { limit: 8 }),
  ]);
  const related = await relatedRows(db, semantic, {
    materials: new Set((materials.data ?? []).map((m) => m.id)),
    artifacts: new Set((artifacts.data ?? []).map((a) => a.id)),
  });
  const ql = q.toLowerCase();
  return {
    materials: [...(materials.data ?? []), ...related.materials],
    artifacts: [...(artifacts.data ?? []), ...related.artifacts],
    creators: creators.data ?? [],
    conversations: (messages.data ?? []).map((m) => ({ id: m.id, conversationId: m.conversation_id, title: (m.conversations as { title: string } | null)?.title ?? "Conversation", snippet: m.content.slice(0, 140) })),
    huddles: huddles.filter((h) => (h.topic ?? "").toLowerCase().includes(ql) || h.participantNames.some((n) => n.toLowerCase().includes(ql))).slice(0, 6),
  };
}, { rateLimit: 60 });

/** Rows for semantic matches not already found by keyword, in similarity order (RLS-scoped). */
async function relatedRows(db: Db, matches: SemanticMatch[], seen: { materials: Set<string>; artifacts: Set<string> }) {
  const materialIds = matches.filter((m) => m.subjectType === "material" && !seen.materials.has(m.subjectId)).map((m) => m.subjectId);
  const artifactIds = matches.filter((m) => m.subjectType === "artifact" && !seen.artifacts.has(m.subjectId)).map((m) => m.subjectId);
  const [mats, arts] = await Promise.all([
    materialIds.length ? db.from("creative_materials").select("id, title, type, created_at").in("id", materialIds).eq("status", "active").then((r) => r.data ?? []) : [],
    artifactIds.length ? db.from("artifacts").select("id, title, artifact_type, status, creator_id").in("id", artifactIds).neq("status", "archived").then((r) => r.data ?? []) : [],
  ]);
  const order = new Map(matches.map((m, i) => [m.subjectId, i]));
  const byOrder = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).map((r) => ({ ...r, related: true as const }));
  return { materials: byOrder(mats).slice(0, 5), artifacts: byOrder(arts).slice(0, 5) };
}
