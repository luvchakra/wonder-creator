import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  cleanupTestCreators,
  createTestCreator,
  expectDenied,
  expectOk,
  type Db,
  type TestCreator,
} from "./helpers";

let pub: TestCreator; // visibility public
let members: TestCreator; // creators_only (the default)
let priv: TestCreator; // private
let viewer: TestCreator;
let anon: Db;

async function visibleIds(client: Db): Promise<string[]> {
  const rows = expectOk(
    await client.from("creators").select("id").in("id", [pub.creatorId, members.creatorId, priv.creatorId]),
  );
  return rows.map((r) => r.id).sort();
}

beforeAll(async () => {
  [pub, members, priv, viewer] = await Promise.all([
    createTestCreator("profilePublic"),
    createTestCreator("profileMembers"),
    createTestCreator("profilePrivate"),
    createTestCreator("profileViewer"),
  ]);
  anon = anonClient();
  expectOk(await pub.client.from("creators").update({ visibility: "public" }).eq("id", pub.creatorId));
  expectOk(await priv.client.from("creators").update({ visibility: "private" }).eq("id", priv.creatorId));
  for (const c of [pub, members, priv]) {
    expectOk(await c.client.from("creator_disciplines").insert({ creator_id: c.creatorId, value: "poetry" }));
  }
});
afterAll(cleanupTestCreators);

describe("profile visibility", () => {
  it("defaults new creators to creators_only", async () => {
    const row = expectOk(await members.client.from("creators").select("visibility").eq("id", members.creatorId).single());
    expect(row.visibility).toBe("creators_only");
  });

  it("anon sees only public creators", async () => {
    expect(await visibleIds(anon)).toEqual([pub.creatorId]);
  });

  it("an authenticated creator sees public and creators_only profiles but not private ones", async () => {
    expect(await visibleIds(viewer.client)).toEqual([pub.creatorId, members.creatorId].sort());
  });

  it("a private creator still sees their own profile", async () => {
    const ids = await visibleIds(priv.client);
    expect(ids).toContain(priv.creatorId);
  });

  it("identity facets follow profile visibility", async () => {
    const ids = [pub.creatorId, members.creatorId, priv.creatorId];
    const anonRows = expectOk(await anon.from("creator_disciplines").select("creator_id").in("creator_id", ids));
    expect(anonRows.map((r) => r.creator_id)).toEqual([pub.creatorId]);
    const viewerRows = expectOk(await viewer.client.from("creator_disciplines").select("creator_id").in("creator_id", ids));
    expect(viewerRows.map((r) => r.creator_id).sort()).toEqual([pub.creatorId, members.creatorId].sort());
  });

  it("a creator cannot write another creator's facets", async () => {
    expectDenied(await viewer.client.from("creator_disciplines").insert({ creator_id: pub.creatorId, value: "forged" }));
  });

  it("anon cannot update a profile", async () => {
    const res = await anon.from("creators").update({ display_name: "anon-edit" }).eq("id", pub.creatorId).select();
    if (!res.error) expect(res.data).toHaveLength(0);
  });
});

describe("blocks", () => {
  let blocker: TestCreator;
  let blocked: TestCreator;
  let bystander: TestCreator;

  beforeAll(async () => {
    [blocker, blocked, bystander] = await Promise.all([
      createTestCreator("blocker"),
      createTestCreator("blocked"),
      createTestCreator("bystander"),
    ]);
    expectOk(await blocker.client.from("creators").update({ visibility: "public" }).eq("id", blocker.creatorId));
  });

  it("the profile is visible before the block", async () => {
    const rows = expectOk(await blocked.client.from("creators").select("id").eq("id", blocker.creatorId));
    expect(rows).toHaveLength(1);
  });

  it("a creator cannot create a block on someone else's behalf", async () => {
    expectDenied(
      await bystander.client
        .from("creator_blocks")
        .insert({ blocker_creator_id: blocker.creatorId, blocked_creator_id: blocked.creatorId }),
    );
  });

  it("blocking hides the blocker's profile from the blocked creator only", async () => {
    expectOk(
      await blocker.client
        .from("creator_blocks")
        .insert({ blocker_creator_id: blocker.creatorId, blocked_creator_id: blocked.creatorId }),
    );
    expect(expectOk(await blocked.client.from("creators").select("id").eq("id", blocker.creatorId))).toHaveLength(0);
    expect(expectOk(await bystander.client.from("creators").select("id").eq("id", blocker.creatorId))).toHaveLength(1);
    expect(expectOk(await anon.from("creators").select("id").eq("id", blocker.creatorId))).toHaveLength(1);
  });

  it("the blocked creator cannot see the block row", async () => {
    const rows = expectOk(
      await blocked.client.from("creator_blocks").select("blocker_creator_id").eq("blocked_creator_id", blocked.creatorId),
    );
    expect(rows).toHaveLength(0);
  });

  it("the blocked creator cannot follow the blocker", async () => {
    expectDenied(
      await blocked.client
        .from("creator_follows")
        .insert({ follower_creator_id: blocked.creatorId, followed_creator_id: blocker.creatorId }),
    );
  });
});
