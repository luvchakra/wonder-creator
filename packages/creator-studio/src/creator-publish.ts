import { DomainError, fromDbError, must } from "@wonder/core";
import type { Db } from "@wonder/db";
import { licenseRights } from "@wonder/creator-library/source-rights";
import { z } from "zod";
import { artifactType } from "./artifact-types";
import { lookOf, ornamentOf } from "./creation-pages";
import { imageSetOf } from "./image-options";
import { audioSetOf } from "./audio-options";
import { deckOf } from "./deck-options";
import { outputModeOf } from "./working-set-options";
import { DEFAULT_OVERLAY, DEFAULT_TRANSFORM, type ImageTransform, type SlideOverlay } from "./carousel";
import { TEMPLATE_IDS, mergeTemplateSettings, normalizeSections, resolveTemplateId, settingsFor, validateSettings, type CreatorPageTemplateId, type TemplateSettings } from "./creator-page-templates";
import {
  EXPERIENCES,
  PAGE_SECTIONS,
  VISIBILITIES,
  experiencesFor,
  isPoem,
  manifestFor,
  slugify,
  type PageSection,
  type PublicBlock,
  type PublicRights,
  type PublicationManifest,
  type PublicationVisibility,
  type PublishSettings,
  type PublishedSnapshot,
} from "./publish-options";

export * from "./publish-options";

/**
 * CreatorPublish (docs/creator-publish.md): publish into the creator's own space first, then share the link anywhere.
 *
 * Publishing freezes a *published revision*: a manifest (how the work is experienced) and a snapshot of exactly what
 * readers see, with rights and provenance as they were — the public page never shows the mutable working Creation.
 * The URL (/p/<handle>/<slug>) stays the same through updates. Everything here runs as the creator (RLS: their own
 * Creation, their own publication); public readers reach revisions only through the database's publication-safe
 * functions. Nothing here changes the Creation or its privacy.
 */


interface Mat {
  id: string;
  type: string;
  title: string | null;
  storage_object_id: string | null;
  text_content: string | null;
  metadata: unknown;
  source_type: string | null;
}

/** Storage objects that passed the upload checks — nothing else is ever published. */
async function cleanObjects(db: Db, ids: Array<string | null | undefined>): Promise<Set<string>> {
  const want = [...new Set(ids.filter((x): x is string => !!x))];
  if (!want.length) return new Set();
  const { data } = await db.from("storage_objects").select("id, security_status").in("id", want);
  return new Set((data ?? []).filter((o) => o.security_status === "clean").map((o) => o.id));
}

const durationOf = (m: Mat) => {
  const meta = (m.metadata as Record<string, unknown> | null) ?? {};
  const d = typeof meta.durationSeconds === "number" ? meta.durationSeconds : typeof meta.duration === "number" ? meta.duration : null;
  return d ? Math.round(d) : null;
};
const vertical = (m: Mat) => {
  const meta = (m.metadata as Record<string, unknown> | null) ?? {};
  return typeof meta.width === "number" && typeof meta.height === "number" ? meta.height > meta.width : undefined;
};

/**
 * What readers will see, built from the Creation as it is now: its current version, cover, Carousel slides, and the
 * Materials it was made from (pictures, a recording, a film). Only clean storage objects; nothing the creator can't read.
 */
