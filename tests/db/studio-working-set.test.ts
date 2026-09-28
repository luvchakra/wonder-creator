import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addSources, openStudioSession, removeSource, searchBringIn, updateSource, workingSetView, createArtifact } from "@wonder/creator-studio";
import { createMaterial } from "@wonder/creator-library";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createTestCreator, type TestCreator } from "./helpers";

const admin = adminClient();
let owner: TestCreator;
let other: TestCreator;
const db = (x: TestCreator) => x.client as unknown as AppDb;
let piece: string;
let note: string;
let photo: string;
let secret: string;
let poem: string;

beforeAll(async () => {
  [owner, other] = await Promise.all([createTestCreator("studioOwner"), createTestCreator("studioOther")]);
  piece = (await createArtifact(db(owner), owner.creatorId, { artifactType: "poem", title: "Platform 3", content: "Every Sunday.", authorKind: "creator", provenance: { origin: "typed" } })).id;
  poem = (await createArtifact(db(owner), owner.creatorId, { artifactType: "poem", title: "Monsoon notes", content: "Rain on tin.", authorKind: "creator", provenance: { origin: "typed" } })).id;
  note = (await createMaterial(db(owner), owner.creatorId, { type: "voice", title: "Dad railway story", textContent: "He waited at Platform 3.", provenance: { origin: "typed" } })).id;
  photo = (await createMaterial(db(owner), owner.creatorId, { type: "note", title: "Station at dusk", textContent: "Lamps and steam.", provenance: { origin: "typed" } })).id;
  secret = (await createMaterial(db(other), other.creatorId, { type: "note", title: "Someone else's note", textContent: "private", provenance: { origin: "typed" } })).id;
  // A Material already grounding the Creation.
  await admin.from("lineage_edges").insert({ creator_id: owner.creatorId, source_type: "material", source_id: photo, target_type: "artifact", target_id: piece, relationship: "references" });
});
afterAll(cleanupTestCreators);

describe("CreativeStudio Working Set", () => {
  it("opens one session per Creation, starting with its grounding Materials In use", async () => {
    const a = await openStudioSession(db(owner), owner.creatorId, piece);
    expect(a.created).toBe(true);
    const b = await openStudioSession(db(owner), owner.creatorId, piece);
    expect(b.id).toBe(a.id);
    const v = await workingSetView(db(owner), a.id);
    expect(v.sources.map((s) => [s.title, s.state])).toEqual([["Station at dusk", "in_use"]]);
    // Only the owner can open a Creation's Studio.
    await expect(openStudioSession(db(other), other.creatorId, piece)).rejects.toThrow(/owner/);
  });

  it("brings in Materials, Creations and Collections with suggested roles; states and roles change without versions", async () => {
    const s = await openStudioSession(db(owner), owner.creatorId, piece);
    const found = await searchBringIn(db(owner), owner.creatorId, s.id, "railway");
    expect(found.map((r) => r.title)).toEqual(["Dad railway story"]);
    expect(await addSources(db(owner), owner.creatorId, s.id, [{ type: "material", id: note }, { type: "creation", id: poem }, { type: "material", id: note }])).toBe(2);
    // Adding again changes nothing; the Creation itself isn't its own source.
    expect(await addSources(db(owner), owner.creatorId, s.id, [{ type: "material", id: note }, { type: "creation", id: piece }])).toBe(0);
    let v = await workingSetView(db(owner), s.id);
    const voice = v.sources.find((x) => x.sourceId === note)!;
    expect(voice).toMatchObject({ state: "available", roles: ["voice", "story"], kind: "Voice note" });
    expect(v.sources.find((x) => x.sourceId === poem)).toMatchObject({ kind: "Poem · Creation", roles: ["structure"] });

    await updateSource(db(owner), voice.id, { state: "pinned", roles: ["quote"] });
    v = await workingSetView(db(owner), s.id);
    expect(v.sources.find((x) => x.id === voice.id)).toMatchObject({ state: "pinned", roles: ["quote"] });
    const { count } = await admin.from("artifact_versions").select("id", { count: "exact", head: true }).eq("artifact_id", piece);
    expect(count).toBe(1);

    await removeSource(db(owner), voice.id);
    expect((await workingSetView(db(owner), s.id)).sources.some((x) => x.id === voice.id)).toBe(false);
    expect((await searchBringIn(db(owner), owner.creatorId, s.id, "")).find((r) => r.sourceId === poem)?.inSet).toBe(true);
  });

  it("never references what the creator can't see, and a lost source shows nothing of itself", async () => {
    const s = await openStudioSession(db(owner), owner.creatorId, piece);
    await expect(addSources(db(owner), owner.creatorId, s.id, [{ type: "material", id: secret }])).rejects.toThrow(/isn't available/);
    // Other creators can't read or change this Working Set.
    expect((await db(other).from("studio_sources").select("id").eq("session_id", s.id)).data).toEqual([]);
    expect((await db(other).from("studio_sessions").select("id").eq("id", s.id)).data).toEqual([]);
    const ins = await other.client.from("studio_sources").insert({ session_id: s.id, creator_id: other.creatorId, added_by: other.creatorId, source_type: "material", source_id: secret });
    expect(ins.error).not.toBeNull();

    // Access goes away (here: the Material is deleted) → the row stays, its content doesn't.
    const temp = (await createMaterial(db(owner), owner.creatorId, { type: "note", title: "Temporary", textContent: "x", provenance: { origin: "typed" } })).id;
    await addSources(db(owner), owner.creatorId, s.id, [{ type: "material", id: temp }]);
    await admin.from("creative_materials").delete().eq("id", temp);
    const gone = (await workingSetView(db(owner), s.id)).sources.find((x) => x.sourceId === temp)!;
    expect(gone).toMatchObject({ available: false, title: "This source is no longer available", href: null });
  });
});
