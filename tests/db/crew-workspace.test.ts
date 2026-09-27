import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createProject,
  deleteCrewMessage,
  getProject,
  getSharedItem,
  inviteToCrew,
  leaveCrew,
  linkToProject,
  listCrewMessages,
  listSharedItems,
  postCrewMessage,
  respondToCrew,
  setItemShared,
  startCrew,
} from "@wonder/creator-projects";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createArtifact, createMaterial, createTestCreator, expectDenied, expectOk, fakeSha, textBlob, type TestCreator } from "./helpers";

const admin = adminClient();
const BUCKET = "creator-media";
let owner: TestCreator;
let mia: TestCreator; // crew member
let nat: TestCreator; // invited, not joined
let out: TestCreator; // outsider
let projectId: string;
let crewId: string;
let sketch: { id: string; path: string };
let privateNote: string;
const db = (x: TestCreator) => x.client as unknown as AppDb;

async function fileMaterial(c: TestCreator, title: string) {
  const path = `${c.creatorId}/${randomUUID()}.txt`;
  expectOk(await c.client.storage.from(BUCKET).upload(path, textBlob("storyboard frame"), { contentType: "text/plain" }));
  const so = expectOk(await admin.from("storage_objects").insert({ creator_id: c.creatorId, bucket: BUCKET, path, mime_type: "text/plain", size_bytes: 16, sha256: fakeSha(), security_status: "clean" }).select("id").single());
  const id = await createMaterial(c, title);
  expectOk(await admin.from("creative_materials").update({ storage_object_id: so.id, security_status: "clean" }).eq("id", id).select("id"));
  return { id, path };
}

beforeAll(async () => {
  [owner, mia, nat, out] = await Promise.all(["wsOwner", "wsMia", "wsNat", "wsOut"].map((l) => createTestCreator(l)));
  projectId = (await createProject(db(owner), owner.creatorId, { title: "A Life in Moments" })).id;
  crewId = (await startCrew(db(owner), owner.creatorId, projectId, {})).id;
  await inviteToCrew(db(owner), crewId, { creatorId: mia.creatorId });
  await respondToCrew(db(mia), crewId, true);
  await inviteToCrew(db(owner), crewId, { creatorId: nat.creatorId });
  sketch = await fileMaterial(owner, "Storyboard, scene 1");
  privateNote = await createMaterial(owner, "Owner's private diary");
});
afterAll(cleanupTestCreators);

