import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { brandSummaryOf, getBrandProfile, saveBrandProfile } from "@wonder/creator-identity";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createTestCreator, expectOk, type TestCreator } from "./helpers";

const admin = adminClient();
let maya: TestCreator;
let other: TestCreator;
const db = (x: TestCreator) => x.client as unknown as AppDb;

beforeAll(async () => {
  [maya, other] = await Promise.all(["brMaya", "brOther"].map((l) => createTestCreator(l)));
});
afterAll(cleanupTestCreators);

describe("brand profile (P1-15)", () => {
  it("is owner-only; others see a short summary only once the creator opts in", async () => {
    const profile = { niches: ["Slow travel"], platforms: ["YouTube"], deliverables: ["Short film"], priorCollaborations: ["Harbour Hotels"], usageRights: "Organic social only, 12 months.", commercialBoundaries: "No alcohol." };
    await saveBrandProfile(db(maya), maya.creatorId, { ...profile, openToBrands: false });
    expect(await brandSummaryOf(db(other), maya.creatorId)).toBeNull();

    await saveBrandProfile(db(maya), maya.creatorId, { ...profile, openToBrands: true });
    const summary = await brandSummaryOf(db(other), maya.creatorId);
    expect(summary).toEqual({ niches: ["Slow travel"], industries: [], platforms: ["YouTube"], deliverables: ["Short film"] });
    // The private parts never leave the owner.
    expect(JSON.stringify(summary)).not.toMatch(/Harbour Hotels|Organic social|alcohol/);
    expect(expectOk(await db(other).from("brand_profiles").select("*").eq("creator_id", maya.creatorId))).toEqual([]);
    expect((await db(other).from("brand_profiles").upsert({ creator_id: maya.creatorId, open_to_brands: false })).error).not.toBeNull();
    expect(await getBrandProfile(db(maya), maya.creatorId)).toMatchObject({ openToBrands: true, priorCollaborations: ["Harbour Hotels"] });
  });

  it("asks for something to show before opening, and hides from blocked viewers", async () => {
    await expect(saveBrandProfile(db(other), other.creatorId, { openToBrands: true })).rejects.toThrow(/niche or deliverable/);
    expectOk(await admin.from("creator_blocks").insert({ blocker_creator_id: maya.creatorId, blocked_creator_id: other.creatorId }).select("blocker_creator_id"));
    expect(await brandSummaryOf(db(other), maya.creatorId)).toBeNull();
  });
});
