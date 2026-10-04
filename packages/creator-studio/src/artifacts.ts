import { createProvenance, type ProvenanceInput } from "@wonder/creator-library";
import { audit, DomainError, fromDbError, must, publishEvent } from "@wonder/core";
import type { Db, Enums, Json, Tables, TablesUpdate } from "@wonder/db";
import { z } from "zod";
import { artifactType, isKnownArtifactType } from "./artifact-types";
import { LOOKS, ORNAMENT_KEYS } from "./creation-pages";
import { outputModeOf } from "./working-set-options";

export type Artifact = Tables<"artifacts">;
export type ArtifactVersion = Tables<"artifact_versions">;
export type LineageRelationship = Enums<"lineage_relationship">;
export type ArtifactStatus = Enums<"artifact_status">;

export interface LineageSource {
  type: "material" | "artifact" | "artifact_version" | "reference" | "conversation" | "huddle" | "collection";
  id: string;
  relationship: LineageRelationship;
}

export interface CreateArtifactInput {
  artifactType: string;
  title: string;
  description?: string | null;
  content: string;
  label?: string;
  authorKind: "creator" | "ai";
  aiRunId?: string | null;
  generationMetadata?: Record<string, unknown>;
  structuredContent?: Record<string, unknown> | null;
  coverMaterialId?: string | null;
  sources?: LineageSource[];
  provenance: ProvenanceInput;
}

export async function createArtifact(db: Db, creatorId: string, input: CreateArtifactInput): Promise<Artifact> {
  const def = artifactType(input.artifactType);
  const provenanceId = await createProvenance(db, creatorId, input.provenance);
  const artifact = must(
    await db
      .from("artifacts")
      .insert({
        creator_id: creatorId,
        artifact_type: def.type,
        category: def.category,
        title: input.title.trim().slice(0, 200) || "Untitled",
        description: input.description?.slice(0, 1000) ?? null,
        provenance_id: provenanceId,
        cover_material_id: input.coverMaterialId ?? null,
      })
      .select("*")
      .single(),
  );
  await createVersion(db, artifact.id, {
    content: input.content,
    label: input.label ?? (input.authorKind === "ai" ? "Initial draft" : "Draft"),
    authorKind: input.authorKind,
    aiRunId: input.aiRunId ?? null,
    generationMetadata: input.generationMetadata,
    structuredContent: input.structuredContent ?? null,
    changeSummary: input.authorKind === "ai" ? "First version, created with CreativeMind." : "First version.",
  });
  for (const s of input.sources ?? []) await addLineage(db, creatorId, s, { type: "artifact", id: artifact.id });

  // Rights foundation: the creator is recorded as sole owner by default (evidence, not legal proof).
  const me = await db.from("creators").select("display_name").eq("id", creatorId).maybeSingle();
  const rights = await db
    .from("rights_records")
    .insert({ artifact_id: artifact.id, creator_id: creatorId, copyright_holder: me.data?.display_name || "Creator" })
    .select("id")
    .single();
  if (rights.error) throw fromDbError(rights.error);
  const owner = await db.from("rights_owners").insert({
    rights_id: rights.data.id,
    creator_id: creatorId,
    owner_creator_id: creatorId,
    owner_name: me.data?.display_name || "Creator",
    share_percent: 100,
  });
  if (owner.error) throw fromDbError(owner.error);

  const derived = (input.sources ?? []).some((s) => s.type === "artifact" && s.relationship !== "references");
  await publishEvent(db, {
    type: derived ? "ArtifactDerived" : "ArtifactCreated",
    aggregate: "artifact",
    aggregateId: artifact.id,
    payload: { artifactType: def.type, authorKind: input.authorKind },
  });
  return (await getArtifact(db, artifact.id)) as Artifact;
}

export interface VersionInput {
  content: string;
  label?: string;
  authorKind: "creator" | "ai" | "restore";
  changeSummary?: string | null;
  aiRunId?: string | null;
  generationMetadata?: Record<string, unknown>;
  structuredContent?: Record<string, unknown> | null;
  restoredFrom?: string | null;
}

