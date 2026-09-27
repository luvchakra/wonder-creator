import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { answerInvite, askAboutInvite, createProject, getCrew, inviteThreadsWaiting, inviteToCrew, leaveCrew, myClosedInvitation, myCrewInvites, removeFromCrew, respondToCrew, startCrew } from "@wonder/creator-projects";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createTestCreator, expectDenied, expectOk, type TestCreator } from "./helpers";

const admin = adminClient();
let owner: TestCreator;
let ada: TestCreator; // invitee who asks, then joins
let bo: TestCreator; // invitee whose invitation expires
let cam: TestCreator; // crew member (not a manager)
let dev: TestCreator; // outsider
const db = (x: TestCreator) => x.client as unknown as AppDb;
let crewId: string;

beforeAll(async () => {
  [owner, ada, bo, cam, dev] = await Promise.all(["invOwner", "invAda", "invBo", "invCam", "invDev"].map((l) => createTestCreator(l)));
  const p = await createProject(db(owner), owner.creatorId, { title: "Monsoon Reflections", brief: "A short documentary." });
  crewId = (await startCrew(db(owner), owner.creatorId, p.id, {})).id;
  await inviteToCrew(db(owner), crewId, { creatorId: cam.creatorId });
  await respondToCrew(db(cam), crewId, true);
});
afterAll(cleanupTestCreators);

describe("scoped invitations", () => {
  it("carry scope, role, access, compensation and rights notes, and an expiry the invitee can read", async () => {
    await inviteToCrew(db(owner), crewId, {
      creatorId: ada.creatorId,
      roleTitle: "Editor",
      scope: "Cut a 12-minute film from about 6 hours of footage, in March.",
      compensation: "Flat fee, agreed separately.",
      rights: "Editing credit; the film stays owned by the project owner.",
      expiresInDays: 7,
    });
    const [inv] = await myCrewInvites(db(ada), ada.creatorId);
    expect(inv).toMatchObject({ crewId, roleTitle: "Editor" });
    const days = (new Date(inv.expiresAt!).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);
    const me = (await getCrew(db(ada), ada.creatorId, crewId))!.me!;
    expect(me).toMatchObject({ scope: "Cut a 12-minute film from about 6 hours of footage, in March.", compensationNote: "Flat fee, agreed separately.", rightsNote: "Editing credit; the film stays owned by the project owner.", expired: false });
    await expect(inviteToCrew(db(owner), crewId, { creatorId: dev.creatorId, expiresInDays: 90 })).rejects.toThrow();
  });

  it("questions go to the owner and admins only, and answers come back", async () => {
    await askAboutInvite(db(ada), crewId, { body: "Is remote editing OK?" });
    // The owner sees the question waiting; a regular member and outsiders don't see the thread.
    expect((await inviteThreadsWaiting(db(owner), owner.creatorId)).find((t) => t.crewId === crewId)).toMatchObject({ kind: "question", inviteeId: ada.creatorId });
    expect(expectOk(await cam.client.from("crew_invite_messages").select("id").eq("crew_id", crewId))).toEqual([]);
    expect(expectOk(await dev.client.from("crew_invite_messages").select("id").eq("crew_id", crewId))).toEqual([]);
    expectDenied(await ada.client.from("crew_invite_messages").insert({ crew_id: crewId, invitee_creator_id: ada.creatorId, author_creator_id: ada.creatorId, body: "direct" }));
    await expect(answerInvite(db(cam), crewId, ada.creatorId, { body: "Sure" })).rejects.toThrow(/owner or admins/);
    await expect(askAboutInvite(db(dev), crewId, { body: "Me too?" })).rejects.toThrow(/isn't open/);

    await answerInvite(db(owner), crewId, ada.creatorId, { body: "Yes — we'll share proxies." });
    expect((await inviteThreadsWaiting(db(owner), owner.creatorId)).filter((t) => t.crewId === crewId)).toEqual([]);
    expect((await inviteThreadsWaiting(db(ada), ada.creatorId)).find((t) => t.crewId === crewId)).toMatchObject({ kind: "answer" });
    const thread = (await getCrew(db(ada), ada.creatorId, crewId))!.messages.map((m) => m.body);
    expect(thread).toEqual(["Is remote editing OK?", "Yes — we'll share proxies."]);

    await respondToCrew(db(ada), crewId, true);
    // Once decided, nothing is waiting any more.
    expect((await inviteThreadsWaiting(db(ada), ada.creatorId)).filter((t) => t.crewId === crewId)).toEqual([]);
  });

  it("an expired invitation can't be accepted, hides the crew, and can be sent again", async () => {
    await inviteToCrew(db(owner), crewId, { creatorId: bo.creatorId, roleTitle: "Sound" });
    expectOk(await admin.from("crew_members").update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("crew_id", crewId).eq("creator_id", bo.creatorId).select("creator_id"));

    await expect(respondToCrew(db(bo), crewId, true)).rejects.toThrow(/expired/);
    await expect(askAboutInvite(db(bo), crewId, { body: "Still on?" })).rejects.toThrow(/expired/);
    expect(await myCrewInvites(db(bo), bo.creatorId)).toEqual([]);
    expect(await getCrew(db(bo), bo.creatorId, crewId)).toBeNull();
    expect(await myClosedInvitation(db(bo), crewId)).toMatchObject({ status: "expired", roleTitle: "Sound" });
    // Managers see it as expired.
    expect((await getCrew(db(owner), owner.creatorId, crewId))!.invited.find((m) => m.creatorId === bo.creatorId)).toMatchObject({ expired: true });

    await inviteToCrew(db(owner), crewId, { creatorId: bo.creatorId, roleTitle: "Sound", expiresInDays: 3 });
    await respondToCrew(db(bo), crewId, false, "Booked that month, sorry!");
    expect(await myClosedInvitation(db(bo), crewId)).toMatchObject({ status: "declined" });
    expect((await admin.from("crew_members").select("decline_note").eq("crew_id", crewId).eq("creator_id", bo.creatorId).single()).data).toEqual({ decline_note: "Booked that month, sorry!" });
  });

  it("leaving or being removed keeps role, notes and dates", async () => {
    await leaveCrew(db(ada), crewId);
    await removeFromCrew(db(owner), crewId, cam.creatorId);
    const rows = expectOk(await admin.from("crew_members").select("creator_id, status, role_title, scope, compensation_note, rights_note, joined_at, ended_at").eq("crew_id", crewId).in("creator_id", [ada.creatorId, cam.creatorId]));
    const a = rows.find((r) => r.creator_id === ada.creatorId)!;
    expect(a).toMatchObject({ status: "left", role_title: "Editor", compensation_note: "Flat fee, agreed separately.", rights_note: "Editing credit; the film stays owned by the project owner." });
    expect(a.joined_at && a.ended_at).toBeTruthy();
    expect(rows.find((r) => r.creator_id === cam.creatorId)).toMatchObject({ status: "removed" });
    // The owner still sees who they were.
    expect((await getCrew(db(owner), owner.creatorId, crewId))!.former.map((m) => m.creatorId).sort()).toEqual([ada.creatorId, cam.creatorId].sort());
  });
});
