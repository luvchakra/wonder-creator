import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createConversation, replyToConversation, saveThought } from "@wonder/creator-community";
import { createMaterial } from "@wonder/creator-library";
import { createDejaVu, attachEntity } from "@wonder/creator-moments";
import {
  addFromDejaVu,
  addSources,
  communityResponses,
  createArtifact,
  dismissCommunityResponse,
  exploreDejaVuIn,
  openStudioSession,
  patchStudioSession,
  searchBringIn,
  useCommunityResponse,
  workingSetView,
} from "@wonder/creator-studio";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createTestCreator, expectDenied, expectOk, loose, type TestCreator } from "./helpers";

// Phase 04 — CreativeStudio integration: Community and DejaVu on the Working Table, rights, Ask Community, responses.
const admin = adminClient();
let a: TestCreator; // works in the Studio, asks Community
let b: TestCreator; // replies
let c: TestCreator; // blocked by A
const db = (x: TestCreator) => x.client as unknown as AppDb;
let piece: string;
let session: string;

beforeAll(async () => {
  [a, b, c] = await Promise.all([createTestCreator("scA"), createTestCreator("scB"), createTestCreator("scC")]);
  expectOk(await a.client.from("creator_blocks").insert({ blocker_creator_id: a.creatorId, blocked_creator_id: c.creatorId }));
  piece = (await createArtifact(db(a), a.creatorId, { artifactType: "carousel", title: "Platform 3", content: "Every Sunday my father waited.", authorKind: "creator", provenance: { origin: "typed" } })).id;
  session = (await openStudioSession(db(a), a.creatorId, piece)).id;
});
afterAll(cleanupTestCreators);

describe("Community on the Working Table", () => {
  it("someone else's reply comes in by reference, credited, as reference only — never as yours", async () => {
    const conv = await createConversation(db(b), b.creatorId, { title: "Pauses between images", intent: "discuss" });
    const reply = (await replyToConversation(db(b), b.creatorId, conv.id, { body: "Treat each image like a pause rather than an illustration." })).id;
    await addSources(db(a), a.creatorId, session, [{ type: "conversation_reply", id: reply }]);
    const row = (await workingSetView(db(a), session)).sources.find((s) => s.sourceId === reply)!;
    expect(row).toMatchObject({ available: true, state: "available", rights: "reference_only", roles: ["creative_direction"] });
    expect(row.kind).toContain("Thought from Pulse");
    expect(row.author).not.toBe("You");
    // Nothing was copied: the row is a pointer to B's reply.
    expect(expectOk(await admin.from("studio_sources").select("source_type, source_id").eq("id", row.id).single())).toEqual({ source_type: "conversation_reply", source_id: reply });
  });

  it("your own Community words are yours to use", async () => {
    const mine = await createConversation(db(a), a.creatorId, { title: "My own idea about trains", intent: "discuss" });
    await addSources(db(a), a.creatorId, session, [{ type: "conversation", id: mine.id }]);
    expect((await workingSetView(db(a), session)).sources.find((s) => s.sourceId === mine.id)!.rights).toBe("reuse_permitted");
  });

  it("the database refuses what the creator can't read: Limited, blocked, private Scrapbook", async () => {
    const limited = await createConversation(db(b), b.creatorId, { title: "Only for invited people", intent: "discuss", visibility: "limited" });
    await expect(addSources(db(a), a.creatorId, session, [{ type: "conversation", id: limited.id }])).rejects.toThrow();
    const cs = await createConversation(db(c), c.creatorId, { title: "From someone A blocked", intent: "discuss" });
    await expect(addSources(db(a), a.creatorId, session, [{ type: "conversation", id: cs.id }])).rejects.toThrow();
    const post = expectOk(await b.client.from("scrapbook_posts").insert({ creator_id: b.creatorId, body: "A private thought", visibility: "private" }).select("id").single()).id;
    await expect(addSources(db(a), a.creatorId, session, [{ type: "scrapbook_entry", id: post }])).rejects.toThrow();
    // …and nobody can write into someone else's Working Table.
    expectDenied(await b.client.from("studio_sources").insert({ session_id: session, creator_id: b.creatorId, added_by: b.creatorId, source_type: "conversation", source_id: limited.id }));
  });

  it("Bring in → Community searches conversations, replies and Scrapbook the creator can see", async () => {
    const r = await searchBringIn(db(a), a.creatorId, session, "pause", undefined, ["conversation", "conversation_reply", "scrapbook_entry"]);
    expect(r.some((x) => x.sourceType === "conversation_reply" && x.rights === "reference_only" && x.inSet)).toBe(true);
    // Recent (no search) stays the creator's own things.
    expect((await searchBringIn(db(a), a.creatorId, session, "")).some((x) => x.sourceType.startsWith("conversation"))).toBe(false);
  });

  it("new roles for what people say: feedback and creative direction; anything else is refused", async () => {
    const row = (await workingSetView(db(a), session)).sources[0]!;
    expectOk(await a.client.from("studio_sources").update({ roles: ["feedback", "creative_direction"] }).eq("id", row.id).select("id"));
    expectDenied(await loose(a.client).from("studio_sources").update({ roles: ["licensed"] }).eq("id", row.id).select("id"), "23514");
  });

  it("Save thought keeps someone's reply as a note — credited, and still reference only", async () => {
    const conv = await createConversation(db(b), b.creatorId, { title: "Silence in film", intent: "discuss" });
    const reply = (await replyToConversation(db(b), b.creatorId, conv.id, { body: "Silence is a sound too." })).id;
    const { materialId } = await saveThought(db(a), a.creatorId, reply);
    await addSources(db(a), a.creatorId, session, [{ type: "material", id: materialId }]);
    const row = (await workingSetView(db(a), session)).sources.find((s) => s.sourceId === materialId)!;
    expect(row.rights).toBe("reference_only");
    expect(row.attribution).toContain("Pulse");
  });
});

