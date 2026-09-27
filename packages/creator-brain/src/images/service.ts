import { audit, DomainError, log } from "@wonder/core";
import { inspectUpload } from "@wonder/core/server";
import type { Db } from "@wonder/db";
import { buildImagePrompt, contextHash, directionsFor, hasMeaningfulContext, IMAGE_SYSTEM, PROMPT_VERSION, type ImageGenerationContext } from "./context";
import { defaultQualityFor, resolveImageModel, ROUTING_VERSION } from "./router";
import type { AspectRatio, ImageProvider, ImagePurpose, ImageQualityIntent, ImageReference } from "./types";

/**
 * Cache-first contextual image generation (docs/image-generation.md §12–26). The creator's RLS client reads context and
 * checks access; the service client writes pipeline state (generations, assets, storage) scoped by the server-resolved
 * creator id. The same meaningful context returns the same stored generation; only "Regenerate" makes a new one.
 */

export const GENERATED_BUCKET = "creator-media";
const REFERENCE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_REFERENCES = 3;
const MAX_MATERIALS = 4;
const FAILED_TTL_MS = 10 * 60_000;

export interface ImageDeps {
  db: Db;
  service: Db;
  creatorId: string;
  provider: ImageProvider;
  /** Master + thumbnail derivatives (WebP), done where an image library is available (the app). */
  derive: (bytes: Uint8Array) => Promise<{ master: Uint8Array; thumbnail: Uint8Array; width: number; height: number }>;
}

export interface ImageGenerationRequest {
  artifactId?: string | null;
  materialIds?: string[];
  purpose: ImagePurpose;
  aspectRatio?: AspectRatio;
  qualityIntent?: ImageQualityIntent;
  count?: number;
  idempotencyKey?: string | null;
  /** Return a stored generation for this context if there is one; never start a new one. */
  lookupOnly?: boolean;
}

type GenerationRow = { id: string; status: string; context_hash: string; variation: number; created_at: string; creator_id: string; artifact_id: string | null; material_id: string | null };

/** The minimised context (§8): this Creation and its few Materials, or the chosen Materials — never account history. */
export async function buildImageGenerationContext(db: Db, creatorId: string, req: Pick<ImageGenerationRequest, "artifactId" | "materialIds">) {
  const context: ImageGenerationContext = {};
  let sourceVersion: number | null = null;
  let materialIds = [...new Set(req.materialIds ?? [])].slice(0, MAX_MATERIALS);
  if (req.artifactId) {
    // Only the owner generates from a Creation (collaborators see the shared result, §34).
    const { data: a } = await db.from("artifacts").select("id, title, artifact_type, status, description, current_version_id").eq("id", req.artifactId).eq("creator_id", creatorId).maybeSingle();
    if (!a) throw new DomainError("not_found", "That Creation isn't available.");
    const { data: v } = a.current_version_id ? await db.from("artifact_versions").select("version_number, content").eq("id", a.current_version_id).maybeSingle() : { data: null };
    sourceVersion = v?.version_number ?? null;
    context.creation = { id: a.id, title: a.title, type: a.artifact_type, version: sourceVersion, summary: v?.content?.slice(0, 500) ?? null, description: a.description, lifecycle: a.status };
    if (!materialIds.length) {
      const { data: edges } = await db.from("lineage_edges").select("source_id").eq("target_type", "artifact").eq("target_id", a.id).eq("source_type", "material").limit(MAX_MATERIALS);
      materialIds = (edges ?? []).map((e) => e.source_id);
    }
  }
  const references: Array<{ materialId: string; storageObjectId: string }> = [];
  if (materialIds.length) {
    // Only the creator's own Materials (§38): never someone else's, even if shared with them.
    const { data: mats } = await db.from("creative_materials").select("id, type, title, understanding, updated_at, storage_object_id, creator_id").in("id", materialIds).eq("creator_id", creatorId);
    const objs = (mats ?? []).map((m) => m.storage_object_id).filter((x): x is string => !!x);
    const { data: clean } = objs.length ? await db.from("storage_objects").select("id, mime_type, size_bytes, security_status").in("id", objs) : { data: [] };
    const usable = new Set((clean ?? []).filter((o) => o.security_status === "clean" && REFERENCE_TYPES.has(o.mime_type) && o.size_bytes <= 5 * 1024 * 1024).map((o) => o.id));
    const moods = new Set<string>();
    const themes = new Set<string>();
    context.materials = (mats ?? []).map((m) => {
      const u = (m.understanding ?? {}) as { summary?: string; themes?: string[]; moods?: string[] };
      (u.themes ?? []).slice(0, 3).forEach((t) => themes.add(t));
      (u.moods ?? []).slice(0, 3).forEach((t) => moods.add(t));
      const ref = !!m.storage_object_id && usable.has(m.storage_object_id) && (m.type === "image" || m.type === "sketch") && references.length < MAX_REFERENCES;
      if (ref) references.push({ materialId: m.id, storageObjectId: m.storage_object_id! });
      return { id: m.id, type: m.type, title: m.title, summary: u.summary?.slice(0, 400) ?? null, updatedAt: m.updated_at, hasReference: ref };
    });
    if (moods.size || themes.size) context.creativeIntent = { mood: [...moods].slice(0, 5), themes: [...themes].slice(0, 5) };
    if (!context.materials.length && req.materialIds?.length && !req.artifactId) throw new DomainError("not_found", "Those Materials aren't available.");
  }
  return { context, references, sourceVersion, materialIds: (context.materials ?? []).map((m) => m.id) };
}

