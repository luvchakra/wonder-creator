import { DomainError, fromDbError, must } from "@wonder/core";
import type { Db, TablesInsert, TablesUpdate } from "@wonder/db";
import { z } from "zod";
import { MAX_GOALS, PROJECT_ITEM_KINDS, PROJECT_STATUSES, type ProjectCard, type ProjectItemKind, type ProjectStatus } from "./options";

export * from "./options";

/**
 * Projects (P1-01): a container that references a creator's work — material, references, pieces, collections,
 * conversations and Huddles — without replacing or owning it. Deleting a project, or unlinking something,
 * never deletes the work itself. RLS decides who can read a project and what can be linked.
 */

const goals = z.array(z.string().trim().min(1).max(300)).max(MAX_GOALS);
const budget = z.object({
  enabled: z.boolean(),
  amount: z.number().nonnegative().max(999_999_999_999).nullable().optional(),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Use a three-letter currency code, like INR or USD.")
    .nullable()
    .optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export const projectSchema = z.object({
  title: z.string().trim().min(1, "Give your project a name.").max(120),
  brief: z.string().trim().max(5000).default(""),
  goals: goals.default([]),
  status: z.enum(PROJECT_STATUSES).default("idea"),
});

export const updateProjectSchema = z.object({
  title: z.string().trim().min(1, "Give your project a name.").max(120).optional(),
  brief: z.string().trim().max(5000).optional(),
  goals: goals.optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  coverMaterialId: z.string().uuid().nullable().optional(),
  rightsNote: z.string().trim().max(2000).nullable().optional(),
  budget: budget.optional(),
});

export const linkSchema = z.object({
  kind: z.enum(PROJECT_ITEM_KINDS),
  ids: z.array(z.string().uuid()).min(1, "Choose something to add.").max(50),
});

const COLUMN: Record<ProjectItemKind, "material_id" | "reference_id" | "artifact_id" | "collection_id" | "conversation_id" | "huddle_id"> = {
  material: "material_id",
  reference: "reference_id",
  artifact: "artifact_id",
  collection: "collection_id",
  conversation: "conversation_id",
  huddle: "huddle_id",
};

function emptyCounts(): Record<ProjectItemKind, number> {
  return { material: 0, reference: 0, artifact: 0, collection: 0, conversation: 0, huddle: 0 };
}

/** The creator's projects, most recently touched first. Archived ones only when asked. */
export async function listProjects(db: Db, opts: { status?: ProjectStatus | "open" | "all" } = {}): Promise<ProjectCard[]> {
  let q = db.from("projects").select("id, title, brief, status, updated_at, cover_material_id").order("updated_at", { ascending: false }).limit(200);
  const s = opts.status ?? "open";
  if (s === "open") q = q.neq("status", "archived");
  else if (s !== "all") q = q.eq("status", s);
  const { data, error } = await q;
  if (error) throw fromDbError(error);
  const projects = data ?? [];
  if (!projects.length) return [];
  const ids = projects.map((p) => p.id);
  const { data: items, error: e2 } = await db
    .from("project_items")
    .select("project_id, kind, added_at, creative_materials(type, storage_object_id, status)")
    .in("project_id", ids)
    .order("added_at", { ascending: false })
    .limit(2000);
  if (e2) throw fromDbError(e2);
  const counts = new Map(ids.map((id) => [id, emptyCounts()]));
  const firstImage = new Map<string, string>();
  for (const i of items ?? []) {
    counts.get(i.project_id)![i.kind as ProjectItemKind] += 1;
    const m = i.creative_materials as { type: string; storage_object_id: string | null; status: string } | null;
    if (m?.storage_object_id && (m.type === "image" || m.type === "sketch") && m.status === "active" && !firstImage.has(i.project_id)) firstImage.set(i.project_id, m.storage_object_id);
  }
  const coverIds = projects.map((p) => p.cover_material_id).filter((x): x is string => !!x);
  const coverObject = new Map<string, string>();
  if (coverIds.length) {
    const { data: ms } = await db.from("creative_materials").select("id, storage_object_id").in("id", coverIds);
    for (const m of ms ?? []) if (m.storage_object_id) coverObject.set(m.id, m.storage_object_id);
  }
  return projects.map((p) => ({
    id: p.id,
    title: p.title,
    brief: p.brief,
    status: p.status as ProjectStatus,
    updatedAt: p.updated_at,
    coverObjectId: (p.cover_material_id && coverObject.get(p.cover_material_id)) || firstImage.get(p.id) || null,
    counts: counts.get(p.id)!,
  }));
}

export interface ProjectItemView {
  id: string;
  kind: ProjectItemKind;
  itemId: string;
  title: string;
  /** Short type or status line, e.g. "Image" or "Poem · Final". */
  detail: string | null;
  /** Where to open it, when the viewer can. */
  href: string | null;
  /** False when the linked work is no longer readable (for example, access was withdrawn). */
  available: boolean;
  note: string | null;
  addedAt: string;
  at: string;
  material?: { type: string; title: string | null; text_content: string | null; storage_object_id: string | null; metadata: unknown; source_url: string | null; created_at: string; processing_state: string };
  artifact?: { artifact_type: string; status: string; updated_at: string; cover_material_id: string | null; title: string };
}

type Row = {
  id: string;
  kind: string;
  note: string | null;
  label: string | null;
  added_at: string;
  material_id: string | null;
  reference_id: string | null;
  artifact_id: string | null;
  collection_id: string | null;
  conversation_id: string | null;
  huddle_id: string | null;
  creative_materials: ProjectItemView["material"] & { id: string } | null;
  artifacts: { id: string; title: string; artifact_type: string; status: string; updated_at: string; cover_material_id: string | null } | null;
  reference_items: { id: string; material_id: string; creative_materials: ProjectItemView["material"] | null } | null;
  material_collections: { id: string; name: string; status: string; updated_at: string } | null;
  conversations: { id: string; title: string | null; updated_at: string } | null;
};

export async function getProject(db: Db, id: string) {
  const project = must(await db.from("projects").select("*").eq("id", id).maybeSingle(), "We couldn't find that project.");
  const { data, error } = await db
    .from("project_items")
    .select(
      `id, kind, note, label, added_at, material_id, reference_id, artifact_id, collection_id, conversation_id, huddle_id,
       creative_materials(id, type, title, text_content, storage_object_id, metadata, source_url, created_at, processing_state),
       artifacts(id, title, artifact_type, status, updated_at, cover_material_id),
       reference_items(id, material_id, creative_materials(type, title, text_content, storage_object_id, metadata, source_url, created_at, processing_state)),
       material_collections(id, name, status, updated_at),
       conversations(id, title, updated_at)`,
    )
    .eq("project_id", id)
    .order("position", { ascending: true, nullsFirst: false })
    .order("added_at", { ascending: false })
    .limit(500);
  if (error) throw fromDbError(error);
  const rows = (data ?? []) as unknown as Row[];

  // Huddles: what the viewer's own history says (Huddle content itself is gone once it ends).
  const huddleIds = rows.filter((r) => r.huddle_id).map((r) => r.huddle_id!);
  const history = huddleIds.length ? ((await db.from("huddle_history").select("huddle_id, topic, joined_at, ended_at").in("huddle_id", huddleIds)).data ?? []) : [];
  const hist = new Map(history.map((h) => [h.huddle_id, h]));

  const items: ProjectItemView[] = rows.map((r) => {
    const base = { id: r.id, kind: r.kind as ProjectItemKind, note: r.note, addedAt: r.added_at, at: r.added_at };
    switch (r.kind) {
      case "material": {
        const m = r.creative_materials;
        return { ...base, itemId: r.material_id!, title: m?.title ?? r.label ?? "Untitled", detail: m?.type ?? null, href: m ? `/space/materials/${r.material_id}` : null, available: !!m, at: m?.created_at ?? r.added_at, material: m ?? undefined };
      }
      case "reference": {
        const ref = r.reference_items;
        const m = ref?.creative_materials ?? null;
        return { ...base, itemId: r.reference_id!, title: m?.title ?? "Reference", detail: m?.type ?? null, href: ref ? `/space/materials/${ref.material_id}` : null, available: !!ref, material: m ?? undefined };
      }
      case "artifact": {
        const a = r.artifacts;
        return { ...base, itemId: r.artifact_id!, title: a?.title ?? r.label ?? "Piece", detail: a?.artifact_type ?? null, href: a ? `/artifacts/${r.artifact_id}` : null, available: !!a, at: a?.updated_at ?? r.added_at, artifact: a ?? undefined };
      }
      case "collection": {
        const c = r.material_collections;
        return { ...base, itemId: r.collection_id!, title: c?.name ?? "Collection", detail: c?.status === "archived" ? "Archived" : null, href: c ? `/space/collections/${r.collection_id}` : null, available: !!c, at: c?.updated_at ?? r.added_at };
      }
      case "conversation": {
        const c = r.conversations;
        return { ...base, itemId: r.conversation_id!, title: c?.title ?? "Conversation", detail: null, href: c ? `/create?c=${r.conversation_id}` : null, available: !!c, at: c?.updated_at ?? r.added_at };
      }
      default: {
        const h = hist.get(r.huddle_id!);
        return { ...base, itemId: r.huddle_id!, title: h?.topic ?? r.label ?? "Huddle", detail: h?.ended_at ? "Ended" : h ? "Live" : null, href: h ? `/huddles/${r.huddle_id}/summary` : null, available: !!h, at: h?.joined_at ?? r.added_at };
      }
    }
  });

  return { project, items };
}

export async function createProject(db: Db, creatorId: string, raw: unknown) {
  const p = projectSchema.parse(raw);
  return must(await db.from("projects").insert({ creator_id: creatorId, title: p.title, brief: p.brief, goals: p.goals, status: p.status }).select("*").single());
}

export async function updateProject(db: Db, id: string, raw: unknown) {
  const u = updateProjectSchema.parse(raw);
  const patch: TablesUpdate<"projects"> = {};
  if (u.title !== undefined) patch.title = u.title;
  if (u.brief !== undefined) patch.brief = u.brief;
  if (u.goals !== undefined) patch.goals = u.goals;
  if (u.status !== undefined) patch.status = u.status;
  if (u.rightsNote !== undefined) patch.rights_note = u.rightsNote || null;
  if (u.coverMaterialId !== undefined) patch.cover_material_id = u.coverMaterialId;
  if (u.budget) {
    patch.budget_enabled = u.budget.enabled;
    if (u.budget.amount !== undefined) patch.budget_amount = u.budget.amount;
    if (u.budget.currency !== undefined) patch.budget_currency = u.budget.currency || null;
    if (u.budget.note !== undefined) patch.budget_note = u.budget.note || null;
  }
  if (!Object.keys(patch).length) return;
  const res = await db.from("projects").update(patch).eq("id", id).select("id");
  if (res.error?.code === "42501") throw new DomainError("validation", "The cover has to be one of your own images.");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "We couldn't find that project.");
}

/** Deletes the project and its links. Everything it referenced stays where it is. */
export async function deleteProject(db: Db, id: string) {
  const res = await db.from("projects").delete().eq("id", id).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "We couldn't find that project.");
}

