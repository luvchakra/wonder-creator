import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generationView, regenerateImageGeneration, requestImageGeneration, runImageGeneration, reorderGeneratedAssets, requestAssetRevision, runImageRevision, saveGeneratedAsset, saveTextOverlay, selectGeneratedAsset, type ImageDeps, type ImageProvider } from "@wonder/creator-brain";
import { DomainError } from "@wonder/core";
import { addCollaborator, createArtifact, saveCreatorVersion } from "@wonder/creator-studio";
import { createMaterial } from "@wonder/creator-library";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createTestCreator, expectOk, type TestCreator } from "./helpers";

const admin = adminClient();
let owner: TestCreator;
let pia: TestCreator;
let out: TestCreator;
let piece: string;
const db = (x: TestCreator) => x.client as unknown as AppDb;

let png: Uint8Array;
/** A live stand-in for the image model (tests only): counts calls, can fail chosen images. */
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
const deps = (x: TestCreator, provider: ImageProvider): ImageDeps => ({ db: db(x), service: admin, creatorId: x.creatorId, provider, derive });

beforeAll(async () => {
  png = new Uint8Array(await sharp({ create: { width: 8, height: 8, channels: 3, background: "#e8c9a0" } }).png().toBuffer());
  [owner, pia, out] = await Promise.all(["imgOwner", "imgPia", "imgOut"].map((l) => createTestCreator(l)));
  piece = (await createArtifact(db(owner), owner.creatorId, { artifactType: "poem", title: "Night ferry", content: "The ferry hums across the dark water.", authorKind: "creator", provenance: { origin: "typed" } })).id;
  await addCollaborator(db(owner), owner.creatorId, piece, { creatorId: pia.creatorId, role: "Co-writer", access: "comment" });
});
afterAll(cleanupTestCreators);

