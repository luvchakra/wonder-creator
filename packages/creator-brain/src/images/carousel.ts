import { audit, DomainError, log } from "@wonder/core";
import { artifactAccess } from "@wonder/creator-studio";
import {
  alternativeChunks,
  CAROUSEL_MAX_SLIDES,
  chunkText,
  cleanSource,
  DEFAULT_OVERLAY,
  DEFAULT_TRANSFORM,
  splitChunk,
  type ImageTransform,
  type SlideOverlay,
} from "@wonder/creator-studio/carousel";
import type { Db } from "@wonder/db";
import { z } from "zod";
import { inspectUpload } from "@wonder/core/server";
import { GENERATED_BUCKET, orderedSet, requestImageGeneration, type ImageDeps } from "./service";

/**
 * Carousel Composer (docs/ui-redesign/carousel-composer.md). A Carousel Creation becomes a sequence of slides, each an
 * image + its words + an optional overlay + a crop + its place in the order.
 *
 * Who may do what: people who may edit the Creation change words, overlay, crop and order (autosave, under RLS). Only
 * the owner spends generation (initial set, one more, regenerate, fill) and chooses which image a slide shows. The
 * server checks every image belongs to this Carousel's generation before a slide can point at it.
 */

type Deps = Pick<ImageDeps, "db" | "service" | "creatorId">;

export interface SlideView {
  id: string;
  order: number;
  sourceText: string;
  displayText: string;
  overlay: SlideOverlay;
  transform: ImageTransform;
  image: { url: string | null; thumbnailUrl: string | null; width: number | null; height: number | null } | null;
  pending: { url: string | null; thumbnailUrl: string | null } | null;
  /** A change the owner asked for on this slide that's in flight or just failed. */
  change: { kind: "variation" | "fill"; status: "queued" | "processing" | "failed" } | null;
}

export interface CarouselView {
  artifactId: string;
  isOwner: boolean;
  canEdit: boolean;
  settings: { requestedCount: number; aspectRatio: string; visualStyle: string; sourceVersion: number | null } | null;
  /** The initial set while it's being made; null once slides exist (or before setup). */
  generating: { status: string; ready: number; requested: number } | null;
  failed: boolean;
  slides: SlideView[];
  /** "Generate one more" requests in flight. */
  adding: number;
  addFailed: boolean;
  sourceText: string;
  sourceVersion: number | null;
  /** Images this Creation already has from before the Composer (owner only): they can become the slides for free. */
  existing: { generationId: string; count: number; thumbnails: string[] } | null;
}

const RECENT_FAILURE_MS = 10 * 60_000;

const access = (db: Db, artifactId: string) => artifactAccess(db, artifactId).catch(() => null);

async function loadArtifact(deps: Deps, artifactId: string) {
  const { data: a } = await deps.db.from("artifacts").select("id, creator_id, artifact_type, current_version_id, status").eq("id", artifactId).maybeSingle();
  if (!a) throw new DomainError("not_found", "That Creation isn't available.");
  const { data: v } = a.current_version_id ? await deps.db.from("artifact_versions").select("version_number, content").eq("id", a.current_version_id).maybeSingle() : { data: null };
  return { ...a, isOwner: a.creator_id === deps.creatorId, content: v?.content ?? "", version: v?.version_number ?? null };
}

async function requireOwner(deps: Deps, artifactId: string) {
  const a = await loadArtifact(deps, artifactId);
  if (!a.isOwner) throw new DomainError("not_found", "That Creation isn't available.");
  return a;
}

async function signed(service: Db, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const { data: objs } = await service.from("storage_objects").select("id, bucket, path").in("id", ids);
  for (const o of objs ?? []) {
    const s = await service.storage.from(o.bucket).createSignedUrl(o.path, 900);
    if (s.data?.signedUrl) out.set(o.id, s.data.signedUrl);
  }
  return out;
}

