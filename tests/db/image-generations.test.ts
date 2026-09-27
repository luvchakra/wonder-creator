import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generationView, regenerateImageGeneration, requestImageGeneration, runImageGeneration, selectGeneratedAsset, type ImageDeps, type ImageProvider } from "@wonder/creator-brain";
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
