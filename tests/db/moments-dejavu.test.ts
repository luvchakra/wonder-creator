import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, cleanupTestCreators, createArtifact, createMaterial, createTestCreator, expectDenied, expectNoRowsAffected, expectOk, loose, type TestCreator } from "./helpers";

// Phase 01 — Moments + DejaVu (docs/moments-dejavu.md): references never widen access, never duplicate the entity,
// and go when the entity goes.
const admin = adminClient();
let a: TestCreator;
let b: TestCreator;
let aMat: string;
let bMat: string;
let aArt: string;

const momentOf = async (c: TestCreator, type: string, id: string) =>
  (await c.client.from("moment_references").select("*").eq("entity_type", type).eq("entity_id", id).maybeSingle()).data;

beforeAll(async () => {
  [a, b] = await Promise.all([createTestCreator("dvA"), createTestCreator("dvB")]);
  [aMat, bMat] = await Promise.all([createMaterial(a, "Dad's railway story"), createMaterial(b, "B's secret")]);
  aArt = await createArtifact(a, { title: "A Life in Moments" });
});
afterAll(cleanupTestCreators);

describe("Moment references", () => {
  it("a new Material and a new Creation get their Moment as they're written — a reference with a preview, private", async () => {
    const m = await momentOf(a, "material", aMat);
    expect(m).toMatchObject({ creator_id: a.creatorId, visibility: "private", title: "Dad's railway story", subtype: "note", preview_kind: "text" });
    const c = await momentOf(a, "creation", aArt);
    expect(c).toMatchObject({ creator_id: a.creatorId, visibility: "private", title: "A Life in Moments", subtype: "poem" });
  });

  it("is idempotent: one Moment per creator per entity", async () => {
    expectDenied(await a.client.from("moment_references").insert({ creator_id: a.creatorId, entity_type: "material", entity_id: aMat }), "23505");
  });

  it("nobody can reference what they can't open, or see someone else's Moments", async () => {
    expectDenied(await b.client.from("moment_references").insert({ creator_id: b.creatorId, entity_type: "material", entity_id: aMat }));
    expectDenied(await b.client.from("moment_references").insert({ creator_id: b.creatorId, entity_type: "creation", entity_id: aArt }));
    expectDenied(await b.client.from("moment_references").insert({ creator_id: a.creatorId, entity_type: "material", entity_id: bMat }));
    expect(expectOk(await b.client.from("moment_references").select("id").eq("entity_id", aMat))).toEqual([]);
  });

  it("kinds without an adapter yet are refused", async () => {
    expectDenied(await a.client.from("moment_references").insert({ creator_id: a.creatorId, entity_type: "huddle", entity_id: aMat }));
  });

  it("a Moment can never be wider than its entity; making the entity more private narrows it", async () => {
    const m = (await momentOf(a, "creation", aArt))!;
    expectDenied(await a.client.from("moment_references").update({ visibility: "public" }).eq("id", m.id).select("id"));
    // Published and public: the Moment may be public too.
    expectOk(await admin.from("artifacts").update({ privacy: "public", status: "published" }).eq("id", aArt));
    expectOk(await a.client.from("moment_references").update({ visibility: "public" }).eq("id", m.id).select("id"));
    // Private again: the Moment follows, without anyone touching it.
    expectOk(await admin.from("artifacts").update({ privacy: "creator_private", status: "draft" }).eq("id", aArt));
    expect((await momentOf(a, "creation", aArt))!.visibility).toBe("private");
  });

  it("someone who can read a public Creation keeps their own reference to it; a private one stays closed", async () => {
    const pub = await createArtifact(a, { title: "Public piece" });
    expectOk(await admin.from("artifacts").update({ privacy: "public", status: "published" }).eq("id", pub));
    expectOk(await b.client.from("moment_references").insert({ creator_id: b.creatorId, entity_type: "creation", entity_id: pub, visibility: "private" }).select("id").single());
    expect(expectOk(await a.client.from("moment_references").select("creator_id").eq("entity_id", pub)).map((r) => r.creator_id)).toEqual([a.creatorId]);
  });

  it("only the preview columns can be changed — never whose it is or what it points at", async () => {
    const m = (await momentOf(a, "material", aMat))!;
    expectDenied(await loose(a.client).from("moment_references").update({ entity_id: bMat }).eq("id", m.id).select("id"), "42501");
    expectDenied(await loose(a.client).from("moment_references").update({ creator_id: b.creatorId }).eq("id", m.id).select("id"), "42501");
  });
});

