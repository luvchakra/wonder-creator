import { DomainError, fromDbError, must } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";
import { artifactType } from "./artifact-types";
import { SOURCE_ROLES, SOURCE_STATES, SOURCE_TYPES, OUTPUT_MODES, type BringInResult, type Fragment, type SourceRole, type SourceType, type StudioIntent, type WorkingSetView, type WorkingSource } from "./working-set-options";

export * from "./working-set-options";

/**
 * CreativeStudio Working Set (docs/ui-redesign/creative-studio-working-set.md §40–48): one StudioSession per creator per
 * Creation, holding references to what they brought in — Materials, other Creations, Collections, collaborator comments,
 * Huddle moments, and fragments of any of them — plus the session's autosaved canvas draft and creative intent. The
 * owning domains keep their truth: a row is a pointer, its Studio state (Available / In use / Pinned) and suggested
 * roles. Visibility is re-checked on every read (a source the creator can no longer open shows as unavailable, with no
 * content), and the database refuses to add anything they can't see. Nothing here creates versions or lineage.
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
export function inferRoles(sourceType: SourceType, mediaType: string | null, fragment?: Fragment | null): SourceRole[] {
  if (fragment?.kind === "text_range" && fragment.text) return ["quote"];
  if (sourceType === "creation") return ["structure"];
  if (sourceType === "collection") return ["reference"];
  if (sourceType === "comment") return ["constraint"];
  if (sourceType === "huddle_moment") return ["story"];
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
  const { data: art } = await db.from("artifacts").select("artifact_type").eq("id", artifactId).maybeSingle();
  const outputMode = art ? (OUTPUT_MODES.find((m) => (m.types as readonly string[]).includes(art.artifact_type))?.key ?? "writing") : "writing";
  const ins = await db.from("studio_sessions").insert({ creator_id: creatorId, artifact_id: artifactId, output_mode: outputMode }).select("id, output_mode").single();
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

/** The Studio the creator was last working in (for "Use in Studio" from a Huddle or a comment, §34–35). */
export async function activeStudioSession(db: Db, creatorId: string): Promise<{ id: string; artifactId: string } | null> {
  const { data } = await db.from("studio_sessions").select("id, artifact_id").eq("creator_id", creatorId).eq("status", "active").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  return data ? { id: data.id, artifactId: data.artifact_id } : null;
}

async function session(db: Db, sessionId: string) {
  return must(await db.from("studio_sessions").select("id, artifact_id, output_mode, intent, draft, draft_base_version_id, draft_saved_at").eq("id", sessionId).maybeSingle(), "That Studio session isn't available.");
}

type Sign = (objectIds: string[]) => Promise<Record<string, string>>;

