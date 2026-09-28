import { DomainError, fromDbError, must } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";
import { artifactType } from "./artifact-types";
import { SOURCE_ROLES, SOURCE_STATES, SOURCE_TYPES, type BringInResult, type SourceRole, type SourceType, type WorkingSetView, type WorkingSource } from "./working-set-options";

export * from "./working-set-options";

/**
 * CreativeStudio Working Set, phase A (docs/ui-redesign/creative-studio-working-set.md §40–48): one StudioSession per
 * creator per Creation, holding references to what they brought in. The owning domains keep their truth — a row is only a
 * pointer plus its Studio state (Available / In use / Pinned) and suggested roles. Visibility is re-checked on every read
 * (a source the creator can no longer open shows as unavailable, with no content), and the database refuses to add
 * anything they can't see. Nothing here creates versions or lineage.
 */

const MATERIAL_KIND: Record<string, string> = {
  idea: "Idea",
  note: "Note",
  text: "Text",
  voice: "Voice note",
  image: "Photo",
  sketch: "Sketch",
  document: "Document",
  pdf: "PDF",
  audio: "Audio",
  video: "Video",
  url: "Link",
  reference: "Reference",
  research: "Research",
  conversation: "Conversation",
  inspiration: "Inspiration",
};

/** Suggested roles from what a source is — deterministic, never about rights or people (§13–14). Creators can change them. */
export function inferRoles(sourceType: SourceType, mediaType: string | null): SourceRole[] {
  if (sourceType === "creation") return ["structure"];
  if (sourceType === "collection") return ["reference"];
  switch (mediaType) {
    case "image":
    case "sketch":
      return ["visual"];
    case "video":
      return ["visual", "sound"];
    case "voice":
      return ["voice", "story"];
    case "audio":
      return ["sound", "mood"];
    case "pdf":
    case "document":
    case "research":
      return ["fact", "reference"];
    case "url":
    case "reference":
      return ["reference"];
    case "inspiration":
      return ["mood"];
    default:
      return ["story"];
  }
}

/** The creator's session for this Creation (made on first open, §44). Opening it never changes anything else. */
export async function openStudioSession(db: Db, creatorId: string, artifactId: string): Promise<{ id: string; outputMode: string; created: boolean }> {
  const existing = await db.from("studio_sessions").select("id, output_mode").eq("creator_id", creatorId).eq("artifact_id", artifactId).maybeSingle();
  if (existing.error) throw fromDbError(existing.error);
  if (existing.data) return { id: existing.data.id, outputMode: existing.data.output_mode, created: false };
  const ins = await db.from("studio_sessions").insert({ creator_id: creatorId, artifact_id: artifactId }).select("id, output_mode").single();
  if (ins.error) {
    // Another tab made it first.
    if (ins.error.code === "23505") return openStudioSession(db, creatorId, artifactId);
    if (ins.error.code === "42501") throw new DomainError("not_found", "Only the Creation's owner can open its Creative Studio.");
    throw fromDbError(ins.error);
  }
  // The Materials already grounding this Creation start In use (§57: what you came from is on the table).
  const { data: edges } = await db.from("lineage_edges").select("source_id").eq("target_type", "artifact").eq("target_id", artifactId).eq("source_type", "material").limit(50);
  if (edges?.length) await addSources(db, creatorId, ins.data.id, edges.map((e) => ({ type: "material" as const, id: e.source_id })), "in_use");
  return { id: ins.data.id, outputMode: ins.data.output_mode, created: true };
}

async function session(db: Db, sessionId: string) {
  return must(await db.from("studio_sessions").select("id, artifact_id, output_mode").eq("id", sessionId).maybeSingle(), "That Studio session isn't available.");
}