const overlaySchema = z.object({
  enabled: z.boolean(),
  text: z.string().max(2000).nullish(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0.2).max(1),
  font: z.enum(["editorial", "serif", "modern", "handwritten"]),
  size: z.number().min(0.02).max(0.2),
  align: z.enum(["left", "center", "right"]),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  shadow: z.boolean(),
  background: z.enum(["none", "shade", "band"]),
});
const transformSchema = z.object({ zoom: z.number().min(1).max(4), focalX: z.number().min(0).max(1), focalY: z.number().min(0).max(1) });

const asOverlay = (v: unknown): SlideOverlay => {
  const p = overlaySchema.safeParse({ ...DEFAULT_OVERLAY, ...(v && typeof v === "object" ? v : {}) });
  return p.success ? p.data : DEFAULT_OVERLAY;
};
const asTransform = (v: unknown): ImageTransform => {
  const p = transformSchema.safeParse({ ...DEFAULT_TRANSFORM, ...(v && typeof v === "object" ? v : {}) });
  return p.success ? p.data : DEFAULT_TRANSFORM;
};

/** Turn a finished initial generation into slides, once (§8): image i gets chunk i. Slides with no image keep their words. */
async function seedSlides(service: Db, artifactId: string, generationId: string, sourceText: string): Promise<void> {
  const { data: g } = await service.from("image_generations").select("context").eq("id", generationId).single();
  const planned = ((g?.context ?? {}) as { slides?: string[] }).slides ?? [];
  let rows: Array<{ order_index: number; asset_id: string; text: string }>;
  let images: number;
  if (planned.length) {
    const { data: assets } = await service.from("image_generation_assets").select("id, sequence").eq("generation_id", generationId).is("revision_of", null);
    const bySeq = new Map((assets ?? []).map((a) => [a.sequence, a.id]));
    rows = planned.map((t, i) => ({ order_index: i, asset_id: bySeq.get(i) ?? "", text: t }));
    images = bySeq.size;
  } else {
    // A set made before the Composer: its images in the creator's order, the words split to match.
    const { data: assets } = await service.from("image_generation_assets").select("id, sequence, position, replaced_by").eq("generation_id", generationId);
    const set = orderedSet(assets ?? []).slice(0, CAROUSEL_MAX_SLIDES);
    const chunks = chunkText(sourceText, set.length);
    rows = set.map((a, i) => ({ order_index: i, asset_id: a.id, text: chunks[i] ?? "" }));
    images = set.length;
  }
  // Atomic and once: a concurrent caller waits, then finds the slides already there.
  const { data, error } = await service.rpc("carousel_seed", { p_artifact: artifactId, p_rows: rows });
  if (error) throw new DomainError("internal", "Couldn't set up the slides.", { cause: error });
  if (data) log("info", "carousel_seeded", { slides: data, images });
}

