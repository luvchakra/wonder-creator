import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createArtifact, createShareLink, createVersion, listShares, openCreatorShare, openShareLink, revokeShare, sharedWithMe, shareWithCreator } from "@wonder/creator-studio";
import type { Db as AppDb } from "@wonder/db";
import { anonClient, cleanupTestCreators, createMaterial, createTestCreator, expectOk, loose, type TestCreator } from "./helpers";

let a: TestCreator; // owner
let b: TestCreator; // recipient
let c: TestCreator; // bystander
let piece: string;
let v1: string;
const db = (x: TestCreator) => x.client as unknown as AppDb;
const anon = anonClient() as unknown as AppDb;

beforeAll(async () => {
  [a, b, c] = await Promise.all([createTestCreator("shareOwner"), createTestCreator("shareTo"), createTestCreator("shareOther")]);
  for (const x of [b, c]) expectOk(await x.client.from("creators").update({ handle: `s${x.creatorId.replace(/-/g, "").slice(0, 20)}` }).eq("id", x.creatorId).select("id"));
  const art = await createArtifact(db(a), a.creatorId, { artifactType: "poem", title: "Lanterns", content: "First light.", authorKind: "creator", provenance: { origin: "typed" } });
  piece = art.id;
  v1 = art.current_version_id!;
  // Private source material linked to the piece: it must never show through a share.
  const mat = await createMaterial(a, "Secret diary entry");
  expectOk(await a.client.from("lineage_edges").insert({ creator_id: a.creatorId, source_type: "material", source_id: mat, target_type: "artifact", target_id: piece, relationship: "created_from" }).select("id"));
});
afterAll(cleanupTestCreators);

describe("private links", () => {
  it("open for anyone holding the token, with only the piece itself", async () => {
    const { token } = await createShareLink(db(a), a.creatorId, piece, { allowDownload: true });
    for (const client of [anon, db(c)]) {
      const p = await openShareLink(client, token);
      expect(p).toMatchObject({ title: "Lanterns", content: "First light.", creatorName: expect.any(String), allowDownload: true, pinned: false });
      expect(JSON.stringify(p)).not.toMatch(/Secret diary/);
    }
    // The piece itself stays private everywhere else.
    expect(expectOk(await c.client.from("artifacts").select("id").eq("id", piece))).toEqual([]);
    expect(await openShareLink(anon, `${token.slice(0, -2)}xx`)).toBeNull();
  });

  it("follow the latest version, or stay on a pinned one", async () => {
    const latest = await createShareLink(db(a), a.creatorId, piece, {});
    const pinned = await createShareLink(db(a), a.creatorId, piece, { versionId: v1 });
    await createVersion(db(a), piece, { content: "Second light.", label: "Revised", authorKind: "creator" });
    expect((await openShareLink(anon, latest.token))?.content).toBe("Second light.");
    expect(await openShareLink(anon, pinned.token)).toMatchObject({ content: "First light.", pinned: true, versionNumber: 1 });
  });

  it("stop working when revoked or expired, and only the owner can revoke", async () => {
    const { share, token } = await createShareLink(db(a), a.creatorId, piece, {});
    await expect(revokeShare(db(b), share.id)).rejects.toThrow(/couldn't find/);
    // No direct updates: a share can't be un-revoked or extended.
    const tamper = await loose(a.client).from("artifact_shares").update({ expires_at: null }).eq("id", share.id).select("id");
    expect(tamper.data ?? []).toEqual([]);
    await revokeShare(db(a), share.id);
    expect(await openShareLink(anon, token)).toBeNull();
    await expect(revokeShare(db(a), share.id)).rejects.toThrow(/already turned off/);

    await expect(createShareLink(db(a), a.creatorId, piece, { expiresAt: new Date(Date.now() - 60_000).toISOString() })).rejects.toThrow(/future/);
    const soon = await createShareLink(db(a), a.creatorId, piece, { expiresAt: new Date(Date.now() + 1500).toISOString() });
    expect(await openShareLink(anon, soon.token)).not.toBeNull();
    await new Promise((r) => setTimeout(r, 2000));
    expect(await openShareLink(anon, soon.token)).toBeNull();
    const views = await listShares(db(a), piece);
    expect(views.find((s) => s.id === share.id)?.state).toBe("revoked");
    expect(views.find((s) => s.id === soon.share.id)?.state).toBe("expired");
  });

  it("can only be made by the owner", async () => {
    await expect(createShareLink(db(b), b.creatorId, piece, {})).rejects.toThrow();
    expect(await listShares(db(b), piece)).toEqual([]);
  });
});

describe("sharing with a creator", () => {
  it("lets only that creator open it, once per person", async () => {
    const [bb] = expectOk(await b.client.from("creators").select("handle").eq("id", b.creatorId));
    const share = await shareWithCreator(db(a), a.creatorId, piece, { handle: `@${bb.handle}` });
    await expect(shareWithCreator(db(a), a.creatorId, piece, { handle: bb.handle! })).rejects.toThrow(/already shared/);
    expect(await openCreatorShare(db(b), share.id)).toMatchObject({ title: "Lanterns", kind: "creator" });
    expect(await openCreatorShare(db(c), share.id)).toBeNull();
    expect((await sharedWithMe(db(b))).map((s) => s.shareId)).toContain(share.id);
    expect(await sharedWithMe(db(c))).toEqual([]);
    // Sharing doesn't widen access to the piece, its versions or its sources.
    expect(expectOk(await b.client.from("artifacts").select("id").eq("id", piece))).toEqual([]);
    expect(expectOk(await b.client.from("artifact_versions").select("id").eq("artifact_id", piece))).toEqual([]);
    await revokeShare(db(a), share.id);
    expect(await openCreatorShare(db(b), share.id)).toBeNull();
    expect(await sharedWithMe(db(b))).toEqual([]);
  });

  it("isn't possible with someone who blocked you", async () => {
    const [cc] = expectOk(await c.client.from("creators").select("handle").eq("id", c.creatorId));
    expectOk(await c.client.from("creator_blocks").insert({ blocker_creator_id: c.creatorId, blocked_creator_id: a.creatorId }).select("blocker_creator_id"));
    await expect(shareWithCreator(db(a), a.creatorId, piece, { handle: cc.handle! })).rejects.toThrow();
  });

  it("archived pieces don't open through any share", async () => {
    const { token } = await createShareLink(db(a), a.creatorId, piece, {});
    expectOk(await a.client.from("artifacts").update({ status: "archived" }).eq("id", piece).select("id"));
    expect(await openShareLink(anon, token)).toBeNull();
    expectOk(await a.client.from("artifacts").update({ status: "draft" }).eq("id", piece).select("id"));
    expect(await openShareLink(anon, token)).not.toBeNull();
  });

  it("shares made and revoked are in the owner's audit log", async () => {
    const actions = expectOk(await a.client.from("audit_logs").select("action").eq("object_id", piece)).map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["share.created", "share.revoked"]));
  });
});
