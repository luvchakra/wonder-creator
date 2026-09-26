import "server-only";
import { selectProvider, semanticMatches, type SemanticMatch } from "@wonder/creator-brain";
import { toTsQuery } from "@wonder/creator-library";
import { liveCards } from "@wonder/creator-huddle";
import type { Db, Enums } from "@wonder/db";

export const SEARCH_TABS = ["all", "material", "creations", "collections", "references", "conversations", "creators", "huddles"] as const;
export type SearchTab = (typeof SEARCH_TABS)[number];

export const SEARCH_WHEN = { any: null, day: 1, week: 7, month: 30, year: 365 } as const;
export type SearchWhen = keyof typeof SEARCH_WHEN;

export const MATERIAL_KINDS: Record<string, Array<Enums<"material_type">>> = {
  images: ["image", "sketch"],
  audio: ["audio", "voice"],
  video: ["video"],
  documents: ["document", "pdf"],
  notes: ["idea", "note", "text", "research", "inspiration"],
  links: ["url", "reference"],
};

export interface SearchInput {
  q: string;
  tab: SearchTab;
  when: SearchWhen;
  kind: string | null;
  tag: string | null;
}

export function parseSearch(p: { get(k: string): string | null }): SearchInput {
  const tab = (SEARCH_TABS as readonly string[]).includes(p.get("type") ?? "") ? (p.get("type") as SearchTab) : "all";
  const when = (Object.keys(SEARCH_WHEN) as string[]).includes(p.get("when") ?? "") ? (p.get("when") as SearchWhen) : "any";
  const kind = p.get("kind") && MATERIAL_KINDS[p.get("kind")!] ? p.get("kind") : null;
  const tag = p.get("tag")?.trim().slice(0, 40) || null;
  return { q: (p.get("q") ?? "").trim().slice(0, 200), tab, when, kind, tag };
}

export interface SearchResults {
  materials: Array<{ id: string; title: string | null; type: string; created_at: string; storage_object_id: string | null; related?: boolean }>;
  artifacts: Array<{ id: string; title: string; artifact_type: string; status: string; creator_id: string; updated_at: string; related?: boolean }>;
  collections: Array<{ id: string; name: string; description: string | null; created_at: string }>;
  references: Array<{ id: string; materialId: string; title: string | null; type: string; shelf: string | null; note: string | null }>;
  conversations: Array<{ id: string; conversationId: string; title: string; snippet: string }>;
  creators: Array<{ id: string; display_name: string; handle: string }>;
  huddles: Array<{ huddleId: string; topic: string | null; participantNames: string[] }>;
}

export const EMPTY_RESULTS: SearchResults = { materials: [], artifacts: [], collections: [], references: [], conversations: [], creators: [], huddles: [] };

/** A search needs a query of 2+ characters, or a tag to browse by. */
export function isSearchable(s: SearchInput): boolean {
  return s.q.length >= 2 || !!s.tag;
}

/**
 * Unified search over what the caller may see. Every query runs through the caller's RLS-scoped client,
 * so other creators' private work never appears, not even in counts. The caller's own material,
 * collections, references and conversations are additionally scoped by creator id. Keyword matches come
 * first; when the provider can embed and no filters narrow the search, the caller's own material and
 * creations that are close in meaning follow (marked `related`).
 */