/** Everything the Composer shows, for anyone who can see the Creation. Seeds slides once the first set is ready. */
export async function carouselView(deps: Deps, artifactId: string): Promise<CarouselView> {
  const a = await loadArtifact(deps, artifactId);
  const level = a.isOwner ? "owner" : await access(deps.db, artifactId);
  const { data: c } = await deps.db.from("carousels").select("*").eq("artifact_id", artifactId).maybeSingle();
  const base: CarouselView = {
    artifactId,
    isOwner: a.isOwner,
    canEdit: level === "owner" || level === "edit",
    settings: c ? { requestedCount: c.requested_count, aspectRatio: c.aspect_ratio, visualStyle: c.visual_style, sourceVersion: c.source_version } : null,
    generating: null,
    failed: false,
    slides: [],
    adding: 0,
    addFailed: false,
    sourceText: a.content,
    sourceVersion: a.version,
    existing: null,
  };
  if (!c?.generation_id) {
    if (!a.isOwner) return base;
    const { data: prev } = await deps.db
      .from("image_generations")
      .select("id")
      .eq("artifact_id", artifactId)
      .eq("purpose", "carousel")
      .in("status", ["complete", "partial"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!prev) return base;
    const { data: rows } = await deps.db.from("image_generation_assets").select("id, sequence, position, replaced_by, thumbnail_object_id, storage_object_id").eq("generation_id", prev.id);
    const set = orderedSet(rows ?? []);
    if (!set.length) return base;
    const urls = await signed(
      deps.service,
      set.slice(0, 6).map((x) => x.thumbnail_object_id ?? x.storage_object_id),
    );
    return {
      ...base,
      existing: {
        generationId: prev.id,
        count: set.length,
        thumbnails: set
          .slice(0, 6)
          .map((x) => urls.get(x.thumbnail_object_id ?? x.storage_object_id) ?? "")
          .filter(Boolean),
      },
    };
  }
  const { data: g } = await deps.db.from("image_generations").select("id, status, requested_count, created_at").eq("id", c.generation_id).maybeSingle();
  if (!g) return base;
  if (!c.seeded_at) {
    if (g.status === "complete" || g.status === "partial") await seedSlides(deps.service, artifactId, g.id, a.content);
    else if (g.status === "failed" || g.status === "cancelled") return { ...base, failed: true };
    else {
      const { count } = await deps.db.from("image_generation_assets").select("id", { count: "exact", head: true }).eq("generation_id", g.id);
      return { ...base, generating: { status: g.status, ready: count ?? 0, requested: g.requested_count } };
    }
  }

  const { data: rows } = await deps.db.from("carousel_slides").select("*").eq("artifact_id", artifactId).order("order_index").order("created_at");
  const assetIds = [...new Set((rows ?? []).flatMap((r) => [r.asset_id, r.pending_asset_id]).filter((x): x is string => !!x))];
  const { data: assets } = assetIds.length
    ? await deps.service.from("image_generation_assets").select("id, generation_id, storage_object_id, thumbnail_object_id, width, height").in("id", assetIds).eq("generation_id", g.id)
    : { data: [] };
  const byId = new Map((assets ?? []).map((x) => [x.id, x]));
  const urls = await signed(
    deps.service,
    (assets ?? []).flatMap((x) => [x.storage_object_id, x.thumbnail_object_id]).filter((x): x is string => !!x),
  );
  const img = (id: string | null) => {
    const x = id ? byId.get(id) : undefined;
    if (!x) return null;
    return {
      url: urls.get(x.storage_object_id) ?? null,
      thumbnailUrl: (x.thumbnail_object_id && urls.get(x.thumbnail_object_id)) || urls.get(x.storage_object_id) || null,
      width: x.width,
      height: x.height,
    };
  };
  const since = new Date(Date.now() - RECENT_FAILURE_MS).toISOString();
  const { data: revs } = await deps.db
    .from("image_asset_revisions")
    .select("id, kind, slide_id, status, created_at")
    .eq("generation_id", g.id)
    .in("kind", ["variation", "fill", "add"])
    .or(`status.in.(queued,processing),and(status.eq.failed,created_at.gte.${since})`)
    .order("created_at", { ascending: true });
  const change = new Map<string, SlideView["change"]>();
  for (const r of revs ?? []) if (r.slide_id && (r.kind === "variation" || r.kind === "fill")) change.set(r.slide_id, { kind: r.kind, status: r.status as "queued" | "processing" | "failed" });
  const adds = (revs ?? []).filter((r) => r.kind === "add");
  return {
    ...base,
    slides: (rows ?? []).map((r) => ({
      id: r.id,
      order: r.order_index,
      sourceText: r.source_text,
      displayText: r.display_text,
      overlay: asOverlay(r.overlay),
      transform: asTransform(r.image_transform),
      image: img(r.asset_id),
      pending: r.pending_asset_id ? img(r.pending_asset_id) : null,
      change: r.pending_asset_id ? null : (change.get(r.id) ?? null),
    })),
    adding: adds.filter((r) => r.status !== "failed").length,
    addFailed: adds.at(-1)?.status === "failed",
  };
}

/**
 * Set up and start the first set (§6–8): the owner picks how many images, a visual style and an aspect ratio; the
 * Creation's words are split into that many chunks and each image is made from its own chunk. Idempotent per key.
 */
export async function startCarousel(deps: ImageDeps, artifactId: string, input: { count: number; visualStyle: string; aspectRatio: "1:1" | "4:5" | "16:9"; idempotencyKey?: string; retry?: boolean }) {
  const a = await requireOwner(deps, artifactId);
  const { data: existing } = await deps.db.from("carousels").select("artifact_id, generation_id, seeded_at").eq("artifact_id", artifactId).maybeSingle();
  if (existing?.seeded_at) throw new DomainError("conflict", "This Carousel already has slides.");
  const chunks = chunkText(a.content, Math.min(CAROUSEL_MAX_SLIDES, Math.max(1, input.count)));
  if (!chunks.length) throw new DomainError("validation", "Add more text or Material to build the Carousel.");
  if (!deps.provider.live) return { kind: "unavailable" as const };
  const { error } = await deps.service.from("carousels").upsert({
    artifact_id: artifactId,
    creator_id: deps.creatorId,
    requested_count: chunks.length,
    aspect_ratio: input.aspectRatio,
    visual_style: input.visualStyle,
    source_version: a.version,
    seeded_at: null,
  });
  if (error) throw new DomainError("internal", "Couldn't start the Carousel.", { cause: error });
  // "Try again" after a failed set asks for a fresh generation instead of the cached failure.
  const out = await requestImageGeneration(
    deps,
    { artifactId, purpose: "carousel", aspectRatio: input.aspectRatio, slideTexts: chunks, visualStyle: input.visualStyle, idempotencyKey: input.idempotencyKey ?? null },
    { regenerate: !!input.retry },
  );
  if (out.kind !== "generation") return { kind: out.kind };
  await deps.service.from("carousels").update({ generation_id: out.view.id }).eq("artifact_id", artifactId);
  await audit(deps.db, { action: "carousel.started", objectType: "artifact", objectId: artifactId, metadata: { slides: chunks.length, style: input.visualStyle } });
  return { kind: "generation" as const, generationId: out.view.id, jobGenerationId: out.jobGenerationId };
}

/** Use the images this Creation already has (made before the Composer) as its slides — no new generation. */
export async function adoptCarouselSet(deps: Deps, artifactId: string, generationId: string) {
  const a = await requireOwner(deps, artifactId);
  const { data: existing } = await deps.db.from("carousels").select("generation_id").eq("artifact_id", artifactId).maybeSingle();
  if (existing?.generation_id) throw new DomainError("conflict", "This Carousel already has slides.");
  const { data: g } = await deps.db.from("image_generations").select("id, artifact_id, purpose, status, aspect_ratio").eq("id", generationId).maybeSingle();
  if (!g || g.artifact_id !== artifactId || g.purpose !== "carousel" || !["complete", "partial"].includes(g.status)) throw new DomainError("not_found", "Those images aren't available.");
  const { data: rows } = await deps.db.from("image_generation_assets").select("id, sequence, position, replaced_by").eq("generation_id", g.id);
  const count = Math.min(CAROUSEL_MAX_SLIDES, orderedSet(rows ?? []).length);
  if (!count) throw new DomainError("not_found", "Those images aren't available.");
  const aspect = (["1:1", "4:5", "16:9"] as const).find((x) => x === g.aspect_ratio) ?? "4:5";
  const { error } = await deps.service
    .from("carousels")
    .upsert({
      artifact_id: artifactId,
      creator_id: deps.creatorId,
      requested_count: count,
      aspect_ratio: aspect,
      visual_style: "auto",
      source_version: a.version,
      generation_id: g.id,
      seeded_at: null,
    });
  if (error) throw new DomainError("internal", "Couldn't set up the slides.", { cause: error });
  await seedSlides(deps.service, artifactId, g.id, a.content);
}

async function carouselGeneration(deps: Deps, artifactId: string) {
  const { data: c } = await deps.db.from("carousels").select("generation_id").eq("artifact_id", artifactId).maybeSingle();
  if (!c?.generation_id) throw new DomainError("conflict", "Create the Carousel's images first.");
  return c.generation_id;
}

async function slideFor(deps: Deps, slideId: string) {
  const { data: s } = await deps.db.from("carousel_slides").select("*").eq("id", slideId).maybeSingle();
  if (!s) throw new DomainError("not_found", "That slide isn't available.");
  return s;
}

async function queueChange(
  deps: ImageDeps,
  row: { generationId: string; kind: "variation" | "fill" | "add"; assetId: string | null; slideId: string | null; slideText: string; instruction?: string | null; idempotencyKey?: string },
) {
  if (row.idempotencyKey) {
    const { data: dup } = await deps.db.from("image_asset_revisions").select("id").eq("creator_id", deps.creatorId).eq("idempotency_key", row.idempotencyKey).maybeSingle();
    if (dup) return { kind: "queued" as const, revisionId: dup.id, queued: false };
  }
  if (row.slideId) {
    const { data: busy } = await deps.db.from("image_asset_revisions").select("id").eq("slide_id", row.slideId).in("status", ["queued", "processing"]).maybeSingle();
    if (busy) return { kind: "queued" as const, revisionId: busy.id, queued: false };
  }
  if (!deps.provider.live) return { kind: "unavailable" as const };
  const instruction = row.instruction?.trim().slice(0, 300) || null;
  const { data: rev, error } = await deps.service
    .from("image_asset_revisions")
    .insert({
      creator_id: deps.creatorId,
      generation_id: row.generationId,
      asset_id: row.assetId,
      slide_id: row.slideId,
      kind: row.kind,
      slide_text: row.slideText.slice(0, 2000) || null,
      instruction,
      idempotency_key: row.idempotencyKey ?? null,
    })
    .select("id")
    .single();
  if (error || !rev) throw new DomainError("internal", "Couldn't start that image.", { cause: error });
  await deps.service.from("jobs").insert({ creator_id: deps.creatorId, kind: "image.revise", subject_id: rev.id, idempotency_key: `imagerev:${rev.id}` });
  log("info", "carousel_image_requested", { kind: row.kind });
  return { kind: "queued" as const, revisionId: rev.id, queued: true };
}

/** "Generate one more" (§11): exactly one new slide, appended, with the next unused words. Never touches the rest. */
export async function addCarouselSlide(deps: ImageDeps, artifactId: string, input: { instruction?: string | null; idempotencyKey?: string }) {
  const a = await requireOwner(deps, artifactId);
  const generationId = await carouselGeneration(deps, artifactId);
  const { data: slides } = await deps.db.from("carousel_slides").select("source_text, display_text").eq("artifact_id", artifactId);
  if ((slides ?? []).length >= CAROUSEL_MAX_SLIDES) throw new DomainError("validation", `A Carousel can have up to ${CAROUSEL_MAX_SLIDES} slides.`);
  const used = (slides ?? []).map((s) => norm(`${s.source_text}\n${s.display_text}`));
  const unused = cleanSource(a.content)
    .map((st) => st.join("\n"))
    .find((t) => !used.some((u) => u.includes(norm(t))));
  return queueChange(deps, { generationId, kind: "add", assetId: null, slideId: null, slideText: unused ?? "", instruction: input.instruction, idempotencyKey: input.idempotencyKey });
}

/** "Regenerate this image" (§25–27): a variation for this slide only, offered as Use new / Keep current. */
export async function regenerateCarouselSlide(deps: ImageDeps, slideId: string, input: { instruction?: string | null; idempotencyKey?: string }) {
  const s = await slideFor(deps, slideId);
  await requireOwner(deps, s.artifact_id);
  const generationId = await carouselGeneration(deps, s.artifact_id);
  return queueChange(deps, {
    generationId,
    kind: s.asset_id ? "variation" : "fill",
    assetId: s.asset_id,
    slideId,
    slideText: s.display_text || s.source_text,
    instruction: input.instruction,
    idempotencyKey: input.idempotencyKey,
  });
}

/** Use new / Keep current (§27). The other image stays in the generation's history either way. */
export async function chooseSlideVariation(deps: Deps, slideId: string, choice: "use" | "keep") {
  const s = await slideFor(deps, slideId);
  await requireOwner(deps, s.artifact_id);
  if (!s.pending_asset_id) return;
  const patch = choice === "use" ? { asset_id: s.pending_asset_id, pending_asset_id: null } : { pending_asset_id: null };
  const { error } = await deps.service.from("carousel_slides").update(patch).eq("id", slideId);
  if (error) throw new DomainError("internal", "Couldn't save that choice.", { cause: error });
}

const slidePatch = z.object({
  displayText: z.string().max(2000).optional(),
  sourceText: z.string().max(2000).optional(),
  overlay: overlaySchema.optional(),
  transform: transformSchema.optional(),
});

/** Autosaved edits (§34): words, overlay and crop. Runs as the person (RLS: owner or edit access). */
export async function updateCarouselSlide(db: Db, slideId: string, raw: unknown) {
  const p = slidePatch.parse(raw);
  const patch = {
    ...(p.displayText !== undefined ? { display_text: p.displayText } : {}),
    ...(p.sourceText !== undefined ? { source_text: p.sourceText } : {}),
    ...(p.overlay ? { overlay: p.overlay } : {}),
    ...(p.transform ? { image_transform: p.transform } : {}),
  };
  if (!Object.keys(patch).length) return;
  const { data, error } = await db.from("carousel_slides").update(patch).eq("id", slideId).select("id");
  if (error) throw new DomainError("internal", "Couldn't save that.", { cause: error });
  if (!data?.length) throw new DomainError("not_found", "That slide isn't available.");
}

/** Arrange (§28): every slide, once. Never generates anything. */
export async function reorderCarousel(db: Db, artifactId: string, slideIds: string[]) {
  const { data: rows } = await db.from("carousel_slides").select("id").eq("artifact_id", artifactId);
  const ids = (rows ?? []).map((r) => r.id);
  if (slideIds.length !== ids.length || new Set(slideIds).size !== slideIds.length || !slideIds.every((id) => ids.includes(id))) {
    throw new DomainError("validation", "That order doesn't match these slides. Refresh and try again.");
  }
  for (const [i, id] of slideIds.entries()) {
    const { data, error } = await db.from("carousel_slides").update({ order_index: i }).eq("id", id).select("id");
    if (error || !data?.length) throw new DomainError("not_found", "You can't arrange this Carousel.", { cause: error });
  }
}

async function requireEditor(deps: Deps, artifactId: string) {
  const a = await loadArtifact(deps, artifactId);
  if (a.isOwner) return a;
  const level = await access(deps.db, artifactId);
  if (level !== "edit") throw new DomainError("not_found", "That Creation isn't available.");
  return a;
}

/** Insert a slide right after another, shifting the rest (server-side: membership isn't a client write). */
async function insertAfter(
  deps: Deps,
  after: { artifact_id: string; order_index: number },
  row: { asset_id: string | null; source_text: string; display_text: string; overlay?: unknown; image_transform?: unknown },
) {
  const { data: all } = await deps.service.from("carousel_slides").select("id, order_index").eq("artifact_id", after.artifact_id).order("order_index");
  if ((all ?? []).length >= CAROUSEL_MAX_SLIDES) throw new DomainError("validation", `A Carousel can have up to ${CAROUSEL_MAX_SLIDES} slides.`);
  for (const r of [...(all ?? [])].reverse())
    if (r.order_index > after.order_index)
      await deps.service
        .from("carousel_slides")
        .update({ order_index: r.order_index + 1 })
        .eq("id", r.id);
  const { data: owner } = await deps.service.from("carousels").select("creator_id").eq("artifact_id", after.artifact_id).single();
  const { data, error } = await deps.service
    .from("carousel_slides")
    .insert({
      artifact_id: after.artifact_id,
      creator_id: owner!.creator_id,
      order_index: after.order_index + 1,
      asset_id: row.asset_id,
      source_text: row.source_text,
      display_text: row.display_text,
      overlay: (row.overlay ?? { enabled: false }) as never,
      image_transform: (row.image_transform ?? {}) as never,
    })
    .select("id")
    .single();
  if (error || !data) throw new DomainError("internal", "Couldn't add the slide.", { cause: error });
  return data.id;
}

/**
 * Split into two slides (§18): this slide keeps the first part; a new slide right after it gets the rest and, until
 * the owner asks for a new image (which costs a generation), shows the same image.
 */
export async function splitCarouselSlide(deps: Deps, slideId: string) {
  const s = await slideFor(deps, slideId);
  await requireEditor(deps, s.artifact_id);
  const parts = splitChunk(s.display_text || s.source_text);
  if (!parts) throw new DomainError("validation", "These words are too short to split.");
  const { error } = await deps.db.from("carousel_slides").update({ display_text: parts[0], source_text: parts[0] }).eq("id", slideId);
  if (error) throw new DomainError("internal", "Couldn't split the slide.", { cause: error });
  const id = await insertAfter(deps, s, { asset_id: s.asset_id, source_text: parts[1], display_text: parts[1], overlay: s.overlay, image_transform: s.image_transform });
  return { slideId: id };
}

/** Duplicate a slide (same image and words) right after it. */
export async function duplicateCarouselSlide(deps: Deps, slideId: string) {
  const s = await slideFor(deps, slideId);
  await requireEditor(deps, s.artifact_id);
  return { slideId: await insertAfter(deps, s, { asset_id: s.asset_id, source_text: s.source_text, display_text: s.display_text, overlay: s.overlay, image_transform: s.image_transform }) };
}

/** Remove a slide (§12). Its image stays in the generation's history. A Carousel keeps at least one slide. */
export async function removeCarouselSlide(deps: Deps, slideId: string) {
  const s = await slideFor(deps, slideId);
  await requireEditor(deps, s.artifact_id);
  const { data: all } = await deps.service.from("carousel_slides").select("id, order_index").eq("artifact_id", s.artifact_id).order("order_index");
  if ((all ?? []).length <= 1) throw new DomainError("validation", "A Carousel needs at least one slide.");
  await deps.service.from("carousel_slides").delete().eq("id", slideId);
  const rest = (all ?? []).filter((r) => r.id !== slideId);
  for (const [i, r] of rest.entries()) if (r.order_index !== i) await deps.service.from("carousel_slides").update({ order_index: i }).eq("id", r.id);
}

/** Other words that could go on this slide (§17) — from the source, never changing it. */
export async function suggestSlideChunks(deps: Deps, slideId: string) {
  const s = await slideFor(deps, slideId);
  const a = await loadArtifact(deps, s.artifact_id);
  const { count } = await deps.db.from("carousel_slides").select("id", { count: "exact", head: true }).eq("artifact_id", s.artifact_id);
  return alternativeChunks(a.content, count ?? 1, s.order_index, s.display_text);
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * "Use it as a slide image" (Studio, owner 28 Sep 2026): one of the creator's own photos becomes the new image offered
 * for a slide — pending, so the slide shows "Use new / Keep current" and nothing is replaced until they choose. The
 * photo is copied (slide-sized, with a thumbnail) into the Carousel's own set with the Material recorded as its source;
 * no image is generated and nothing is charged. The Material must be one the creator can see (RLS read).
 */
export async function slideImageFromMaterial(deps: Pick<ImageDeps, "db" | "service" | "creatorId" | "derive">, slideId: string, materialId: string): Promise<{ slideId: string }> {
  const { data: slide } = await deps.db.from("carousel_slides").select("id, artifact_id, asset_id").eq("id", slideId).maybeSingle();
  if (!slide) throw new DomainError("not_found", "That slide isn't available.");
  const level = await access(deps.db, slide.artifact_id);
  if (level !== "owner" && level !== "edit") throw new DomainError("forbidden", "You can't change this Carousel.");
  const { data: c } = await deps.db.from("carousels").select("generation_id").eq("artifact_id", slide.artifact_id).maybeSingle();
  if (!c?.generation_id) throw new DomainError("conflict", "Create the Carousel's images first.");
  const { data: m } = await deps.db.from("creative_materials").select("id, type, title, storage_object_id").eq("id", materialId).maybeSingle();
  if (!m || !["image", "sketch"].includes(m.type) || !m.storage_object_id) throw new DomainError("validation", "That isn't a photo you can use here.");
  const { data: o } = await deps.db.from("storage_objects").select("bucket, path, security_status").eq("id", m.storage_object_id).maybeSingle();
  if (!o || o.security_status !== "clean") throw new DomainError("validation", "That photo isn't available.");
  const dl = await deps.service.storage.from(o.bucket).download(o.path);
  if (!dl.data) throw new DomainError("internal", "Couldn't read the photo.");
  const bytes = new Uint8Array(await dl.data.arrayBuffer());
  if ((await inspectUpload(bytes)).kind !== "image") throw new DomainError("validation", "That isn't a photo you can use here.");
  const derived = await deps.derive(bytes);
  const g = c.generation_id;
  const { data: seqs } = await deps.service.from("image_generation_assets").select("sequence").eq("generation_id", g).order("sequence", { ascending: false }).limit(1);
  const seq = (seqs?.[0]?.sequence ?? -1) + 1;
  if (seq > 99) throw new DomainError("validation", "This Carousel's image set is full.");
  const store = async (b: Uint8Array, suffix: string) => {
    const path = `${deps.creatorId}/generated/${g}/${seq}-${suffix}.webp`;
    const up = await deps.service.storage.from(GENERATED_BUCKET).upload(path, b, { contentType: "image/webp", upsert: true });
    if (up.error) throw new DomainError("internal", "Couldn't store the photo.", { cause: up.error });
    const insp = await inspectUpload(b);
    const { data, error } = await deps.service
      .from("storage_objects")
      .upsert(
        {
          creator_id: deps.creatorId,
          bucket: GENERATED_BUCKET,
          path,
          mime_type: "image/webp",
          size_bytes: insp.size,
          sha256: insp.sha256,
          original_filename: `${(m.title ?? "photo").slice(0, 60)}.webp`,
          security_status: "clean",
        },
        { onConflict: "bucket,path" },
      )
      .select("id")
      .single();
    if (error || !data) throw new DomainError("internal", "Couldn't record the photo.", { cause: error });
    return data.id;
  };
  const master = await store(derived.master, "master");
  const thumb = await store(derived.thumbnail, "480");
  const { data: fresh, error } = await deps.service
    .from("image_generation_assets")
    .insert({
      generation_id: g,
      creator_id: deps.creatorId,
      storage_object_id: master,
      thumbnail_object_id: thumb,
      width: derived.width,
      height: derived.height,
      sequence: seq,
      direction_label: "Your photo",
      revision_of: slide.asset_id,
      replaced_by: null,
    })
    .select("id")
    .single();
  if (error || !fresh) throw new DomainError("internal", "Couldn't record the photo.", { cause: error });
  // Lineage: the set now also comes from this Material ("Used in slides …" reads it).
  const { data: gen } = await deps.service.from("image_generations").select("source_material_ids").eq("id", g).single();
  const ids = [...new Set([...(gen?.source_material_ids ?? []), materialId])];
  await deps.service.from("image_generations").update({ source_material_ids: ids }).eq("id", g);
  await deps.service.from("carousel_slides").update({ pending_asset_id: fresh.id }).eq("id", slideId);
  await audit(deps.db, { action: "carousel.slide_photo", objectType: "artifact", objectId: slide.artifact_id, metadata: { slideId, materialId } });
  return { slideId };
}