export interface GenerationView {
  id: string;
  status: "queued" | "processing" | "complete" | "partial" | "failed" | "cancelled";
  cached: boolean;
  purpose: string;
  qualityIntent: string;
  aspectRatio: string;
  requestedCount: number;
  createdAt: string;
  assets: Array<{ id: string; sequence: number; imageUrl: string | null; thumbnailUrl: string | null; width: number | null; height: number | null; directionLabel: string | null; rationale: string | null; selected: boolean; savedMaterialId: string | null }>;
}

/** A generation and its images, with short-lived signed URLs (§45). Null when the caller can't see it. */
export async function generationView(db: Db, service: Db, generationId: string, cached = false): Promise<GenerationView | null> {
  const { data: g } = await db.from("image_generations").select("id, status, purpose, quality_intent, aspect_ratio, requested_count, created_at").eq("id", generationId).maybeSingle();
  if (!g) return null;
  const { data: assets, error: assetsError } = await db.from("image_generation_assets").select("id, sequence, storage_object_id, thumbnail_object_id, width, height, direction_label, rationale, selected, saved_material_id").eq("generation_id", generationId).order("sequence");
  // A read failure must surface as an error, never as "no images" (which the UI would show as a failed generation).
  if (assetsError) throw new DomainError("internal", "Couldn't load these images. Please try again.", { cause: assetsError });
  // Access was just checked under RLS; the objects belong to the generation's creator, so sign with the service client.
  const ids = (assets ?? []).flatMap((a) => [a.storage_object_id, a.thumbnail_object_id]).filter((x): x is string => !!x);
  const { data: objs } = ids.length ? await service.from("storage_objects").select("id, bucket, path").in("id", ids) : { data: [] };
  const urls = new Map<string, string>();
  for (const o of objs ?? []) {
    const s = await service.storage.from(o.bucket).createSignedUrl(o.path, 900);
    if (s.data?.signedUrl) urls.set(o.id, s.data.signedUrl);
  }
  return {
    id: g.id,
    status: g.status as GenerationView["status"],
    cached,
    purpose: g.purpose,
    qualityIntent: g.quality_intent,
    aspectRatio: g.aspect_ratio,
    requestedCount: g.requested_count,
    createdAt: g.created_at,
    assets: (assets ?? []).map((a) => ({
      id: a.id,
      sequence: a.sequence,
      imageUrl: urls.get(a.storage_object_id) ?? null,
      thumbnailUrl: (a.thumbnail_object_id && urls.get(a.thumbnail_object_id)) || urls.get(a.storage_object_id) || null,
      width: a.width,
      height: a.height,
      directionLabel: a.direction_label,
      rationale: a.rationale,
      selected: a.selected,
      savedMaterialId: a.saved_material_id,
    })),
  };
}