/** Links work to a project. Already-linked items are skipped; returns how many were added. */
export async function linkToProject(db: Db, creatorId: string, projectId: string, raw: unknown): Promise<number> {
  const { kind, ids } = linkSchema.parse(raw);
  const col = COLUMN[kind];
  const unique = [...new Set(ids)];
  const existing = await db.from("project_items").select(col).eq("project_id", projectId).eq("kind", kind).in(col, unique);
  if (existing.error) throw fromDbError(existing.error);
  const have = new Set((existing.data ?? []).map((r) => (r as Record<string, string | null>)[col]));
  const fresh = unique.filter((id) => !have.has(id));
  if (!fresh.length) return 0;
  // A Huddle link keeps only the topic as the creator saw it, from their own history.
  const labels = new Map<string, string | null>();
  if (kind === "huddle") {
    const { data } = await db.from("huddle_history").select("huddle_id, topic").in("huddle_id", fresh);
    for (const h of data ?? []) labels.set(h.huddle_id, h.topic);
  }
  const rows = fresh.map((id) => ({ project_id: projectId, creator_id: creatorId, kind, [col]: id, label: labels.get(id) ?? null }) as TablesInsert<"project_items">);
  const res = await db.from("project_items").insert(rows);
  if (res.error?.code === "42501") throw new DomainError("forbidden", "You can add only your own work (and Huddles you were part of) to your own projects.");
  if (res.error?.code === "23505") throw new DomainError("conflict", "That's already in this project.");
  if (res.error?.code === "23503") throw new DomainError("not_found", "We couldn't find that item.");
  if (res.error) throw fromDbError(res.error);
  return fresh.length;
}

