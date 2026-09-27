import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  acceptProposal,
  addArtifactComment,
  addCollaborator,
  collaboratorSave,
  createArtifact,
  declineProposal,
  getCollaboration,
  proposeChange,
  removeCollaborator,
  resolveArtifactComment,
  saveCreatorVersion,
  updateCollaborator,
  withdrawProposal,
} from "@wonder/creator-studio";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createTestCreator, expectDenied, expectOk, type TestCreator } from "./helpers";

const admin = adminClient();
let owner: TestCreator;
let pia: TestCreator; // proposes
let ed: TestCreator; // edits
let cam: TestCreator; // comments only
let out: TestCreator; // outsider
let piece: string;
const db = (x: TestCreator) => x.client as unknown as AppDb;
const current = async () => expectOk(await admin.from("artifacts").select("current_version_id").eq("id", piece).single()).current_version_id!;

beforeAll(async () => {
  [owner, pia, ed, cam, out] = await Promise.all(["colOwner", "colPia", "colEd", "colCam", "colOut"].map((l) => createTestCreator(l)));
  piece = (await createArtifact(db(owner), owner.creatorId, { artifactType: "poem", title: "Monsoon", content: "Rain on the tin roof.", authorKind: "creator", provenance: { origin: "typed" } })).id;
  await addCollaborator(db(owner), owner.creatorId, piece, { creatorId: pia.creatorId, role: "Co-writer", access: "propose" });
  await addCollaborator(db(owner), owner.creatorId, piece, { creatorId: ed.creatorId, role: "Editor", access: "edit" });
  await addCollaborator(db(owner), owner.creatorId, piece, { creatorId: cam.creatorId, role: "Reader", access: "comment" });
});
afterAll(cleanupTestCreators);