export async function buildSnapshot(db: Db, artifactId: string, settings: PublishSettings = {}): Promise<{ snapshot: PublishedSnapshot; versionId: string | null; aspectRatio?: string; coverCandidates: string[] }> {
  const a = must(await db.from("artifacts").select("id, title, description, artifact_type, current_version_id, cover_material_id, presentation").eq("id", artifactId).maybeSingle(), "That Creation isn't available.");
  const [{ data: v }, { data: edges }, { data: slides }, { data: carousel }] = await Promise.all([
    a.current_version_id ? db.from("artifact_versions").select("id, version_number, content, structured_content").eq("id", a.current_version_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("lineage_edges").select("source_id, created_at").eq("target_type", "artifact").eq("target_id", artifactId).eq("source_type", "material").order("created_at").limit(40),
    db.from("carousel_slides").select("id, order_index, asset_id, display_text, source_text, overlay, image_transform").eq("artifact_id", artifactId).order("order_index").limit(60),
    db.from("carousels").select("aspect_ratio").eq("artifact_id", artifactId).maybeSingle(),
  ]);
  const matIds = [...new Set([...(edges ?? []).map((e) => e.source_id), ...(a.cover_material_id ? [a.cover_material_id] : [])])];
  const { data: mats } = matIds.length ? await db.from("creative_materials").select("id, type, title, storage_object_id, text_content, metadata, source_type").in("id", matIds) : { data: [] as Mat[] };
  const byId = new Map((mats ?? []).map((m) => [m.id, m as Mat]));
  const linked = (edges ?? []).map((e) => byId.get(e.source_id)).filter((m): m is Mat => !!m);
  const assetIds = (slides ?? []).map((s) => s.asset_id).filter((x): x is string => !!x);
  const { data: assets } = assetIds.length ? await db.from("image_generation_assets").select("id, storage_object_id").in("id", assetIds) : { data: [] as Array<{ id: string; storage_object_id: string }> };
  const assetObject = new Map((assets ?? []).map((x) => [x.id, x.storage_object_id]));
  const clean = await cleanObjects(db, [...(mats ?? []).map((m) => m.storage_object_id), ...(assets ?? []).map((x) => x.storage_object_id)]);
  const obj = (id: string | null | undefined) => (id && clean.has(id) ? id : null);

  const type = a.artifact_type;
  const content = (v?.content ?? "").replace(/\r\n/g, "\n");
  const pictures = linked.filter((m) => (m.type === "image" || m.type === "sketch") && obj(m.storage_object_id));
  const video = linked.find((m) => m.type === "video" && obj(m.storage_object_id));
  // The Audio page's kept take plays first (creation-pages.md, step 3); otherwise the first linked recording.
  const takeId = audioSetOf(v?.structured_content).take?.materialId;
  const kept = takeId ? linked.find((m) => m.id === takeId && obj(m.storage_object_id)) : undefined;
  const audio = kept ?? linked.find((m) => (m.type === "audio" || m.type === "voice") && obj(m.storage_object_id));
  const cover = a.cover_material_id ? byId.get(a.cover_material_id) : undefined;
  const coverCandidates = [...new Set([obj(cover?.storage_object_id), ...pictures.map((p) => p.storage_object_id), ...(slides ?? []).map((s) => obj(assetObject.get(s.asset_id ?? "")))].filter((x): x is string => !!x))].slice(0, 12);
  const coverObjectId = settings.coverObjectId && coverCandidates.includes(settings.coverObjectId) ? settings.coverObjectId : (coverCandidates[0] ?? null);

  const snapshot: PublishedSnapshot = {
    title: a.title,
    description: a.description,
    typeLabel: artifactType(type).label,
    artifactType: type,
    versionNumber: v?.version_number ?? null,
    content,
    coverObjectId,
  };
  // Written work keeps the look it has on its page: over the cover, over it blurred, or on paper (creation-pages.md).
  if (outputModeOf(type) === "writing") {
    snapshot.look = lookOf(a.presentation, !!coverObjectId);
    snapshot.ornament = ornamentOf(a.presentation);
  }
  if (slides?.length)
    snapshot.slides = slides.map((s) => ({
      objectId: obj(assetObject.get(s.asset_id ?? "")),
      text: (s.display_text || s.source_text || "").slice(0, 2000),
      overlay: { ...DEFAULT_OVERLAY, ...((s.overlay as Partial<SlideOverlay>) ?? {}) },
      transform: { ...DEFAULT_TRANSFORM, ...((s.image_transform as Partial<ImageTransform>) ?? {}) },
    }));
  if (pictures.length) snapshot.images = pictures.slice(0, 24).map((p) => ({ objectId: p.storage_object_id!, alt: p.title?.trim() || "" }));
  // The Images page (creation-pages.md, step 2): the pictures in the creator's order, as shaped — only clean, linked ones.
  const shaped = imageSetOf(v?.structured_content).items.map((i) => ({ item: i, m: byId.get(i.materialId) })).filter((x) => x.m && obj(x.m.storage_object_id));
  if (shaped.length) {
    snapshot.pictures = shaped.map(({ item, m }) => ({ objectId: m!.storage_object_id!, caption: item.caption, edits: item.edits, texts: item.texts }));
    snapshot.images = shaped.map(({ item, m }) => ({ objectId: m!.storage_object_id!, alt: item.caption || m!.title?.trim() || "" }));
  }
  else if (cover && obj(cover.storage_object_id) && (cover.type === "image" || cover.type === "sketch")) snapshot.images = [{ objectId: cover.storage_object_id!, alt: cover.title?.trim() || "" }];
  if (video) snapshot.media = { kind: "video", objectId: video.storage_object_id!, title: video.title?.trim() || a.title, durationSeconds: durationOf(video), posterObjectId: coverObjectId, vertical: vertical(video) };
  else if (audio && !isPoem(type)) snapshot.media = { kind: "audio", objectId: audio.storage_object_id!, title: audio.title?.trim() || a.title, durationSeconds: durationOf(audio) };
  else if (audio && type === "spoken_word") snapshot.media = { kind: "audio", objectId: audio.storage_object_id!, title: audio.title?.trim() || a.title, durationSeconds: durationOf(audio) };
  // A poem's reading is offered alongside the words, never instead of them (§7).
  if (audio && isPoem(type)) snapshot.voice = { objectId: audio.storage_object_id!, durationSeconds: durationOf(audio) };
  if (snapshot.media) snapshot.transcript = content.trim() || (snapshot.media.kind === "audio" ? audio?.text_content : video?.text_content) || null;

  // A Presentation (creation-pages.md, step 4): its slides in their theme, with the pictures on them; notes stay private.
  if (outputModeOf(type) === "presentation") {
    const deck = deckOf(v?.structured_content, content);
    if (deck.slides.length) snapshot.deck = { theme: deck.theme, slides: deck.slides.map((x) => ({ title: x.title, body: x.body, objectId: x.image ? obj(byId.get(x.image)?.storage_object_id) : null })) };
  }
  // A Journey: the authored text in its order, with the Creation's pictures, recordings and films between passages.
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const media: PublicBlock[] = [
    ...pictures.map((p) => ({ kind: "image" as const, objectId: p.storage_object_id!, alt: p.title?.trim() || "" })),
    ...linked.filter((m) => (m.type === "audio" || m.type === "voice") && obj(m.storage_object_id)).map((m) => ({ kind: "audio" as const, objectId: m.storage_object_id!, title: m.title?.trim() || "A recording", durationSeconds: durationOf(m) })),
    ...linked.filter((m) => m.type === "video" && obj(m.storage_object_id)).map((m) => ({ kind: "video" as const, objectId: m.storage_object_id!, title: m.title?.trim() || "A film", posterObjectId: null })),
  ];
  if (media.length && paragraphs.length + media.length >= 2) {
    const blocks: PublicBlock[] = [];
    const every = Math.max(1, Math.ceil(paragraphs.length / Math.max(1, media.length)));
    let mi = 0;
    if (media[0]?.kind === "image") blocks.push(media[mi++]!);
    paragraphs.forEach((p, i) => {
      blocks.push({ kind: "text", text: p });
      if ((i + 1) % every === 0 && mi < media.length) blocks.push(media[mi++]!);
    });
    while (mi < media.length) blocks.push(media[mi++]!);
    snapshot.blocks = blocks;
  }
  if (!settings.show?.description) snapshot.description = settings.show?.description === false ? null : snapshot.description;
  if (settings.show?.transcript === false) snapshot.transcript = null;
  return { snapshot, versionId: v?.id ?? null, aspectRatio: carousel?.aspect_ratio ?? undefined, coverCandidates };
}

/** Rights as recorded (never inferred): the creator's rights record, their publishing choices, and credits that must travel with the work. */
async function rightsFor(db: Db, artifactId: string, versionId: string | null, settings: PublishSettings): Promise<PublicRights> {
  const [{ data: r }, { data: contributors }, { data: aiVersions }, { data: used }, { data: edges }] = await Promise.all([
    db.from("rights_records").select("copyright_holder, attribution_required, derivatives_allowed, commercial_use").eq("artifact_id", artifactId).maybeSingle(),
    db.from("artifact_contributors").select("role, creators!artifact_contributors_contributor_creator_id_fkey(display_name)").eq("artifact_id", artifactId).limit(20),
    db.from("artifact_versions").select("id").eq("artifact_id", artifactId).eq("author_kind", "ai").limit(1),
    versionId ? db.from("artifact_version_sources").select("attribution, rights_state").eq("version_id", versionId) : Promise.resolve({ data: [] as Array<{ attribution: string | null; rights_state: string }> }),
    db.from("lineage_edges").select("source_id").eq("target_type", "artifact").eq("target_id", artifactId).eq("source_type", "material").limit(40),
  ]);
  const matIds = (edges ?? []).map((e) => e.source_id);
  const { data: mats } = matIds.length ? await db.from("creative_materials").select("metadata, source_type").in("id", matIds) : { data: [] as Array<{ metadata: unknown; source_type: string | null }> };
  const credits = new Set<string>();
  for (const c of contributors ?? []) {
    const name = (c.creators as unknown as { display_name: string } | null)?.display_name;
    if (name) credits.add(`${name}${c.role ? ` · ${c.role}` : ""}`);
  }
  // A Room's song (creative-room-parts.md, step 5b): the credits everyone agreed to, by part.
  const { data: song } = await db.from("project_songs").select("project_id").eq("artifact_id", artifactId).maybeSingle();
  if (song) {
    const { data: g } = await db.from("project_song_agreements").select("lines").eq("project_id", song.project_id).eq("status", "agreed").maybeSingle();
    for (const l of (Array.isArray(g?.lines) ? g.lines : []) as Array<{ name?: string; parts?: Array<{ title: string; credit: string }> }>) {
      if (l.name) credits.add(`${l.name} · ${(l.parts ?? []).map((x) => `${x.title} (${x.credit})`).join(", ")}`);
    }
  }
  for (const m of mats ?? []) {
    const lic = (m.metadata as { license?: { name?: string; creator?: string | null; provider?: string | null } } | null)?.license;
    if (lic?.name && licenseRights(lic.name) === "attribution_required") credits.add([lic.creator ? `Image by ${lic.creator}` : "Image", lic.name, lic.provider].filter(Boolean).join(" · "));
  }
  for (const u of used ?? []) if (u.attribution && u.rights_state === "attribution_required") credits.add(u.attribution);
  const { data: gen } = await db.from("carousels").select("generation_id").eq("artifact_id", artifactId).maybeSingle();
  return {
    holder: r?.copyright_holder ?? null,
    allowSharing: settings.rights?.allowSharing ?? true,
    requireAttribution: settings.rights?.requireAttribution ?? r?.attribution_required ?? true,
    // Remixing is offered only when the rights record allows derivatives and the creator says so.
    allowRemix: !!settings.rights?.allowRemix && !!r?.derivatives_allowed,
    commercial: (r?.commercial_use as PublicRights["commercial"]) ?? null,
    credits: [...credits].slice(0, 20),
    aiAssisted: !!aiVersions?.length || !!gen?.generation_id,
  };
}

async function provenanceFor(db: Db, versionId: string | null, versionNumber: number | null, revisionNumber: number) {
  const { data: used } = versionId ? await db.from("artifact_version_sources").select("source_type").eq("version_id", versionId) : { data: [] as Array<{ source_type: string }> };
  const madeFrom: Record<string, number> = {};
  for (const u of used ?? []) madeFrom[u.source_type] = (madeFrom[u.source_type] ?? 0) + 1;
  return { versionNumber, revisionNumber, madeFrom };
}

export const publishSettingsSchema = z.object({
  experience: z.enum(EXPERIENCES).optional(),
  treatment: z.string().max(30).optional(),
  theme: z.enum(["light", "dark", "paper", "cinematic"]).optional(),
  coverObjectId: z.string().uuid().nullish(),
  show: z.object({ description: z.boolean().optional(), transcript: z.boolean().optional(), location: z.boolean().optional(), context: z.boolean().optional() }).optional(),
  rights: z.object({ allowSharing: z.boolean().optional(), requireAttribution: z.boolean().optional(), allowRemix: z.boolean().optional() }).optional(),
});

export const publishSchema = z.object({
  visibility: z.enum(VISIBILITIES).default("public"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/, "Use letters, numbers and dashes.")
    .optional(),
  featured: z.boolean().optional(),
  settings: publishSettingsSchema.optional(),
});

export interface PublicationView {
  workId: string;
  slug: string;
  visibility: PublicationVisibility;
  featured: boolean;
  settings: PublishSettings;
  unpublished: boolean;
  revision: { number: number; publishedAt: string; versionNumber: number | null; manifest: PublicationManifest } | null;
  /** Newer versions saved since this revision was published ("Changes since publishing"). */
  newerVersions: number;
}

/** The creator's publication of a Creation (null when never published), and what could be published now. */
export async function publicationFor(db: Db, artifactId: string) {
  const { data: w } = await db.from("published_works").select("id, slug, visibility, featured, settings, unpublished_at, current_revision_id").eq("artifact_id", artifactId).maybeSingle();
  const settings = (w?.settings as PublishSettings | null) ?? {};
  const built = await buildSnapshot(db, artifactId, settings);
  const { data: a } = await db.from("artifacts").select("title, artifact_type").eq("id", artifactId).single();
  let publication: PublicationView | null = null;
  if (w) {
    const { data: r } = w.current_revision_id ? await db.from("published_revisions").select("revision_number, published_at, version_id, manifest").eq("id", w.current_revision_id).maybeSingle() : { data: null };
    const { data: rv } = r?.version_id ? await db.from("artifact_versions").select("version_number").eq("id", r.version_id).maybeSingle() : { data: null };
    const newer = rv ? ((await db.from("artifact_versions").select("id", { count: "exact", head: true }).eq("artifact_id", artifactId).gt("version_number", rv.version_number)).count ?? 0) : 0;
    publication = {
      workId: w.id,
      slug: w.slug,
      visibility: w.visibility as PublicationVisibility,
      featured: w.featured,
      settings,
      unpublished: !!w.unpublished_at,
      revision: r ? { number: r.revision_number, publishedAt: r.published_at, versionNumber: rv?.version_number ?? null, manifest: r.manifest as unknown as PublicationManifest } : null,
      newerVersions: newer,
    };
  }
  return {
    publication,
    suggestedSlug: slugify(a!.title),
    experiences: experiencesFor(a!.artifact_type, built.snapshot),
    preview: manifestFor(a!.artifact_type, built.snapshot, settings, built.aspectRatio),
    coverCandidates: built.coverCandidates,
  };
}

async function freeSlug(db: Db, creatorId: string, wanted: string, workId: string | null): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const slug = i ? `${wanted.slice(0, 74)}-${i + 1}` : wanted;
    const { data } = await db.from("published_works").select("id").eq("creator_id", creatorId).eq("slug", slug).maybeSingle();
    if (!data || data.id === workId) return slug;
  }
  throw new DomainError("conflict", "Choose another address for this work.");
}