/** The Working Set, newest first within each state, resolved through the viewer's own access. */
export async function workingSetView(db: Db, sessionId: string, sign: (objectIds: string[]) => Promise<Record<string, string>> = async () => ({})): Promise<WorkingSetView> {
  const s = await session(db, sessionId);
  const rows = must(await db.from("studio_sources").select("id, source_type, source_id, state, roles, added_at").eq("session_id", sessionId).order("added_at", { ascending: false }).limit(200));
  const ids = (t: SourceType) => rows.filter((r) => r.source_type === t).map((r) => r.source_id);
  const [mats, arts, cols] = await Promise.all([
    ids("material").length ? db.from("creative_materials").select("id, type, title, storage_object_id").in("id", ids("material")) : Promise.resolve({ data: [] as never[] }),
    ids("creation").length ? db.from("artifacts").select("id, title, artifact_type").in("id", ids("creation")) : Promise.resolve({ data: [] as never[] }),
    ids("collection").length ? db.from("material_collections").select("id, name, material_collection_items(count)").in("id", ids("collection")) : Promise.resolve({ data: [] as never[] }),
  ]);
  const matBy = new Map((mats.data ?? []).map((m: { id: string; type: string; title: string | null; storage_object_id: string | null }) => [m.id, m]));
  const artBy = new Map((arts.data ?? []).map((a: { id: string; title: string; artifact_type: string }) => [a.id, a]));
  const colBy = new Map((cols.data ?? []).map((c: { id: string; name: string; material_collection_items: Array<{ count: number }> }) => [c.id, c]));
  const urls = await sign([...matBy.values()].filter((m) => m.type === "image" || m.type === "sketch").map((m) => m.storage_object_id).filter((x): x is string => !!x));
  const sources: WorkingSource[] = rows.map((r) => {
    const base = { id: r.id, sourceType: r.source_type as SourceType, sourceId: r.source_id, state: r.state as WorkingSource["state"], roles: r.roles as SourceRole[], addedAt: r.added_at };
    if (r.source_type === "material") {
      const m = matBy.get(r.source_id);
      if (m) return { ...base, available: true, title: m.title || "Untitled", kind: MATERIAL_KIND[m.type] ?? "Material", mediaType: m.type, href: `/space/materials/${m.id}`, thumbnailUrl: m.storage_object_id ? (urls[m.storage_object_id] ?? null) : null };
    } else if (r.source_type === "creation") {
      const a = artBy.get(r.source_id);
      if (a) return { ...base, available: true, title: a.title, kind: `${artifactType(a.artifact_type).label} · Creation`, mediaType: a.artifact_type, href: `/artifacts/${a.id}`, thumbnailUrl: null };
    } else {
      const c = colBy.get(r.source_id);
      if (c) {
        const n = c.material_collection_items?.[0]?.count ?? 0;
        return { ...base, available: true, title: c.name, kind: `Collection · ${n}`, mediaType: "collection", href: `/space/collections/${c.id}`, thumbnailUrl: null };
      }
    }
    // Access was lost (§70): say so, show nothing of it.
    return { ...base, available: false, title: "This source is no longer available", kind: "Unavailable", mediaType: null, href: null, thumbnailUrl: null };
  });
  return { sessionId: s.id, artifactId: s.artifact_id, outputMode: s.output_mode, sources };
}

export const addSourcesSchema = z.object({
  items: z.array(z.object({ type: z.enum(SOURCE_TYPES), id: z.string().uuid() })).min(1).max(30),
  state: z.enum(SOURCE_STATES).optional(),
});

/** Bring things in. Already-present items are left as they are; the database refuses anything the creator can't see. */
export async function addSources(db: Db, creatorId: string, sessionId: string, items: Array<{ type: SourceType; id: string }>, state: WorkingSource["state"] = "available"): Promise<number> {
  const s = await session(db, sessionId);
  const unique = [...new Map(items.map((i) => [`${i.type}:${i.id}`, i])).values()].filter((i) => !(i.type === "creation" && i.id === s.artifact_id));
  if (!unique.length) return 0;
  const matIds = unique.filter((i) => i.type === "material").map((i) => i.id);
  const { data: mats } = matIds.length ? await db.from("creative_materials").select("id, type").in("id", matIds) : { data: [] };
  const typeOf = new Map((mats ?? []).map((m) => [m.id, m.type as string]));
  const rows = unique.map((i) => ({ session_id: sessionId, creator_id: creatorId, added_by: creatorId, source_type: i.type, source_id: i.id, state, roles: inferRoles(i.type, typeOf.get(i.id) ?? null) }));
  const res = await db.from("studio_sources").upsert(rows, { onConflict: "session_id,source_type,source_id", ignoreDuplicates: true }).select("id");
  if (res.error) {
    if (res.error.code === "42501") throw new DomainError("not_found", "Something you picked isn't available to you.");
    throw fromDbError(res.error);
  }
  return res.data?.length ?? 0;
}

