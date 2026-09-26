import { DomainError, fromDbError, must, publishEvent } from "@wonder/core";
import type { Db, Enums, JsonValue, Tables, TablesInsert, TablesUpdate } from "@wonder/db";
import { z } from "zod";

export type Material = Tables<"creative_materials">;
export type MaterialType = Enums<"material_type">;
export type ProvenanceOrigin = TablesInsert<"provenance_records">["origin"];

export const MATERIAL_BUCKET = "creator-media";

export const MATERIAL_FILTERS = ["all", "ideas", "notes", "images", "audio", "video", "documents", "links", "archived"] as const;
export type MaterialFilter = (typeof MATERIAL_FILTERS)[number];

const FILTER_TYPES: Record<Exclude<MaterialFilter, "all" | "archived">, MaterialType[]> = {
  ideas: ["idea", "inspiration"],
  notes: ["note", "text", "conversation", "research"],
  images: ["image", "sketch"],
  audio: ["audio", "voice"],
  video: ["video"],
  documents: ["document", "pdf"],
  links: ["url", "reference"],
};

export interface ProvenanceInput {
  origin: ProvenanceOrigin;
  sourceUrl?: string | null;
  originalFilename?: string | null;
  sha256?: string | null;
  huddleId?: string | null;
  conversationId?: string | null;
  aiRunId?: string | null;
  details?: Record<string, unknown>;
}

export async function createProvenance(db: Db, creatorId: string, p: ProvenanceInput): Promise<string> {
  const row = must(
    await db
      .from("provenance_records")
      .insert({
        creator_id: creatorId,
        origin: p.origin,
        source_url: p.sourceUrl ?? null,
        original_filename: p.originalFilename ?? null,
        sha256: p.sha256 ?? null,
        huddle_id: p.huddleId ?? null,
        conversation_id: p.conversationId ?? null,
        ai_run_id: p.aiRunId ?? null,
        details: (p.details ?? {}) as JsonValue,
      })
      .select("id")
      .single(),
  );
  return row.id;
}

export interface CreateMaterialInput {
  type: MaterialType;
  title?: string | null;
  textContent?: string | null;
  storageObjectId?: string | null;
  sourceUrl?: string | null;
  sourceType?: string | null;
  metadata?: Record<string, unknown>;
  securityStatus?: Enums<"security_status">;
  processingState?: Enums<"intake_state">;
  provenance: ProvenanceInput;
  tags?: string[];
}

export async function createMaterial(db: Db, creatorId: string, input: CreateMaterialInput): Promise<Material> {
  const provenanceId = await createProvenance(db, creatorId, input.provenance);
  const material = must(
    await db
      .from("creative_materials")
      .insert({
        creator_id: creatorId,
        type: input.type,
        title: input.title?.slice(0, 200) || null,
        text_content: input.textContent ?? null,
        storage_object_id: input.storageObjectId ?? null,
        source_url: input.sourceUrl ?? null,
        source_type: input.sourceType ?? null,
        metadata: (input.metadata ?? {}) as JsonValue,
        provenance_id: provenanceId,
        security_status: input.securityStatus ?? "clean",
        processing_state: input.processingState ?? "ready",
      })
      .select("*")
      .single(),
  );
  if (input.tags?.length) await setMaterialTags(db, creatorId, material.id, input.tags);
  await publishEvent(db, {
    type: "CreativeMaterialCreated",
    aggregate: "material",
    aggregateId: material.id,
    payload: { type: material.type, origin: input.provenance.origin },
  });
  return material;
}

export interface MaterialListItem extends Material {
  tags: string[];
}

export async function listMaterials(
  db: Db,
  opts: { filter?: MaterialFilter; q?: string; limit?: number; ids?: string[] } = {},
): Promise<MaterialListItem[]> {
  let q = db
    .from("creative_materials")
    .select("*, creative_material_tags(tag)")
    .order("created_at", { ascending: false })
    .limit(Math.min(opts.limit ?? 60, 200));
  const filter = opts.filter ?? "all";
  if (filter === "archived") q = q.eq("status", "archived");
  else q = q.eq("status", "active");
  if (filter !== "all" && filter !== "archived") q = q.in("type", FILTER_TYPES[filter]);
  if (opts.ids) q = q.in("id", opts.ids);
  if (opts.q?.trim()) q = q.textSearch("search", toTsQuery(opts.q), { config: "simple" });
  const { data, error } = await q;
  if (error) throw fromDbError(error);
  return (data ?? []).map(({ creative_material_tags, ...m }) => ({
    ...(m as Material),
    tags: (creative_material_tags as Array<{ tag: string }> | null)?.map((t) => t.tag) ?? [],
  }));
}

export async function materialCounts(db: Db): Promise<Record<MaterialFilter, number>> {
  const { data, error } = await db.from("creative_materials").select("type, status");
  if (error) throw fromDbError(error);
  const counts = Object.fromEntries(MATERIAL_FILTERS.map((f) => [f, 0])) as Record<MaterialFilter, number>;
  for (const row of data ?? []) {
    if (row.status === "archived") {
      counts.archived++;
      continue;
    }
    counts.all++;
    for (const [f, types] of Object.entries(FILTER_TYPES)) if (types.includes(row.type)) counts[f as MaterialFilter]++;
  }
  return counts;
}