/**
 * Publish (or update the published version of) a Creation: a new revision frozen from the Creation as it is now, made
 * current under the same URL. The first publish picks the address; later ones keep it unless the creator changes it.
 */
export async function publishCreation(db: Db, creatorId: string, artifactId: string, raw: unknown): Promise<PublicationView> {
  const input = publishSchema.parse(raw);
  const { data: a } = await db.from("artifacts").select("id, title, artifact_type, creator_id, status").eq("id", artifactId).maybeSingle();
  if (!a || a.creator_id !== creatorId) throw new DomainError("not_found", "Only the Creation's owner can publish it.");
  if (a.status === "archived") throw new DomainError("validation", "Bring this Creation back from the archive to publish it.");
  const { data: existing } = await db.from("published_works").select("id, slug, settings, visibility, featured").eq("artifact_id", artifactId).maybeSingle();
  const settings: PublishSettings = { ...((existing?.settings as PublishSettings | null) ?? {}), ...(input.settings ?? {}) };
  const slug = await freeSlug(db, creatorId, input.slug ?? existing?.slug ?? slugify(a.title), existing?.id ?? null);

  const built = await buildSnapshot(db, artifactId, settings);
  if (!built.snapshot.content.trim() && !built.snapshot.slides?.length && !built.snapshot.images?.length && !built.snapshot.media)
    throw new DomainError("validation", "There's nothing to publish yet — write or add something first.");
  const manifest = manifestFor(a.artifact_type, built.snapshot, settings, built.aspectRatio);

  let workId = existing?.id ?? null;
  if (!workId) {
    const ins = await db
      .from("published_works")
      .insert({ artifact_id: artifactId, creator_id: creatorId, slug, visibility: input.visibility, featured: input.featured ?? false, settings: settings as never })
      .select("id")
      .single();
    if (ins.error) throw ins.error.code === "23505" ? new DomainError("conflict", "That address is taken. Choose another.") : fromDbError(ins.error);
    workId = ins.data.id;
  }
  const { data: last } = await db.from("published_revisions").select("revision_number").eq("work_id", workId).order("revision_number", { ascending: false }).limit(1).maybeSingle();
  const number = (last?.revision_number ?? 0) + 1;
  const rights = await rightsFor(db, artifactId, built.versionId, settings);
  const provenance = await provenanceFor(db, built.versionId, built.snapshot.versionNumber, number);
  const rev = await db
    .from("published_revisions")
    .insert({
      work_id: workId,
      artifact_id: artifactId,
      creator_id: creatorId,
      revision_number: number,
      version_id: built.versionId,
      manifest: manifest as never,
      snapshot: built.snapshot as never,
      rights_snapshot: rights as never,
      provenance_snapshot: provenance as never,
    })
    .select("id")
    .single();
  if (rev.error) throw fromDbError(rev.error);
  const up = await db
    .from("published_works")
    .update({ current_revision_id: rev.data.id, slug, visibility: input.visibility, featured: input.featured ?? existing?.featured ?? false, settings: settings as never, unpublished_at: null })
    .eq("id", workId)
    .select("id");
  if (up.error) throw up.error.code === "23505" ? new DomainError("conflict", "That address is taken. Choose another.") : fromDbError(up.error);
  return (await publicationFor(db, artifactId)).publication!;
}