/** The Working Set, newest first within each state, resolved through the viewer's own access. */
export async function workingSetView(db: Db, sessionId: string, sign: Sign = async () => ({})): Promise<WorkingSetView> {
  const s = await session(db, sessionId);
  const rows = must(await db.from("studio_sources").select("id, source_type, source_id, state, roles, fragment, added_at").eq("session_id", sessionId).order("added_at", { ascending: false }).limit(200));
  const ids = (t: SourceType) => [...new Set(rows.filter((r) => r.source_type === t).map((r) => r.source_id))];
  const [mats, arts, cols, comments, moments] = await Promise.all([
    ids("material").length ? db.from("creative_materials").select("id, type, title, storage_object_id, text_content").in("id", ids("material")) : Promise.resolve({ data: [] as never[] }),
    ids("creation").length ? db.from("artifacts").select("id, title, artifact_type").in("id", ids("creation")) : Promise.resolve({ data: [] as never[] }),
    ids("collection").length ? db.from("material_collections").select("id, name, material_collection_items(count)").in("id", ids("collection")) : Promise.resolve({ data: [] as never[] }),
    ids("comment").length ? db.from("artifact_comments").select("id, body, quote, creators!artifact_comments_creator_id_fkey(display_name)").in("id", ids("comment")) : Promise.resolve({ data: [] as never[] }),
    ids("huddle_moment").length ? db.from("huddle_preserved_items").select("id, kind, material_id, artifact_id, creative_materials(title, type, storage_object_id), artifacts(title)").in("id", ids("huddle_moment")) : Promise.resolve({ data: [] as never[] }),
  ]);
  const matBy = new Map((mats.data ?? []).map((m: { id: string; type: string; title: string | null; storage_object_id: string | null; text_content: string | null }) => [m.id, m]));
  const artBy = new Map((arts.data ?? []).map((a: { id: string; title: string; artifact_type: string }) => [a.id, a]));
  const colBy = new Map((cols.data ?? []).map((c: { id: string; name: string; material_collection_items: Array<{ count: number }> }) => [c.id, c]));
  const comBy = new Map((comments.data ?? []).map((c: { id: string; body: string; quote: string | null; creators: { display_name: string } | null }) => [c.id, c]));
  const momBy = new Map((moments.data ?? []).map((h: { id: string; kind: string; material_id: string | null; artifact_id: string | null; creative_materials: { title: string | null; type: string; storage_object_id: string | null } | null; artifacts: { title: string } | null }) => [h.id, h]));
  const thumbs = [...matBy.values()].filter((m) => m.type === "image" || m.type === "sketch").map((m) => m.storage_object_id).concat([...momBy.values()].map((h) => h.creative_materials?.storage_object_id ?? null));
  const urls = await sign(thumbs.filter((x): x is string => !!x));
  const sources: WorkingSource[] = rows.map((r) => {
    const fragment = (r.fragment as Fragment | null) ?? null;
    const base = { id: r.id, sourceType: r.source_type as SourceType, sourceId: r.source_id, state: r.state as WorkingSource["state"], roles: r.roles as SourceRole[], fragment, addedAt: r.added_at };
    const withFragment = (v: WorkingSource): WorkingSource =>
      fragment ? { ...v, title: fragment.text ? `“${fragment.text.length > 90 ? `${fragment.text.slice(0, 88)}…` : fragment.text}”` : v.title, kind: `${fragmentLabel(fragment)} · ${v.kind}` } : v;
    if (r.source_type === "material") {
      const m = matBy.get(r.source_id);
      if (m) return withFragment({ ...base, available: true, title: m.title || "Untitled", kind: MATERIAL_KIND[m.type] ?? "Material", mediaType: m.type, href: `/space/materials/${m.id}`, thumbnailUrl: m.storage_object_id ? (urls[m.storage_object_id] ?? null) : null });
    } else if (r.source_type === "creation") {
      const a = artBy.get(r.source_id);
      if (a) return withFragment({ ...base, available: true, title: a.title, kind: `${artifactType(a.artifact_type).label} · Creation`, mediaType: a.artifact_type, href: `/artifacts/${a.id}`, thumbnailUrl: null });
    } else if (r.source_type === "collection") {
      const c = colBy.get(r.source_id);
      if (c) return { ...base, available: true, title: c.name, kind: `Collection · ${c.material_collection_items?.[0]?.count ?? 0}`, mediaType: "collection", href: `/space/collections/${c.id}`, thumbnailUrl: null };
    } else if (r.source_type === "comment") {
      const c = comBy.get(r.source_id);
      if (c) return { ...base, available: true, title: `“${c.body.length > 90 ? `${c.body.slice(0, 88)}…` : c.body}”`, kind: `Feedback · ${c.creators?.display_name ?? "A collaborator"}`, mediaType: "comment", href: `/artifacts/${s.artifact_id}/collaborate`, thumbnailUrl: null };
    } else {
      const h = momBy.get(r.source_id);
      if (h) {
        const title = h.creative_materials?.title || h.artifacts?.title || "Huddle moment";
        return { ...base, available: true, title, kind: `Huddle moment · ${h.kind === "artifact" ? "Creation" : (MATERIAL_KIND[h.creative_materials?.type ?? ""] ?? "Idea")}`, mediaType: h.creative_materials?.type ?? "huddle", href: h.material_id ? `/space/materials/${h.material_id}` : h.artifact_id ? `/artifacts/${h.artifact_id}` : null, thumbnailUrl: h.creative_materials?.storage_object_id ? (urls[h.creative_materials.storage_object_id] ?? null) : null };
      }
    }
    // Access was lost (§70): say so, show nothing of it.
    return { ...base, fragment: null, available: false, title: "This source is no longer available", kind: "Unavailable", mediaType: null, href: null, thumbnailUrl: null };
  });
  const draft = s.draft != null && s.draft_saved_at ? { text: s.draft, baseVersionId: s.draft_base_version_id, savedAt: s.draft_saved_at } : null;
  return { sessionId: s.id, artifactId: s.artifact_id, outputMode: s.output_mode, intent: (s.intent as StudioIntent) ?? {}, draft, sources };
}