export type RequestOutcome = { kind: "generation"; view: GenerationView } | { kind: "none" } | { kind: "unavailable" } | { kind: "no_context" };

/**
 * Cache lookup → dedupe → create (§12, §66–68). A complete, partial or in-flight generation for the same context is
 * returned as is; a recent failure is shown (short TTL) rather than retried behind the creator's back.
 */
export async function requestImageGeneration(deps: ImageDeps, req: ImageGenerationRequest, opts: { regenerate?: boolean } = {}): Promise<RequestOutcome & { jobGenerationId?: string }> {
  const purpose = req.purpose;
  const qualityIntent = req.qualityIntent ?? defaultQualityFor(purpose);
  const aspectRatio = req.aspectRatio ?? (purpose === "hero" ? "16:9" : purpose === "carousel" || purpose === "explore" ? "4:5" : "1:1");
  const count = purpose === "carousel" || purpose === "explore" || purpose === "moodboard" || purpose === "transform-preview" ? Math.min(Math.max(req.count ?? 4, 3), 5) : 1;

  if (req.idempotencyKey) {
    const { data: dup } = await deps.db.from("image_generations").select("id").eq("creator_id", deps.creatorId).eq("idempotency_key", req.idempotencyKey).maybeSingle();
    if (dup) {
      const view = await generationView(deps.db, deps.service, dup.id);
      if (view) return { kind: "generation", view };
    }
  }
  const built = await buildImageGenerationContext(deps.db, deps.creatorId, req);
  if (!hasMeaningfulContext(built.context)) return { kind: "no_context" };
  const hash = contextHash({ creatorId: deps.creatorId, purpose, context: built.context, aspectRatio, qualityIntent, count });
  const { data: latest } = await deps.db
    .from("image_generations")
    .select("id, status, context_hash, variation, created_at, creator_id, artifact_id, material_id")
    .eq("creator_id", deps.creatorId)
    .eq("context_hash", hash)
    .order("variation", { ascending: false })
    .limit(1)
    .maybeSingle<GenerationRow>();
  const recentFailure = latest?.status === "failed" && Date.now() - Date.parse(latest.created_at) < FAILED_TTL_MS;
  if (latest && !opts.regenerate && (latest.status !== "failed" || recentFailure || req.lookupOnly)) {
    const reuse = latest.status === "complete" || latest.status === "partial";
    log("info", reuse ? "image_generation_cache_hit" : "image_generation_deduped", { purpose, qualityIntent });
    const view = await generationView(deps.db, deps.service, latest.id, reuse);
    if (view) return { kind: "generation", view };
  }
  if (req.lookupOnly) return { kind: "none" };
  if (!deps.provider.live) return { kind: "unavailable" };

  const model = resolveImageModel({ qualityIntent, purpose });
  const { data: row, error } = await deps.service
    .from("image_generations")
    .insert({
      creator_id: deps.creatorId,
      artifact_id: req.artifactId ?? null,
      material_id: !req.artifactId && built.materialIds.length === 1 ? built.materialIds[0] : null,
      purpose,
      aspect_ratio: aspectRatio,
      quality_intent: qualityIntent,
      context_hash: hash,
      variation: latest ? latest.variation + 1 : 0,
      context: { ...built.context, references: built.references } as never,
      source_material_ids: built.materialIds,
      source_version: built.sourceVersion,
      provider: deps.provider.name,
      model,
      prompt_version: PROMPT_VERSION,
      routing_version: ROUTING_VERSION,
      requested_count: count,
      idempotency_key: req.idempotencyKey ?? null,
    })
    .select("id")
    .single();
  if (error || !row) {
    // A concurrent identical request won the unique (creator, hash, variation) race: return that one (§68).
    const { data: other } = await deps.db.from("image_generations").select("id").eq("creator_id", deps.creatorId).eq("context_hash", hash).order("variation", { ascending: false }).limit(1).maybeSingle();
    const view = other ? await generationView(deps.db, deps.service, other.id) : null;
    if (view) return { kind: "generation", view };
    throw new DomainError("internal", "Couldn't start creating images.", { cause: error });
  }
  await deps.service.from("jobs").insert({ creator_id: deps.creatorId, kind: "image.generate", subject_id: row.id, idempotency_key: `imagegen:${row.id}` });
  log("info", opts.regenerate ? "image_generation_regenerated" : "image_generation_requested", { purpose, qualityIntent, count });
  const view = await generationView(deps.db, deps.service, row.id);
  return { kind: "generation", view: view!, jobGenerationId: row.id };
}