export const updateSourceSchema = z
  .object({
    state: z.enum(SOURCE_STATES).optional(),
    roles: z.array(z.enum(SOURCE_ROLES)).max(4).optional(),
  })
  .refine((v) => v.state !== undefined || v.roles !== undefined, { message: "Nothing to change." });

/** Available ⇄ In use ⇄ Pinned, or correct its roles. Routine: no version, no audit (§47, §73). */
export async function updateSource(db: Db, sourceRowId: string, raw: unknown): Promise<void> {
  const v = updateSourceSchema.parse(raw);
  const res = await db.from("studio_sources").update({ ...(v.state ? { state: v.state } : {}), ...(v.roles ? { roles: v.roles } : {}) }).eq("id", sourceRowId).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "That source isn't in your Working Set.");
}

export async function removeSource(db: Db, sourceRowId: string): Promise<void> {
  const res = await db.from("studio_sources").delete().eq("id", sourceRowId).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "That source isn't in your Working Set.");
}

const likeTerm = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/**
 * "Bring in" search (§10–11): the creator's Materials, other Creations and Collections in one place, grouped, newest
 * first; everything through their own RLS. An empty query shows what's recent.
 */
export async function searchBringIn(db: Db, creatorId: string, sessionId: string, q: string, sign: (objectIds: string[]) => Promise<Record<string, string>> = async () => ({})): Promise<BringInResult[]> {
  const s = await session(db, sessionId);
  const term = q.trim().slice(0, 100);
  let mq = db.from("creative_materials").select("id, type, title, storage_object_id").eq("creator_id", creatorId).order("created_at", { ascending: false }).limit(12);
  let aq = db.from("artifacts").select("id, title, artifact_type").eq("creator_id", creatorId).neq("id", s.artifact_id).neq("status", "archived").order("updated_at", { ascending: false }).limit(8);
  let cq = db.from("material_collections").select("id, name, material_collection_items(count)").eq("creator_id", creatorId).order("created_at", { ascending: false }).limit(6);
  if (term) {
    mq = mq.or(`title.ilike.${likeTerm(term)},text_content.ilike.${likeTerm(term)}`);
    aq = aq.ilike("title", likeTerm(term));
    cq = cq.ilike("name", likeTerm(term));
  }
  const [mats, arts, cols, inSet] = await Promise.all([mq, aq, cq, db.from("studio_sources").select("source_type, source_id").eq("session_id", sessionId)]);
  for (const r of [mats, arts, cols]) if (r.error) throw fromDbError(r.error);
  const present = new Set((inSet.data ?? []).map((r) => `${r.source_type}:${r.source_id}`));
  const urls = await sign((mats.data ?? []).filter((m) => m.type === "image" || m.type === "sketch").map((m) => m.storage_object_id).filter((x): x is string => !!x));
  return [
    ...(mats.data ?? []).map((m) => ({ sourceType: "material" as const, sourceId: m.id, title: m.title || "Untitled", kind: MATERIAL_KIND[m.type] ?? "Material", mediaType: m.type as string, thumbnailUrl: m.storage_object_id ? (urls[m.storage_object_id] ?? null) : null, inSet: present.has(`material:${m.id}`) })),
    ...(arts.data ?? []).map((a) => ({ sourceType: "creation" as const, sourceId: a.id, title: a.title, kind: artifactType(a.artifact_type).label, mediaType: a.artifact_type, thumbnailUrl: null, inSet: present.has(`creation:${a.id}`) })),
    ...(cols.data ?? []).map((c) => ({
      sourceType: "collection" as const,
      sourceId: c.id,
      title: c.name,
      kind: `Collection · ${(c.material_collection_items as unknown as Array<{ count: number }>)?.[0]?.count ?? 0}`,
      mediaType: "collection",
      thumbnailUrl: null,
      inSet: present.has(`collection:${c.id}`),
    })),
  ];
}