const mm = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
function fragmentLabel(f: Fragment): string {
  if (f.kind === "audio_range" || f.kind === "video_range") return f.start != null && f.end != null ? `${mm(f.start)}–${mm(f.end)}` : "Moment";
  return f.label || (f.kind === "section" ? "Section" : "Passage");
}

const fragmentSchema = z.object({
  kind: z.enum(["text_range", "audio_range", "video_range", "section"]),
  start: z.number().min(0).max(1e7).optional(),
  end: z.number().min(0).max(1e7).optional(),
  label: z.string().trim().max(80).optional(),
  text: z.string().trim().max(1000).optional(),
});

export const addSourcesSchema = z.object({
  items: z.array(z.object({ type: z.enum(SOURCE_TYPES), id: z.string().uuid(), fragment: fragmentSchema.nullish() })).min(1).max(30),
  state: z.enum(SOURCE_STATES).optional(),
});

/** Bring things in (whole sources, or fragments of them). Already-present items are left as they are; the database refuses anything the creator can't see. */
export async function addSources(db: Db, creatorId: string, sessionId: string, items: Array<{ type: SourceType; id: string; fragment?: Fragment | null }>, state: WorkingSource["state"] = "available"): Promise<number> {
  const s = await session(db, sessionId);
  const key = (i: { type: string; id: string; fragment?: Fragment | null }) => `${i.type}:${i.id}:${i.fragment ? JSON.stringify(i.fragment) : ""}`;
  const unique = [...new Map(items.map((i) => [key(i), i])).values()].filter((i) => !(i.type === "creation" && i.id === s.artifact_id));
  if (!unique.length) return 0;
  const matIds = unique.filter((i) => i.type === "material").map((i) => i.id);
  const { data: mats } = matIds.length ? await db.from("creative_materials").select("id, type").in("id", matIds) : { data: [] };
  const typeOf = new Map((mats ?? []).map((m) => [m.id, m.type as string]));
  const rows = unique.map((i) => {
    const f = i.fragment ? fragmentSchema.parse(i.fragment) : null;
    if (f && (f.kind === "audio_range" || f.kind === "video_range") && (f.start == null || f.end == null || f.end <= f.start)) throw new DomainError("validation", "Choose where the moment starts and ends.");
    return { session_id: sessionId, creator_id: creatorId, added_by: creatorId, source_type: i.type, source_id: i.id, state, roles: inferRoles(i.type, typeOf.get(i.id) ?? null, f), fragment: f as never };
  });
  const res = await db.from("studio_sources").upsert(rows, { onConflict: "session_id,source_type,source_id,fragment_key", ignoreDuplicates: true }).select("id");
  if (res.error) {
    if (res.error.code === "42501") throw new DomainError("not_found", "Something you picked isn't available to you.");
    throw fromDbError(res.error);
  }
  await touch(db, sessionId);
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
  const res = await db.from("studio_sources").update({ ...(v.state ? { state: v.state } : {}), ...(v.roles ? { roles: v.roles } : {}) }).eq("id", sourceRowId).select("id, session_id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "That source isn't in your Working Set.");
  await touch(db, res.data[0]!.session_id);
}

/** Several at once — "Use this connection", "Use these two photos" (§18, §29). */
export async function setSourceStates(db: Db, sessionId: string, ids: string[], state: WorkingSource["state"]): Promise<void> {
  if (!ids.length) return;
  const res = await db.from("studio_sources").update({ state }).eq("session_id", sessionId).in("id", ids).select("id");
  if (res.error) throw fromDbError(res.error);
  await touch(db, sessionId);
}

export async function removeSource(db: Db, sourceRowId: string): Promise<void> {
  const res = await db.from("studio_sources").delete().eq("id", sourceRowId).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "That source isn't in your Working Set.");
}

