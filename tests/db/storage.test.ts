import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanupTestCreators, createTestCreator, expectOk, textBlob, type TestCreator } from "./helpers";

const BUCKET = "creator-media";
const admin = adminClient();
let a: TestCreator;
let b: TestCreator;
let aPath: string;

beforeAll(async () => {
  [a, b] = await Promise.all([createTestCreator("storageA"), createTestCreator("storageB")]);
  aPath = `${a.creatorId}/${randomUUID()}.txt`;
});
afterAll(async () => {
  await admin.storage.from(BUCKET).remove([aPath]).catch(() => undefined);
  await cleanupTestCreators();
});

describe("creator-media bucket", () => {
  it("is private", async () => {
    const bucket = expectOk(await admin.storage.getBucket(BUCKET));
    expect(bucket.public).toBe(false);
  });

  it("A can upload into A's own folder", async () => {
    const res = await a.client.storage.from(BUCKET).upload(aPath, textBlob("hello from A"), { contentType: "text/plain" });
    expect(res.error).toBeNull();
  });

  it("A can download A's own object", async () => {
    const res = await a.client.storage.from(BUCKET).download(aPath);
    expect(res.error).toBeNull();
    expect(await res.data?.text()).toBe("hello from A");
  });

  it("A cannot upload into B's folder", async () => {
    const res = await a.client.storage
      .from(BUCKET)
      .upload(`${b.creatorId}/${randomUUID()}.txt`, textBlob("intrusion"), { contentType: "text/plain" });
    expect(res.error).not.toBeNull();
  });

  it("A cannot upload outside any creator folder", async () => {
    const res = await a.client.storage.from(BUCKET).upload(`${randomUUID()}.txt`, textBlob("root"), { contentType: "text/plain" });
    expect(res.error).not.toBeNull();
  });

  it("B cannot download A's object", async () => {
    const res = await b.client.storage.from(BUCKET).download(aPath);
    expect(res.error).not.toBeNull();
    expect(res.data).toBeNull();
  });

  it("B cannot list A's folder", async () => {
    const res = await b.client.storage.from(BUCKET).list(a.creatorId);
    expect(res.data ?? []).toHaveLength(0);
  });

  it("B cannot create a signed URL for A's object", async () => {
    const res = await b.client.storage.from(BUCKET).createSignedUrl(aPath, 60);
    expect(res.error).not.toBeNull();
  });

  it("B cannot overwrite or delete A's object", async () => {
    const up = await b.client.storage.from(BUCKET).upload(aPath, textBlob("overwrite"), { upsert: true });
    expect(up.error).not.toBeNull();
    await b.client.storage.from(BUCKET).remove([aPath]);
    const still = await a.client.storage.from(BUCKET).download(aPath);
    expect(await still.data?.text()).toBe("hello from A");
  });

  it("anon cannot download A's object", async () => {
    const res = await anonClient().storage.from(BUCKET).download(aPath);
    expect(res.error).not.toBeNull();
  });
});