export async function unifiedSearch(db: Db, creatorId: string, s: SearchInput): Promise<SearchResults> {
  if (!isSearchable(s)) return EMPTY_RESULTS;
  const want = (t: SearchTab) => s.tab === "all" || s.tab === t;
  const limit = s.tab === "all" ? 6 : 40;
  const days = SEARCH_WHEN[s.when];
  const since = days ? new Date(Date.now() - days * 86_400_000).toISOString() : null;
  const hasQ = s.q.length >= 2;
  const ts = hasQ ? toTsQuery(s.q) : "";
  const like = `%${s.q.replace(/[%_\\,()]/g, "")}%`;
  // Tags and material kinds describe material only; other entities drop out when they're set.
  const materialOnly = !!s.tag || !!s.kind;

  const materialQuery = (n: number) => {
    let q = db
      .from("creative_materials")
      .select(s.tag ? "id, title, type, created_at, storage_object_id, creative_material_tags!inner(tag)" : "id, title, type, created_at, storage_object_id")
      .eq("creator_id", creatorId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(n);
    if (hasQ) q = q.textSearch("search", ts, { config: "simple" });
    if (since) q = q.gte("created_at", since);
    if (s.kind) q = q.in("type", MATERIAL_KINDS[s.kind]);
    if (s.tag) q = q.eq("creative_material_tags.tag", s.tag);
    return q.then((r) => (r.data ?? []) as unknown as SearchResults["materials"]);
  };

  const [materials, refMaterials, artifacts, collections, references, conversations, creators, huddles, semantic] = await Promise.all([
    want("material") ? materialQuery(limit) : [],
    // Materials behind reference matches (up to 60), found with the same filters.
    want("references") ? materialQuery(60) : [],
    want("creations") && !materialOnly && hasQ
      ? (() => {
          let q = db.from("artifacts").select("id, title, artifact_type, status, creator_id, updated_at").neq("status", "archived").textSearch("search", ts, { config: "simple" }).order("updated_at", { ascending: false }).limit(limit);
          if (since) q = q.gte("updated_at", since);
          return q.then((r) => r.data ?? []);
        })()
      : [],
    want("collections") && !materialOnly && hasQ
      ? (() => {
          let q = db.from("material_collections").select("id, name, description, created_at").eq("creator_id", creatorId).eq("status", "active").or(`name.ilike.${like},description.ilike.${like}`).limit(limit);
          if (since) q = q.gte("created_at", since);
          return q.then((r) => r.data ?? []);
        })()
      : [],
    want("references") && hasQ
      ? db
          .from("reference_items")
          .select("id, material_id, note, reference_shelves(name), creative_materials!inner(title, type, status)")
          .eq("creator_id", creatorId)
          .ilike("note", like)
          .limit(limit)
          .then((r) => r.data ?? [])
      : [],
    want("conversations") && !materialOnly && hasQ
      ? (() => {
          let q = db.from("conversation_messages").select("id, conversation_id, content, created_at, conversations(title)").eq("creator_id", creatorId).textSearch("search", ts, { config: "simple" }).order("created_at", { ascending: false }).limit(limit);
          if (since) q = q.gte("created_at", since);
          return q.then((r) => r.data ?? []);
        })()
      : [],
    want("creators") && !materialOnly && hasQ
      ? db.from("creators").select("id, display_name, handle").or(`display_name.ilike.${like},handle.ilike.${like}`).not("handle", "is", null).limit(limit).then((r) => (r.data ?? []) as SearchResults["creators"])
      : [],
    want("huddles") && !materialOnly && hasQ && !since ? liveCards(db, { limit: 50 }) : [],
    (want("material") || want("creations")) && hasQ && !since && !materialOnly ? semanticMatches(db, selectProvider(), s.q, { limit: 8 }) : [],
  ]);

  // References: shelf items whose material matched, plus items whose note matched.
  const refIds = refMaterials.map((m) => m.id);
  const refByMaterial = refIds.length
    ? ((await db.from("reference_items").select("id, material_id, note, reference_shelves(name), creative_materials!inner(title, type, status)").eq("creator_id", creatorId).in("material_id", refIds).limit(limit)).data ?? [])
    : [];
  const refs = new Map<string, SearchResults["references"][number]>();
  for (const r of [...refByMaterial, ...(references as typeof refByMaterial)]) {
    const m = r.creative_materials as unknown as { title: string | null; type: string; status: string };
    if (m.status !== "active" || refs.has(r.id)) continue;
    refs.set(r.id, { id: r.id, materialId: r.material_id, title: m.title, type: m.type, shelf: (r.reference_shelves as { name: string } | null)?.name ?? null, note: r.note });
  }

  const related = await relatedRows(db, semantic, { materials: new Set(materials.map((m) => m.id)), artifacts: new Set(artifacts.map((a) => a.id)) });
  const ql = s.q.toLowerCase();
  return {
    materials: want("material") ? [...materials, ...related.materials] : [],
    artifacts: want("creations") ? [...artifacts, ...related.artifacts] : [],
    collections,
    references: [...refs.values()].slice(0, limit),
    conversations: conversations.map((m) => ({ id: m.id, conversationId: m.conversation_id, title: (m.conversations as { title: string } | null)?.title ?? "Conversation", snippet: m.content.slice(0, 140) })),
    creators,
    huddles: huddles.filter((h) => (h.topic ?? "").toLowerCase().includes(ql) || h.participantNames.some((n) => n.toLowerCase().includes(ql))).slice(0, limit),
  };
}

/** Rows for semantic matches not already found by keyword, in similarity order (RLS-scoped). */
async function relatedRows(db: Db, matches: SemanticMatch[], seen: { materials: Set<string>; artifacts: Set<string> }) {
  const materialIds = matches.filter((m) => m.subjectType === "material" && !seen.materials.has(m.subjectId)).map((m) => m.subjectId);
  const artifactIds = matches.filter((m) => m.subjectType === "artifact" && !seen.artifacts.has(m.subjectId)).map((m) => m.subjectId);
  const [mats, arts] = await Promise.all([
    materialIds.length ? db.from("creative_materials").select("id, title, type, created_at, storage_object_id").in("id", materialIds).eq("status", "active").then((r) => r.data ?? []) : [],
    artifactIds.length ? db.from("artifacts").select("id, title, artifact_type, status, creator_id, updated_at").in("id", artifactIds).neq("status", "archived").then((r) => r.data ?? []) : [],
  ]);
  const order = new Map(matches.map((m, i) => [m.subjectId, i]));
  const byOrder = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).map((r) => ({ ...r, related: true as const }));
  return { materials: byOrder(mats).slice(0, 5), artifacts: byOrder(arts).slice(0, 5) };
}

/** The creator's most used material tags, for filter chips. */
export async function topTags(db: Db, creatorId: string, n = 12): Promise<string[]> {
  const { data } = await db.from("creative_material_tags").select("tag").eq("creator_id", creatorId).limit(1000);
  const counts = new Map<string, number>();
  for (const r of data ?? []) counts.set(r.tag, (counts.get(r.tag) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([t]) => t);
}