/**
 * Preview (owner, 4 Oct 2026: "show the same to user as a prominent preview option so they understand what can happen
 * next"): the Creation as it is now, exactly as its public page would show it — the same snapshot, manifest, rights and
 * provenance a publish would freeze, built as the creator under RLS. Nothing is written.
 */
export async function previewPublication(db: Db, creatorId: string, artifactId: string) {
  const { data: a } = await db.from("artifacts").select("id, title, artifact_type, creator_id").eq("id", artifactId).maybeSingle();
  if (!a || a.creator_id !== creatorId) throw new DomainError("not_found", "That Creation isn't available.");
  const { data: w } = await db.from("published_works").select("slug, visibility, settings, unpublished_at, current_revision_id").eq("artifact_id", artifactId).maybeSingle();
  const settings = (w?.settings as PublishSettings | null) ?? {};
  const built = await buildSnapshot(db, artifactId, settings);
  const manifest = manifestFor(a.artifact_type, built.snapshot, settings, built.aspectRatio);
  const { data: last } = w ? await db.from("published_revisions").select("revision_number, version_id").eq("artifact_id", artifactId).order("revision_number", { ascending: false }).limit(1).maybeSingle() : { data: null };
  const nextRevision = (last?.revision_number ?? 0) + 1;
  const [rights, provenance] = await Promise.all([rightsFor(db, artifactId, built.versionId, settings), provenanceFor(db, built.versionId, built.snapshot.versionNumber, nextRevision)]);
  const live = !!w && !w.unpublished_at && w.visibility !== "private";
  return {
    slug: w?.slug ?? slugify(a.title),
    visibility: (w?.visibility as PublicationVisibility | undefined) ?? "unlisted",
    settings,
    manifest,
    snapshot: built.snapshot,
    rights,
    provenance,
    /** Published and reachable; and whether what's shown here differs from what readers see now. */
    published: live,
    changedSincePublished: live && !!last && last.version_id !== built.versionId,
    empty: !built.snapshot.content.trim() && !built.snapshot.slides?.length && !built.snapshot.images?.length && !built.snapshot.media,
  };
}

