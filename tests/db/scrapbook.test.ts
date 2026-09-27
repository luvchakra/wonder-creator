import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPost, deletePost, deleteReply, getPost, listPosts, replyToPost, updatePostSettings } from "@wonder/creator-library";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createMaterial, createTestCreator, expectOk, fakeSha, textBlob, type TestCreator } from "./helpers";

const admin = adminClient();
let a: TestCreator; // author
let b: TestCreator; // follower-ish viewer
let c: TestCreator; // someone A blocks
let sketch: string; // A's file-backed material
let sketchPath: string;
let unattachedPath: string;
const db = (x: TestCreator) => x.client as unknown as AppDb;

async function fileMaterial(owner: TestCreator, title: string): Promise<{ id: string; path: string }> {
  const path = `${owner.creatorId}/${randomUUID()}.txt`;
  expectOk(await owner.client.storage.from("creator-media").upload(path, textBlob("a sketch"), { contentType: "text/plain" }));
  const so = expectOk(await admin.from("storage_objects").insert({ creator_id: owner.creatorId, bucket: "creator-media", path, mime_type: "text/plain", size_bytes: 8, sha256: fakeSha(), security_status: "clean" }).select("id").single());
  const id = await createMaterial(owner, title);
  expectOk(await admin.from("creative_materials").update({ storage_object_id: so.id, security_status: "clean" }).eq("id", id).select("id"));
  return { id, path };
}

beforeAll(async () => {
  [a, b, c] = await Promise.all([createTestCreator("sbAuthor"), createTestCreator("sbViewer"), createTestCreator("sbBlocked")]);
  ({ id: sketch, path: sketchPath } = await fileMaterial(a, "Harbour sketch"));
  unattachedPath = (await fileMaterial(a, "Private diary scan")).path;
});
afterAll(cleanupTestCreators);

describe("posting", () => {
  it("public posts are visible to others, private ones only to you; attaching is the only sharing", async () => {
    const pub = await createPost(db(a), a.creatorId, { kind: "sketch", body: "Morning light on the harbour.", materialIds: [sketch] });
    const priv = await createPost(db(a), a.creatorId, { body: "Not ready yet.", visibility: "private" });
    const seen = (await listPosts(db(b), b.creatorId, { scope: "everyone" })).posts.map((p) => p.id);
    expect(seen).toContain(pub);
    expect(seen).not.toContain(priv);
    expect((await listPosts(db(a), a.creatorId, { scope: "creator", authorId: a.creatorId })).posts.map((p) => p.id)).toEqual(expect.arrayContaining([pub, priv]));

    const post = (await getPost(db(b), b.creatorId, pub))!;
    const [att] = post.post.attachments;
    expect(att).toMatchObject({ kind: "material", title: "Harbour sketch", canOpen: false });
    expect(att.fileUrl).toMatch(/^http/);
    // The attached file can be signed by a viewer; an unattached one can't.
    expect((await b.client.storage.from("creator-media").createSignedUrl(sketchPath, 60)).data?.signedUrl).toBeTruthy();
    expect((await b.client.storage.from("creator-media").createSignedUrl(unattachedPath, 60)).data?.signedUrl).toBeFalsy();
    // …and the rest of the material stays private.
    expect(expectOk(await b.client.from("creative_materials").select("id").eq("id", sketch))).toEqual([]);
    await expect(createPost(db(b), b.creatorId, { body: "mine?", materialIds: [sketch] })).rejects.toThrow(/only your own/);
    await expect(createPost(db(a), a.creatorId, { body: "" })).rejects.toThrow(/Write something/);
  });

  it("blocks hide posts both ways", async () => {
    const pub = await createPost(db(a), a.creatorId, { body: "Hello from A." });
    expectOk(await a.client.from("creator_blocks").insert({ blocker_creator_id: a.creatorId, blocked_creator_id: c.creatorId }).select("blocker_creator_id"));
    expect(await getPost(db(c), c.creatorId, pub)).toBeNull();
    await expect(replyToPost(db(c), c.creatorId, pub, { body: "hi" })).rejects.toThrow();
  });
});

describe("replies", () => {
  it("follow the post's reply setting; the author can remove any reply on their post", async () => {
    const id = await createPost(db(a), a.creatorId, { body: "What do tides remember?" });
    const r = await replyToPost(db(b), b.creatorId, id, { body: "Every shoreline." });
    expect((await getPost(db(a), a.creatorId, id))!.replies.map((x) => x.body)).toEqual(["Every shoreline."]);

    await updatePostSettings(db(a), id, { replyPolicy: "none" });
    expect((await getPost(db(b), b.creatorId, id))!.canReply).toBe(false);
    await expect(replyToPost(db(b), b.creatorId, id, { body: "Again" })).rejects.toThrow(/limited by its creator/);

    await updatePostSettings(db(a), id, { replyPolicy: "following" });
    await expect(replyToPost(db(b), b.creatorId, id, { body: "Not followed" })).rejects.toThrow(/limited/);
    expectOk(await a.client.from("creator_follows").insert({ follower_creator_id: a.creatorId, followed_creator_id: b.creatorId }).select("follower_creator_id"));
    await replyToPost(db(b), b.creatorId, id, { body: "Now I can." });

    await deleteReply(db(a), r.id); // the author moderates their post
    expect((await getPost(db(b), b.creatorId, id))!.replies.map((x) => x.body)).toEqual(["Now I can."]);
    await expect(updatePostSettings(db(b), id, { visibility: "private" })).rejects.toThrow(/couldn't find/);
  });

  it("deleting a post removes it and its replies; only the author can", async () => {
    const id = await createPost(db(a), a.creatorId, { body: "Temporary." });
    await replyToPost(db(b), b.creatorId, id, { body: "Noted." });
    await expect(deletePost(db(b), id)).rejects.toThrow(/couldn't find/);
    await deletePost(db(a), id);
    expect(await getPost(db(a), a.creatorId, id)).toBeNull();
    expect(expectOk(await admin.from("scrapbook_replies").select("id").eq("post_id", id))).toEqual([]);
  });

  it("posting and deleting are audited", async () => {
    const actions = expectOk(await a.client.from("audit_logs").select("action").eq("object_type", "scrapbook_post")).map((x) => x.action);
    expect(actions).toEqual(expect.arrayContaining(["scrapbook.posted", "scrapbook.settings", "scrapbook.deleted"]));
  });
});
