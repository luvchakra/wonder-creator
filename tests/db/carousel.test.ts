import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addCarouselSlide,
  carouselView,
  chooseSlideVariation,
  duplicateCarouselSlide,
  regenerateCarouselSlide,
  removeCarouselSlide,
  reorderCarousel as reorderCarouselSlides,
  runImageGeneration,
  runImageRevision,
  splitCarouselSlide,
  startCarousel,
  suggestSlideChunks,
  updateCarouselSlide,
  type ImageDeps,
  type ImageProvider,
} from "@wonder/creator-brain";
import { DomainError } from "@wonder/core";
import { addCollaborator, createArtifact } from "@wonder/creator-studio";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createTestCreator, expectOk, loose, type TestCreator } from "./helpers";

const admin = adminClient();
let owner: TestCreator;
let editor: TestCreator;
let viewer: TestCreator;
let out: TestCreator;
let piece: string;
let png: Uint8Array;
const db = (x: TestCreator) => x.client as unknown as AppDb;
const poem = "Moon wanes,\nhides in the new-moon pocket.\n\nIn the mirror—\nonly loneliness.\n\nDim light,\na face like a question.\n\nSome things\nstay unsaid.";

function fakeProvider(failAt: number[] = []): ImageProvider & { calls: number; prompts: string[] } {
  const p = {
    name: "test",
    live: true,
    calls: 0,
    prompts: [] as string[],
    async generate(req: { prompt: string; model: string }) {
      const n = p.calls++;
      p.prompts.push(req.prompt);
      if (failAt.includes(n)) throw new DomainError("provider_failed", "blocked");
      return { image: { mimeType: "image/png", bytes: png }, model: req.model };
    },
  };
  return p;
}
const derive = async (bytes: Uint8Array) => {
  const master = await sharp(bytes).webp().toBuffer({ resolveWithObject: true });
  return { master: new Uint8Array(master.data), thumbnail: new Uint8Array(await sharp(bytes).resize(4).webp().toBuffer()), width: master.info.width, height: master.info.height };
};
const deps = (x: TestCreator, provider: ImageProvider = fakeProvider()): ImageDeps => ({ db: db(x), service: admin, creatorId: x.creatorId, provider, derive });

beforeAll(async () => {
  png = new Uint8Array(await sharp({ create: { width: 8, height: 10, channels: 3, background: "#203040" } }).png().toBuffer());
  [owner, editor, viewer, out] = await Promise.all(["carOwner", "carEditor", "carViewer", "carOut"].map((l) => createTestCreator(l)));
  piece = (await createArtifact(db(owner), owner.creatorId, { artifactType: "carousel", title: "Amavas", content: poem, authorKind: "creator", provenance: { origin: "typed" } })).id;
  await addCollaborator(db(owner), owner.creatorId, piece, { creatorId: editor.creatorId, role: "Designer", access: "edit" });
  await addCollaborator(db(owner), owner.creatorId, piece, { creatorId: viewer.creatorId, role: "Reader", access: "comment" });
});
afterAll(cleanupTestCreators);