describe("collaborators", () => {
  it("only the owner adds and changes collaborators; outsiders see nothing", async () => {
    await expect(addCollaborator(db(pia), pia.creatorId, piece, { creatorId: out.creatorId, role: "Friend" })).rejects.toThrow(/Only the Creation's owner/);
    await expect(updateCollaborator(db(pia), pia.creatorId, piece, { creatorId: pia.creatorId, access: "edit" })).rejects.toThrow(/Only the Creation's owner/);
    expect(await getCollaboration(db(out), out.creatorId, piece)).toBeNull();
    const view = (await getCollaboration(db(cam), cam.creatorId, piece))!;
    expect(view.access).toBe("comment");
    expect(view.collaborators.map((c) => [c.name.length > 0, c.access])).toEqual([[true, "propose"], [true, "edit"], [true, "comment"]]);
    // Blocked creators can't be added.
    expectOk(await out.client.from("creator_blocks").insert({ blocker_creator_id: out.creatorId, blocked_creator_id: owner.creatorId }).select("blocker_creator_id"));
    await expect(addCollaborator(db(owner), owner.creatorId, piece, { creatorId: out.creatorId, role: "x" })).rejects.toThrow(/couldn't find that creator/);
  });
});

describe("proposals", () => {
  it("are accepted by the owner and credited to the proposer; comment-only collaborators can't propose", async () => {
    const base = await current();
    await expect(proposeChange(db(cam), cam.creatorId, piece, { baseVersionId: base, content: "x", summary: "x" })).rejects.toThrow();
    const id = await proposeChange(db(pia), pia.creatorId, piece, { baseVersionId: base, content: "Rain on the tin roof,\nand the kettle answers.", summary: "Added a second line" });
    await expect(acceptProposal(db(pia), id)).rejects.toThrow(/couldn't find that proposal/);
    const v = await acceptProposal(db(owner), id);
    expect(v.version_number).toBe(2);
    const view = (await getCollaboration(db(owner), owner.creatorId, piece))!;
    expect(view.versions[0]).toMatchObject({ number: 2, authorKind: "creator", authorId: pia.creatorId, summary: expect.stringContaining("Proposed by") });
    expect(view.proposals[0]).toMatchObject({ status: "accepted", resultingVersion: 2 });
    await expect(acceptProposal(db(owner), id)).rejects.toThrow(/already been decided/);
  });

  it("a stale proposal needs explicit confirmation; declines carry a note; proposers can withdraw", async () => {
    const base = await current();
    const stale = await proposeChange(db(pia), pia.creatorId, piece, { baseVersionId: base, content: "Different take.", summary: "Rewrite" });
    await saveCreatorVersion(db(owner), piece, { content: "Owner's newer text.", baseVersionId: base });
    await expect(proposeChange(db(pia), pia.creatorId, piece, { baseVersionId: base, content: "late", summary: "late" })).rejects.toThrow(/changed while you were editing/);
    await expect(acceptProposal(db(owner), stale)).rejects.toThrow(/changed since this was proposed/);
    expect((await getCollaboration(db(owner), owner.creatorId, piece))!.proposals.find((p) => p.id === stale)).toMatchObject({ status: "open", stale: true });

    const next = await proposeChange(db(pia), pia.creatorId, piece, { baseVersionId: await current(), content: "Another idea.", summary: "Idea" });
    await declineProposal(db(owner), next, "Not this time.");
    expect((await getCollaboration(db(pia), pia.creatorId, piece))!.proposals.find((p) => p.id === next)).toMatchObject({ status: "declined", decisionNote: "Not this time." });

    await withdrawProposal(db(pia), stale);
    await expect(withdrawProposal(db(ed), stale)).rejects.toThrow();
    // Direct writes to proposals are refused.
    expectDenied(await pia.client.from("artifact_change_proposals").update({ status: "accepted" }).eq("id", stale));
    // Accepting a stale proposal with confirmation works, and is still credited.
    const s2 = await proposeChange(db(pia), pia.creatorId, piece, { baseVersionId: await current(), content: "Confirmed later.", summary: "Late edit" });
    await saveCreatorVersion(db(owner), piece, { content: "Owner again.", baseVersionId: await current() });
    const v = await acceptProposal(db(owner), s2, true);
    expect((await getCollaboration(db(owner), owner.creatorId, piece))!.versions.find((x) => x.number === v.version_number)).toMatchObject({ authorId: pia.creatorId });
  });
});

describe("direct edits", () => {
  it("edit access saves versions credited to the editor; stale saves are refused; others can't", async () => {
    const base = await current();
    const v = await collaboratorSave(db(ed), piece, { baseVersionId: base, content: "Ed's tightened version.", summary: "Tightened" });
    expect((await getCollaboration(db(owner), owner.creatorId, piece))!.versions[0]).toMatchObject({ number: v.version_number, authorId: ed.creatorId });
    await expect(collaboratorSave(db(ed), piece, { baseVersionId: base, content: "stale", summary: "" })).rejects.toThrow(/newer version/);
    await expect(collaboratorSave(db(pia), piece, { baseVersionId: await current(), content: "nope", summary: "" })).rejects.toThrow(/don't have that access/);
    await expect(collaboratorSave(db(ed), piece, { baseVersionId: await current(), content: "Ed's tightened version.", summary: "" })).rejects.toThrow(/no changes/);
    // The owner's Studio save path still refuses collaborators.
    await expect(saveCreatorVersion(db(ed), piece, { content: "via owner path", baseVersionId: await current() })).rejects.toThrow();
  });
});

describe("comments", () => {
  it("are for the owner and collaborators; the owner or author resolves", async () => {
    const id = await addArtifactComment(db(cam), cam.creatorId, piece, { body: "Love the kettle.", versionId: await current(), quote: "kettle" });
    await expect(addArtifactComment(db(out), out.creatorId, piece, { body: "hi" })).rejects.toThrow(/Only the owner and collaborators/);
    await expect(resolveArtifactComment(db(pia), pia.creatorId, id, true)).rejects.toThrow(/owner or the comment's author/);
    await resolveArtifactComment(db(owner), owner.creatorId, id, true);
    expect((await getCollaboration(db(cam), cam.creatorId, piece))!.comments[0]).toMatchObject({ body: "Love the kettle.", quote: "kettle", resolved: true });
    expectDenied(await cam.client.from("artifact_comments").update({ body: "edited" }).eq("id", id));
  });

  it("removing a collaborator keeps their versions credited and ends their access", async () => {
    await removeCollaborator(db(owner), piece, ed.creatorId);
    expect(await getCollaboration(db(ed), ed.creatorId, piece)).toBeNull();
    const view = (await getCollaboration(db(owner), owner.creatorId, piece))!;
    expect(view.versions.some((v) => v.authorId === ed.creatorId)).toBe(true);
    // A collaborator can leave on their own.
    await removeCollaborator(db(cam), piece, cam.creatorId);
    expect(await getCollaboration(db(cam), cam.creatorId, piece)).toBeNull();
    const audit = expectOk(await admin.from("audit_logs").select("action").eq("object_id", piece));
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(["artifact.collaborator_added", "artifact.proposal_accepted", "artifact.proposal_declined", "artifact.collaborator_edit", "artifact.collaborator_removed"]));
  });
});