/** Presentation and placement only (visibility, featured, address, context and rights toggles) — no new revision. */
export async function updatePublishedWork(db: Db, artifactId: string, raw: unknown): Promise<PublicationView> {
  const input = publishSchema.partial().parse(raw);
  const { data: w } = await db.from("published_works").select("id, creator_id, settings").eq("artifact_id", artifactId).maybeSingle();
  if (!w) throw new DomainError("not_found", "This Creation isn't published yet.");
  const patch: { visibility?: string; featured?: boolean; settings?: never; slug?: string } = {};
  if (input.visibility) patch.visibility = input.visibility;
  if (input.featured !== undefined) patch.featured = input.featured;
  if (input.settings) patch.settings = { ...((w.settings as PublishSettings) ?? {}), ...input.settings } as never;
  if (input.slug) patch.slug = await freeSlug(db, w.creator_id, input.slug, w.id);
  const res = await db.from("published_works").update(patch).eq("id", w.id).select("id");
  if (res.error) throw fromDbError(res.error);
  return (await publicationFor(db, artifactId)).publication!;
}

/** Take it down: the address stops working for everyone else; revisions are kept, and publishing again brings it back. */
export async function unpublishCreation(db: Db, artifactId: string): Promise<void> {
  const res = await db.from("published_works").update({ unpublished_at: new Date().toISOString(), featured: false }).eq("artifact_id", artifactId).select("id");
  if (res.error) throw fromDbError(res.error);
  if (!res.data?.length) throw new DomainError("not_found", "This Creation isn't published.");
}