describe("sharing work with the crew", () => {
  it("linked work stays private until its owner shares it; then the crew reads it read-only", async () => {
    await linkToProject(db(owner), owner.creatorId, projectId, { kind: "material", ids: [sketch.id, privateNote] });
    const items = (await getProject(db(owner), projectId)).items;
    const sketchItem = items.find((i) => i.itemId === sketch.id)!;
    const noteItem = items.find((i) => i.itemId === privateNote)!;
    expect(sketchItem.shared).toBe(false);

    expect(await listSharedItems(db(mia), projectId)).toEqual([]);
    expect(await getSharedItem(db(mia), sketchItem.id, BUCKET)).toBeNull();
    expect((await mia.client.storage.from(BUCKET).createSignedUrl(sketch.path, 60)).data?.signedUrl).toBeFalsy();

    await setItemShared(db(owner), projectId, sketchItem.id, true);
    expect((await listSharedItems(db(mia), projectId)).map((s) => [s.title, s.sharedBy.id])).toEqual([["Storyboard, scene 1", owner.creatorId]]);
    const view = (await getSharedItem(db(mia), sketchItem.id, BUCKET))!;
    expect(view).toMatchObject({ kind: "material", title: "Storyboard, scene 1", mine: false });
    expect(view.kind === "material" && view.fileUrl).toMatch(/^http/);
    // Sharing into the crew doesn't widen access anywhere else.
    expect(expectOk(await mia.client.from("creative_materials").select("id").eq("id", sketch.id))).toEqual([]);
    expect(await getSharedItem(db(mia), noteItem.id, BUCKET)).toBeNull();

    // Invitees and outsiders see nothing.
    for (const x of [nat, out]) {
      expect(await listSharedItems(db(x), projectId)).toEqual([]);
      expect(await getSharedItem(db(x), sketchItem.id, BUCKET)).toBeNull();
      expect((await x.client.storage.from(BUCKET).createSignedUrl(sketch.path, 60)).data?.signedUrl).toBeFalsy();
    }

    // Stop sharing: access ends.
    await setItemShared(db(owner), projectId, sketchItem.id, false);
    expect(await getSharedItem(db(mia), sketchItem.id, BUCKET)).toBeNull();
    expect((await mia.client.storage.from(BUCKET).createSignedUrl(sketch.path, 60)).data?.signedUrl).toBeFalsy();
    await setItemShared(db(owner), projectId, sketchItem.id, true);
  });

  it("crew members add their own work (always shared); only its owner can change that", async () => {
    const piece = await createArtifact(mia, { title: "Score sketch" });
    const othersPiece = await createArtifact(out, { title: "Not mine" });
    await expect(linkToProject(db(mia), mia.creatorId, projectId, { kind: "artifact", ids: [piece] })).rejects.toThrow(/only your own work/);
    await expect(linkToProject(db(mia), mia.creatorId, projectId, { kind: "artifact", ids: [othersPiece], shared: true })).rejects.toThrow(/only your own work/);
    await expect(linkToProject(db(mia), mia.creatorId, projectId, { kind: "conversation", ids: [randomUUID()], shared: true })).rejects.toThrow(/Only material, references and Creations/);
    await linkToProject(db(mia), mia.creatorId, projectId, { kind: "artifact", ids: [piece], shared: true });

    const shared = await listSharedItems(db(owner), projectId);
    const mine = shared.find((s) => s.title === "Score sketch")!;
    expect(mine).toMatchObject({ kind: "artifact", sharedBy: { id: mia.creatorId } });
    expect(await getSharedItem(db(owner), mine.itemId, BUCKET)).toMatchObject({ kind: "artifact", title: "Score sketch", mine: false });
    // The project's owner can't re-share it after Mia stops sharing, but can remove the link.
    await setItemShared(db(mia), projectId, mine.itemId, false);
    await expect(setItemShared(db(owner), projectId, mine.itemId, true)).rejects.toThrow(/Only the person whose work it is/);
    // A crew member can't share the owner's unshared link either.
    const noteItem = (await getProject(db(owner), projectId)).items.find((i) => i.itemId === privateNote)!;
    await expect(setItemShared(db(mia), projectId, noteItem.id, true)).rejects.toThrow();
    expect(expectOk(await owner.client.from("project_items").select("shared").eq("id", noteItem.id).single())).toEqual({ shared: false });
    await setItemShared(db(mia), projectId, mine.itemId, true);
  });

  it("people who leave lose access to shared work", async () => {
    const extra = await createTestCreator("wsLeaver");
    await inviteToCrew(db(owner), crewId, { creatorId: extra.creatorId });
    await respondToCrew(db(extra), crewId, true);
    const sketchItem = (await listSharedItems(db(extra), projectId)).find((s) => s.title === "Storyboard, scene 1")!;
    expect(await getSharedItem(db(extra), sketchItem.itemId, BUCKET)).not.toBeNull();
    await leaveCrew(db(extra), crewId);
    expect(await getSharedItem(db(extra), sketchItem.itemId, BUCKET)).toBeNull();
    expect((await extra.client.storage.from(BUCKET).createSignedUrl(sketch.path, 60)).data?.signedUrl).toBeFalsy();
  });
});

describe("crew chat", () => {
  it("is for active members only; authors and managers can remove messages", async () => {
    await postCrewMessage(db(owner), owner.creatorId, crewId, { body: "Welcome aboard!" });
    const sketchItem = (await listSharedItems(db(mia), projectId)).find((s) => s.title === "Storyboard, scene 1")!;
    const m = await postCrewMessage(db(mia), mia.creatorId, crewId, { body: "Loving scene 1.", itemId: sketchItem.itemId });
    const { messages } = await listCrewMessages(db(owner), owner.creatorId, crewId);
    expect(messages.map((x) => [x.body, x.author.id, x.itemId])).toEqual([
      ["Welcome aboard!", owner.creatorId, null],
      ["Loving scene 1.", mia.creatorId, sketchItem.itemId],
    ]);

    for (const x of [nat, out]) {
      expect((await listCrewMessages(db(x), x.creatorId, crewId)).messages).toEqual([]);
      await expect(postCrewMessage(db(x), x.creatorId, crewId, { body: "hi" })).rejects.toThrow(/Only people in the crew/);
    }
    // Messages can only point at work shared in this crew.
    const noteItem = (await getProject(db(owner), projectId)).items.find((i) => i.itemId === privateNote)!;
    await expect(postCrewMessage(db(mia), mia.creatorId, crewId, { body: "Look", itemId: noteItem.id })).rejects.toThrow();
    // Nobody edits a message.
    expectDenied(await mia.client.from("crew_messages").update({ body: "edited" }).eq("id", m.id));

    await expect(deleteCrewMessage(db(mia), crewId, messages[0].id)).rejects.toThrow(/isn't yours/);
    await deleteCrewMessage(db(mia), crewId, m.id);
    await deleteCrewMessage(db(owner), crewId, messages[0].id);
    expect((await listCrewMessages(db(owner), owner.creatorId, crewId)).messages).toEqual([]);
  });
});