export const sessionPatchSchema = z.object({
  outputMode: z.enum(OUTPUT_MODES.map((m) => m.key) as [string, ...string[]]).optional(),
  intent: z
    .object({
      goal: z.string().trim().max(300).optional(),
      format: z.string().trim().max(60).optional(),
      mood: z.array(z.string().trim().max(40)).max(6).optional(),
      style: z.array(z.string().trim().max(40)).max(6).optional(),
      preserve: z.array(z.string().trim().max(120)).max(10).optional(),
      avoid: z.array(z.string().trim().max(120)).max(10).optional(),
    })
    .optional(),
  /** The canvas draft (autosave, §46); null clears it once a version was made. */
  draft: z.object({ text: z.string().max(500000), baseVersionId: z.string().uuid().nullable() }).nullable().optional(),
});

/** Autosave: output mode, creative intent, the canvas draft. Never a version (§47). */
export async function patchStudioSession(db: Db, sessionId: string, raw: unknown): Promise<void> {
  const v = sessionPatchSchema.parse(raw);
  const patch: { output_mode?: string; intent?: never; draft?: string | null; draft_base_version_id?: string | null; draft_saved_at?: string | null } = {};
  if (v.outputMode) patch.output_mode = v.outputMode;
  if (v.intent) patch.intent = v.intent as never;
  if (v.draft !== undefined) {
    patch.draft = v.draft?.text ?? null;
    patch.draft_base_version_id = v.draft?.baseVersionId ?? null;
    patch.draft_saved_at = v.draft ? new Date().toISOString() : null;
  }
  if (!Object.keys(patch).length) return;
  const res = await db.from("studio_sessions").update(patch).eq("id", sessionId).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "That Studio session isn't available.");
}

async function touch(db: Db, sessionId: string) {
  await db.from("studio_sessions").update({ status: "active" }).eq("id", sessionId);
}

/**
 * Format switching (§24–25): the same ingredients under a new lens. The new Creation (made by Transform, with lineage)
 * gets a Studio session carrying this one's Working Set, states, roles, fragments and intent.
 */
export async function copyWorkingSet(db: Db, creatorId: string, fromSessionId: string, toArtifactId: string): Promise<string> {
  const from = await session(db, fromSessionId);
  const to = await openStudioSession(db, creatorId, toArtifactId);
  // Only what the creator can still open comes along (a lost source stays behind, §70).
  const rows = (await workingSetView(db, fromSessionId)).sources.filter((r) => r.available);
  if (rows.length) {
    const res = await db
      .from("studio_sources")
      .upsert(
        rows.filter((r) => !(r.sourceType === "creation" && r.sourceId === toArtifactId)).map((r) => ({ session_id: to.id, creator_id: creatorId, added_by: creatorId, source_type: r.sourceType, source_id: r.sourceId, state: r.state, roles: r.roles, fragment: r.fragment as never })),
        { onConflict: "session_id,source_type,source_id,fragment_key", ignoreDuplicates: true },
      )
      .select("id");
    if (res.error) throw fromDbError(res.error);
  }
  // The source Creation itself joins the new table, so "Made from" stays honest (§39).
  await addSources(db, creatorId, to.id, [{ type: "creation", id: from.artifact_id }], "in_use");
  await db.from("studio_sessions").update({ intent: from.intent }).eq("id", to.id);
  return to.id;
}

