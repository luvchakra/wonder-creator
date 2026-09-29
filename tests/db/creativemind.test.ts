import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createConversation, replyToConversation } from "@wonder/creator-community";
import { createMaterial } from "@wonder/creator-library";
import { currentConnection, discoverConnections, resolveConnection } from "@wonder/creator-moments";
import { addSources, commitStudioSources, createArtifact, openStudioSession, saveCreatorVersion, updateSource, versionSources, workingSetView } from "@wonder/creator-studio";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createTestCreator, expectDenied, expectNoRowsAffected, expectOk, loose, type TestCreator } from "./helpers";

// Phase 05 — CreativeMind orchestration: found connections (private, dismissible, confidence hidden), conversation
// summaries (readable by whoever can read the conversation, written only by the pipeline) and "Made from" records.
const admin = adminClient();
const service = admin as unknown as AppDb;
let a: TestCreator;
let b: TestCreator;
const db = (x: TestCreator) => x.client as unknown as AppDb;
const momentOf = async (materialId: string) => expectOk(await admin.from("moment_references").select("id").eq("entity_type", "material").eq("entity_id", materialId).single()).id as string;

beforeAll(async () => {
  [a, b] = await Promise.all([createTestCreator("cmA"), createTestCreator("cmB")]);
});
afterAll(cleanupTestCreators);

describe("Your world is connecting", () => {
  it("finds a connection from recorded facts, keeps the evidence, hides the confidence, and a dismissal is final", async () => {
    const old = await createMaterial(db(a), a.creatorId, { type: "image", title: "Platform at dawn", provenance: { origin: "typed" } });
    const fresh = await createMaterial(db(a), a.creatorId, { type: "note", title: "Waiting again", textContent: "The same bench.", provenance: { origin: "typed" } });
    const [mo, mf] = [await momentOf(old.id), await momentOf(fresh.id)];
    expectOk(await admin.from("moment_references").update({ occurred_at: new Date(Date.now() - 200 * 86_400_000).toISOString() }).eq("id", mo).select("id"));
    expectOk(await admin.from("creative_material_tags").insert([
      { material_id: old.id, creator_id: a.creatorId, tag: "waiting" },
      { material_id: fresh.id, creator_id: a.creatorId, tag: "waiting" },
    ]));

    expect(await discoverConnections(db(a), service, a.creatorId)).toBe(1);
    // Idempotent: the same connection isn't written twice.
    expect(await discoverConnections(db(a), service, a.creatorId)).toBe(0);
    const c = (await currentConnection(db(a)))!;
    expect(c).toMatchObject({ connectionType: "shared_theme", evidence: ["Both are tagged “waiting”"] });
    expect(new Set(c.momentIds)).toEqual(new Set([mo, mf]));

    // Confidence is internal: creators can't read it; nor can anyone else see the connection.
    expectDenied(await loose(a.client).from("moment_connections").select("confidence_internal").eq("id", c.id), "42501");
    expect(expectOk(await b.client.from("moment_connections").select("id").eq("id", c.id))).toEqual([]);
    expectDenied(await loose(a.client).from("moment_connections").insert({ creator_id: a.creatorId, moment_ids: [mo, mf], connection_type: "shared_theme", short_explanation: "Made up by me", signature: "x" }));
    expectNoRowsAffected(await b.client.from("moment_connections").update({ status: "dismissed" }).eq("id", c.id).select("id"));

    await resolveConnection(db(a), c.id, "dismissed");
    expect(await currentConnection(db(a))).toBeNull();
    // It never comes back, and it can't be un-dismissed into "new".
    expect(await discoverConnections(db(a), service, a.creatorId)).toBe(0);
    expectDenied(await loose(a.client).from("moment_connections").update({ status: "new" }).eq("id", c.id).select("id"));
  });

  it("what the creator already connected with a DejaVu isn't suggested again", async () => {
    const old = await createMaterial(db(b), b.creatorId, { type: "image", title: "Old harbour", provenance: { origin: "typed" } });
    const fresh = await createMaterial(db(b), b.creatorId, { type: "note", title: "Harbour lights", provenance: { origin: "typed" } });
    const [mo, mf] = [await momentOf(old.id), await momentOf(fresh.id)];
    expectOk(await admin.from("moment_references").update({ occurred_at: new Date(Date.now() - 100 * 86_400_000).toISOString() }).eq("id", mo).select("id"));
    expectOk(await admin.from("creative_material_tags").insert([
      { material_id: old.id, creator_id: b.creatorId, tag: "harbour" },
      { material_id: fresh.id, creator_id: b.creatorId, tag: "harbour" },
    ]));
    const dv = expectOk(await b.client.from("dejavus").insert({ creator_id: b.creatorId, name: "Harbour" }).select("id").single()).id;
    for (const m of [mo, mf]) expectOk(await b.client.from("dejavu_moments").insert({ dejavu_id: dv, moment_id: m, creator_id: b.creatorId, added_by: b.creatorId }));
    expect(await discoverConnections(db(b), service, b.creatorId)).toBe(0);
  });
});

