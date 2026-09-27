import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { collaborationProfileOf, getCollaborationProfile, saveCollaborationProfile } from "@wonder/creator-identity";
import { canMessage, createProject, inviteToCrew, respondToCrew, startCrew } from "@wonder/creator-projects";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createTestCreator, expectOk, type TestCreator } from "./helpers";

const admin = adminClient();
let ada: TestCreator; // the profile's owner
let crewmate: TestCreator; // shared a crew with Ada
let stranger: TestCreator; // no relationship
const db = (x: TestCreator) => x.client as unknown as AppDb;

beforeAll(async () => {
  [ada, crewmate, stranger] = await Promise.all(["cpAda", "cpCrew", "cpStranger"].map((l) => createTestCreator(l)));
  expectOk(await admin.from("creators").update({ collaboration_availability: "open", onboarding_step: "complete" }).eq("id", ada.creatorId).select("id"));
  const project = (await createProject(db(ada), ada.creatorId, { title: "Harbour Film" })).id;
  const crew = (await startCrew(db(ada), ada.creatorId, project, {})).id;
  await inviteToCrew(db(ada), crew, { creatorId: crewmate.creatorId });
  await respondToCrew(db(crewmate), crew, true);
});
afterAll(cleanupTestCreators);

describe("collaboration profile", () => {
  it("is owner-only as a table; others see it only through collaboration_profile_of", async () => {
    const saved = await saveCollaborationProfile(db(ada), ada.creatorId, {
      projectTypes: ["Short film", "short film", "Podcast"],
      interests: ["Coastal stories"],
      workMode: "remote",
      region: "Konkan coast",
      turnaround: "About two weeks",
      commercialBoundaries: "No alcohol or gambling brands.",
      rateGuidance: "From ₹40,000 per short",
      rightsPreferences: "I keep authorship credit.",
      exclusivity: "non_exclusive_only",
    });
    expect(saved).toMatchObject({ projectTypes: ["short film", "Podcast"], rateVisibility: "private", contactPreference: "anyone" });
    expect(await getCollaborationProfile(db(ada), ada.creatorId)).toMatchObject({ region: "Konkan coast" });

    // Nobody else can read or write the row directly.
    expect(expectOk(await db(stranger).from("collaboration_profiles").select("*").eq("creator_id", ada.creatorId))).toEqual([]);
    const forged = await db(stranger).from("collaboration_profiles").upsert({ creator_id: ada.creatorId, rate_guidance: "free", rate_visibility: "public" });
    expect(forged.error).not.toBeNull();

    // The public view: everything but the rate, which is private by default.
    const seen = await collaborationProfileOf(db(stranger), ada.creatorId);
    expect(seen).toMatchObject({ availability: "open", workMode: "remote", turnaround: "About two weeks", exclusivity: "non_exclusive_only", rateGuidance: null, hasProfile: true });
    expect((await collaborationProfileOf(db(ada), ada.creatorId))?.rateGuidance).toBe("From ₹40,000 per short");
  });

  it("shows rate guidance only to the audience its owner chose", async () => {
    const base = await getCollaborationProfile(db(ada), ada.creatorId);
    await saveCollaborationProfile(db(ada), ada.creatorId, { ...base, rateVisibility: "collaborators" });
    expect((await collaborationProfileOf(db(crewmate), ada.creatorId))?.rateGuidance).toBe("From ₹40,000 per short");
    expect((await collaborationProfileOf(db(stranger), ada.creatorId))?.rateGuidance).toBeNull();

    await saveCollaborationProfile(db(ada), ada.creatorId, { ...base, rateVisibility: "public" });
    expect((await collaborationProfileOf(db(stranger), ada.creatorId))?.rateGuidance).toBe("From ₹40,000 per short");

    // No rate, nothing to show: visibility falls back to private.
    expect(await saveCollaborationProfile(db(ada), ada.creatorId, { ...base, rateGuidance: "", rateVisibility: "public" })).toMatchObject({ rateGuidance: null, rateVisibility: "private" });
  });

  it("'only people I've worked with' closes the open-availability route to a direct thread", async () => {
    const base = await getCollaborationProfile(db(ada), ada.creatorId);
    expect(await canMessage(db(stranger), ada.creatorId)).toBe(true);
    await saveCollaborationProfile(db(ada), ada.creatorId, { ...base, contactPreference: "network" });
    expect(await canMessage(db(stranger), ada.creatorId)).toBe(false);
    expect(await canMessage(db(crewmate), ada.creatorId)).toBe(true);
    await saveCollaborationProfile(db(ada), ada.creatorId, { ...base, contactPreference: "anyone" });
    expect(await canMessage(db(stranger), ada.creatorId)).toBe(true);
  });

  it("is hidden from someone the owner blocked", async () => {
    expectOk(await admin.from("creator_blocks").insert({ blocker_creator_id: ada.creatorId, blocked_creator_id: stranger.creatorId }).select("blocker_creator_id"));
    expect(await collaborationProfileOf(db(stranger), ada.creatorId)).toBeNull();
  });
});
