import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, cleanupTestCreators, createMaterial, createTestCreator, expectDenied, expectNoRowsAffected, expectOk, loose, type TestCreator } from "./helpers";

// Phase 03 — Community + Open Conversations: visibility, blocks, Limited access, owner and moderator controls, mutes,
// Open to…, and Moments on other people's conversations that never touch the source.
const admin = adminClient();
let a: TestCreator; // starts conversations
let b: TestCreator; // a reader
let c: TestCreator; // blocked by A
let m: TestCreator; // a platform moderator

const start = async (who: TestCreator, over: Record<string, unknown> = {}) =>
  expectOk(await who.client.from("open_conversations").insert({ creator_id: who.creatorId, title: "How much text belongs on a carousel?", intent: "discuss", ...over }).select("id").single()).id as string;
const sees = async (who: TestCreator, id: string) => expectOk(await who.client.from("open_conversations").select("id").eq("id", id)).length === 1;

beforeAll(async () => {
  [a, b, c, m] = await Promise.all([createTestCreator("comA"), createTestCreator("comB"), createTestCreator("comC"), createTestCreator("comM")]);
  expectOk(await a.client.from("creator_blocks").insert({ blocker_creator_id: a.creatorId, blocked_creator_id: c.creatorId }));
  expectOk(await admin.from("platform_moderators").insert({ creator_id: m.creatorId }));
});
afterAll(cleanupTestCreators);

