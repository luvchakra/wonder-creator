import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { followCounts, followList } from "@wonder/creator-identity";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, anonClient, cleanupTestCreators, createTestCreator, expectDenied, expectOk, type TestCreator } from "./helpers";

// Followers and following on the Profile (owner decision, 2 Oct 2026): plain counts, and lists that show only people
// the viewer may see. Follow rows stay private to their two creators.
const admin = adminClient();
const anon = anonClient();
let ada: TestCreator;
let bo: TestCreator;
let cy: TestCreator;
let hidden: TestCreator;
const db = (x: TestCreator) => x.client as unknown as AppDb;
const follow = async (a: TestCreator, b: TestCreator) => expectOk(await a.client.from("creator_follows").insert({ follower_creator_id: a.creatorId, followed_creator_id: b.creatorId }).select("follower_creator_id"));

beforeAll(async () => {
  [ada, bo, cy, hidden] = await Promise.all([createTestCreator("fAda"), createTestCreator("fBo"), createTestCreator("fCy"), createTestCreator("fHidden")]);
  await follow(bo, ada);
  await follow(cy, ada);
  await follow(hidden, ada);
  await follow(ada, bo);
  // Hidden blocks Cy: Cy must never see Hidden in a list.
  expectOk(await hidden.client.from("creator_blocks").insert({ blocker_creator_id: hidden.creatorId, blocked_creator_id: cy.creatorId }).select("blocker_creator_id"));
});
afterAll(cleanupTestCreators);

describe("follow counts and lists", () => {
  it("counts are plain totals anyone who can see the profile gets; 'follows you' is from the viewer's side", async () => {
    expect(await followCounts(db(bo), ada.creatorId)).toEqual({ followers: 3, following: 1, followsMe: true });
    expect(await followCounts(db(cy), ada.creatorId)).toEqual({ followers: 3, following: 1, followsMe: false });
  });

  it("lists show only people the viewer may see, newest first, with whether the viewer follows each", async () => {
    const forBo = await followList(db(bo), ada.creatorId, "followers");
    expect(forBo.people.map((p) => p.id).sort()).toEqual([bo.creatorId, cy.creatorId, hidden.creatorId].sort());
    const forCy = await followList(db(cy), ada.creatorId, "followers");
    expect(forCy.people.map((p) => p.id)).not.toContain(hidden.creatorId);
    expect((await followList(db(cy), ada.creatorId, "following")).people.map((p) => p.name)).toHaveLength(1);
    expect((await followList(db(ada), ada.creatorId, "followers")).people.find((p) => p.id === bo.creatorId)?.iFollow).toBe(true);
  });

  it("a profile the viewer can't see gives nothing; signed-out readers can't ask; rows stay private", async () => {
    expectOk(await admin.from("creators").update({ visibility: "private" }).eq("id", ada.creatorId).select("id"));
    expect(await followCounts(db(cy), ada.creatorId)).toBeNull();
    expect((await followList(db(cy), ada.creatorId, "followers")).people).toEqual([]);
    expectOk(await admin.from("creators").update({ visibility: "creators_only" }).eq("id", ada.creatorId).select("id"));
    expectDenied(await anon.rpc("follow_counts", { p_creator: ada.creatorId }));
    expect(expectOk(await cy.client.from("creator_follows").select("follower_creator_id").eq("followed_creator_id", ada.creatorId))).toEqual([{ follower_creator_id: cy.creatorId }]);
  });
});