/** Removes the link only; the work itself is kept. */
export async function unlinkFromProject(db: Db, projectId: string, itemId: string) {
  const res = await db.from("project_items").delete().eq("project_id", projectId).eq("id", itemId).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "That's no longer in this project.");
}

export async function setProjectItemNote(db: Db, projectId: string, itemId: string, note: string | null) {
  const clean = z.string().trim().max(500).nullable().parse(note) || null;
  const res = await db.from("project_items").update({ note: clean }).eq("project_id", projectId).eq("id", itemId).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "That's no longer in this project.");
}

/** Which of the creator's projects already contain an item (for "Add to project" pickers). */
export async function projectsWith(db: Db, kind: ProjectItemKind, itemId: string): Promise<string[]> {
  const { data, error } = await db.from("project_items").select("project_id").eq("kind", kind).eq(COLUMN[kind], itemId).limit(200);
  if (error) throw fromDbError(error);
  return (data ?? []).map((r) => r.project_id);
}

/** Conversations that belong to a project: started from it, or linked to it. */
export async function projectConversationIds(db: Db, projectId: string): Promise<string[]> {
  const [started, linked] = await Promise.all([
    db.from("conversations").select("id").eq("project_id", projectId).limit(200),
    db.from("project_items").select("conversation_id").eq("project_id", projectId).eq("kind", "conversation").limit(200),
  ]);
  if (started.error) throw fromDbError(started.error);
  if (linked.error) throw fromDbError(linked.error);
  return [...new Set([...(started.data ?? []).map((c) => c.id), ...(linked.data ?? []).map((c) => c.conversation_id!).filter(Boolean)])];
}