describe("Open Conversations", () => {
  it("Community conversations are seen by creators who may see the owner — never across a block", async () => {
    const id = await start(a);
    expect(await sees(b, id)).toBe(true);
    expect(await sees(c, id)).toBe(false);
    expectDenied(await c.client.from("open_conversation_replies").insert({ conversation_id: id, creator_id: c.creatorId, body: "Hello?" }));
  });

  it("Limited conversations: only the people added can see and reply", async () => {
    const id = await start(a, { visibility: "limited" });
    expect(await sees(b, id)).toBe(false);
    expectDenied(await b.client.from("open_conversation_replies").insert({ conversation_id: id, creator_id: b.creatorId, body: "Let me in" }));
    expectOk(await a.client.from("open_conversation_invites").insert({ conversation_id: id, creator_id: b.creatorId }));
    expect(await sees(b, id)).toBe(true);
    expectOk(await b.client.from("open_conversation_replies").insert({ conversation_id: id, creator_id: b.creatorId, body: "Thanks for asking me." }));
    // Nobody else can add people, and blocked people can't be added.
    expectDenied(await b.client.from("open_conversation_invites").insert({ conversation_id: id, creator_id: m.creatorId }));
    expectDenied(await a.client.from("open_conversation_invites").insert({ conversation_id: id, creator_id: c.creatorId }));
  });

  it("replies keep quiet counts; a closed conversation takes no new replies but stays readable", async () => {
    const id = await start(a);
    expectOk(await b.client.from("open_conversation_replies").insert({ conversation_id: id, creator_id: b.creatorId, body: "One breath per slide." }));
    expectOk(await m.client.from("open_conversation_replies").insert({ conversation_id: id, creator_id: m.creatorId, body: "Let the image carry it." }));
    const row = expectOk(await a.client.from("open_conversations").select("reply_count, participant_count, last_reply_at").eq("id", id).single());
    expect(row).toMatchObject({ reply_count: 2, participant_count: 3 });
    expectOk(await a.client.from("open_conversations").update({ closed_at: new Date().toISOString() }).eq("id", id).select("id"));
    expectDenied(await b.client.from("open_conversation_replies").insert({ conversation_id: id, creator_id: b.creatorId, body: "One more" }));
    expect(expectOk(await b.client.from("open_conversation_replies").select("id").eq("conversation_id", id))).toHaveLength(2);
  });

  it("the owner controls wording, visibility and closing — never counts, removal or someone else's conversation", async () => {
    const id = await start(a);
    expectDenied(await loose(a.client).from("open_conversations").update({ reply_count: 99 }).eq("id", id).select("id"), "42501");
    expectDenied(await loose(a.client).from("open_conversations").update({ removed_at: new Date().toISOString() }).eq("id", id).select("id"), "42501");
    expectNoRowsAffected(await b.client.from("open_conversations").update({ title: "Hijacked title" }).eq("id", id).select("id"));
    expectOk(await a.client.from("open_conversations").update({ visibility: "limited" }).eq("id", id).select("id"));
    // A visibility change takes it out of other people's view at once.
    expect(await sees(b, id)).toBe(false);
  });

  it("an attachment or subject must be your own", async () => {
    const aMat = await createMaterial(a, "A's private note");
    expectDenied(await b.client.from("open_conversations").insert({ creator_id: b.creatorId, title: "About A's note", intent: "discuss", source_entity_type: "material", source_entity_id: aMat }));
    const id = await start(a);
    expectDenied(await b.client.from("open_conversation_replies").insert({ conversation_id: id, creator_id: b.creatorId, body: "See this", attachment_type: "material", attachment_entity_id: aMat }));
    const bMat = await createMaterial(b, "B's reference");
    expectOk(await b.client.from("open_conversation_replies").insert({ conversation_id: id, creator_id: b.creatorId, body: "See this", attachment_type: "material", attachment_entity_id: bMat }));
    // …and A still can't open B's private Material through the reply.
    expect(expectOk(await a.client.from("creative_materials").select("id").eq("id", bMat))).toEqual([]);
  });

  it("authors take back their own replies; the owner (or a moderator) removes others' — audited; nobody else can", async () => {
    const id = await start(a);
    const reply = expectOk(await b.client.from("open_conversation_replies").insert({ conversation_id: id, creator_id: b.creatorId, body: "Off-topic spam" }).select("id").single()).id;
    const { error: notOwner } = await m.client.rpc("open_conversation_remove_reply", { p_reply: reply });
    expect(notOwner).toBeNull(); // m is a moderator
    const again = expectOk(await b.client.from("open_conversation_replies").insert({ conversation_id: id, creator_id: b.creatorId, body: "Another" }).select("id").single()).id;
    const { error: stranger } = await c.client.rpc("open_conversation_remove_reply", { p_reply: again });
    expect(stranger).not.toBeNull();
    expect((await a.client.rpc("open_conversation_remove_reply", { p_reply: again })).error).toBeNull();
    expect(expectOk(await a.client.from("open_conversation_replies").select("id").eq("conversation_id", id))).toEqual([]);
    const audit = expectOk(await admin.from("audit_logs").select("action").eq("object_id", again));
    expect(audit.map((r) => r.action)).toContain("community.reply_removed");
    // A deleted reply leaves the count.
    expect(expectOk(await a.client.from("open_conversations").select("reply_count").eq("id", id).single()).reply_count).toBe(0);
  });

  it("only moderators remove a conversation; the owner still sees it, others don't", async () => {
    const id = await start(a);
    expect((await b.client.rpc("open_conversation_moderate", { p_conversation: id, p_remove: true })).error).not.toBeNull();
    expect((await m.client.rpc("open_conversation_moderate", { p_conversation: id, p_remove: true, p_reason: "spam" })).error).toBeNull();
    expect(await sees(b, id)).toBe(false);
    expect(await sees(a, id)).toBe(true);
    expectDenied(await loose(b.client).from("platform_moderators").insert({ creator_id: b.creatorId }));
  });

  it("a Huddle or Creative Room can be linked only by the person who started it, on a conversation they can see", async () => {
    const id = await start(a);
    const { data: huddle } = await b.client.rpc("huddle_start", { p_topic: "About the carousel", p_discoverability: "public" });
    expect((await c.client.rpc("open_conversation_link", { p_conversation: id, p_kind: "huddle", p_target: huddle as string })).error).not.toBeNull();
    expect((await m.client.rpc("open_conversation_link", { p_conversation: id, p_kind: "huddle", p_target: huddle as string })).error).not.toBeNull();
    expect((await b.client.rpc("open_conversation_link", { p_conversation: id, p_kind: "huddle", p_target: huddle as string })).error).toBeNull();
    expect(expectOk(await a.client.from("open_conversation_links").select("kind").eq("conversation_id", id))).toEqual([{ kind: "huddle" }]);
    expectDenied(await loose(b.client).from("open_conversation_links").insert({ conversation_id: id, kind: "project", project_id: randomUUID(), started_by: b.creatorId }));
  });

  it("reports can point at conversations and replies", async () => {
    const id = await start(a);
    expectOk(await b.client.from("moderation_reports").insert({ reporter_creator_id: b.creatorId, reported_creator_id: a.creatorId, context_type: "open_conversation", context_id: id, reason: "spam" }));
  });
});