describe("Carousel Composer", () => {
  it("starts with the chosen count, one image per chunk, and seeds slides once when the set is ready", async () => {
    await expect(startCarousel(deps(editor), piece, { count: 4, visualStyle: "atmospheric", aspectRatio: "4:5" })).rejects.toThrow(/isn't available/);
    const offline = { name: "none", live: false, generate: async () => Promise.reject(new Error("never")) } as ImageProvider;
    expect((await startCarousel(deps(owner, offline), piece, { count: 4, visualStyle: "atmospheric", aspectRatio: "4:5" })).kind).toBe("unavailable");

    const provider = fakeProvider([2]); // the third image is blocked
    const started = await startCarousel(deps(owner, provider), piece, { count: 4, visualStyle: "atmospheric", aspectRatio: "4:5", idempotencyKey: "carousel-start-1" });
    if (started.kind !== "generation") throw new Error(started.kind);
    const before = await carouselView(deps(owner), piece);
    expect(before.generating).toMatchObject({ requested: 4, ready: 0 });
    expect(before.slides).toEqual([]);

    await runImageGeneration({ service: admin, provider, derive }, started.generationId);
    expect(provider.calls).toBe(4);
    // Each image is made from its own words, fenced, in one visual style.
    expect(provider.prompts[1]).toContain("In the mirror—");
    expect(provider.prompts[1]).toContain("<untrusted_material");
    expect(provider.prompts[1]).toContain("atmospheric and cinematic");

    const [v1, v2] = await Promise.all([carouselView(deps(owner), piece), carouselView(deps(editor), piece)]);
    expect(v1.slides.map((s) => s.displayText)).toEqual(["Moon wanes,\nhides in the new-moon pocket.", "In the mirror—\nonly loneliness.", "Dim light,\na face like a question.", "Some things\nstay unsaid."]);
    // Seeded once, even when two people open it at the same moment.
    expect(v2.slides).toHaveLength(4);
    expect(expectOk(await admin.from("carousel_slides").select("id").eq("artifact_id", piece))).toHaveLength(4);
    expect(v1.slides.map((s) => !!s.image)).toEqual([true, true, false, true]);
    expect(v1.slides[0]!.image!.thumbnailUrl).toContain("token=");
    expect(v1).toMatchObject({ isOwner: true, canEdit: true, settings: { requestedCount: 4, aspectRatio: "4:5", visualStyle: "atmospheric" } });
    expect(v2).toMatchObject({ isOwner: false, canEdit: true });
    expect((await carouselView(deps(viewer), piece)).canEdit).toBe(false);
    await expect(carouselView(deps(out), piece)).rejects.toThrow(/isn't available/);
    await expect(startCarousel(deps(owner, provider), piece, { count: 5, visualStyle: "auto", aspectRatio: "1:1" })).rejects.toThrow(/already has slides/);
  });

  it("lets editors change words, overlay, crop and order; nobody can point a slide at another image", async () => {
    const v = await carouselView(deps(owner), piece);
    const [a, b, c, d] = v.slides.map((s) => s.id) as [string, string, string, string];
    await updateCarouselSlide(db(editor), b, { displayText: "In the mirror — only loneliness.", overlay: { enabled: true, x: 0.5, y: 0.84, width: 0.8, font: "serif", size: 0.07, align: "center", color: "#ffffff", shadow: true, background: "shade" }, transform: { zoom: 1.5, focalX: 0.4, focalY: 0.6 } });
    await expect(updateCarouselSlide(db(viewer), b, { displayText: "hijack" })).rejects.toThrow(/isn't available/);
    await expect(updateCarouselSlide(db(editor), b, { overlay: { enabled: true, x: 5 } })).rejects.toThrow();
    const after = (await carouselView(deps(viewer), piece)).slides[1]!;
    expect(after).toMatchObject({ displayText: "In the mirror — only loneliness.", overlay: { enabled: true, y: 0.84 }, transform: { zoom: 1.5 } });
    // The source words are kept apart from what's shown.
    expect(after.sourceText).toBe("In the mirror—\nonly loneliness.");

    // Images and membership can't be written by people directly.
    const other = expectOk(await admin.from("image_generation_assets").select("id").neq("creator_id", owner.creatorId).limit(1));
    expect((await loose(owner.client).from("carousel_slides").update({ asset_id: other[0]?.id ?? a }).eq("id", a).select("id")).error).not.toBeNull();
    expect((await loose(owner.client).from("carousel_slides").insert({ artifact_id: piece, creator_id: owner.creatorId, order_index: 9 })).error).not.toBeNull();
    expect((await loose(owner.client).from("carousel_slides").delete().eq("id", a).select("id")).data ?? []).toEqual([]);

    await reorderCarouselSlides(db(editor), piece, [d, a, b, c]);
    expect((await carouselView(deps(owner), piece)).slides.map((s) => s.id)).toEqual([d, a, b, c]);
    await expect(reorderCarouselSlides(db(editor), piece, [d, a, b])).rejects.toThrow(/doesn't match/);
    await expect(reorderCarouselSlides(db(viewer), piece, [a, b, c, d])).rejects.toThrow(/can't arrange/);
    await reorderCarouselSlides(db(owner), piece, [a, b, c, d]);
  });

  it("adds exactly one slide, regenerates one image as a choice, and fills a slide without an image", async () => {
    const provider = fakeProvider();
    const v = await carouselView(deps(owner), piece);
    const [a, b, c] = v.slides as [(typeof v.slides)[0], (typeof v.slides)[0], (typeof v.slides)[0]];
    await expect(addCarouselSlide(deps(editor, provider), piece, {})).rejects.toThrow(/isn't available/);
    // Every stanza is used, so the new slide comes with no words (the creator adds them).
    const add = await addCarouselSlide(deps(owner, provider), piece, { instruction: "Night scene", idempotencyKey: "carousel-add-01" });
    if (add.kind !== "queued") throw new Error(add.kind);
    expect((await addCarouselSlide(deps(owner, provider), piece, { idempotencyKey: "carousel-add-01" })) as { revisionId: string }).toMatchObject({ revisionId: add.revisionId, queued: false });
    expect((await carouselView(deps(owner), piece)).adding).toBe(1);
    await runImageRevision({ service: admin, provider, derive }, add.revisionId);
    const withFive = await carouselView(deps(owner), piece);
    expect(withFive.slides).toHaveLength(5);
    expect(withFive.slides.slice(0, 4).map((s) => s.id)).toEqual(v.slides.map((s) => s.id)); // the rest untouched
    expect(withFive.slides[4]!.image).not.toBeNull();
    expect(provider.prompts.at(-1)).toContain("Night scene");

    // Regenerate slide 2: a variation waits beside the current image.
    const rg = await regenerateCarouselSlide(deps(owner, provider), b.id, { instruction: "Warmer, closer shot" });
    if (rg.kind !== "queued") throw new Error(rg.kind);
    expect((await carouselView(deps(owner), piece)).slides[1]!.change).toEqual({ kind: "variation", status: "queued" });
    await runImageRevision({ service: admin, provider, derive }, rg.revisionId);
    expect(provider.prompts.at(-1)).toContain("Warmer, closer shot");
    expect(provider.prompts.at(-1)).toContain("In the mirror — only loneliness.");
    const waiting = (await carouselView(deps(owner), piece)).slides[1]!;
    expect(waiting.pending).not.toBeNull();
    const currentUrl = waiting.image!.url!.split("?")[0];
    await expect(chooseSlideVariation(deps(editor), b.id, "use")).rejects.toThrow(/isn't available/);
    await chooseSlideVariation(deps(owner), b.id, "keep");
    const kept = (await carouselView(deps(owner), piece)).slides[1]!;
    expect([kept.pending, kept.image!.url!.split("?")[0]]).toEqual([null, currentUrl]);

    const again = await regenerateCarouselSlide(deps(owner, provider), b.id, {});
    if (again.kind !== "queued") throw new Error(again.kind);
    await runImageRevision({ service: admin, provider, derive }, again.revisionId);
    await chooseSlideVariation(deps(owner), b.id, "use");
    expect((await carouselView(deps(owner), piece)).slides[1]!.image!.url!.split("?")[0]).not.toBe(currentUrl);

    // Slide 3 had no image: regenerating fills it.
    expect(c.image).toBeNull();
    const fill = await regenerateCarouselSlide(deps(owner, provider), c.id, {});
    if (fill.kind !== "queued") throw new Error(fill.kind);
    await runImageRevision({ service: admin, provider, derive }, fill.revisionId);
    expect((await carouselView(deps(owner), piece)).slides[2]!.image).not.toBeNull();

    // A failed change says so on its slide and changes nothing.
    const failing = fakeProvider([0]);
    const bad = await regenerateCarouselSlide(deps(owner, failing), a.id, {});
    if (bad.kind !== "queued") throw new Error(bad.kind);
    await runImageRevision({ service: admin, provider: failing, derive }, bad.revisionId);
    expect((await carouselView(deps(owner), piece)).slides[0]).toMatchObject({ pending: null, change: { kind: "variation", status: "failed" } });
  });

  it("splits, duplicates and removes slides without generating; suggests other words without changing the source", async () => {
    const v = await carouselView(deps(owner), piece);
    const b = v.slides[1]!;
    const { slideId } = await splitCarouselSlide(deps(editor), b.id);
    const split = await carouselView(deps(owner), piece);
    expect(split.slides.map((s) => s.id).indexOf(slideId)).toBe(2);
    expect([split.slides[1]!.displayText, split.slides[2]!.displayText]).toEqual(["In the mirror —", "only loneliness."]);
    expect(split.slides[2]!.image!.url!.split("?")[0]).toBe(split.slides[1]!.image!.url!.split("?")[0]); // no new image yet

    const dup = await duplicateCarouselSlide(deps(owner), slideId);
    expect((await carouselView(deps(owner), piece)).slides).toHaveLength(7);
    await removeCarouselSlide(deps(editor), dup.slideId);
    await expect(removeCarouselSlide(deps(viewer), slideId)).rejects.toThrow(/isn't available/);
    const after = await carouselView(deps(owner), piece);
    expect(after.slides.map((s) => s.order)).toEqual([0, 1, 2, 3, 4, 5]);

    const alts = await suggestSlideChunks(deps(owner), after.slides[0]!.id);
    expect(alts.length).toBeGreaterThan(0);
    expect(alts).not.toContain(after.slides[0]!.displayText);
    const { data: art } = await admin.from("artifacts").select("current_version_id").eq("id", piece).single();
    expect(expectOk(await admin.from("artifact_versions").select("content").eq("id", art!.current_version_id!).single()).content).toBe(poem);
  });
});
