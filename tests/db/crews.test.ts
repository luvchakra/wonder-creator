import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createProject,
  deleteProject,
  getCrew,
  getProject,
  inviteToCrew,
  leaveCrew,
  linkToProject,
  listProjects,
  myCrewInvites,
  removeFromCrew,
  respondToCrew,
  setCrewRole,
  startCrew,
  updateCrew,
  updateProject,
} from "@wonder/creator-projects";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createMaterial, createTestCreator, expectDenied, expectOk, type TestCreator } from "./helpers";

const admin = adminClient();
let owner: TestCreator;
let ana: TestCreator; // becomes admin
let ben: TestCreator; // member
let cy: TestCreator; // declines
let dee: TestCreator; // outsider
const db = (x: TestCreator) => x.client as unknown as AppDb;

beforeAll(async () => {
  [owner, ana, ben, cy, dee] = await Promise.all(["crewOwner", "crewAna", "crewBen", "crewCy", "crewDee"].map((l) => createTestCreator(l)));
});
afterAll(cleanupTestCreators);

async function projectWithCrew(title: string) {
  const p = await createProject(db(owner), owner.creatorId, { title, brief: "Memory, family, the passing of time." });
  const crew = await startCrew(db(owner), owner.creatorId, p.id, { purpose: "Make the film in Goa." });
  return { p, crew };
}

describe("starting a crew", () => {
  it("only the project's owner can, once per project; the owner is its first member", async () => {
    const p = await createProject(db(owner), owner.creatorId, { title: "One crew" });
    await expect(startCrew(db(ana), ana.creatorId, p.id, {})).rejects.toThrow();
    const crew = await startCrew(db(owner), owner.creatorId, p.id, {});
    expect(crew).toMatchObject({ name: "One crew", status: "forming" });
    await expect(startCrew(db(owner), owner.creatorId, p.id, {})).rejects.toThrow(/already has a crew/);
    const view = (await getCrew(db(owner), owner.creatorId, crew.id))!;
    expect(view.active.map((m) => [m.creatorId, m.access])).toEqual([[owner.creatorId, "owner"]]);
    expect(view.activity.map((a) => a.kind)).toEqual(["crew_created"]);
    // Nobody else sees it.
    expect(await getCrew(db(dee), dee.creatorId, crew.id)).toBeNull();
  });
});