describe("DejaVu in the Studio", () => {
  it("Bring in → DejaVu adds only the chosen Moments, Available; Explore makes the DejaVu available without importing", async () => {
    const { dejavu } = await createDejaVu(db(a), a.creatorId, { name: "Railways" });
    const m1 = await createMaterial(db(a), a.creatorId, { type: "note", title: "Chai at the station", textContent: "Steam and chai.", provenance: { origin: "typed" } });
    const m2 = await createMaterial(db(a), a.creatorId, { type: "note", title: "Night train", textContent: "Lights passing.", provenance: { origin: "typed" } });
    const mo1 = await attachEntity(db(a), a.creatorId, dejavu.id, { entityType: "material", entityId: m1.id });
    await attachEntity(db(a), a.creatorId, dejavu.id, { entityType: "material", entityId: m2.id });
    const before = (await workingSetView(db(a), session)).sources.length;
    await exploreDejaVuIn(db(a), session, dejavu.id);
    const explored = await workingSetView(db(a), session);
    expect(explored.dejavu).toEqual({ id: dejavu.id, name: "Railways", count: 2 });
    expect(explored.sources.length).toBe(before);
    const r = await addFromDejaVu(db(a), a.creatorId, session, { dejavuId: dejavu.id, momentIds: [mo1.id] });
    expect(r).toEqual({ added: 1, skipped: 0 });
    const after = await workingSetView(db(a), session);
    expect(after.sources.find((s) => s.sourceId === m1.id)?.state).toBe("available");
    expect(after.sources.some((s) => s.sourceId === m2.id)).toBe(false);
  });

  it("a session can only point at your own DejaVu and your own source rows", async () => {
    const { dejavu } = await createDejaVu(db(b), b.creatorId, { name: "B's thread" });
    await expect(patchStudioSession(db(a), session, { dejavuId: dejavu.id })).rejects.toThrow();
    const bPiece = (await createArtifact(db(b), b.creatorId, { artifactType: "poem", title: "B's poem", content: "x", authorKind: "creator", provenance: { origin: "typed" } })).id;
    const bSession = (await openStudioSession(db(b), b.creatorId, bPiece)).id;
    const bNote = await createMaterial(db(b), b.creatorId, { type: "note", title: "B note", textContent: "b", provenance: { origin: "typed" } });
    await addSources(db(b), b.creatorId, bSession, [{ type: "material", id: bNote.id }]);
    const bRow = (await workingSetView(db(b), bSession)).sources[0]!.id;
    await expect(patchStudioSession(db(a), session, { lastOpenedSourceId: bRow })).rejects.toThrow();
    const aRow = (await workingSetView(db(a), session)).sources[0]!.id;
    await patchStudioSession(db(a), session, { lastOpenedSourceId: aRow });
    expect((await workingSetView(db(a), session)).lastOpenedSourceId).toBe(aRow);
  });
});

describe("Ask Community and the replies that come back", () => {
  it("only the excerpt is shared; replies return to the Studio, new ones counted; use and dismiss", async () => {
    const conv = await createConversation(db(a), a.creatorId, {
      title: "Does slide 3 feel too literal?",
      intent: "critique",
      source: { type: "creation", id: piece },
      fragment: { label: "Slide 3", text: "The train was always late." },
    });
    // B sees the excerpt, never the Creation.
    const seen = expectOk(await b.client.from("open_conversations").select("source_fragment").eq("id", conv.id).single());
    expect(seen.source_fragment).toMatchObject({ label: "Slide 3", text: "The train was always late." });
    expect(expectOk(await b.client.from("artifacts").select("id").eq("id", piece))).toEqual([]);
    expect(expectOk(await b.client.from("artifact_versions").select("id").eq("artifact_id", piece))).toEqual([]);
    // The excerpt can't be swapped for more of the work later.
    expectDenied(await loose(a.client).from("open_conversations").update({ source_fragment: { label: "All", text: "everything" } }).eq("id", conv.id).select("id"), "42501");
    // An excerpt must be about your own work, and small.
    expectDenied(await b.client.from("open_conversations").insert({ creator_id: b.creatorId, title: "About A's piece", intent: "critique", source_entity_type: "creation", source_entity_id: piece, source_fragment: { label: "x", text: "y" } }));
    expectDenied(await a.client.from("open_conversations").insert({ creator_id: a.creatorId, title: "Too long", intent: "critique", source_entity_type: "creation", source_entity_id: piece, source_fragment: { label: "x", text: "y".repeat(1300) } }));

    const r1 = (await replyToConversation(db(b), b.creatorId, conv.id, { body: "Let the image carry it." })).id;
    const r2 = (await replyToConversation(db(b), b.creatorId, conv.id, { body: "Cut the second clause." })).id;
    let res = await communityResponses(db(a), session);
    expect(res).toMatchObject({ total: 2, fresh: 2, conversations: 1 });
    expect(res.responses[0]!.about).toBe("Slide 3");
    await useCommunityResponse(db(a), a.creatorId, session, r1);
    const row = (await workingSetView(db(a), session)).sources.find((s) => s.sourceId === r1)!;
    expect(row).toMatchObject({ state: "available", roles: ["feedback"], rights: "reference_only" });
    await dismissCommunityResponse(db(a), session, r2);
    res = await communityResponses(db(a), session);
    expect(res.responses.map((x) => [x.id, x.inSet])).toEqual([[r1, true]]);
    // B can't read A's Studio or its dismissals.
    expect(expectOk(await b.client.from("studio_sessions").select("id").eq("id", session))).toEqual([]);
  });
});