describe("DejaVus", () => {
  let railways: string;

  it("one per name, however it's typed", async () => {
    railways = expectOk(await a.client.from("dejavus").insert({ creator_id: a.creatorId, name: "Railways" }).select("id, normalized_name").single()).id;
    expectDenied(await a.client.from("dejavus").insert({ creator_id: a.creatorId, name: "  railways " }), "23505");
    // B's "Railways" is B's own.
    expectOk(await b.client.from("dejavus").insert({ creator_id: b.creatorId, name: "Railways" }));
    expect(expectOk(await b.client.from("dejavus").select("id").eq("id", railways))).toEqual([]);
  });

  it("a Moment can carry several DejaVus; only your own Moments on your own DejaVus", async () => {
    const dad = expectOk(await a.client.from("dejavus").insert({ creator_id: a.creatorId, name: "Dad" }).select("id").single()).id;
    const m = (await momentOf(a, "material", aMat))!;
    for (const d of [railways, dad]) expectOk(await a.client.from("dejavu_moments").insert({ dejavu_id: d, moment_id: m.id, creator_id: a.creatorId, added_by: a.creatorId }));
    expect(expectOk(await a.client.from("dejavu_moments").select("dejavu_id").eq("moment_id", m.id))).toHaveLength(2);

    const bMoment = (await momentOf(b, "material", bMat))!;
    const bRail = expectOk(await b.client.from("dejavus").select("id").single()).id;
    expectDenied(await a.client.from("dejavu_moments").insert({ dejavu_id: railways, moment_id: bMoment.id, creator_id: a.creatorId, added_by: a.creatorId }));
    expectDenied(await b.client.from("dejavu_moments").insert({ dejavu_id: railways, moment_id: bMoment.id, creator_id: b.creatorId, added_by: b.creatorId }));
    expectDenied(await b.client.from("dejavu_moments").insert({ dejavu_id: bRail, moment_id: m.id, creator_id: b.creatorId, added_by: b.creatorId }));
    // Links can't pretend to be CreativeMind's or a migration's.
    expectDenied(await a.client.from("dejavu_moments").insert({ dejavu_id: dad, moment_id: (await momentOf(a, "creation", aArt))!.id, creator_id: a.creatorId, added_by: a.creatorId, source: "migration" }));
    expectNoRowsAffected(await b.client.from("dejavu_moments").delete().eq("dejavu_id", railways).select("id"));
  });

  it("using a DejaVu moves it up the Recent list", async () => {
    const before = expectOk(await a.client.from("dejavus").select("last_used_at").eq("id", railways).single()).last_used_at;
    await new Promise((r) => setTimeout(r, 20));
    const m = (await momentOf(a, "creation", aArt))!;
    expectOk(await a.client.from("dejavu_moments").insert({ dejavu_id: railways, moment_id: m.id, creator_id: a.creatorId, added_by: a.creatorId }));
    const after = expectOk(await a.client.from("dejavus").select("last_used_at").eq("id", railways).single()).last_used_at;
    expect(Date.parse(after)).toBeGreaterThan(Date.parse(before));
    // …and it can't be set by hand.
    expectDenied(await loose(a.client).from("dejavus").update({ last_used_at: new Date(0).toISOString() }).eq("id", railways).select("id"), "42501");
  });

  it("CreativeMind's suggestions are written by the pipeline only and resolved by their owner", async () => {
    const m = (await momentOf(a, "material", aMat))!;
    expectDenied(await loose(a.client).from("dejavu_suggestions").insert({ creator_id: a.creatorId, moment_id: m.id, suggested_name: "Childhood" }));
    const s = expectOk(await admin.from("dejavu_suggestions").insert({ creator_id: a.creatorId, moment_id: m.id, suggested_name: "Childhood" }).select("id").single()).id;
    expect(expectOk(await b.client.from("dejavu_suggestions").select("id").eq("id", s))).toEqual([]);
    expectNoRowsAffected(await b.client.from("dejavu_suggestions").update({ status: "dismissed" }).eq("id", s).select("id"));
    expectOk(await a.client.from("dejavu_suggestions").update({ status: "dismissed", resolved_at: new Date().toISOString() }).eq("id", s).select("id"));
    // Once resolved it stays resolved.
    expectNoRowsAffected(await a.client.from("dejavu_suggestions").update({ status: "accepted" }).eq("id", s).select("id"));
  });

  it("deleting the entity takes its Moment and DejaVu links with it; the DejaVu stays", async () => {
    const m = (await momentOf(a, "material", aMat))!;
    expectOk(await a.client.from("creative_materials").delete().eq("id", aMat).select("id"));
    expect(await momentOf(a, "material", aMat)).toBeNull();
    expect(expectOk(await a.client.from("dejavu_moments").select("id").eq("moment_id", m.id))).toEqual([]);
    expect(expectOk(await a.client.from("dejavus").select("id").eq("id", railways))).toHaveLength(1);
  });
});
