import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, cleanupTestCreators, createArtifact, createMaterial, createTestCreator, expectDenied, expectNoRowsAffected, expectOk, loose, type TestCreator } from "./helpers";

const admin = adminClient();
let a: TestCreator;
let b: TestCreator;
let aMat: string;
let aMat2: string;
let bMat: string;
let aCol: string;
let bCol: string;

beforeAll(async () => {
  [a, b] = await Promise.all([createTestCreator("colA"), createTestCreator("colB")]);
  [aMat, aMat2, bMat] = await Promise.all([createMaterial(a, "Harbour"), createMaterial(a, "Lantern"), createMaterial(b, "B's secret")]);
  aCol = expectOk(await a.client.from("material_collections").insert({ creator_id: a.creatorId, name: "Film References" }).select("id").single()).id;
  bCol = expectOk(await b.client.from("material_collections").insert({ creator_id: b.creatorId, name: "Film References" }).select("id").single()).id;
});
afterAll(cleanupTestCreators);

describe("material collections", () => {
  it("one material can belong to several collections, by reference", async () => {
    const other = expectOk(await a.client.from("material_collections").insert({ creator_id: a.creatorId, name: "Locations" }).select("id").single()).id;
    expectOk(await a.client.from("material_collection_items").insert([
      { collection_id: aCol, material_id: aMat, creator_id: a.creatorId },
      { collection_id: other, material_id: aMat, creator_id: a.creatorId },
    ]));
    const rows = expectOk(await a.client.from("material_collection_items").select("collection_id").eq("material_id", aMat));
    expect(rows.map((r) => r.collection_id).sort()).toEqual([aCol, other].sort());
  });

  it("nobody can put someone else's material in a collection, or add to someone else's collection", async () => {
    expectDenied(await a.client.from("material_collection_items").insert({ collection_id: aCol, material_id: bMat, creator_id: a.creatorId }));
    expectDenied(await b.client.from("material_collection_items").insert({ collection_id: aCol, material_id: bMat, creator_id: b.creatorId }));
    expectDenied(await b.client.from("material_collection_items").insert({ collection_id: aCol, material_id: bMat, creator_id: a.creatorId }));
  });

  it("the cover must be the owner's own material", async () => {
    expectDenied(await a.client.from("material_collections").update({ cover_material_id: bMat }).eq("id", aCol).select("id"));
    expectOk(await a.client.from("material_collections").update({ cover_material_id: aMat }).eq("id", aCol).select("id"));
    expectNoRowsAffected(await b.client.from("material_collections").update({ cover_material_id: bMat }).eq("id", aCol).select("id"));
  });

  it("a collection can't be made public or shared", async () => {
    expectDenied(await loose(a.client).from("material_collections").update({ privacy: "public" }).eq("id", aCol).select("id"), "23514");
  });

  it("manual order is stored per item and only the owner can change it", async () => {
    expectOk(await a.client.from("material_collection_items").insert({ collection_id: aCol, material_id: aMat2, creator_id: a.creatorId }));
    expectOk(await a.client.from("material_collection_items").update({ position: 0 }).eq("collection_id", aCol).eq("material_id", aMat2).select("material_id"));
    expectNoRowsAffected(await b.client.from("material_collection_items").update({ position: 5 }).eq("collection_id", aCol).eq("material_id", aMat2).select("material_id"));
    const first = expectOk(await a.client.from("material_collection_items").select("material_id").eq("collection_id", aCol).order("position", { nullsFirst: false }).limit(1).single());
    expect(first.material_id).toBe(aMat2);
  });

  it("a conversation can only start from the creator's own collection", async () => {
    expectOk(await a.client.from("conversations").insert({ creator_id: a.creatorId, title: "From a collection", collection_id: aCol }).select("id").single());
    expectDenied(await b.client.from("conversations").insert({ creator_id: b.creatorId, title: "Probe", collection_id: aCol }).select("id").single());
  });

  it("lineage can name the owner's collection as a source, never someone else's", async () => {
    const art = await createArtifact(a);
    expectOk(await a.client.from("lineage_edges").insert({ creator_id: a.creatorId, source_type: "collection", source_id: aCol, target_type: "artifact", target_id: art, relationship: "references" }));
    const bArt = await createArtifact(b);
    expectDenied(await b.client.from("lineage_edges").insert({ creator_id: b.creatorId, source_type: "collection", source_id: aCol, target_type: "artifact", target_id: bArt, relationship: "references" }));
  });

  it("removing from a collection or deleting it never deletes the material", async () => {
    expectOk(await a.client.from("material_collection_items").delete().eq("collection_id", aCol).eq("material_id", aMat).select("material_id"));
    expectOk(await a.client.from("material_collections").delete().eq("id", aCol).select("id"));
    const left = expectOk(await admin.from("creative_materials").select("id").in("id", [aMat, aMat2]));
    expect(left).toHaveLength(2);
  });

  it("B's collection with the same name is separate and invisible to A", async () => {
    expect(expectOk(await a.client.from("material_collections").select("id").eq("id", bCol))).toEqual([]);
  });
});