/** "Try another direction" (§17): same place, current context, a new variation — the old one stays. */
export async function regenerateImageGeneration(deps: ImageDeps, generationId: string) {
  const { data: g } = await deps.db.from("image_generations").select("id, creator_id, artifact_id, source_material_ids, purpose, aspect_ratio, quality_intent, requested_count").eq("id", generationId).maybeSingle();
  if (!g || g.creator_id !== deps.creatorId) throw new DomainError("not_found", "That isn't available.");
  return requestImageGeneration(
    deps,
    { artifactId: g.artifact_id, materialIds: g.source_material_ids, purpose: g.purpose as ImagePurpose, aspectRatio: g.aspect_ratio as AspectRatio, qualityIntent: g.quality_intent as ImageQualityIntent, count: g.requested_count },
    { regenerate: true },
  );
}

/** Mark one concept as chosen (§61). */
export async function selectGeneratedAsset(deps: Pick<ImageDeps, "db" | "service" | "creatorId">, generationId: string, assetId: string) {
  const { data: g } = await deps.db.from("image_generations").select("id, creator_id").eq("id", generationId).maybeSingle();
  if (!g || g.creator_id !== deps.creatorId) throw new DomainError("not_found", "That isn't available.");
  const { data: a } = await deps.db.from("image_generation_assets").select("id").eq("id", assetId).eq("generation_id", generationId).maybeSingle();
  if (!a) throw new DomainError("not_found", "That image isn't available.");
  await deps.service.from("image_generation_assets").update({ selected: false }).eq("generation_id", generationId);
  await deps.service.from("image_generation_assets").update({ selected: true }).eq("id", assetId);
  log("info", "image_generation_selected", {});
}

/**
 * The job (§22, §54): claim, generate each direction, store master + thumbnail privately, record assets. Partial success
 * keeps what worked; a blocked or failed image stores nothing (§56). Never logs creator content.
 */