export interface ProjectCandidate {
  id: string;
  title: string;
  detail: string | null;
  at: string;
}

function likeTerm(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** The creator's own work that could be added to a project (not already in it), newest first. */
export async function projectCandidates(db: Db, creatorId: string, projectId: string, kind: ProjectItemKind, q = ""): Promise<ProjectCandidate[]> {
  const term = q.trim().slice(0, 100);
  const limit = 40;
  let out: ProjectCandidate[] = [];
  if (kind === "material") {
    let s = db.from("creative_materials").select("id, title, type, created_at").eq("creator_id", creatorId).eq("status", "active").order("created_at", { ascending: false }).limit(limit);
    if (term) s = s.ilike("title", likeTerm(term));
    const { data, error } = await s;
    if (error) throw fromDbError(error);
    out = (data ?? []).map((m) => ({ id: m.id, title: m.title ?? "Untitled", detail: m.type, at: m.created_at }));
  } else if (kind === "reference") {
    const { data, error } = await db.from("reference_items").select("id, created_at, creative_materials(title, type)").eq("creator_id", creatorId).order("created_at", { ascending: false }).limit(200);
    if (error) throw fromDbError(error);
    out = (data ?? [])
      .map((r) => {
        const m = r.creative_materials as { title: string | null; type: string } | null;
        return { id: r.id, title: m?.title ?? "Reference", detail: m?.type ?? null, at: r.created_at };
      })
      .filter((r) => !term || r.title.toLowerCase().includes(term.toLowerCase()))
      .slice(0, limit);
  } else if (kind === "artifact") {
    let s = db.from("artifacts").select("id, title, artifact_type, updated_at").eq("creator_id", creatorId).neq("status", "archived").order("updated_at", { ascending: false }).limit(limit);
    if (term) s = s.ilike("title", likeTerm(term));
    const { data, error } = await s;
    if (error) throw fromDbError(error);
    out = (data ?? []).map((a) => ({ id: a.id, title: a.title, detail: a.artifact_type, at: a.updated_at }));
  } else if (kind === "collection") {
    let s = db.from("material_collections").select("id, name, status, updated_at").eq("creator_id", creatorId).order("updated_at", { ascending: false }).limit(limit);
    if (term) s = s.ilike("name", likeTerm(term));
    const { data, error } = await s;
    if (error) throw fromDbError(error);
    out = (data ?? []).map((c) => ({ id: c.id, title: c.name, detail: c.status === "archived" ? "Archived" : null, at: c.updated_at }));
  } else if (kind === "conversation") {
    let s = db.from("conversations").select("id, title, updated_at").eq("creator_id", creatorId).order("updated_at", { ascending: false }).limit(limit);
    if (term) s = s.ilike("title", likeTerm(term));
    const { data, error } = await s;
    if (error) throw fromDbError(error);
    out = (data ?? []).map((c) => ({ id: c.id, title: c.title ?? "Conversation", detail: null, at: c.updated_at }));
  } else {
    let s = db.from("huddle_history").select("huddle_id, topic, joined_at, ended_at").eq("creator_id", creatorId).order("joined_at", { ascending: false }).limit(limit);
    if (term) s = s.ilike("topic", likeTerm(term));
    const { data, error } = await s;
    if (error) throw fromDbError(error);
    out = (data ?? []).map((h) => ({ id: h.huddle_id, title: h.topic ?? "Huddle", detail: h.ended_at ? "Ended" : "Live", at: h.joined_at }));
  }
  if (!out.length) return out;
  const col = COLUMN[kind];
  const { data: linked } = await db.from("project_items").select(col).eq("project_id", projectId).eq("kind", kind).in(col, out.map((o) => o.id));
  const have = new Set((linked ?? []).map((r) => (r as Record<string, string | null>)[col]));
  return out.filter((o) => !have.has(o.id));
}