describe("contextual image generation", () => {
  it("generates once per context, reuses it on the next visit, and only regenerates when asked", async () => {
    const provider = fakeProvider([2]); // the third image is blocked
    const first = await requestImageGeneration(deps(owner, provider), { artifactId: piece, purpose: "carousel" });
    expect(first.kind).toBe("generation");
    if (first.kind !== "generation") return;
    expect(first.view.status).toBe("queued");
    expect(first.view.cached).toBe(false);

    // Same context while it's in flight: the same generation (dedupe), nothing new queued.
    const again = await requestImageGeneration(deps(owner, provider), { artifactId: piece, purpose: "carousel" });
    expect(again.kind === "generation" && again.view.id).toBe(first.view.id);
    expect(expectOk(await admin.from("jobs").select("id").eq("subject_id", first.view.id))).toHaveLength(1);

    await runImageGeneration({ service: admin, provider, derive }, first.view.id);
    expect(provider.calls).toBe(4);
    // Creator text reached the model fenced, never as instructions.
    expect(provider.prompts[0]).toContain("<untrusted_material");

    const view = (await generationView(db(owner), admin, first.view.id))!;
    expect(view.status).toBe("partial"); // 3 of 4 kept, nothing stored for the blocked one
    expect(view.assets.map((a) => a.sequence)).toEqual([0, 1, 3]);
    expect(view.assets.every((a) => a.thumbnailUrl?.includes("token="))).toBe(true);
    expect(new Set(view.assets.map((a) => a.directionLabel)).size).toBe(3);

    // Coming back: the stored carousel, no provider call.
    const hit = await requestImageGeneration(deps(owner, provider), { artifactId: piece, purpose: "carousel" });
    expect(hit.kind === "generation" && hit.view.id).toBe(first.view.id);
    expect(hit.kind === "generation" && hit.view.cached).toBe(true);
    expect(provider.calls).toBe(4);

    // "Try another direction": a new variation; the old one stays.
    const regen = await regenerateImageGeneration(deps(owner, provider), first.view.id);
    expect(regen.kind === "generation" && regen.view.id).not.toBe(first.view.id);
    expect(await generationView(db(owner), admin, first.view.id)).not.toBeNull();

    await selectGeneratedAsset({ db: db(owner), service: admin, creatorId: owner.creatorId }, first.view.id, view.assets[1]!.id);
    expect((await generationView(db(owner), admin, first.view.id))!.assets.filter((a) => a.selected).map((a) => a.id)).toEqual([view.assets[1]!.id]);
  });

  it("a new version is new context; lookups never start work; no provider means an honest 'unavailable'", async () => {
    const provider = fakeProvider();
    const { data: v } = await db(owner).from("artifacts").select("current_version_id").eq("id", piece).single();
    await saveCreatorVersion(db(owner), piece, { content: "The ferry hums; the harbour answers.", baseVersionId: v!.current_version_id, label: "Revised" });
    expect((await requestImageGeneration(deps(owner, provider), { artifactId: piece, purpose: "carousel", lookupOnly: true })).kind).toBe("none");
    const offline = { name: "none", live: false, generate: async () => Promise.reject(new Error("never")) } as ImageProvider;
    expect((await requestImageGeneration(deps(owner, offline), { artifactId: piece, purpose: "carousel" })).kind).toBe("unavailable");
    expect(provider.calls).toBe(0);
  });

  it("collaborators see the Creation's shared carousel; outsiders see nothing and nobody writes rows directly", async () => {
    const { data: gens } = await admin.from("image_generations").select("id").eq("artifact_id", piece).order("created_at").limit(1);
    const id = gens![0]!.id;
    expect(await generationView(db(pia), admin, id)).not.toBeNull();
    expect(await generationView(db(out), admin, id)).toBeNull();
    expect(expectOk(await db(out).from("image_generation_assets").select("id").eq("generation_id", id))).toEqual([]);
    // Only the owner generates from their Creation.
    await expect(requestImageGeneration(deps(pia, fakeProvider()), { artifactId: piece, purpose: "carousel" })).rejects.toThrow(/isn't available/);
    // Pipeline state can't be forged by clients.
    expect((await db(owner).from("image_generations").update({ status: "complete" }).eq("id", id).select()).data ?? []).toEqual([]);
    expect((await db(owner).from("image_generation_assets").insert({ generation_id: id, creator_id: owner.creatorId, storage_object_id: id, sequence: 9 })).error).not.toBeNull();
    await expect(selectGeneratedAsset({ db: db(pia), service: admin, creatorId: pia.creatorId }, id, id)).rejects.toThrow(/isn't available/);
  });

  it("uses only the creator's own Materials as context", async () => {
    const mine = await createMaterial(db(out), out.creatorId, { type: "note", title: "Out's private note", textContent: "secret", provenance: { origin: "typed" } });
    await expect(requestImageGeneration(deps(owner, fakeProvider()), { materialIds: [mine.id], purpose: "explore" })).rejects.toThrow(/aren't available/);
  });
});

describe("keeping a generated image", () => {
  it("saves it as a Material with provenance and lineage, once, and can add it to the Creation", async () => {
    const provider = fakeProvider();
    const gen = await requestImageGeneration(deps(owner, provider), { artifactId: piece, purpose: "explore" });
    if (gen.kind !== "generation") throw new Error(gen.kind);
    await runImageGeneration({ service: admin, provider, derive }, gen.view.id);
    const view = (await generationView(db(owner), admin, gen.view.id))!;
    const asset = view.assets[0]!;

    // Only the owner can keep it.
    await expect(saveGeneratedAsset({ db: db(pia), service: admin, creatorId: pia.creatorId }, gen.view.id, asset.id)).rejects.toThrow(/isn't available/);

    const { materialId } = await saveGeneratedAsset({ db: db(owner), service: admin, creatorId: owner.creatorId }, gen.view.id, asset.id, { useInCreation: true });
    const again = await saveGeneratedAsset({ db: db(owner), service: admin, creatorId: owner.creatorId }, gen.view.id, asset.id);
    expect(again.materialId).toBe(materialId);

    const m = expectOk(await db(owner).from("creative_materials").select("type, source_type, security_status, provenance_records(origin, details)").eq("id", materialId).single());
    expect(m).toMatchObject({ type: "image", source_type: "generated", security_status: "clean" });
    const prov = (m as unknown as { provenance_records: { origin: string; details: Record<string, unknown> } }).provenance_records;
    expect(prov.origin).toBe("ai_generated");
    expect(prov.details).toMatchObject({ generationId: gen.view.id, sourceArtifactId: piece, provider: "test", promptVersion: "context-image-v1" });

    const edges = expectOk(await db(owner).from("lineage_edges").select("source_type, source_id, target_type, target_id, relationship").or(`target_id.eq.${materialId},source_id.eq.${materialId}`));
    expect(edges).toEqual(
      expect.arrayContaining([
        { source_type: "artifact", source_id: piece, target_type: "material", target_id: materialId, relationship: "derived_from" },
        { source_type: "material", source_id: materialId, target_type: "artifact", target_id: piece, relationship: "references" },
      ]),
    );
    expect((await generationView(db(owner), admin, gen.view.id))!.assets[0]!.savedMaterialId).toBe(materialId);
    // It's the owner's Material, not a collaborator's.
    expect(expectOk(await db(out).from("creative_materials").select("id").eq("id", materialId))).toEqual([]);
  });
});

describe("words on a slide visual", () => {
  it("keeps the composed image as a derived Material that records the words and its source image", async () => {
    const provider = fakeProvider();
    const gen = await requestImageGeneration(deps(owner, provider), { artifactId: piece, purpose: "carousel" });
    if (gen.kind !== "generation") throw new Error(gen.kind);
    await runImageGeneration({ service: admin, provider, derive }, gen.view.id);
    const asset = (await generationView(db(owner), admin, gen.view.id))!.assets[1]!;
    const composed = new Uint8Array(await sharp({ create: { width: 8, height: 10, channels: 3, background: "#203040" } }).jpeg().toBuffer());
    const text = "बारिश की पहली बूँद";
    const d = (x: TestCreator) => ({ db: db(x), service: admin, creatorId: x.creatorId, derive });

    // Only the owner; only images; never empty words.
    await expect(saveTextOverlay(d(pia), gen.view.id, asset.id, { bytes: composed, text })).rejects.toThrow(/isn't available/);
    await expect(saveTextOverlay(d(owner), gen.view.id, asset.id, { bytes: new TextEncoder().encode("<svg onload=alert(1)>"), text })).rejects.toThrow(/can't|isn't an image/i);
    await expect(saveTextOverlay(d(owner), gen.view.id, asset.id, { bytes: composed, text: "  " })).rejects.toThrow(/Add some words/);

    const { materialId } = await saveTextOverlay(d(owner), gen.view.id, asset.id, { bytes: composed, text, useInCreation: true });
    const m = expectOk(await db(owner).from("creative_materials").select("title, type, source_type, storage_object_id, provenance_records(origin, details)").eq("id", materialId).single());
    expect(m).toMatchObject({ type: "image", source_type: "generated", title: `Slide 2 · ${text}` });
    const prov = (m as unknown as { provenance_records: { origin: string; details: Record<string, unknown> } }).provenance_records;
    expect(prov.origin).toBe("derived");
    expect(prov.details).toMatchObject({ derivation: "text_overlay", generationId: gen.view.id, assetId: asset.id, overlayText: text, sourceArtifactId: piece });
    const obj = expectOk(await admin.from("storage_objects").select("mime_type, creator_id").eq("id", (m as { storage_object_id: string }).storage_object_id).single());
    expect(obj).toEqual({ mime_type: "image/webp", creator_id: owner.creatorId });
    const edges = expectOk(await db(owner).from("lineage_edges").select("source_type, source_id, target_type, target_id, relationship").or(`target_id.eq.${materialId},source_id.eq.${materialId}`));
    expect(edges).toEqual(
      expect.arrayContaining([
        { source_type: "artifact", source_id: piece, target_type: "material", target_id: materialId, relationship: "derived_from" },
        { source_type: "material", source_id: materialId, target_type: "artifact", target_id: piece, relationship: "references" },
      ]),
    );
    expect(expectOk(await db(out).from("creative_materials").select("id").eq("id", materialId))).toEqual([]);
  });
});

describe("arranging and changing slide visuals", () => {
  it("keeps the creator's order, and changes one image with their instruction without overwriting it", async () => {
    const provider = fakeProvider();
    const piece2 = (await createArtifact(db(owner), owner.creatorId, { artifactType: "carousel", title: "Harbour at dusk", content: "Slide 1: boats\nSlide 2: nets\nSlide 3: gulls", authorKind: "creator", provenance: { origin: "typed" } })).id;
    const gen = await requestImageGeneration(deps(owner, provider), { artifactId: piece2, purpose: "carousel", count: 3 });
    if (gen.kind !== "generation") throw new Error(gen.kind);
    await runImageGeneration({ service: admin, provider, derive }, gen.view.id);
    const first = (await generationView(db(owner), admin, gen.view.id))!;
    const [a, b, c] = first.assets.map((x) => x.id) as [string, string, string];
    const d = (x: TestCreator) => ({ db: db(x), service: admin, creatorId: x.creatorId });

    // Order: only the owner, only the exact set.
    await expect(reorderGeneratedAssets(d(pia), gen.view.id, [c, a, b])).rejects.toThrow(/isn't available/);
    await expect(reorderGeneratedAssets(d(owner), gen.view.id, [c, a])).rejects.toThrow(/doesn't match/);
    await expect(reorderGeneratedAssets(d(owner), gen.view.id, [c, a, a])).rejects.toThrow(/doesn't match/);
    await reorderGeneratedAssets(d(owner), gen.view.id, [c, a, b]);
    expect((await generationView(db(owner), admin, gen.view.id))!.assets.map((x) => x.id)).toEqual([c, a, b]);

    // Change the middle image (a). Outsiders can't; no provider means an honest "unavailable".
    await expect(requestAssetRevision(deps(out, provider), gen.view.id, a, { instruction: "night" })).rejects.toThrow(/isn't available/);
    const offline = { name: "none", live: false, generate: async () => Promise.reject(new Error("never")) } as ImageProvider;
    expect((await requestAssetRevision(deps(owner, offline), gen.view.id, a, { instruction: "make it night" })).kind).toBe("unavailable");
    await selectGeneratedAsset(d(owner), gen.view.id, a);
    const asked = await requestAssetRevision(deps(owner, provider), gen.view.id, a, { instruction: "make it night, with rain on the water", idempotencyKey: "rev-key-0001" });
    if (asked.kind !== "revision") throw new Error(asked.kind);
    expect(asked.view.revisions).toEqual([{ id: asked.revisionId, assetId: a, status: "queued" }]);
    // Same key → same revision; a second ask while it's running doesn't queue another.
    const again = await requestAssetRevision(deps(owner, provider), gen.view.id, a, { instruction: "make it night, with rain on the water", idempotencyKey: "rev-key-0001" });
    expect(again.kind === "revision" && again.revisionId).toBe(asked.revisionId);
    expect(((await requestAssetRevision(deps(owner, provider), gen.view.id, a, { instruction: "other" })) as { queued: boolean }).queued).toBe(false);
    expect(expectOk(await admin.from("jobs").select("id").eq("subject_id", asked.revisionId))).toHaveLength(1);
    // Collaborators never see the creator's words.
    expect(expectOk(await db(pia).from("image_asset_revisions").select("id").eq("generation_id", gen.view.id))).toEqual([]);

    const calls = provider.calls;
    await runImageRevision({ service: admin, provider, derive }, asked.revisionId);
    expect(provider.calls).toBe(calls + 1);
    expect(provider.prompts.at(-1)).toContain("make it night, with rain on the water");
    const after = (await generationView(db(owner), admin, gen.view.id))!;
    const fresh = after.assets[1]!;
    // Same place and choice in the set; the old image is kept, not overwritten.
    expect(after.assets.map((x) => x.id)).toEqual([c, fresh.id, b]);
    expect(fresh).toMatchObject({ revised: true, selected: true, directionLabel: first.assets.find((x) => x.id === a)!.directionLabel });
    expect(fresh.id).not.toBe(a);
    const old = expectOk(await admin.from("image_generation_assets").select("replaced_by, storage_object_id").eq("id", a).single());
    expect(old.replaced_by).toBe(fresh.id);
    expect(expectOk(await admin.from("storage_objects").select("id").eq("id", old.storage_object_id))).toHaveLength(1);
    expect(after.revisions).toEqual([]);
    // The replaced image can't be changed again or ordered.
    await expect(requestAssetRevision(deps(owner, provider), gen.view.id, a, { instruction: "x" })).rejects.toThrow(/already changed/);
    await expect(reorderGeneratedAssets(d(owner), gen.view.id, [a, b, c])).rejects.toThrow(/doesn't match/);

    // A failed change stores nothing and says so.
    const failing = fakeProvider([0]);
    const bad = await requestAssetRevision(deps(owner, failing), gen.view.id, b, { instruction: "blocked" });
    if (bad.kind !== "revision") throw new Error(bad.kind);
    await runImageRevision({ service: admin, provider: failing, derive }, bad.revisionId);
    const v = (await generationView(db(owner), admin, gen.view.id))!;
    expect(v.assets.map((x) => x.id)).toEqual([c, fresh.id, b]);
    expect(v.revisions).toEqual([{ id: bad.revisionId, assetId: b, status: "failed" }]);
  });
});
