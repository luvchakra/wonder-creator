import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { homeCommunityGlance } from "@wonder/creator-community";
import { createArtifact } from "@wonder/creator-studio";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createTestCreator, expectOk, type TestCreator } from "./helpers";

// Home → From the community: a small glance read through the viewer's own access — public, finished work only,
// people you follow first (with why), and never anyone across a block.
const admin = adminClient();
let me: TestCreator;
let friend: TestCreator;
let stranger: TestCreator;
let blocked: TestCreator;
const db = (x: TestCreator) => x.client as unknown as AppDb;
const tag = Date.now().toString(36);

async function publicWork(x: TestCreator, title: string, opts: { privacy?: "public" | "creator_private"; status?: "final" | "draft" } = {}) {
  const a = await createArtifact(db(x), x.creatorId, { artifactType: "poem", title, content: `${title}\nsecond line`, authorKind: "creator", provenance: { origin: "typed" } });
  expectOk(await admin.from("artifacts").update({ privacy: opts.privacy ?? "public", status: opts.status ?? "final" }).eq("id", a.id).select("id"));
  return a.id;
}

beforeAll(async () => {
  [me, friend, stranger, blocked] = await Promise.all([createTestCreator("hcMe"), createTestCreator("hcFriend"), createTestCreator("hcStranger"), createTestCreator("hcBlocked")]);
  await publicWork(friend, `Friend poem ${tag}`);
  await publicWork(stranger, `Stranger poem ${tag}`);
  await publicWork(stranger, `Stranger draft ${tag}`, { status: "draft" });
  await publicWork(stranger, `Stranger private ${tag}`, { privacy: "creator_private" });
  await publicWork(blocked, `Blocked poem ${tag}`);
  expectOk(await me.client.from("creator_follows").insert({ follower_creator_id: me.creatorId, followed_creator_id: friend.creatorId }).select("follower_creator_id"));
  expectOk(await me.client.from("creator_blocks").insert({ blocker_creator_id: me.creatorId, blocked_creator_id: blocked.creatorId }).select("blocker_creator_id"));
  expectOk(await friend.client.from("scrapbook_posts").insert({ creator_id: friend.creatorId, body: `A friend's thought ${tag}`, visibility: "public" }).select("id"));
});
afterAll(cleanupTestCreators);

describe("Home: from the community", () => {
  it("shows public, finished work — people you follow first, with why — and never private, draft or blocked work", async () => {
    const g = await homeCommunityGlance(db(me), me.creatorId);
    const titles = g.creations.map((c) => c.title);
    expect(titles[0]).toBe(`Friend poem ${tag}`);
    expect(g.creations[0]!.reason).toMatch(/^You follow /);
    expect(g.creations[0]!.excerpt).toContain("second line");
    const mine = titles.filter((t) => t.endsWith(tag));
    expect(mine).not.toContain(`Stranger draft ${tag}`);
    expect(mine).not.toContain(`Stranger private ${tag}`);
    expect(mine).not.toContain(`Blocked poem ${tag}`);
    expect(g.creations.length).toBeLessThanOrEqual(4);
    expect(g.thought?.body).toBe(`A friend's thought ${tag}`);
    expect(g.thought?.reason).toMatch(/^You follow /);
  });
});
