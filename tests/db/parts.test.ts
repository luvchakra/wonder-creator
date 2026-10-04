import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addPart,
  addTemplateParts,
  attachPartArtifact,
  claimPart,
  createProject,
  deletePart,
  inviteToCrew,
  inviteToPart,
  leavePart,
  listParts,
  myPartInvites,
  partsTimeline,
  respondToCrew,
  respondToPart,
  setPartFinal,
  startCrew,
  updatePart,
} from "@wonder/creator-projects";
import type { Db as AppDb } from "@wonder/db";
import { cleanupTestCreators, createArtifact, createTestCreator, expectDenied, expectOk, type TestCreator } from "./helpers";

// Parts (docs/creative-room-parts.md): peers, with one or more people each; someone invited to a part alone sees the
// Room's name and its parts, not its items, tasks or chat. Membership moves only through the functions.
let owner: TestCreator;
let ana: TestCreator; // crew member
let dee: TestCreator; // invited to one part only
let cy: TestCreator; // outsider
const db = (x: TestCreator) => x.client as unknown as AppDb;

beforeAll(async () => {
  [owner, ana, dee, cy] = await Promise.all(["partOwner", "partAna", "partDee", "partCy"].map((l) => createTestCreator(l)));
});
afterAll(cleanupTestCreators);

async function songRoom() {
  const p = await createProject(db(owner), owner.creatorId, { title: "Platform 3", brief: "A song about waiting.", status: "active" });
  await addTemplateParts(db(owner), owner.creatorId, p.id, "song");
  const crew = await startCrew(db(owner), owner.creatorId, p.id, { purpose: "Make the song." });
  await inviteToCrew(db(owner), crew.id, { creatorId: ana.creatorId, access: "member" });
  await respondToCrew(db(ana), crew.id, true);
  const parts = await listParts(db(owner), p.id, owner.creatorId);
  return { p, crew, lyrics: parts[0]!, tune: parts[1]!, voice: parts[2]! };
}