export async function runImageGeneration(deps: Omit<ImageDeps, "db" | "creatorId">, generationId: string): Promise<void> {
  const service = deps.service;
  const { data: claim } = await service.from("image_generations").update({ status: "processing" }).eq("id", generationId).in("status", ["queued", "processing"]).select("*").maybeSingle();
  if (!claim) return;
  const g = claim as unknown as { id: string; creator_id: string; context: ImageGenerationContext & { references?: Array<{ materialId: string; storageObjectId: string }> }; purpose: ImagePurpose; aspect_ratio: AspectRatio; model: string; requested_count: number; created_at: string };
  const started = Date.now();
  const { data: done } = await service.from("image_generation_assets").select("sequence").eq("generation_id", g.id);
  const have = new Set((done ?? []).map((d) => d.sequence));

  const references: ImageReference[] = [];
  for (const r of g.context.references ?? []) {
    const { data: o } = await service.from("storage_objects").select("bucket, path, mime_type, creator_id, security_status").eq("id", r.storageObjectId).maybeSingle();
    if (!o || o.creator_id !== g.creator_id || o.security_status !== "clean" || !REFERENCE_TYPES.has(o.mime_type)) continue;
    const dl = await service.storage.from(o.bucket).download(o.path);
    if (dl.data) references.push({ mimeType: o.mime_type as ImageReference["mimeType"], dataBase64: Buffer.from(await dl.data.arrayBuffer()).toString("base64") });
  }

  const directions = directionsFor(g.context, g.requested_count);
  let ok = have.size;
  let providerDown = false;
  for (const [i, d] of directions.entries()) {
    if (have.has(i)) continue;
    try {
      const out = await deps.provider.generate({ model: g.model, system: IMAGE_SYSTEM, prompt: buildImagePrompt(g.context, g.purpose, g.aspect_ratio, d), aspectRatio: g.aspect_ratio, references });
      const inspected = await inspectUpload(out.image.bytes);
      if (inspected.kind !== "image") throw new DomainError("provider_failed", "Not an image.");
      const derived = await deps.derive(out.image.bytes);
      const store = async (bytes: Uint8Array, suffix: string) => {
        const path = `${g.creator_id}/generated/${g.id}/${i}-${suffix}.webp`;
        const up = await service.storage.from(GENERATED_BUCKET).upload(path, bytes, { contentType: "image/webp", upsert: true });
        if (up.error) throw new DomainError("provider_failed", "Couldn't store the image.", { cause: up.error });
        const insp = await inspectUpload(bytes);
        const { data: obj, error } = await service
          .from("storage_objects")
          .upsert({ creator_id: g.creator_id, bucket: GENERATED_BUCKET, path, mime_type: "image/webp", size_bytes: insp.size, sha256: insp.sha256, original_filename: `${d.label}.webp`, security_status: "clean" }, { onConflict: "bucket,path" })
          .select("id")
          .single();
        if (error || !obj) throw new DomainError("internal", "Couldn't record the image.", { cause: error });
        return obj.id;
      };
      const master = await store(derived.master, "master");
      const thumb = await store(derived.thumbnail, "480");
      await service.from("image_generation_assets").insert({ generation_id: g.id, creator_id: g.creator_id, storage_object_id: master, thumbnail_object_id: thumb, width: derived.width, height: derived.height, sequence: i, direction_label: d.label, rationale: d.rationale });
      ok++;
    } catch (e) {
      const code = e instanceof DomainError ? e.code : "internal";
      log("warn", "image_generation_item_failed", { generationId: g.id, sequence: i, code });
      if (code === "provider_unavailable" || code === "rate_limited") {
        providerDown = true;
        break;
      }
    }
  }
  const status = ok >= g.requested_count ? "complete" : ok > 0 ? "partial" : "failed";
  if (providerDown && ok === 0) {
    // Let the job retry later rather than burn the generation.
    await service.from("image_generations").update({ status: "queued" }).eq("id", g.id);
    throw new DomainError("provider_unavailable", "Image generation is busy.");
  }
  await service
    .from("image_generations")
    .update({ status, completed_at: new Date().toISOString(), latency_ms: Date.now() - started, error_code: status === "failed" ? "generation_failed" : null })
    .eq("id", g.id);
  log("info", status === "failed" ? "image_generation_failed" : "image_generation_completed", { purpose: g.purpose, count: g.requested_count, ok, ms: Date.now() - started });
}

/**
 * Keep a generated image (§61, §64): it becomes one of the creator's Creative Materials — origin ai_generated, with the
 * generation's provenance (provider, model, prompt version, purpose, source Creation/version and Materials) and
 * lineage from its sources — and can join the Creation as a reference. Saving again returns the same Material.
 * The Material row is pipeline output (already checked, clean), so the server writes it, scoped to this creator.
 */
