import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { indexStaleSubjects, semanticMatches, type CreativeModelProvider } from "@wonder/creator-brain";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, anonClient, cleanupTestCreators, createTestCreator, expectDenied, expectOk, loose, type TestCreator } from "./helpers";

const admin = adminClient();
let a: TestCreator;
let b: TestCreator;
let river: string;
let city: string;

/** Deterministic embeddings: one axis per topic word, so "river" queries match river material. */
const AXES = ["river", "city", "light"];
const embedCalls: number[] = [];
function vectorFor(text: string): number[] {
  const t = text.toLowerCase();
  const v = Array.from({ length: 768 }, () => 0);
  AXES.forEach((w, i) => {
    if (t.includes(w)) v[i] = 1;
  });
  v[767] = 0.05; // never the zero vector
  const norm = Math.hypot(...v);
  return v.map((x) => x / norm);
}
const fakeProvider = {
  name: "fake",
  live: true,
  modelFor: () => "fake",
  embed: async ({ items }: { items: Array<{ title?: string | null; text: string }> }) => {
    embedCalls.push(items.length);
    return { vectors: items.map((i) => vectorFor(`${i.title ?? ""} ${i.text}`)), model: "fake-embedding", dimensions: 768 };
  },
} as unknown as CreativeModelProvider;

async function note(c: TestCreator, title: string, text: string): Promise<string> {
  const prov = expectOk(await c.client.from("provenance_records").insert({ creator_id: c.creatorId, origin: "typed" }).select("id").single());
  return expectOk(await c.client.from("creative_materials").insert({ creator_id: c.creatorId, type: "note", title, text_content: text, provenance_id: prov.id }).select("id").single()).id;
}

beforeAll(async () => {
  [a, b] = await Promise.all([createTestCreator("semanticA"), createTestCreator("semanticB")]);
  river = await note(a, "Riverbank", "Morning river mist over the ghats");
  city = await note(a, "Traffic", "Honking city streets at night");
  await note(b, "B's river", "Another creator's river notes");
});
afterAll(cleanupTestCreators);

describe("semantic search", () => {
  it("indexes a creator's stale material once, and re-stamps unchanged content without re-embedding", async () => {
    const before = embedCalls.length;
    expect(await indexStaleSubjects(admin as unknown as AppDb, fakeProvider, { creatorId: a.creatorId })).toBe(2);
    expect(embedCalls.length).toBe(before + 1);
    expect(await indexStaleSubjects(admin as unknown as AppDb, fakeProvider, { creatorId: a.creatorId })).toBe(0);

    // A title edit makes the material stale; unchanged embedding text still needs a new vector (title is embedded).
    expectOk(await a.client.from("creative_materials").update({ title: "Riverbank at dawn" }).eq("id", river).select("id"));
    expect(await indexStaleSubjects(admin as unknown as AppDb, fakeProvider, { creatorId: a.creatorId })).toBe(1);
  });

  it("finds the caller's own material by meaning, never another creator's", async () => {
    await indexStaleSubjects(admin as unknown as AppDb, fakeProvider, { creatorId: b.creatorId });
    const mine = await semanticMatches(a.client as unknown as AppDb, fakeProvider, "a quiet river", { minSimilarity: 0.5 });
    expect(mine.map((m) => m.subjectId)).toEqual([river]);
    const theirs = await semanticMatches(b.client as unknown as AppDb, fakeProvider, "a quiet river", { minSimilarity: 0.5 });
    expect(theirs.map((m) => m.subjectId)).not.toContain(river);
    expect(theirs.map((m) => m.subjectId)).not.toContain(city);
  });

  it("embeddings are owner-readable only and never writable through the API", async () => {
    const own = expectOk(await a.client.from("search_embeddings").select("subject_id"));
    expect(own.map((r) => r.subject_id).sort()).toEqual([river, city].sort());
    const other = expectOk(await b.client.from("search_embeddings").select("subject_id").eq("creator_id", a.creatorId));
    expect(other).toEqual([]);
    const anonRead = await loose(anonClient()).from("search_embeddings").select("subject_id");
    expect(anonRead.data ?? []).toEqual([]);
    const fake = JSON.stringify(vectorFor("river"));
    expectDenied(await loose(b.client).from("search_embeddings").insert({ subject_type: "material", subject_id: river, creator_id: b.creatorId, model: "x", content_hash: "0".repeat(64), embedding: fake }));
    const tamper = await loose(a.client).from("search_embeddings").update({ embedding: fake }).eq("subject_id", city).select("subject_id");
    expect(tamper.data ?? []).toEqual([]);
  });

  it("the stale-subject scan is server-only", async () => {
    expectDenied(await loose(a.client).rpc("stale_search_subjects", { p_creator: b.creatorId }));
    expectDenied(await loose(anonClient()).rpc("stale_search_subjects", {}));
  });

  it("deleting material removes its embedding", async () => {
    expectOk(await a.client.from("creative_materials").delete().eq("id", city).select("id"));
    const left = expectOk(await admin.from("search_embeddings").select("subject_id").eq("subject_id", city));
    expect(left).toEqual([]);
  });

  it("returns nothing (search stays lexical) when the provider can't embed", async () => {
    const noEmbed = { ...fakeProvider, embed: undefined } as CreativeModelProvider;
    expect(await semanticMatches(a.client as unknown as AppDb, noEmbed, "river")).toEqual([]);
    expect(await indexStaleSubjects(admin as unknown as AppDb, noEmbed, { creatorId: a.creatorId })).toBe(0);
  });
});
