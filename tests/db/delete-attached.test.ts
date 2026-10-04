import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTestCreators, createArtifact, createMaterial, createTestCreator, expectOk, type TestCreator } from "./helpers";

// Owner, 4 Oct 2026: deleting a Creation attached in a conversation failed ("Some details weren't valid."). An
// attachment whose only link is the deleted thing goes with it; one that still points at something else stays.
let me: TestCreator;
let friend: TestCreator;
beforeAll(async () => {
  [me, friend] = await Promise.all([createTestCreator("delAttMe"), createTestCreator("delAttFriend")]);
});
afterAll(cleanupTestCreators);

async function message(c: TestCreator) {
  const conv = expectOk(await c.client.from("conversations").insert({ creator_id: c.creatorId }).select("id").single());
  return expectOk(await c.client.from("conversation_messages").insert({ conversation_id: conv.id, creator_id: c.creatorId, role: "creator", content: "this one" }).select("id").single()).id;
}

describe("deleting what was attached in a conversation", () => {
  it("a Creation attached on its own: the delete goes through and the attachment goes with it", async () => {
    const art = await createArtifact(me, { title: "Someone, Somewhere", artifact_type: "carousel", category: "visual" });
    const msg = await message(me);
    expectOk(await me.client.from("conversation_attachments").insert({ message_id: msg, creator_id: me.creatorId, artifact_id: art }));
    expectOk(await me.client.from("artifacts").delete().eq("id", art));
    expect(expectOk(await me.client.from("artifacts").select("id").eq("id", art))).toEqual([]);
    expect(expectOk(await me.client.from("conversation_attachments").select("id").eq("message_id", msg))).toEqual([]);
  });

  it("a Material attached on its own: the same", async () => {
    const mat = await createMaterial(me, "A photo");
    const msg = await message(me);
    expectOk(await me.client.from("conversation_attachments").insert({ message_id: msg, creator_id: me.creatorId, material_id: mat }));
    expectOk(await me.client.from("creative_materials").delete().eq("id", mat));
    expect(expectOk(await me.client.from("conversation_attachments").select("id").eq("message_id", msg))).toEqual([]);
  });

  it("attached together with a Material: the attachment keeps the Material", async () => {
    const art = await createArtifact(me, { title: "Both", artifact_type: "poem", category: "writing" });
    const mat = await createMaterial(me, "Kept");
    const msg = await message(me);
    expectOk(await me.client.from("conversation_attachments").insert({ message_id: msg, creator_id: me.creatorId, artifact_id: art, material_id: mat }));
    expectOk(await me.client.from("artifacts").delete().eq("id", art));
    expect(expectOk(await me.client.from("conversation_attachments").select("artifact_id, material_id").eq("message_id", msg))).toEqual([{ artifact_id: null, material_id: mat }]);
  });

  it("attached by someone else who could read it: the owner can still delete it", async () => {
    const art = await createArtifact(me, { title: "Shared", artifact_type: "poem", category: "writing", privacy: "public", status: "published" });
    const msg = await message(friend);
    expectOk(await friend.client.from("conversation_attachments").insert({ message_id: msg, creator_id: friend.creatorId, artifact_id: art }));
    expectOk(await me.client.from("artifacts").delete().eq("id", art));
    expect(expectOk(await me.client.from("artifacts").select("id").eq("id", art))).toEqual([]);
  });
});