export async function saveGeneratedAsset(deps: Pick<ImageDeps, "db" | "service" | "creatorId">, generationId: string, assetId: string, opts: { useInCreation?: boolean } = {}): Promise<{ materialId: string }> {
  const { data: g } = await deps.db
    .from("image_generations")
    .select("id, creator_id, artifact_id, source_material_ids, source_version, purpose, provider, model, prompt_version, routing_version, quality_intent")
    .eq("id", generationId)
    .maybeSingle();
  if (!g || g.creator_id !== deps.creatorId) throw new DomainError("not_found", "That isn't available.");
  const { data: a } = await deps.db.from("image_generation_assets").select("id, storage_object_id, direction_label, saved_material_id").eq("id", assetId).eq("generation_id", generationId).maybeSingle();
  if (!a) throw new DomainError("not_found", "That image isn't available.");

  let materialId = a.saved_material_id;
  if (!materialId) {
    const { data: prov, error: pErr } = await deps.service
      .from("provenance_records")
      .insert({
        creator_id: deps.creatorId,
        origin: "ai_generated",
        details: {
          generationId: g.id,
          assetId: a.id,
          purpose: g.purpose,
          provider: g.provider,
          model: g.model,
          promptVersion: g.prompt_version,
          routingVersion: g.routing_version,
          qualityIntent: g.quality_intent,
          sourceArtifactId: g.artifact_id,
          sourceVersion: g.source_version,
          sourceMaterialIds: g.source_material_ids,
          direction: a.direction_label,
        },
      })
      .select("id")
      .single();
    if (pErr || !prov) throw new DomainError("internal", "Couldn't save that image.", { cause: pErr });
    const { data: m, error: mErr } = await deps.service
      .from("creative_materials")
      .insert({
        creator_id: deps.creatorId,
        type: "image",
        title: `${a.direction_label ?? "Visual"} direction`,
        storage_object_id: a.storage_object_id,
        source_type: "generated",
        security_status: "clean",
        processing_state: "ready",
        provenance_id: prov.id,
        metadata: { generated: { generationId: g.id, assetId: a.id } },
      })
      .select("id")
      .single();
    if (mErr || !m) throw new DomainError("internal", "Couldn't save that image.", { cause: mErr });
    materialId = m.id;
    const edges = [
      ...(g.artifact_id ? [{ source_type: "artifact", source_id: g.artifact_id, relationship: "derived_from" as const }] : []),
      ...g.source_material_ids.map((id) => ({ source_type: "material", source_id: id, relationship: "inspired_by" as const })),
    ].map((e) => ({ ...e, creator_id: deps.creatorId, target_type: "material", target_id: materialId! }));
    if (edges.length) await deps.service.from("lineage_edges").upsert(edges, { onConflict: "source_type,source_id,target_type,target_id,relationship", ignoreDuplicates: true });
    await deps.service.from("image_generation_assets").update({ saved_material_id: materialId, selected: true }).eq("id", a.id);
    await audit(deps.db, { action: "generated_image.saved", objectType: "material", objectId: materialId, metadata: { generationId: g.id, purpose: g.purpose } });
    log("info", "image_generation_saved", { purpose: g.purpose });
  }
  if (opts.useInCreation && g.artifact_id) {
    // Joins the Creation as a reference Material.
    await deps.service
      .from("lineage_edges")
      .upsert([{ creator_id: deps.creatorId, source_type: "material", source_id: materialId, target_type: "artifact", target_id: g.artifact_id, relationship: "references" }], {
        onConflict: "source_type,source_id,target_type,target_id,relationship",
        ignoreDuplicates: true,
      });
  }
  return { materialId };
}

/**
 * Keep a slide visual with the creator's own words set on it. The words are laid out in the creator's browser (their
 * fonts render every script, and the image model is never asked to draw text); the server only receives the finished
 * picture. It is inspected like any upload, re-encoded, and kept as a derived Material whose provenance records the
 * source image and the exact words, with lineage to the generated image and its Creation.
 */
