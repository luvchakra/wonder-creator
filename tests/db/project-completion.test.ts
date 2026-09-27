import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assertOwnership,
  completeProject,
  completionReview,
  createProject,
  createTask,
  deleteProject,
  getCrew,
  inviteToCrew,
  linkToProject,
  listContributions,
  openItems,
  recordContribution,
  reopenProject,
  respondToCrew,
  startCrew,
  updateProject,
  updateTask,
} from "@wonder/creator-projects";
import { addCollaborator, createArtifact } from "@wonder/creator-studio";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createTestCreator, expectOk, type TestCreator } from "./helpers";

const admin = adminClient();
let owner: TestCreator;
let kai: TestCreator; // crew member & collaborator
let noa: TestCreator; // invited, never answered
let out: TestCreator;
let projectId: string;
let crewId: string;
let piece: string;
let task: string;
const TITLE = "Tide Lines";
const db = (x: TestCreator) => x.client as unknown as AppDb;

beforeAll(async () => {
  [owner, kai, noa, out] = await Promise.all(["pcOwner", "pcKai", "pcNoa", "pcOut"].map((l) => createTestCreator(l)));
  projectId = (await createProject(db(owner), owner.creatorId, { title: TITLE })).id;
  crewId = (await startCrew(db(owner), owner.creatorId, projectId, {})).id;
  await inviteToCrew(db(owner), crewId, { creatorId: kai.creatorId });
  await respondToCrew(db(kai), crewId, true);
  await inviteToCrew(db(owner), crewId, { creatorId: noa.creatorId });
  piece = (
    await createArtifact(db(owner), owner.creatorId, {
      artifactType: "poem",
      title: "Low Water",
      content: "Salt on the stones.",
      authorKind: "creator",
      provenance: { origin: "typed" },
    })
  ).id;
  await linkToProject(db(owner), owner.creatorId, projectId, {
    kind: "artifact",
    ids: [piece],
  });
  await addCollaborator(db(owner), owner.creatorId, piece, {
    creatorId: kai.creatorId,
    role: "Editor",
    access: "propose",
  });
  task = await createTask(db(owner), owner.creatorId, projectId, {
    title: "Final read-through",
    assigneeIds: [kai.creatorId],
  });
  await assertOwnership(db(kai), projectId, {
    artifactId: piece,
    claim: "contributor_only",
    statement: "I edited it.",
  });
});
afterAll(cleanupTestCreators);

describe("the completion review", () => {
  it("lists what's still open for people in the project, and nothing for outsiders", async () => {
    expect(await openItems(db(kai), projectId)).toMatchObject({
      tasks: 1,
      claims: 1,
      proposals: 0,
    });
    const review = await completionReview(db(owner), owner.creatorId, projectId);
    expect(review.tasks.map((t) => t.title)).toEqual(["Final read-through"]);
    expect(review.rights.claims).toHaveLength(1);
    expect(review.attribution.uncredited.map((p) => p.id)).toEqual([kai.creatorId]);
    expect(review.crew).toMatchObject({ active: 2, invited: 1 });
    expect(await openItems(db(out), projectId)).toMatchObject({
      tasks: 0,
      claims: 0,
    });
  });
});