/** Every change is a new immutable version; nothing is overwritten. */
export async function createVersion(db: Db, artifactId: string, v: VersionInput): Promise<ArtifactVersion> {
  const { data, error } = await db.rpc("create_artifact_version", {
    p_artifact_id: artifactId,
    p_content: v.content,
    p_label: v.label ?? "Draft",
    p_author_kind: v.authorKind,
    p_change_summary: v.changeSummary ?? undefined,
    p_structured_content: (v.structuredContent ?? undefined) as Json | undefined,
    p_generation_metadata: (v.generationMetadata ?? undefined) as Json | undefined,
    p_ai_run_id: v.aiRunId ?? undefined,
    p_restored_from: v.restoredFrom ?? undefined,
  });
  if (error) throw fromDbError(error);
  return data as ArtifactVersion;
}

export const saveVersionSchema = z.object({
  content: z.string().max(500000),
  label: z.string().trim().max(80).optional(),
  changeSummary: z.string().trim().max(500).optional(),
  baseVersionId: z.string().uuid().optional(),
});

/** Creator edit from the Studio. Rejects stale saves so a newer version is never silently replaced. */
export async function saveCreatorVersion(db: Db, artifactId: string, raw: unknown): Promise<ArtifactVersion> {
  const input = saveVersionSchema.parse(raw);
  const a = await getArtifact(db, artifactId);
  if (input.baseVersionId && a.current_version_id && input.baseVersionId !== a.current_version_id) {
    throw new DomainError("conflict", "A newer version exists. Refresh to see it before saving.");
  }
  if (a.current_version_id) {
    const cur = await db.from("artifact_versions").select("content").eq("id", a.current_version_id).maybeSingle();
    if (cur.data?.content === input.content) throw new DomainError("validation", "There are no changes to save.");
  }
  return createVersion(db, artifactId, {
    content: input.content,
    label: input.label || "Revised",
    authorKind: "creator",
    changeSummary: input.changeSummary || "Edited in the Creative Studio.",
  });
}

export async function restoreVersion(db: Db, artifactId: string, versionId: string): Promise<ArtifactVersion> {
  const v = must(
    await db.from("artifact_versions").select("*").eq("id", versionId).eq("artifact_id", artifactId).maybeSingle(),
    "We couldn't find that version.",
  );
  const created = await createVersion(db, artifactId, {
    content: v.content,
    label: `Restored v${v.version_number}`,
    authorKind: "restore",
    changeSummary: `Restored from v${v.version_number}. Later versions are kept.`,
    structuredContent: (v.structured_content as Record<string, unknown> | null) ?? null,
    restoredFrom: v.id,
  });
  await audit(db, { action: "artifact.restore", objectType: "artifact", objectId: artifactId, metadata: { from: v.version_number } });
  return created;
}

export async function getArtifact(db: Db, id: string): Promise<Artifact> {
  return must(await db.from("artifacts").select("*").eq("id", id).maybeSingle(), "We couldn't find that Creation.");
}

export async function listArtifacts(db: Db, opts: { status?: ArtifactStatus[]; q?: string; limit?: number; creatorId?: string } = {}) {
  let q = db.from("artifacts").select("*").order("updated_at", { ascending: false }).limit(Math.min(opts.limit ?? 60, 200));
  if (opts.status?.length) q = q.in("status", opts.status);
  if (opts.creatorId) q = q.eq("creator_id", opts.creatorId);
  if (opts.q?.trim()) {
    const { toTsQuery } = await import("@wonder/creator-library");
    q = q.textSearch("search", toTsQuery(opts.q), { config: "simple" });
  }
  const { data, error } = await q;
  if (error) throw fromDbError(error);
  return data ?? [];
}

export async function listVersions(db: Db, artifactId: string): Promise<ArtifactVersion[]> {
  const { data, error } = await db.from("artifact_versions").select("*").eq("artifact_id", artifactId).order("version_number", { ascending: false });
  if (error) throw fromDbError(error);
  return data ?? [];
}

export async function getVersion(db: Db, id: string): Promise<ArtifactVersion> {
  return must(await db.from("artifact_versions").select("*").eq("id", id).maybeSingle(), "We couldn't find that version.");
}