/** Turn free text into a safe prefix tsquery ("father house" -> "father:* & house:*"). */
export function toTsQuery(q: string): string {
  const terms = q
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
  return terms.length ? terms.map((t) => `${t}:*`).join(" & ") : "''";
}

export async function getMaterial(db: Db, id: string) {
  const m = must(
    await db.from("creative_materials").select("*, creative_material_tags(tag), provenance_records(*)").eq("id", id).maybeSingle(),
    "We couldn't find that material.",
  );
  return m;
}

export const updateMaterialSchema = z.object({
  title: z.string().trim().max(200).optional(),
  textContent: z.string().max(200000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  status: z.enum(["active", "archived"]).optional(),
});

export async function updateMaterial(db: Db, creatorId: string, id: string, raw: unknown): Promise<void> {
  const input = updateMaterialSchema.parse(raw);
  const patch: TablesUpdate<"creative_materials"> = {};
  if (input.title !== undefined) patch.title = input.title || null;
  if (input.textContent !== undefined) patch.text_content = input.textContent;
  if (input.status !== undefined) patch.status = input.status;
  if (Object.keys(patch).length) {
    const res = await db.from("creative_materials").update(patch).eq("id", id).select("id");
    if (res.error) throw fromDbError(res.error);
    if (!res.data?.length) throw new DomainError("not_found", "We couldn't find that material.");
  }
  if (input.tags) await setMaterialTags(db, creatorId, id, input.tags);
  await publishEvent(db, { type: "CreativeMaterialUpdated", aggregate: "material", aggregateId: id, payload: { fields: Object.keys(input) } });
}

export async function setMaterialTags(db: Db, creatorId: string, materialId: string, tags: string[]) {
  const clean = [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, 20);
  const del = await db.from("creative_material_tags").delete().eq("material_id", materialId);
  if (del.error) throw fromDbError(del.error);
  if (clean.length) {
    const ins = await db.from("creative_material_tags").insert(clean.map((tag) => ({ material_id: materialId, creator_id: creatorId, tag })));
    if (ins.error) throw fromDbError(ins.error);
  }
}

/** Permanent delete (a destructive action: the UI confirms and the API requires confirm=true). */
export async function deleteMaterial(db: Db, id: string): Promise<void> {
  const m = must(await db.from("creative_materials").select("id, storage_object_id").eq("id", id).maybeSingle());
  const res = await db.from("creative_materials").delete().eq("id", id);
  if (res.error) throw fromDbError(res.error);
  if (m.storage_object_id) {
    const obj = await db.from("storage_objects").select("bucket, path").eq("id", m.storage_object_id).maybeSingle();
    if (obj.data) {
      await db.storage.from(obj.data.bucket).remove([obj.data.path]);
      await db.from("storage_objects").delete().eq("id", m.storage_object_id);
    }
  }
}

/** Short-lived signed URL for a private object the caller can read (RLS on storage.objects applies). */
export async function signedUrlFor(db: Db, storageObjectId: string, expiresIn = 600): Promise<string | null> {
  const obj = await db.from("storage_objects").select("bucket, path, security_status").eq("id", storageObjectId).maybeSingle();
  if (obj.error) throw fromDbError(obj.error);
  if (!obj.data || obj.data.security_status === "quarantined" || obj.data.security_status === "rejected") return null;
  const { data, error } = await db.storage.from(obj.data.bucket).createSignedUrl(obj.data.path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}

export async function signedUrlsFor(db: Db, ids: Array<string | null | undefined>, expiresIn = 600): Promise<Record<string, string>> {
  const wanted = [...new Set(ids.filter((x): x is string => !!x))];
  if (!wanted.length) return {};
  const objs = await db.from("storage_objects").select("id, bucket, path, security_status").in("id", wanted);
  if (objs.error) throw fromDbError(objs.error);
  const clean = (objs.data ?? []).filter((o) => o.security_status === "clean");
  const out: Record<string, string> = {};
  if (!clean.length) return out;
  const { data } = await db.storage.from(MATERIAL_BUCKET).createSignedUrls(clean.map((o) => o.path), expiresIn);
  for (const o of clean) {
    const hit = data?.find((d) => d.path === o.path);
    if (hit?.signedUrl) out[o.id] = hit.signedUrl;
  }
  return out;
}

/** Display helpers */
export const MATERIAL_TYPE_LABEL: Record<MaterialType, string> = {
  idea: "Idea", note: "Note", text: "Text", voice: "Voice note", image: "Image", sketch: "Sketch",
  document: "Document", pdf: "PDF", audio: "Audio", video: "Video", url: "Link", reference: "Reference",
  research: "Research", conversation: "Conversation", inspiration: "Inspiration",
};