const likeTerm = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/**
 * "Bring in" search (§10–11): the creator's Materials, other Creations, Collections, this Creation's comments and the
 * creator's saved Huddle moments, in one place, grouped, newest first; everything through their own RLS. An empty
 * query shows what's recent.
 */
export async function searchBringIn(db: Db, creatorId: string, sessionId: string, q: string, sign: Sign = async () => ({}), only?: SourceType[]): Promise<BringInResult[]> {
  const s = await session(db, sessionId);
  const term = q.trim().slice(0, 100);
  const want = (t: SourceType) => !only?.length || only.includes(t);
  let mq = db.from("creative_materials").select("id, type, title, storage_object_id").eq("creator_id", creatorId).order("created_at", { ascending: false }).limit(only?.length === 1 ? 40 : 12);
  let aq = db.from("artifacts").select("id, title, artifact_type").eq("creator_id", creatorId).neq("id", s.artifact_id).neq("status", "archived").order("updated_at", { ascending: false }).limit(only?.length === 1 ? 30 : 8);
  let cq = db.from("material_collections").select("id, name, material_collection_items(count)").eq("creator_id", creatorId).order("created_at", { ascending: false }).limit(only?.length === 1 ? 30 : 6);
  let kq = db.from("artifact_comments").select("id, body, quote, created_at, creators!artifact_comments_creator_id_fkey(display_name)").eq("artifact_id", s.artifact_id).is("resolved_at", null).order("created_at", { ascending: false }).limit(only?.length === 1 ? 30 : 6);
  const hq = db.from("huddle_preserved_items").select("id, kind, material_id, artifact_id, created_at, creative_materials(title, type, storage_object_id), artifacts(title)").eq("creator_id", creatorId).order("created_at", { ascending: false }).limit(only?.length === 1 ? 30 : 6);
  if (term) {
    mq = mq.or(`title.ilike.${likeTerm(term)},text_content.ilike.${likeTerm(term)}`);
    aq = aq.ilike("title", likeTerm(term));
    cq = cq.ilike("name", likeTerm(term));
    kq = kq.ilike("body", likeTerm(term));
  }
  const empty = Promise.resolve({ data: [], error: null });
  const [mats, arts, cols, coms, moms, inSet] = await Promise.all([want("material") ? mq : empty, want("creation") ? aq : empty, want("collection") ? cq : empty, want("comment") ? kq : empty, want("huddle_moment") ? hq : empty, db.from("studio_sources").select("source_type, source_id").eq("session_id", sessionId).is("fragment", null)]);
  for (const r of [mats, arts, cols, coms, moms]) if (r.error) throw fromDbError(r.error);
  const present = new Set((inSet.data ?? []).map((r) => `${r.source_type}:${r.source_id}`));
  type M = { id: string; type: string; title: string | null; storage_object_id: string | null };
  type H = { id: string; kind: string; material_id: string | null; artifact_id: string | null; creative_materials: { title: string | null; type: string; storage_object_id: string | null } | null; artifacts: { title: string } | null };
  const momentRows = (moms.data ?? []) as H[];
  const filteredMoments = term ? momentRows.filter((h) => (h.creative_materials?.title ?? h.artifacts?.title ?? "").toLowerCase().includes(term.toLowerCase())) : momentRows;
  const urls = await sign(
    ((mats.data ?? []) as M[])
      .filter((m) => m.type === "image" || m.type === "sketch")
      .map((m) => m.storage_object_id)
      .concat(filteredMoments.map((h) => h.creative_materials?.storage_object_id ?? null))
      .filter((x): x is string => !!x),
  );
  return [
    ...((mats.data ?? []) as M[]).map((m) => ({ sourceType: "material" as const, sourceId: m.id, title: m.title || "Untitled", kind: MATERIAL_KIND[m.type] ?? "Material", mediaType: m.type, thumbnailUrl: m.storage_object_id ? (urls[m.storage_object_id] ?? null) : null, inSet: present.has(`material:${m.id}`) })),
    ...((arts.data ?? []) as Array<{ id: string; title: string; artifact_type: string }>).map((a) => ({ sourceType: "creation" as const, sourceId: a.id, title: a.title, kind: artifactType(a.artifact_type).label, mediaType: a.artifact_type, thumbnailUrl: null, inSet: present.has(`creation:${a.id}`) })),
    ...((cols.data ?? []) as Array<{ id: string; name: string; material_collection_items: Array<{ count: number }> }>).map((c) => ({ sourceType: "collection" as const, sourceId: c.id, title: c.name, kind: `Collection · ${c.material_collection_items?.[0]?.count ?? 0}`, mediaType: "collection", thumbnailUrl: null, inSet: present.has(`collection:${c.id}`) })),
    ...((coms.data ?? []) as Array<{ id: string; body: string; creators: { display_name: string } | null }>).map((c) => ({ sourceType: "comment" as const, sourceId: c.id, title: c.body.length > 90 ? `${c.body.slice(0, 88)}…` : c.body, kind: `Comment · ${c.creators?.display_name ?? "A collaborator"}`, mediaType: "comment", thumbnailUrl: null, inSet: present.has(`comment:${c.id}`) })),
    ...filteredMoments.map((h) => ({ sourceType: "huddle_moment" as const, sourceId: h.id, title: h.creative_materials?.title || h.artifacts?.title || "Huddle moment", kind: `Huddle moment · ${h.kind === "artifact" ? "Creation" : (MATERIAL_KIND[h.creative_materials?.type ?? ""] ?? "Idea")}`, mediaType: h.creative_materials?.type ?? "huddle", thumbnailUrl: h.creative_materials?.storage_object_id ? (urls[h.creative_materials.storage_object_id] ?? null) : null, inSet: present.has(`huddle_moment:${h.id}`) })),
  ];
}

