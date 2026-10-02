import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  canMessage,
  createProject,
  createTask,
  deleteDirectMessage,
  getThread,
  inviteToCrew,
  linkToProject,
  listCrewMessages,
  listThreads,
  markCrewRead,
  markThreadRead,
  openDirectThread,
  postCrewMessage,
  respondToCrew,
  sendDirectMessage,
  startCrew,
  unreadMessages,
} from "@wonder/creator-projects";
import { createArtifact } from "@wonder/creator-studio";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createTestCreator, expectOk, type TestCreator } from "./helpers";

const admin = adminClient();
let owner: TestCreator;
let mira: TestCreator; // crewmate
let closed: TestCreator; // no relationship, not taking collaborations
let open: TestCreator; // no relationship, open to collaborate
let projectId: string;
let crewId: string;
let piece: string;
let otherPiece: string; // owner's piece Mira isn't on
const db = (x: TestCreator) => x.client as unknown as AppDb;

beforeAll(async () => {
  [owner, mira, closed, open] = await Promise.all(["msgOwner", "msgMira", "msgClosed", "msgOpen"].map((l) => createTestCreator(l)));
  expectOk(await admin.from("creators").update({ collaboration_availability: "closed", onboarding_step: "complete" }).eq("id", closed.creatorId).select("id"));
  expectOk(await admin.from("creators").update({ collaboration_availability: "open", onboarding_step: "complete" }).eq("id", open.creatorId).select("id"));
  projectId = (await createProject(db(owner), owner.creatorId, { title: "Harbour Film" })).id;
  crewId = (await startCrew(db(owner), owner.creatorId, projectId, {})).id;
  await inviteToCrew(db(owner), crewId, { creatorId: mira.creatorId });
  await respondToCrew(db(mira), crewId, true);
  piece = (await createArtifact(db(owner), owner.creatorId, { artifactType: "poem", title: "Harbour", content: "Low tide.", authorKind: "creator", provenance: { origin: "typed" } })).id;
  otherPiece = (await createArtifact(db(owner), owner.creatorId, { artifactType: "poem", title: "Private", content: "Mine.", authorKind: "creator", provenance: { origin: "typed" } })).id;
  await linkToProject(db(owner), owner.creatorId, projectId, { kind: "artifact", ids: [piece] });
});
afterAll(cleanupTestCreators);

