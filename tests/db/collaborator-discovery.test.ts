import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addToShortlist, findCollaborators, listShortlist, removeFromShortlist } from "@wonder/creator-identity";
import { createProject, inviteToCrew, respondToCrew, startCrew } from "@wonder/creator-projects";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createTestCreator, expectOk, type TestCreator } from "./helpers";

const admin = adminClient();
const tag = randomUUID().slice(0, 8); // a discipline unique to this run
let me: TestCreator;
let known: TestCreator; // crewmate, open, shows location
let stranger: TestCreator; // same discipline, no relationship
let hidden: TestCreator; // private profile
let blocked: TestCreator; // blocked me
let closed: TestCreator; // not taking collaborations
let unfinished: TestCreator; // hasn't finished onboarding
const db = (x: TestCreator) => x.client as unknown as AppDb;

async function profile(c: TestCreator, opts: { name: string; discipline?: string; skills?: string[]; interests?: string[]; location?: string; availability?: string; visibility?: string; done?: boolean }) {
  expectOk(
    await admin
      .from("creators")
      .update({
        display_name: opts.name,
        onboarding_step: opts.done === false ? "about" : "complete",
        location: opts.location ?? null,
        show_location: !!opts.location,
        collaboration_availability: opts.availability ?? "open",
        visibility: (opts.visibility ?? "creators_only") as "creators_only",
      })
      .eq("id", c.creatorId)
      .select("id"),
  );
  if (opts.discipline) expectOk(await admin.from("creator_disciplines").insert({ creator_id: c.creatorId, value: opts.discipline }).select("creator_id"));
  for (const s of opts.skills ?? []) expectOk(await admin.from("creator_skills").insert({ creator_id: c.creatorId, value: s }).select("creator_id"));
  for (const i of opts.interests ?? []) expectOk(await admin.from("creator_interests").insert({ creator_id: c.creatorId, value: i }).select("creator_id"));
}

beforeAll(async () => {
  [me, known, stranger, hidden, blocked, closed, unfinished] = await Promise.all(["dMe", "dKnown", "dStranger", "dHidden", "dBlocked", "dClosed", "dUnfinished"].map((l) => createTestCreator(l)));
  const discipline = `Cinematography ${tag}`;
  await profile(me, { name: "Me" });
  await profile(known, { name: "Asha Known", discipline, skills: ["Colour grading"], interests: ["Monsoon light"], location: "Goa, India" });
  await profile(stranger, { name: "Bea Stranger", discipline, location: "Lisbon", availability: "selective" });
  await profile(hidden, { name: "Hidden", discipline, visibility: "private" });
  await profile(blocked, { name: "Blocker", discipline });
  await profile(closed, { name: "Closed", discipline, availability: "closed" });
  await profile(unfinished, { name: "Unfinished", discipline, done: false });
  expectOk(await admin.from("creators").update({ show_location: false }).eq("id", stranger.creatorId).select("id")); // Lisbon, but hidden
  expectOk(await blocked.client.from("creator_blocks").insert({ blocker_creator_id: blocked.creatorId, blocked_creator_id: me.creatorId }).select("blocker_creator_id"));
  // Me and Asha are in a crew together.
  const p = await createProject(db(me), me.creatorId, { title: "Monsoon Reflections" });
  const crew = await startCrew(db(me), me.creatorId, p.id, {});
  await inviteToCrew(db(me), crew.id, { creatorId: known.creatorId });
  await respondToCrew(db(known), crew.id, true);
  expectOk(await me.client.from("creator_follows").insert({ follower_creator_id: me.creatorId, followed_creator_id: stranger.creatorId }).select("follower_creator_id"));
});
afterAll(cleanupTestCreators);

describe("finding collaborators", () => {
  it("matches by discipline, respects visibility, blocks, availability and onboarding, and explains itself", async () => {
    const people = await findCollaborators(db(me), { terms: [tag] });
    expect(people.map((p) => p.name)).toEqual(["Asha Known", "Bea Stranger"]); // same fit: people you know first, then by name
    const asha = people[0]!;
    expect(asha).toMatchObject({ location: "Goa, India", known: true, signals: { sharedCrews: 1 } });
    expect(asha.reasons).toEqual(expect.arrayContaining([`Lists Cinematography ${tag} as a discipline`, "You've been in 1 crew together", "Open to collaborate"]));
    expect(people[1]!.reasons).toEqual(expect.arrayContaining(["You follow them", "Selective about collaborations"]));
    // Nothing that looks like a score or popularity is returned.
    expect(JSON.stringify(people)).not.toMatch(/score|rank|follower_count|likes/i);
    expect((await findCollaborators(db(me), { terms: [tag], availability: ["closed"] })).map((p) => p.name)).toEqual(["Closed"]);
  });

  it("filters by network, location and interest, and can exclude a project's crew", async () => {
    expect((await findCollaborators(db(me), { terms: [tag], networkOnly: true })).map((p) => p.name)).toEqual(["Asha Known", "Bea Stranger"]); // crewmate + someone I follow
    expect((await findCollaborators(db(me), { terms: [tag], location: "goa" })).map((p) => p.name)).toEqual(["Asha Known"]);
    expect((await findCollaborators(db(me), { terms: [tag], interest: "monsoon" }))[0]!.reasons).toContain("Interested in Monsoon light");
    // Someone who hides their location never matches a location filter.
    expect(await findCollaborators(db(me), { terms: [tag], location: "lisbon" })).toEqual([]);
    const { data: proj } = await me.client.from("projects").select("id").eq("creator_id", me.creatorId).single();
    const forProject = await findCollaborators(db(me), { terms: [tag], projectId: proj!.id });
    expect(forProject.find((p) => p.name === "Asha Known")!.signals.inProject).toBe("active");
    // Another creator can't search in the context of my project.
    expect(await findCollaborators(db(stranger), { terms: [tag], projectId: proj!.id })).toEqual([]);
  });
});

describe("the shortlist", () => {
  it("is private to its owner and can't include people you can't see", async () => {
    const id = await addToShortlist(db(me), me.creatorId, { candidateId: stranger.creatorId, note: "Loved her reel" });
    await addToShortlist(db(me), me.creatorId, { candidateId: stranger.creatorId, note: "Updated" }); // same entry
    expect(await listShortlist(db(me), me.creatorId)).toEqual([expect.objectContaining({ id, note: "Updated", candidate: expect.objectContaining({ id: stranger.creatorId }) })]);
    expect(expectOk(await stranger.client.from("collaborator_shortlist").select("id"))).toEqual([]);
    await expect(addToShortlist(db(me), me.creatorId, { candidateId: hidden.creatorId })).rejects.toThrow(/couldn't find/);
    await expect(addToShortlist(db(me), me.creatorId, { candidateId: blocked.creatorId })).rejects.toThrow(/couldn't find/);
    const forged = await stranger.client.from("collaborator_shortlist").insert({ creator_id: me.creatorId, candidate_creator_id: stranger.creatorId });
    expect(forged.error).toBeTruthy();
    await expect(removeFromShortlist(db(stranger), id)).rejects.toThrow(/not on your shortlist/);
    await removeFromShortlist(db(me), id);
    expect(await listShortlist(db(me), me.creatorId)).toEqual([]);
  });
});