export const updateArtifactSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(["draft", "in_review", "final", "archived"]).optional(),
  privacy: z.enum(["public", "creator_private", "shared"]).optional(),
  featuredOnProfile: z.boolean().optional(),
  /** A picture Material of the creator's as the cover, or none. */
  coverMaterialId: z.string().uuid().nullable().optional(),
  /** How the work is set on its page (creation-pages.md). */
  presentation: z.object({ look: z.enum(LOOKS), ornament: z.enum(ORNAMENT_KEYS) }).partial().strict().optional(),
  /** Another kind within the same format (a passage becomes a poem); the words stay as they are. */
  artifactType: z.string().max(40).optional(),
});

export async function updateArtifact(db: Db, id: string, raw: unknown): Promise<Artifact> {
  const input = updateArtifactSchema.parse(raw);
  const patch: TablesUpdate<"artifacts"> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.status !== undefined) patch.status = input.status;
  if (input.privacy !== undefined) patch.privacy = input.privacy;
  if (input.featuredOnProfile !== undefined) patch.featured_on_profile = input.featuredOnProfile;
  if (input.coverMaterialId !== undefined || input.presentation || input.artifactType) {
    const cur = must(await db.from("artifacts").select("artifact_type, presentation").eq("id", id).maybeSingle(), "We couldn't find that Creation.");
    if (input.coverMaterialId) {
      // RLS already insists the Material is the creator's own; a cover must also be a picture.
      const { data: m } = await db.from("creative_materials").select("type, storage_object_id").eq("id", input.coverMaterialId).maybeSingle();
      if (!m || !(m.type === "image" || m.type === "sketch") || !m.storage_object_id) throw new DomainError("validation", "Only a picture can be the cover.");
    }
    if (input.coverMaterialId !== undefined) patch.cover_material_id = input.coverMaterialId;
    if (input.presentation) patch.presentation = { ...((cur.presentation as Record<string, Json> | null) ?? {}), ...input.presentation };
    if (input.artifactType && input.artifactType !== cur.artifact_type) {
      const def = artifactType(input.artifactType);
      if (!isKnownArtifactType(def.type) || outputModeOf(def.type) !== outputModeOf(cur.artifact_type) || outputModeOf(def.type) !== "writing")
        throw new DomainError("validation", "That kind can't be changed here — use Change format.");
      patch.artifact_type = def.type;
      patch.category = def.category;
    }
  }
  const res = await db.from("artifacts").update(patch).eq("id", id).select("*");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "We couldn't find that Creation.");
  if (input.privacy) await audit(db, { action: "artifact.visibility", objectType: "artifact", objectId: id, metadata: { privacy: input.privacy } });
  await publishEvent(db, { type: "ArtifactUpdated", aggregate: "artifact", aggregateId: id, payload: { fields: Object.keys(input) } });
  return res.data[0];
}

export async function deleteArtifact(db: Db, id: string): Promise<void> {
  const res = await db.from("artifacts").delete().eq("id", id).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "We couldn't find that Creation.");
  await audit(db, { action: "artifact.delete", objectType: "artifact", objectId: id });
}

// ---------------------------------------------------------------------------
// Lineage / Creative Graph
// ---------------------------------------------------------------------------
export async function addLineage(
  db: Db,
  creatorId: string,
  source: LineageSource,
  target: { type: "artifact" | "artifact_version" | "material"; id: string },
) {
  const res = await db.from("lineage_edges").upsert(
    {
      creator_id: creatorId,
      source_type: source.type,
      source_id: source.id,
      target_type: target.type,
      target_id: target.id,
      relationship: source.relationship,
    },
    { onConflict: "source_type,source_id,target_type,target_id,relationship", ignoreDuplicates: true },
  );
  if (res.error) throw fromDbError(res.error);
  await publishEvent(db, {
    type: "ArtifactLineageCreated",
    aggregate: "artifact",
    aggregateId: target.type === "artifact" ? target.id : null,
    payload: { sourceType: source.type, relationship: source.relationship },
  });
}

export interface GraphNode {
  key: string;
  type: "material" | "artifact" | "conversation" | "huddle" | "reference" | "artifact_version" | "collection";
  id: string;
  title: string;
  subtitle: string;
  depth: number;
}
export interface GraphEdge {
  from: string;
  to: string;
  relationship: LineageRelationship;
}