/** What a source holds, for making fragments of it (§21): its words (a note, a transcript) and how long it plays. */
export async function sourceDetail(db: Db, sourceRowId: string): Promise<{ text: string | null; durationSeconds: number | null; mediaType: string | null; audioObjectId: string | null }> {
  const row = must(await db.from("studio_sources").select("source_type, source_id").eq("id", sourceRowId).maybeSingle(), "That source isn't in your Working Set.");
  if (row.source_type === "material" || row.source_type === "huddle_moment") {
    const materialId = row.source_type === "material" ? row.source_id : (await db.from("huddle_preserved_items").select("material_id").eq("id", row.source_id).maybeSingle()).data?.material_id;
    if (!materialId) return { text: null, durationSeconds: null, mediaType: null, audioObjectId: null };
    const m = must(await db.from("creative_materials").select("type, text_content, metadata, storage_object_id").eq("id", materialId).maybeSingle(), "That Material isn't available.");
    const meta = (m.metadata as Record<string, unknown> | null) ?? {};
    const dur = typeof meta.durationSeconds === "number" ? meta.durationSeconds : typeof meta.duration === "number" ? meta.duration : null;
    const playable = m.type === "voice" || m.type === "audio" || m.type === "video";
    return { text: m.text_content, durationSeconds: dur, mediaType: m.type, audioObjectId: playable ? m.storage_object_id : null };
  }
  if (row.source_type === "creation") {
    const a = must(await db.from("artifacts").select("current_version_id, artifact_type").eq("id", row.source_id).maybeSingle(), "That Creation isn't available.");
    const v = a.current_version_id ? (await db.from("artifact_versions").select("content").eq("id", a.current_version_id).maybeSingle()).data : null;
    return { text: v?.content ?? null, durationSeconds: null, mediaType: a.artifact_type, audioObjectId: null };
  }
  if (row.source_type === "comment") {
    const c = must(await db.from("artifact_comments").select("body").eq("id", row.source_id).maybeSingle(), "That comment isn't available.");
    return { text: c.body, durationSeconds: null, mediaType: "comment", audioObjectId: null };
  }
  return { text: null, durationSeconds: null, mediaType: null, audioObjectId: null };
}