/** "Open a conversation about this" (§20): the creator's choice, linked from the public page. */
export async function linkPublicationConversation(db: Db, artifactId: string, conversationId: string | null): Promise<void> {
  const { data: w } = await db.from("published_works").select("id, settings").eq("artifact_id", artifactId).maybeSingle();
  if (!w) throw new DomainError("not_found", "Publish this Creation first.");
  const res = await db
    .from("published_works")
    .update({ settings: { ...((w.settings as PublishSettings) ?? {}), conversationId } as never })
    .eq("id", w.id)
    .select("id");
  if (res.error) throw fromDbError(res.error);
}

/** Views, completions and shares this week — for the creator only, never shown publicly (§38). */
export async function publicationStats(db: Db, workId: string, days = 7) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data } = await db.from("published_work_stats").select("views, completions, shares").eq("work_id", workId).gte("day", since);
  return (data ?? []).reduce((t, r) => ({ views: t.views + r.views, completions: t.completions + r.completions, shares: t.shares + r.shares }), { views: 0, completions: 0, shares: 0 });
}

/* ------------------------------------------------------------------------------------------------ Creator Page */

export interface CreatorPageSettings {
  isPublished: boolean;
  headline: string | null;
  intro: string | null;
  sections: Array<{ section: PageSection; enabled: boolean }>;
  publicDejaVuIds: string[];
  publicMomentIds: string[];
  links: Array<{ label: string; url: string }>;
  /** The chosen look (presentation only) and every template's own settings, kept so switching back restores them. */
  templateId: CreatorPageTemplateId;
  templateSettings: Record<string, TemplateSettings>;
}