export async function saveTextOverlay(
  deps: Pick<ImageDeps, "db" | "service" | "creatorId" | "derive">,
  generationId: string,
  assetId: string,
  input: { bytes: Uint8Array; text: string; useInCreation?: boolean },
): Promise<{ materialId: string }> {
  const text = input.text.trim().slice(0, 500);
  if (!text) throw new DomainError("validation", "Add some words first.");
  const { data: g } = await deps.db.from("image_generations").select("id, creator_id, artifact_id, purpose").eq("id", generationId).maybeSingle();
  if (!g || g.creator_id !== deps.creatorId) throw new DomainError("not_found", "That isn't available.");
  const { data: a } = await deps.db.from("image_generation_assets").select("id, sequence, direction_label, saved_material_id").eq("id", assetId).eq("generation_id", generationId).maybeSingle();
  if (!a) throw new DomainError("not_found", "That image isn't available.");

  const inspected = await inspectUpload(input.bytes, "slide.png");
  if (!REFERENCE_TYPES.has(inspected.mime)) throw new DomainError("unsupported_media", "That isn't an image we can keep.");
  let derived: Awaited<ReturnType<ImageDeps["derive"]>>;
  try {
    derived = await deps.derive(input.bytes);
  } catch (e) {
    throw new DomainError("unsupported_media", "That isn't an image we can keep.", { cause: e });
  }

  const key = crypto.randomUUID();
  const store = async (bytes: Uint8Array, suffix: string) => {
    const path = `${deps.creatorId}/generated/${g.id}/text-${key}-${suffix}.webp`;
    const up = await deps.service.storage.from(GENERATED_BUCKET).upload(path, bytes, { contentType: "image/webp", upsert: false });
    if (up.error) throw new DomainError("internal", "Couldn't save that image.", { cause: up.error });
    const insp = await inspectUpload(bytes);
    const { data: obj, error } = await deps.service
      .from("storage_objects")
      .insert({ creator_id: deps.creatorId, bucket: GENERATED_BUCKET, path, mime_type: "image/webp", size_bytes: insp.size, sha256: insp.sha256, original_filename: `slide-${a.sequence + 1}.webp`, security_status: "clean" })
      .select("id")
      .single();
    if (error || !obj) throw new DomainError("internal", "Couldn't save that image.", { cause: error });
    return obj.id;
  };
  const master = await store(derived.master, "master");
  await store(derived.thumbnail, "480");

  const { data: prov, error: pErr } = await deps.service
    .from("provenance_records")
    .insert({
      creator_id: deps.creatorId,
      origin: "derived",
      sha256: inspected.sha256,
      details: { derivation: "text_overlay", generationId: g.id, assetId: a.id, sourceArtifactId: g.artifact_id, direction: a.direction_label, overlayText: text },
    })
    .select("id")
    .single();
  if (pErr || !prov) throw new DomainError("internal", "Couldn't save that image.", { cause: pErr });
  const firstLine = text.split("\n")[0]!.slice(0, 60);
  const { data: m, error: mErr } = await deps.service
    .from("creative_materials")
    .insert({
      creator_id: deps.creatorId,
      type: "image",
      title: g.purpose === "carousel" ? `Slide ${a.sequence + 1} · ${firstLine}` : firstLine,
      storage_object_id: master,
      source_type: "generated",
      security_status: "clean",
      processing_state: "ready",
      provenance_id: prov.id,
      metadata: { generated: { generationId: g.id, assetId: a.id, textOverlay: true }, width: derived.width, height: derived.height },
    })
    .select("id")
    .single();
  if (mErr || !m) throw new DomainError("internal", "Couldn't save that image.", { cause: mErr });

  const edges = [
    ...(a.saved_material_id ? [{ source_type: "material", source_id: a.saved_material_id, target_type: "material", target_id: m.id, relationship: "derived_from" as const }] : []),
    ...(g.artifact_id ? [{ source_type: "artifact", source_id: g.artifact_id, target_type: "material", target_id: m.id, relationship: "derived_from" as const }] : []),
    ...(input.useInCreation && g.artifact_id ? [{ source_type: "material", source_id: m.id, target_type: "artifact", target_id: g.artifact_id, relationship: "references" as const }] : []),
  ].map((e) => ({ ...e, creator_id: deps.creatorId }));
  if (edges.length) await deps.service.from("lineage_edges").upsert(edges, { onConflict: "source_type,source_id,target_type,target_id,relationship", ignoreDuplicates: true });
  await audit(deps.db, { action: "generated_image.text_saved", objectType: "material", objectId: m.id, metadata: { generationId: g.id, purpose: g.purpose } });
  log("info", "image_text_overlay_saved", { purpose: g.purpose });
  return { materialId: m.id };
}