describe("parts: who sees and does what", () => {
  it("a template lays out the parts in order; only the owner or admins add, rename or remove them", async () => {
    const { p, lyrics } = await songRoom();
    expect((await listParts(db(ana), p.id, ana.creatorId)).map((x) => [x.title, x.kind, x.status])).toEqual([
      ["Lyrics", "writing", "open"],
      ["Tune", "audio", "open"],
      ["Voice", "audio", "open"],
    ]);
    await expect(addPart(db(ana), ana.creatorId, p.id, { title: "Cover art", kind: "image" })).rejects.toThrow();
    await expect(updatePart(db(ana), lyrics.id, { title: "Words" })).rejects.toThrow(/owner or admins/);
    await expect(deletePart(db(ana), lyrics.id)).rejects.toThrow(/owner or admins/);
    const art = await addPart(db(owner), owner.creatorId, p.id, { title: "Cover art", kind: "image" });
    await updatePart(db(owner), art, { title: "Cover" });
    expect((await listParts(db(owner), p.id, owner.creatorId)).map((x) => x.title)).toEqual(["Lyrics", "Tune", "Voice", "Cover"]);
    await deletePart(db(owner), art);
    // An outsider sees nothing of the Room or its parts.
    expect(expectOk(await cy.client.from("projects").select("id").eq("id", p.id))).toEqual([]);
    expect(await listParts(db(cy), p.id, cy.creatorId)).toEqual([]);
  });

  it("crew members claim parts (two may share one); outsiders can't claim, and no one writes membership rows directly", async () => {
    const { p, lyrics } = await songRoom();
    await claimPart(db(ana), lyrics.id);
    await claimPart(db(owner), lyrics.id);
    const [l] = await listParts(db(owner), p.id, owner.creatorId);
    expect(l!.status).toBe("in_rounds");
    expect(l!.people.map((x) => x.id).sort()).toEqual([ana.creatorId, owner.creatorId].sort());
    await expect(claimPart(db(ana), lyrics.id)).rejects.toThrow(/already/);
    await expect(claimPart(db(cy), lyrics.id)).rejects.toThrow();
    expectDenied(await cy.client.from("project_part_members").insert({ part_id: lyrics.id, creator_id: cy.creatorId, status: "active" }));
    expectDenied(await ana.client.from("project_part_members").insert({ part_id: lyrics.id, creator_id: cy.creatorId, status: "active" }));
    // Leaving the only person's part opens it again.
    await leavePart(db(ana), lyrics.id);
    await leavePart(db(owner), lyrics.id);
    expect((await listParts(db(owner), p.id, owner.creatorId))[0]!.status).toBe("open");
  });

  it("someone invited to one part sees the Room and its parts, not its items or tasks; the invite is theirs to answer", async () => {
    const { p, voice, lyrics } = await songRoom();
    await claimPart(db(ana), lyrics.id);
    // Ana (on Lyrics) can invite to Voice? No: only people on that part, or the owner/admins.
    await expect(inviteToPart(db(ana), voice.id, { creatorId: dee.creatorId })).rejects.toThrow(/people on this part/);
    await inviteToPart(db(owner), voice.id, { creatorId: dee.creatorId, note: "Would you sing it?" });
    expect((await myPartInvites(db(dee), dee.creatorId)).map((i) => [i.partTitle, i.projectTitle, i.note])).toEqual([["Voice", "Platform 3", "Would you sing it?"]]);
    // Dee sees the Room row and the parts, and nothing else of it.
    expect(expectOk(await dee.client.from("projects").select("id").eq("id", p.id))).toHaveLength(1);
    expect((await listParts(db(dee), p.id, dee.creatorId)).map((x) => x.title)).toEqual(["Lyrics", "Tune", "Voice"]);
    expect(expectOk(await dee.client.from("project_items").select("id").eq("project_id", p.id))).toEqual([]);
    expect(expectOk(await dee.client.from("project_tasks").select("id").eq("project_id", p.id))).toEqual([]);
    expect(expectOk(await dee.client.from("crew_members").select("creator_id"))).toEqual([]);
    // Only Dee answers; accepting puts her on the part, outside the crew.
    await expect(respondToPart(db(cy), voice.id, true)).rejects.toThrow();
    await respondToPart(db(dee), voice.id, true);
    const v = (await listParts(db(owner), p.id, owner.creatorId))[2]!;
    expect(v.status).toBe("in_rounds");
    expect(v.people).toMatchObject([{ id: dee.creatorId, status: "active", outside: true }]);
    expect((await listParts(db(dee), p.id, dee.creatorId))[2]!.mine).toBe(true);
  });

  it("a part's Creation is the member's own; everyone else on the part edits it, and everyone making the work reads it", async () => {
    const { p, tune, voice } = await songRoom();
    await claimPart(db(ana), tune.id);
    await claimPart(db(owner), tune.id);
    await inviteToPart(db(owner), voice.id, { creatorId: dee.creatorId });
    await respondToPart(db(dee), voice.id, true);
    const anasTune = await createArtifact(ana, { title: "Platform 3 · Tune", artifact_type: "song_concept", category: "audio" });
    // Not on the part, or not your own Creation: refused.
    await expect(attachPartArtifact(db(dee), tune.id, anasTune)).rejects.toThrow(/people on this part/);
    const owners = await createArtifact(owner, { title: "Not mine to give", artifact_type: "song_concept", category: "audio" });
    await expect(attachPartArtifact(db(ana), tune.id, owners)).rejects.toThrow(/their own/);
    await attachPartArtifact(db(ana), tune.id, anasTune);
    await expect(attachPartArtifact(db(owner), tune.id, owners)).rejects.toThrow(/already has/);
    // The owner, also on Tune, can now edit Ana's Creation; Dee (on Voice only) can read it; an outsider cannot.
    expect(expectOk(await owner.client.from("artifact_contributors").select("access").eq("artifact_id", anasTune).eq("contributor_creator_id", owner.creatorId))).toEqual([{ access: "edit" }]);
    expect(expectOk(await dee.client.from("artifacts").select("id").eq("id", anasTune))).toHaveLength(1);
    expect(expectOk(await cy.client.from("artifacts").select("id").eq("id", anasTune))).toEqual([]);
    const t = (await listParts(db(dee), p.id, dee.creatorId))[1]!;
    expect(t.artifact).toMatchObject({ id: anasTune, title: "Platform 3 · Tune", versionNumber: 1 });
    // The crew sees it as work shared with the Room.
    expect(expectOk(await owner.client.from("project_items").select("artifact_id, shared").eq("project_id", p.id).eq("kind", "artifact"))).toEqual([{ artifact_id: anasTune, shared: true }]);
    // Leaving takes the edit access back.
    await leavePart(db(owner), tune.id);
    expect(expectOk(await owner.client.from("artifact_contributors").select("access").eq("artifact_id", anasTune).eq("contributor_creator_id", owner.creatorId))).toEqual([]);
  });

  it("final is said by the people on the part (or the owner), needs a Creation, and can be taken back; the timeline tells it", async () => {
    const { p, lyrics } = await songRoom();
    await claimPart(db(ana), lyrics.id);
    await expect(setPartFinal(db(ana), lyrics.id, true)).rejects.toThrow(/Creation first/);
    const words = await createArtifact(ana, { title: "Platform 3 · Lyrics", artifact_type: "lyrics", category: "writing" });
    await attachPartArtifact(db(ana), lyrics.id, words);
    await expect(setPartFinal(db(cy), lyrics.id, true)).rejects.toThrow();
    await setPartFinal(db(ana), lyrics.id, true);
    expect((await listParts(db(owner), p.id, owner.creatorId))[0]).toMatchObject({ status: "final" });
    await expect(claimPart(db(owner), lyrics.id)).rejects.toThrow(/final/);
    await setPartFinal(db(owner), lyrics.id, false);
    expect((await listParts(db(owner), p.id, owner.creatorId))[0]).toMatchObject({ status: "in_rounds", finalAt: null });
    const kinds = (await partsTimeline(db(ana), p.id, await listParts(db(ana), p.id, ana.creatorId))).map((e) => e.kind);
    expect(kinds.slice(0, 4)).toEqual(["reopened", "final", "started", "claimed"]);
    expect(kinds).toContain("added");
    // Events are the Room's: an outsider reads none.
    expect(expectOk(await cy.client.from("project_part_events").select("id").eq("project_id", p.id))).toEqual([]);
  });
});