describe("membership lifecycle", () => {
  it("invite → accept / decline; members read the project, outsiders don't; rows are never written directly", async () => {
    const { p, crew } = await projectWithCrew("A Life in Moments");
    await inviteToCrew(db(owner), crew.id, { creatorId: ana.creatorId, access: "admin", roleTitle: "Cinematographer", note: "Would love your eye on this." });
    await inviteToCrew(db(owner), crew.id, { creatorId: ben.creatorId, roleTitle: "Boom operator & tea" });
    await inviteToCrew(db(owner), crew.id, { creatorId: cy.creatorId, roleTitle: "Writer" });
    await expect(inviteToCrew(db(owner), crew.id, { creatorId: ben.creatorId })).rejects.toThrow(/already invited/);
    await expect(inviteToCrew(db(ben), crew.id, { creatorId: dee.creatorId })).rejects.toThrow(/owner or admins/);

    // The invitee sees what it is before deciding (project title and brief), but not the project itself yet.
    const [invite] = await myCrewInvites(db(ana), ana.creatorId);
    expect(invite).toMatchObject({ crewId: crew.id, projectTitle: "A Life in Moments", roleTitle: "Cinematographer", access: "admin", note: "Would love your eye on this." });
    expect(expectOk(await ana.client.from("projects").select("id").eq("id", p.id))).toEqual([]);

    await respondToCrew(db(ana), crew.id, true);
    await respondToCrew(db(ben), crew.id, true);
    await respondToCrew(db(cy), crew.id, false);
    await expect(respondToCrew(db(cy), crew.id, true)).rejects.toThrow(/isn't open anymore/);

    const view = (await getCrew(db(ana), ana.creatorId, crew.id))!;
    expect(view.crew.status).toBe("active"); // the first to join makes a forming crew active
    expect(view.active.map((m) => m.roleTitle)).toEqual([null, "Cinematographer", "Boom operator & tea"]);
    // Members can read the project; nobody but the owner can change it.
    expect(expectOk(await ben.client.from("projects").select("title").eq("id", p.id))).toEqual([{ title: "A Life in Moments" }]);
    expect((await listProjects(db(ben))).map((x) => x.id)).toContain(p.id);
    expect(expectOk(await ben.client.from("projects").update({ title: "Mine now" }).eq("id", p.id).select("id"))).toEqual([]);
    await expect(updateProject(db(ben), p.id, { title: "Mine now" })).rejects.toThrow(/couldn't find/);
    expect(await getCrew(db(dee), dee.creatorId, crew.id)).toBeNull();
    expect(expectOk(await cy.client.from("projects").select("id").eq("id", p.id))).toEqual([]);

    // Direct writes are refused.
    expectDenied(await ben.client.from("crew_members").update({ access: "admin" }).eq("crew_id", crew.id).eq("creator_id", ben.creatorId));
    expectDenied(await dee.client.from("crew_members").insert({ crew_id: crew.id, creator_id: dee.creatorId, status: "active" }));
    expectDenied(await ben.client.from("crew_activity").insert({ crew_id: crew.id, kind: "joined" }));
  });

  it("roles are flexible; only the owner changes access; admins manage members but not other admins", async () => {
    const { crew } = await projectWithCrew("Songs for Tomorrow");
    await inviteToCrew(db(owner), crew.id, { creatorId: ana.creatorId, access: "admin" });
    await inviteToCrew(db(owner), crew.id, { creatorId: ben.creatorId });
    await respondToCrew(db(ana), crew.id, true);
    await respondToCrew(db(ben), crew.id, true);

    await setCrewRole(db(ben), crew.id, { creatorId: ben.creatorId, roleTitle: "Whoever holds the boom" });
    await expect(setCrewRole(db(ben), crew.id, { creatorId: ana.creatorId, roleTitle: "Intern" })).rejects.toThrow(/someone else's role/);
    await setCrewRole(db(ana), crew.id, { creatorId: ben.creatorId, roleTitle: "Sound" });
    await expect(setCrewRole(db(ana), crew.id, { creatorId: ben.creatorId, access: "admin" })).rejects.toThrow(/Only the crew's owner/);
    await expect(inviteToCrew(db(ana), crew.id, { creatorId: dee.creatorId, access: "admin" })).rejects.toThrow(/invite admins/);
    await setCrewRole(db(owner), crew.id, { creatorId: ben.creatorId, access: "admin" });
    await expect(setCrewRole(db(owner), crew.id, { creatorId: owner.creatorId, access: "member" })).rejects.toThrow(/Only the crew's owner/);

    // Admins can't remove admins or the owner.
    await expect(removeFromCrew(db(ana), crew.id, ben.creatorId)).rejects.toThrow(/can't remove this person/);
    await expect(removeFromCrew(db(ana), crew.id, owner.creatorId)).rejects.toThrow(/yourself or the owner/);
    const view = (await getCrew(db(owner), owner.creatorId, crew.id))!;
    expect(view.active.find((m) => m.creatorId === ben.creatorId)).toMatchObject({ access: "admin", roleTitle: "Sound" });
  });

  it("leaving and removal keep the record; former members lose access to the project", async () => {
    const { p, crew } = await projectWithCrew("Goa Photo Series");
    const material = await createMaterial(owner, "Owner's private sketch");
    await linkToProject(db(owner), owner.creatorId, p.id, { kind: "material", ids: [material] });
    for (const x of [ana, ben]) await inviteToCrew(db(owner), crew.id, { creatorId: x.creatorId });
    for (const x of [ana, ben]) await respondToCrew(db(x), crew.id, true);
    await inviteToCrew(db(owner), crew.id, { creatorId: dee.creatorId });

    // Membership never widens access to linked work: the link is visible, the material is not.
    const seen = await getProject(db(ben), p.id);
    expect(seen.items).toHaveLength(1);
    expect(seen.items[0]).toMatchObject({ kind: "material", available: false, href: null });
    expect(expectOk(await ben.client.from("creative_materials").select("id").eq("id", material))).toEqual([]);

    await expect(leaveCrew(db(owner), crew.id)).rejects.toThrow(/owner, you can't leave/);
    await leaveCrew(db(ana), crew.id);
    await removeFromCrew(db(owner), crew.id, ben.creatorId);
    await removeFromCrew(db(owner), crew.id, dee.creatorId); // cancels the invitation
    expect(await myCrewInvites(db(dee), dee.creatorId)).toEqual([]);

    expect(expectOk(await ben.client.from("projects").select("id").eq("id", p.id))).toEqual([]);
    expect(await getCrew(db(ana), ana.creatorId, crew.id)).toBeNull();
    const rows = expectOk(await admin.from("crew_members").select("creator_id, status, ended_at").eq("crew_id", crew.id));
    expect(Object.fromEntries(rows.map((r) => [r.creator_id, r.status]))).toEqual({ [owner.creatorId]: "active", [ana.creatorId]: "left", [ben.creatorId]: "removed", [dee.creatorId]: "cancelled" });
    expect(rows.filter((r) => r.status !== "active").every((r) => r.ended_at)).toBe(true);

    const view = (await getCrew(db(owner), owner.creatorId, crew.id))!;
    expect(view.former.map((m) => m.creatorId).sort()).toEqual([ana.creatorId, ben.creatorId].sort());
    expect(view.activity.map((a) => a.kind)).toEqual(expect.arrayContaining(["left", "removed", "invite_cancelled", "joined", "invited"]));
    const audit = expectOk(await admin.from("audit_logs").select("action").eq("object_id", crew.id));
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(["crew.crew_created", "crew.invited", "crew.joined", "crew.left", "crew.removed"]));

    // Someone who left can be invited back.
    await inviteToCrew(db(owner), crew.id, { creatorId: ana.creatorId });
    expect((await myCrewInvites(db(ana), ana.creatorId)).map((i) => i.crewId)).toContain(crew.id);
  });

  it("blocks apply, and a project with a crew can't be deleted from under it", async () => {
    const { p, crew } = await projectWithCrew("Blocked");
    expectOk(await dee.client.from("creator_blocks").insert({ blocker_creator_id: dee.creatorId, blocked_creator_id: owner.creatorId }).select("blocker_creator_id"));
    await expect(inviteToCrew(db(owner), crew.id, { creatorId: dee.creatorId })).rejects.toThrow(/couldn't find that creator/);
    await inviteToCrew(db(owner), crew.id, { creatorId: ben.creatorId });
    await expect(deleteProject(db(owner), p.id)).rejects.toThrow();
    await removeFromCrew(db(owner), crew.id, ben.creatorId);
    await deleteProject(db(owner), p.id);
  });

  it("crew details change only by the owner or admins; a completed crew takes no new invites", async () => {
    const { crew } = await projectWithCrew("Finishing");
    await inviteToCrew(db(owner), crew.id, { creatorId: ben.creatorId });
    await respondToCrew(db(ben), crew.id, true);
    await expect(updateCrew(db(ben), crew.id, { name: "Ben's crew" })).rejects.toThrow(/owner or admins/);
    await updateCrew(db(owner), crew.id, { status: "completed", purpose: "Wrapped." });
    await expect(inviteToCrew(db(owner), crew.id, { creatorId: ana.creatorId })).rejects.toThrow(/completed its work/);
    expect((await getCrew(db(ben), ben.creatorId, crew.id))!.activity[0]).toMatchObject({ kind: "crew_updated", detail: { status: "completed", purpose: true } });
  });
});