describe("completing", () => {
  it("has no one-tap path: status changes and crew dissolution go through the checklist", async () => {
    await expect(updateProject(db(owner), projectId, { status: "completed" })).rejects.toThrow(/completion checklist/);
    await expect(updateProject(db(owner), projectId, { status: "archived" })).rejects.toThrow(/completion checklist/);
    const direct = await owner.client.from("crews").update({ status: "completed" }).eq("id", crewId).select("id");
    expect(direct.error?.message).toMatch(/completion checklist/);
    await updateProject(db(owner), projectId, { status: "paused" }); // ordinary status changes still work
    await expect(
      completeProject(db(kai), projectId, {
        outcome: "completed",
        confirmTitle: TITLE,
      }),
    ).rejects.toThrow(/Only the project's owner/);
    await expect(
      completeProject(db(owner), projectId, {
        outcome: "completed",
        confirmTitle: "Tide",
      }),
    ).rejects.toThrow(/name exactly/);
    await expect(
      completeProject(db(owner), projectId, {
        outcome: "completed",
        confirmTitle: TITLE,
      }),
    ).rejects.toThrow(/still open/);
    expect(expectOk(await admin.from("projects").select("status").eq("id", projectId).single()).status).toBe("paused");
  });

  it("closes with open items acknowledged, dissolves the crew, lapses invitations, and deletes nothing", async () => {
    await recordContribution(db(owner), owner.creatorId, {
      projectId,
      contributorId: kai.creatorId,
      kind: "editing",
      description: "Line edits",
    });
    await completeProject(db(owner), projectId, {
      outcome: "completed",
      dissolveCrew: true,
      confirmTitle: " tide lines ",
      acknowledgeOpen: true,
      note: "Printed in the zine.",
    });
    expect(expectOk(await admin.from("projects").select("status").eq("id", projectId).single()).status).toBe("completed");
    const crew = (await getCrew(db(kai), kai.creatorId, crewId))!;
    expect(crew.crew.status).toBe("completed");
    expect(crew.invited).toEqual([]);
    expect(crew.me?.status).toBe("active"); // members keep access to the history
    await expect(inviteToCrew(db(owner), crewId, { creatorId: out.creatorId })).rejects.toThrow(/completed its work/);

    // Everything is still there, readable by the crew.
    const review = await completionReview(db(kai), kai.creatorId, projectId);
    expect(review.pieces.map((p) => p.id)).toEqual([piece]);
    expect(review.tasks.map((t) => t.id)).toEqual([task]);
    expect(review.history[0]).toMatchObject({
      outcome: "completed",
      crewDissolved: true,
      acknowledgedOpen: true,
      openItems: { tasks: 1, claims: 1 },
      note: "Printed in the zine.",
    });
    expect((await listContributions(db(kai), kai.creatorId, { projectId })).length).toBeGreaterThan(0);
    const audit = expectOk(await admin.from("audit_logs").select("action").eq("object_id", projectId));
    expect(audit.map((a) => a.action)).toContain("project.completed");

    // The record can't be written or changed directly.
    const forged = await owner.client.from("project_completions").insert({ project_id: projectId, outcome: "archived" });
    expect(forged.error).toBeTruthy();
    await expect(
      completeProject(db(owner), projectId, {
        outcome: "completed",
        confirmTitle: TITLE,
        acknowledgeOpen: true,
      }),
    ).rejects.toThrow(/already closed/);
  });

  it("a project with other people's contributions can't be deleted — archive it instead", async () => {
    await expect(deleteProject(db(owner), projectId)).rejects.toThrow(/crew|Archive it instead/);
  });

  it("reopening revives the crew it dissolved and keeps the completion on record", async () => {
    await expect(reopenProject(db(kai), projectId)).rejects.toThrow(/Only the project's owner/);
    await reopenProject(db(owner), projectId);
    expect(expectOk(await admin.from("projects").select("status").eq("id", projectId).single()).status).toBe("active");
    expect((await getCrew(db(owner), owner.creatorId, crewId))!.crew.status).toBe("active");
    const [h] = (await completionReview(db(owner), owner.creatorId, projectId)).history;
    expect(h.reopened).toMatchObject({ at: expect.any(String) });

    // Archive, this time with everything resolved.
    await updateTask(db(kai), task, { status: "done" });
    const [claim] = expectOk(await admin.from("ownership_assertions").select("id").eq("project_id", projectId));
    await kai.client.rpc("respond_ownership_assertion", {
      p_assertion: claim.id,
      p_response: "withdraw",
    });
    await completeProject(db(owner), projectId, {
      outcome: "archived",
      confirmTitle: TITLE,
    });
    expect(expectOk(await admin.from("projects").select("status").eq("id", projectId).single()).status).toBe("archived");
    expect((await getCrew(db(owner), owner.creatorId, crewId))!.crew.status).toBe("active"); // not dissolved this time
  });

  it("solo projects keep the simple status control", async () => {
    const solo = await createProject(db(owner), owner.creatorId, {
      title: "Notebook",
    });
    await updateProject(db(owner), solo.id, { status: "completed" });
    await updateProject(db(owner), solo.id, { status: "active" });
    await deleteProject(db(owner), solo.id);
  });
});