export const creatorPageSchema = z.object({
  templateId: z.enum(TEMPLATE_IDS).optional(),
  /** Settings for one template: `{ template, settings }`. Only that template's offered choices are accepted. */
  templateSettings: z.object({ template: z.enum(TEMPLATE_IDS), settings: z.record(z.string(), z.union([z.string().max(40), z.boolean()])) }).optional(),
  isPublished: z.boolean().optional(),
  headline: z.string().trim().max(120).nullish(),
  intro: z.string().trim().max(1200).nullish(),
  sections: z
    .array(z.object({ section: z.enum(PAGE_SECTIONS), enabled: z.boolean() }))
    .max(PAGE_SECTIONS.length)
    .refine((s) => new Set(s.map((x) => x.section)).size === s.length, "Each section once.")
    .optional(),
  publicDejaVuIds: z.array(z.string().uuid()).max(12).optional(),
  publicMomentIds: z.array(z.string().uuid()).max(24).optional(),
  links: z
    .array(z.object({ label: z.string().trim().min(1).max(40), url: z.string().trim().url().max(300).refine((u) => /^https:\/\//i.test(u), "Links must start with https://") }))
    .max(8)
    .optional(),
});


export async function getCreatorPage(db: Db, creatorId: string): Promise<CreatorPageSettings> {
  const { data } = await db.from("creator_pages").select("*").eq("creator_id", creatorId).maybeSingle();
  // Defaults when nothing is stored; sections added later appear, switched off, at the end.
  const sections = normalizeSections(data?.sections);
  return {
    isPublished: data?.is_published ?? false,
    headline: data?.headline ?? null,
    intro: data?.intro ?? null,
    sections,
    publicDejaVuIds: data?.public_dejavu_ids ?? [],
    publicMomentIds: data?.public_moment_ids ?? [],
    links: (data?.links as CreatorPageSettings["links"] | null) ?? [],
    templateId: resolveTemplateId(data?.template_id),
    templateSettings: Object.fromEntries(TEMPLATE_IDS.map((t) => [t, settingsFor(t, data?.template_settings)])),
  };
}

/** Save the Creator Page: what the world sees is only what's chosen here (§39) — never a mirror of the Profile. */
export async function saveCreatorPage(db: Db, creatorId: string, raw: unknown): Promise<CreatorPageSettings> {
  const v = creatorPageSchema.parse(raw);
  const cur = await getCreatorPage(db, creatorId);
  if (v.templateSettings) {
    try {
      validateSettings(v.templateSettings.template, v.templateSettings.settings);
    } catch (e) {
      throw new DomainError("validation", (e as Error).message);
    }
  }
  const row = {
    creator_id: creatorId,
    is_published: v.isPublished ?? cur.isPublished,
    headline: v.headline !== undefined ? v.headline || null : cur.headline,
    intro: v.intro !== undefined ? v.intro || null : cur.intro,
    sections: (v.sections ?? cur.sections) as never,
    public_dejavu_ids: v.publicDejaVuIds ?? cur.publicDejaVuIds,
    public_moment_ids: v.publicMomentIds ?? cur.publicMomentIds,
    links: (v.links ?? cur.links) as never,
    template_id: v.templateId ?? cur.templateId,
    template_settings: v.templateSettings ? (mergeTemplateSettings(cur.templateSettings, v.templateSettings.template, v.templateSettings.settings) as never) : (cur.templateSettings as never),
  };
  const res = await db.from("creator_pages").upsert(row, { onConflict: "creator_id" }).select("creator_id");
  if (res.error) throw res.error.code === "42501" ? new DomainError("forbidden", "Only your own DejaVus and Scrapbook entries can go on your page.") : fromDbError(res.error);
  return getCreatorPage(db, creatorId);
}