describe("crew chat context and unread", () => {
  it("messages can point at project things only; unread counts clear when read", async () => {
    const task = await createTask(db(owner), owner.creatorId, projectId, { title: "Scout the pier" });
    await postCrewMessage(db(owner), owner.creatorId, crewId, { body: "Can you take this?", contextKind: "task", contextId: task });
    await postCrewMessage(db(owner), owner.creatorId, crewId, { body: "Thoughts on the poem?", contextKind: "artifact", contextId: piece, draftedByAi: true });
    await expect(postCrewMessage(db(owner), owner.creatorId, crewId, { body: "Not in the project", contextKind: "artifact", contextId: otherPiece })).rejects.toThrow(/isn't part of this Creative Room/);
    const { messages } = await listCrewMessages(db(owner), owner.creatorId, crewId);
    expect(messages.map((m) => m.context?.label)).toEqual(["Task: Scout the pier", "Creation: Harbour"]);
    expect(messages[1]).toMatchObject({ draftedByAi: true, context: { href: `/creations/${piece}` } });
    // A context never reveals what the reader can't open (Mira isn't on the piece).
    const forMira = (await listCrewMessages(db(mira), mira.creatorId, crewId)).messages;
    expect(forMira[1]!.context).toMatchObject({ label: "Something you can't open", href: null });

    expect((await unreadMessages(db(mira))).find((u) => u.id === crewId)).toMatchObject({ kind: "crew", unread: 2, projectId, latestAuthor: expect.any(String) });
    expect((await unreadMessages(db(owner))).find((u) => u.id === crewId)).toBeUndefined(); // your own messages aren't unread
    await markCrewRead(db(mira), mira.creatorId, crewId);
    expect((await unreadMessages(db(mira))).find((u) => u.id === crewId)).toBeUndefined();
    // Nobody else's read marker can be set.
    const forged = await closed.client.from("crew_message_reads").insert({ crew_id: crewId, creator_id: closed.creatorId });
    expect(forged.error).toBeTruthy();
  });
});

describe("direct conversations", () => {
  it("open with people you work with or who are open; never with someone closed you don't know", async () => {
    expect(await canMessage(db(owner), mira.creatorId)).toBe(true);
    expect(await canMessage(db(owner), open.creatorId)).toBe(true);
    expect(await canMessage(db(owner), closed.creatorId)).toBe(false);
    await expect(openDirectThread(db(owner), closed.creatorId)).rejects.toThrow(/can't message/);
    const t1 = await openDirectThread(db(owner), mira.creatorId);
    expect(await openDirectThread(db(mira), owner.creatorId)).toBe(t1); // one conversation per pair
    expectOk(await owner.client.from("direct_threads").select("id").eq("id", t1));
    expect(expectOk(await open.client.from("direct_threads").select("id").eq("id", t1))).toEqual([]);
    const forged = await owner.client.from("direct_threads").insert({ creator_a: owner.creatorId < closed.creatorId ? owner.creatorId : closed.creatorId, creator_b: owner.creatorId < closed.creatorId ? closed.creatorId : owner.creatorId });
    expect(forged.error).toBeTruthy();
  });

  it("messages can be about what both people can open; outsiders see nothing; read markers and removal", async () => {
    const t = await openDirectThread(db(owner), mira.creatorId);
    await sendDirectMessage(db(owner), owner.creatorId, t, { body: "About the film", projectId });
    await expect(sendDirectMessage(db(owner), owner.creatorId, t, { body: "About my private poem", artifactId: otherPiece })).rejects.toThrow(/isn't open to both/);
    const reply = await sendDirectMessage(db(mira), mira.creatorId, t, { body: "Sounds good", draftedByAi: true });
    await expect(sendDirectMessage(db(open), open.creatorId, t, { body: "Hi" })).rejects.toThrow();

    const thread = await getThread(db(owner), owner.creatorId, t);
    expect(thread.messages.map((m) => [m.body, m.mine, m.project?.title ?? null, m.draftedByAi])).toEqual([
      ["About the film", true, "Harbour Film", false],
      ["Sounds good", false, null, true],
    ]);
    expect(expectOk(await open.client.from("direct_messages").select("id").eq("thread_id", t))).toEqual([]);

    const [summary] = (await listThreads(db(owner), owner.creatorId)).filter((x) => x.id === t);
    expect(summary).toMatchObject({ other: { id: mira.creatorId }, unread: 1, lastMessage: { body: "Sounds good", mine: false } });
    await markThreadRead(db(owner), owner.creatorId, t);
    expect((await unreadMessages(db(owner))).find((u) => u.id === t)).toBeUndefined();

    // Messages can't be edited; only the author removes theirs.
    const edit = await mira.client.from("direct_messages").update({ body: "changed" }).eq("id", reply).select("id");
    expect(edit.error ?? edit.data?.length === 0).toBeTruthy();
    await expect(deleteDirectMessage(db(owner), reply)).rejects.toThrow(/isn't yours/);
    await deleteDirectMessage(db(mira), reply);
  });

  it("a block stops the conversation both ways", async () => {
    const t = await openDirectThread(db(owner), open.creatorId);
    await sendDirectMessage(db(owner), owner.creatorId, t, { body: "Hello!" });
    expectOk(await open.client.from("creator_blocks").insert({ blocker_creator_id: open.creatorId, blocked_creator_id: owner.creatorId }).select("blocker_creator_id"));
    await expect(sendDirectMessage(db(owner), owner.creatorId, t, { body: "Still there?" })).rejects.toThrow();
    await expect(sendDirectMessage(db(open), open.creatorId, t, { body: "Bye" })).rejects.toThrow();
    await expect(openDirectThread(db(owner), open.creatorId)).rejects.toThrow(/can't message/);
  });
});