/** Walk upstream (what this was made from) and downstream (what was derived from it). */
export async function lineageGraph(db: Db, artifactId: string, maxDepth = 4): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const root = await getArtifact(db, artifactId);
  nodes.set(`artifact:${root.id}`, { key: `artifact:${root.id}`, type: "artifact", id: root.id, title: root.title, subtitle: artifactType(root.artifact_type).label, depth: 0 });

  let frontier = [root.id];
  for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
    const { data, error } = await db.from("lineage_edges").select("*").eq("target_type", "artifact").in("target_id", frontier);
    if (error) throw fromDbError(error);
    const next: string[] = [];
    for (const e of data ?? []) {
      const key = `${e.source_type}:${e.source_id}`;
      edges.push({ from: key, to: `artifact:${e.target_id}`, relationship: e.relationship });
      if (!nodes.has(key)) {
        nodes.set(key, { key, type: e.source_type as GraphNode["type"], id: e.source_id, title: "", subtitle: "", depth: -depth });
        if (e.source_type === "artifact") next.push(e.source_id);
      }
    }
    frontier = next;
  }
  // Downstream derivatives (one level is enough for the view).
  const down = await db.from("lineage_edges").select("*").eq("source_type", "artifact").eq("source_id", root.id).eq("target_type", "artifact");
  if (down.error) throw fromDbError(down.error);
  for (const e of down.data ?? []) {
    const key = `artifact:${e.target_id}`;
    edges.push({ from: `artifact:${root.id}`, to: key, relationship: e.relationship });
    if (!nodes.has(key)) nodes.set(key, { key, type: "artifact", id: e.target_id, title: "", subtitle: "", depth: 1 });
  }

  // Resolve titles (RLS decides what the viewer may see; unreadable nodes stay generic).
  const ids = (t: GraphNode["type"]) => [...nodes.values()].filter((n) => n.type === t).map((n) => n.id);
  const [arts, mats, convs, cols] = await Promise.all([
    ids("artifact").length ? db.from("artifacts").select("id, title, artifact_type").in("id", ids("artifact")) : Promise.resolve({ data: [] as Array<{ id: string; title: string; artifact_type: string }> }),
    ids("material").length ? db.from("creative_materials").select("id, title, type").in("id", ids("material")) : Promise.resolve({ data: [] as Array<{ id: string; title: string | null; type: string }> }),
    ids("conversation").length ? db.from("conversations").select("id, title").in("id", ids("conversation")) : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
    ids("collection").length ? db.from("material_collections").select("id, name").in("id", ids("collection")) : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);
  for (const a of arts.data ?? []) {
    const n = nodes.get(`artifact:${a.id}`);
    if (n) Object.assign(n, { title: a.title, subtitle: artifactType(a.artifact_type).label });
  }
  for (const m of mats.data ?? []) {
    const n = nodes.get(`material:${m.id}`);
    if (n) Object.assign(n, { title: m.title || "Untitled material", subtitle: "Creative Material" });
  }
  for (const c of convs.data ?? []) {
    const n = nodes.get(`conversation:${c.id}`);
    if (n) Object.assign(n, { title: c.title, subtitle: "Conversation" });
  }
  for (const c of cols.data ?? []) {
    const n = nodes.get(`collection:${c.id}`);
    if (n) Object.assign(n, { title: c.name, subtitle: "Collection" });
  }
  for (const n of nodes.values()) {
    if (!n.title) {
      n.title = n.type === "huddle" ? "A Huddle" : n.type === "artifact" ? "A private Creation" : "Private source";
      n.subtitle = n.type === "huddle" ? "Preserved from a Huddle" : n.subtitle || "Not visible to you";
    }
  }
  return { nodes: [...nodes.values()].sort((a, b) => a.depth - b.depth), edges };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Derivatives: what carries over from the source (P0.1-06)
// ---------------------------------------------------------------------------
export interface Inheritance {
  sourceArtifactId: string;
  sourceVersionId: string | null;
  sourceVersionNumber: number | null;
  materials: number;
  contributors: number;
  rights: { ownershipKind: string; attributionRequired: boolean; derivativesAllowed: boolean; owners: string[] } | null;
}

/**
 * A derivative answers: what was I made from, which version, which material contributed, who contributed,
 * and which rights constraints followed me. Called after the derivative exists (with its lineage to the
 * source artifact and version). Material and contributors carry over only from the creator's own work;
 * rights always carry over: ownership and co-owners from the creator's own source, and attribution to the
 * original creator when the source belongs to someone else.
 */
export async function inheritFromSource(
  db: Db,
  creatorId: string,
  derivativeId: string,
  source: { id: string; title: string; creator_id: string },
  version: { id: string; number: number } | null,
): Promise<Inheritance> {
  const own = source.creator_id === creatorId;
  let materials = 0;
  let contributors = 0;

  if (own) {
    // The source's material now also informs the derivative.
    const edges = await db.from("lineage_edges").select("source_id").eq("target_type", "artifact").eq("target_id", source.id).eq("source_type", "material");
    for (const e of edges.data ?? []) {
      await addLineage(db, creatorId, { type: "material", id: e.source_id, relationship: "references" }, { type: "artifact", id: derivativeId });
      materials++;
    }
    const cs = await db.from("artifact_contributors").select("contributor_creator_id, role").eq("artifact_id", source.id);
    if (cs.data?.length) {
      const ins = await db.from("artifact_contributors").upsert(
        cs.data.map((c) => ({ artifact_id: derivativeId, contributor_creator_id: c.contributor_creator_id, role: c.role, added_by_creator_id: creatorId })),
        { onConflict: "artifact_id,contributor_creator_id", ignoreDuplicates: true },
      );
      if (ins.error) throw fromDbError(ins.error);
      contributors = cs.data.length;
    }
  } else {
    const ins = await db.from("artifact_contributors").upsert({ artifact_id: derivativeId, contributor_creator_id: source.creator_id, role: "Original creator", added_by_creator_id: creatorId }, { onConflict: "artifact_id,contributor_creator_id", ignoreDuplicates: true });
    if (ins.error) throw fromDbError(ins.error);
    contributors = 1;
  }

  const src = await db.from("rights_records").select("ownership_kind, copyright_holder, attribution_required, derivatives_allowed, rights_owners(owner_creator_id, owner_name, share_percent)").eq("artifact_id", source.id).maybeSingle();
  const mine = must(await db.from("rights_records").select("id").eq("artifact_id", derivativeId).maybeSingle(), "We couldn't find the rights record.");
  const from = `Derived from “${source.title}”${version ? ` (v${version.number})` : ""}.`;
  let rights: Inheritance["rights"] = null;
  if (src.data && own) {
    const owners = (src.data.rights_owners as Array<{ owner_creator_id: string | null; owner_name: string; share_percent: number }>) ?? [];
    const up = await db
      .from("rights_records")
      .update({
        ownership_kind: src.data.ownership_kind,
        copyright_holder: src.data.copyright_holder,
        attribution_required: src.data.attribution_required,
        derivatives_allowed: src.data.derivatives_allowed,
        notes: `${from} Ownership, co-owners and attribution carry over from the source.`,
      })
      .eq("id", mine.id);
    if (up.error) throw fromDbError(up.error);
    if (owners.length) {
      await db.from("rights_owners").delete().eq("rights_id", mine.id);
      const ins = await db.from("rights_owners").insert(owners.map((o) => ({ rights_id: mine.id, creator_id: creatorId, owner_creator_id: o.owner_creator_id, owner_name: o.owner_name, share_percent: o.share_percent })));
      if (ins.error) throw fromDbError(ins.error);
    }
    rights = { ownershipKind: src.data.ownership_kind, attributionRequired: src.data.attribution_required, derivativesAllowed: src.data.derivatives_allowed, owners: owners.map((o) => o.owner_name) };
  } else {
    // Someone else's work (with their permission): the original creator must be credited.
    const holder = src.data?.copyright_holder ?? "the original creator";
    const up = await db.from("rights_records").update({ attribution_required: true, derivatives_allowed: false, notes: `${from} Adapted from work by ${holder}, who allowed derivatives; credit them when sharing.` }).eq("id", mine.id);
    if (up.error) throw fromDbError(up.error);
    rights = { ownershipKind: "sole", attributionRequired: true, derivativesAllowed: false, owners: [] };
  }
  return { sourceArtifactId: source.id, sourceVersionId: version?.id ?? null, sourceVersionNumber: version?.number ?? null, materials, contributors, rights };
}