describe("Conversation so far", () => {
  it("is read by whoever can read the conversation and written only by the pipeline", async () => {
    const open = await createConversation(db(a), a.creatorId, { title: "How much text on a slide?", intent: "discuss" });
    const limited = await createConversation(db(a), a.creatorId, { title: "Only for invited people", intent: "discuss", visibility: "limited" });
    const r = await replyToConversation(db(b), b.creatorId, open.id, { body: "One line at most." });
    for (const id of [open.id, limited.id]) expectOk(await admin.from("open_conversation_summaries").insert({ conversation_id: id, points: [{ text: "Most prefer one line.", replyIds: [r.id] }], reply_count_at: 1 }));
    expect(expectOk(await b.client.from("open_conversation_summaries").select("conversation_id").eq("conversation_id", open.id))).toHaveLength(1);
    expect(expectOk(await b.client.from("open_conversation_summaries").select("conversation_id").eq("conversation_id", limited.id))).toEqual([]);
    expectDenied(await loose(a.client).from("open_conversation_summaries").update({ points: [{ text: "Everyone agrees with me.", replyIds: [] }] }).eq("conversation_id", open.id).select("conversation_id"));
    expectDenied(await loose(b.client).from("open_conversation_summaries").insert({ conversation_id: limited.id, points: [{ text: "x", replyIds: [] }], reply_count_at: 0 }));
  });
});

describe("Made from", () => {
  it("records only the sources in use when a version is saved — with rights and credit — and nobody else can add to it", async () => {
    const piece = (await createArtifact(db(a), a.creatorId, { artifactType: "poem", title: "Platform", content: "First draft.", authorKind: "creator", provenance: { origin: "typed" } })).id;
    const session = (await openStudioSession(db(a), a.creatorId, piece)).id;
    const note = await createMaterial(db(a), a.creatorId, { type: "note", title: "Steam", textContent: "Steam and chai.", provenance: { origin: "typed" } });
    const unused = await createMaterial(db(a), a.creatorId, { type: "note", title: "Unused", textContent: "Not used.", provenance: { origin: "typed" } });
    const conv = await createConversation(db(b), b.creatorId, { title: "Feedback please", intent: "discuss" });
    const reply = await replyToConversation(db(b), b.creatorId, conv.id, { body: "Let the image do the work." });
    await addSources(db(a), a.creatorId, session, [
      { type: "material", id: note.id },
      { type: "material", id: unused.id },
      { type: "conversation_reply", id: reply.id, roles: ["feedback"] },
    ]);
    const ws = await workingSetView(db(a), session);
    for (const s of ws.sources.filter((x) => x.sourceId === note.id || x.sourceId === reply.id)) await updateSource(db(a), s.id, { state: "in_use" });
    const { data: cur } = await admin.from("artifacts").select("current_version_id").eq("id", piece).single();
    const v = await saveCreatorVersion(db(a), piece, { content: "Second draft.", baseVersionId: cur!.current_version_id, label: "Revised" });

    expect(await commitStudioSources(db(a), a.creatorId, session, v.id)).toBe(2);
    const made = await versionSources(db(a), v.id);
    expect(made.map((x) => [x.source_type, x.rights_state]).sort()).toEqual([
      ["conversation_reply", "reference_only"],
      ["material", "reuse_permitted"],
    ]);
    expect(made.find((x) => x.source_type === "conversation_reply")!.attribution).toMatch(/^By /);
    // The Material used gets a lineage edge; the unused one doesn't.
    const edges = expectOk(await admin.from("lineage_edges").select("source_id").eq("target_id", piece).eq("source_type", "material"));
    expect(edges.map((e) => e.source_id)).toContain(note.id);
    expect(edges.map((e) => e.source_id)).not.toContain(unused.id);
    // Immutable; and B can't add to A's version.
    expectDenied(await loose(a.client).from("artifact_version_sources").update({ rights_state: "reuse_permitted" }).eq("version_id", v.id).select("id"));
    expectDenied(await b.client.from("artifact_version_sources").insert({ artifact_id: piece, version_id: v.id, creator_id: b.creatorId, source_type: "conversation_reply", source_id: reply.id, rights_state: "reuse_permitted" }));
  });
});

describe("New DejaVu names", () => {
  it("are suggested only for a human theme that keeps coming back — never metadata, never twice after a no", async () => {
    const { suggestNewDejaVu } = await import("@wonder/creator-moments");
    const c = await createTestCreator("cmN");
    const mats = await Promise.all([1, 2, 3].map((i) => createMaterial(db(c), c.creatorId, { type: "note", title: `Note ${i}`, provenance: { origin: "typed" } })));
    expectOk(await admin.from("creative_material_tags").insert(mats.flatMap((m) => [{ material_id: m.id, creator_id: c.creatorId, tag: "grandmother" }, { material_id: m.id, creator_id: c.creatorId, tag: "photo" }])));
    const moment = await momentOf(mats[0]!.id);
    expect(await suggestNewDejaVu(service, c.creatorId, moment, mats[0]!.id)).toBe("Grandmother");
    // One open suggestion at a time for this Moment.
    expect(await suggestNewDejaVu(service, c.creatorId, moment, mats[0]!.id)).toBeNull();
    // Declined: never offered again.
    expectOk(await admin.from("dejavu_suggestions").update({ status: "dismissed", resolved_at: new Date().toISOString() }).eq("creator_id", c.creatorId).select("id"));
    expect(await suggestNewDejaVu(service, c.creatorId, await momentOf(mats[1]!.id), mats[1]!.id)).toBeNull();
  });
});