describe("mutes and Open to…", () => {
  it("mutes are private to the muter", async () => {
    expectOk(await b.client.from("creator_mutes").insert({ muter_creator_id: b.creatorId, muted_creator_id: a.creatorId }));
    expect(expectOk(await a.client.from("creator_mutes").select("muter_creator_id").eq("muted_creator_id", a.creatorId))).toEqual([]);
    expectDenied(await b.client.from("creator_mutes").insert({ muter_creator_id: a.creatorId, muted_creator_id: b.creatorId }));
  });

  it("Open to… is the creator's own choice, readable by people who may see them (not across a block)", async () => {
    expectOk(await a.client.from("creator_open_to").insert({ creator_id: a.creatorId, preferences: ["feedback", "huddles"] }));
    expect(expectOk(await b.client.from("creator_open_to").select("preferences").eq("creator_id", a.creatorId).single()).preferences).toEqual(["feedback", "huddles"]);
    expect(expectOk(await c.client.from("creator_open_to").select("preferences").eq("creator_id", a.creatorId))).toEqual([]);
    expectNoRowsAffected(await b.client.from("creator_open_to").update({ preferences: [] }).eq("creator_id", a.creatorId).select("creator_id"));
    expectDenied(await loose(a.client).from("creator_open_to").update({ preferences: ["karma"] }).eq("creator_id", a.creatorId).select("creator_id"), "23514");
  });
});

describe("DejaVu on someone else's conversation", () => {
  it("a reader keeps their own reference — the owner's conversation and Moment are untouched", async () => {
    const id = await start(a);
    const ref = expectOk(await b.client.from("moment_references").insert({ creator_id: b.creatorId, entity_type: "conversation", entity_id: id, visibility: "private" }).select("id").single()).id;
    const dv = expectOk(await b.client.from("dejavus").insert({ creator_id: b.creatorId, name: "Carousels" }).select("id").single()).id;
    expectOk(await b.client.from("dejavu_moments").insert({ dejavu_id: dv, moment_id: ref, creator_id: b.creatorId, added_by: b.creatorId }));
    // A sees only their own Moment of it, with no DejaVu.
    const aMoments = expectOk(await a.client.from("moment_references").select("id, creator_id").eq("entity_id", id));
    expect(aMoments.map((x) => x.creator_id)).toEqual([a.creatorId]);
    expect(expectOk(await a.client.from("dejavu_moments").select("id").eq("moment_id", aMoments[0]!.id))).toEqual([]);
    // Nobody can reference a conversation they can't see.
    const limited = await start(a, { visibility: "limited" });
    expectDenied(await b.client.from("moment_references").insert({ creator_id: b.creatorId, entity_type: "conversation", entity_id: limited, visibility: "private" }));
    // Deleting the conversation removes every reference to it.
    expectOk(await a.client.from("open_conversations").delete().eq("id", id).select("id"));
    expect(expectOk(await admin.from("moment_references").select("id").eq("entity_id", id))).toEqual([]);
  });
});
