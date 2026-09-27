import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  contributionHistory,
  contributionSummary,
  createProject,
  createTask,
  exportCredits,
  inviteToCrew,
  leaveCrew,
  linkToProject,
  listContributions,
  recordContribution,
  respondToCrew,
  retractContribution,
  startCrew,
  updateContribution,
  updateTask,
} from "@wonder/creator-projects";
import { acceptProposal, addCollaborator, createArtifact, proposeChange } from "@wonder/creator-studio";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createMaterial, createTestCreator, expectDenied, expectOk, type TestCreator } from "./helpers";

const admin = adminClient();
let owner: TestCreator;
let ivy: TestCreator; // crew member & collaborator
let out: TestCreator;
let projectId: string;
let crewId: string;
let piece: string;
const db = (x: TestCreator) => x.client as unknown as AppDb;

beforeAll(async () => {
  [owner, ivy, out] = await Promise.all(["ldOwner", "ldIvy", "ldOut"].map((l) => createTestCreator(l)));
  projectId = (await createProject(db(owner), owner.creatorId, { title: "A Life in Moments" })).id;
  crewId = (await startCrew(db(owner), owner.creatorId, projectId, {})).id;
  await inviteToCrew(db(owner), crewId, { creatorId: ivy.creatorId });
  await respondToCrew(db(ivy), crewId, true);
  piece = (await createArtifact(db(owner), owner.creatorId, { artifactType: "screenplay", title: "Script", content: "INT. HOUSE - DAY", authorKind: "creator", provenance: { origin: "typed" } })).id;
  await linkToProject(db(owner), owner.creatorId, projectId, { kind: "artifact", ids: [piece] });
  await addCollaborator(db(owner), owner.creatorId, piece, { creatorId: ivy.creatorId, role: "Co-writer", access: "propose" });
});
afterAll(cleanupTestCreators);

describe("automatic entries", () => {
  it("record accepted proposals, shared work and completed tasks — never the owner's own edits", async () => {
    const cur = expectOk(await admin.from("artifacts").select("current_version_id").eq("id", piece).single()).current_version_id!;
    const p = await proposeChange(db(ivy), ivy.creatorId, piece, { baseVersionId: cur, content: "INT. HOUSE - NIGHT", summary: "Moved the scene to night" });
    await acceptProposal(db(owner), p);
    const mat = await createMaterial(ivy, "Location photos");
    await linkToProject(db(ivy), ivy.creatorId, projectId, { kind: "material", ids: [mat], shared: true });
    const task = await createTask(db(owner), owner.creatorId, projectId, { title: "Scout the beach", assigneeIds: [ivy.creatorId] });
    await updateTask(db(ivy), task, { status: "done" });

    const ledger = await listContributions(db(owner), owner.creatorId, { projectId });
    expect(ledger.map((c) => [c.source, c.contributor.id]).sort()).toEqual(
      [
        ["shared_item", ivy.creatorId],
        ["task", ivy.creatorId],
        ["version", ivy.creatorId],
      ].sort(),
    );
    const v = ledger.find((c) => c.source === "version")!;
    expect(v).toMatchObject({ kind: "writing", related: { artifact: { id: piece }, versionNumber: 2 }, description: expect.stringContaining("Moved the scene to night") });
    // The piece's own ledger shows it too; outsiders see nothing.
    expect((await listContributions(db(ivy), ivy.creatorId, { artifactId: piece })).map((c) => c.id)).toContain(v.id);
    expect(await listContributions(db(out), out.creatorId, { projectId })).toEqual([]);
  });
});

describe("manual entries, edits and retraction", () => {
  it("managers record contributions for people involved; facts can't be changed or deleted", async () => {
    const id = await recordContribution(db(owner), owner.creatorId, { projectId, contributorId: ivy.creatorId, kind: "sound", description: "Recorded the monsoon ambience", creditLine: "Sound recordist", sharePercent: 30 });
    await expect(recordContribution(db(ivy), ivy.creatorId, { projectId, contributorId: ivy.creatorId, kind: "idea", description: "Self-credit" })).rejects.toThrow(/Only the Creative Room's owner/);
    await expect(recordContribution(db(owner), owner.creatorId, { projectId, contributorId: out.creatorId, kind: "idea", description: "Not involved" })).rejects.toThrow(/people involved/);
    await expect(recordContribution(db(owner), owner.creatorId, { projectId, contributorId: owner.creatorId, kind: "direction", description: "Directed", sharePercent: 80 })).rejects.toThrow(/more than 100%/);
    expectDenied(await owner.client.from("contributions").update({ contributor_creator_id: owner.creatorId }).eq("id", id));
    expectDenied(await owner.client.from("contributions").delete().eq("id", id));
    expectDenied(await ivy.client.from("contribution_edits").insert({ contribution_id: id, changes: {} }));

    // The contributor refines their description; only managers change credit, rights, compensation and shares.
    await updateContribution(db(ivy), id, { description: "Recorded the monsoon ambience on the terrace" });
    await expect(updateContribution(db(ivy), id, { sharePercent: 50 })).rejects.toThrow(/can't change that/);
    await updateContribution(db(owner), id, { rights: "co_owner", compensation: "Flat fee", sharePercent: null });
    const history = await contributionHistory(db(ivy), id);
    expect(history.map((h) => Object.keys(h.changes).sort())).toEqual([["description"], ["compensation", "rights", "share"]]);

    const entry = (await listContributions(db(owner), owner.creatorId, { projectId })).find((c) => c.id === id)!;
    expect(entry).toMatchObject({ rights: "co_owner", sharePercent: null, edited: 2, recordedBy: expect.any(String) });

    await expect(retractContribution(db(ivy), id, "mistake")).rejects.toThrow(/can't change that/);
    await retractContribution(db(owner), id, "Recorded twice");
    const after = (await listContributions(db(ivy), ivy.creatorId, { projectId })).find((c) => c.id === id)!;
    expect(after.retracted).toMatchObject({ reason: "Recorded twice" });
    await expect(updateContribution(db(owner), id, { description: "x" })).rejects.toThrow(/retracted/);
  });

  it("summaries count contributions and show shares only where defined; credits respect attribution", async () => {
    await recordContribution(db(owner), owner.creatorId, { projectId, contributorId: owner.creatorId, kind: "direction", description: "Directed", creditLine: "Director", sharePercent: 60 });
    await recordContribution(db(owner), owner.creatorId, { projectId, contributorId: ivy.creatorId, kind: "review", description: "Gave notes", attribution: "none" });
    const ledger = await listContributions(db(owner), owner.creatorId, { projectId });
    const s = contributionSummary(ledger);
    const me = s.people.find((p) => p.id === owner.creatorId)!;
    const her = s.people.find((p) => p.id === ivy.creatorId)!;
    expect(me.definedShare).toBe(60);
    expect(her.definedShare).toBeNull(); // no percentage invented
    const txt = exportCredits("A Life in Moments", ledger, "txt");
    expect(txt).toContain("Director");
    expect(txt).not.toContain("Gave notes");
    const csv = exportCredits("A Life in Moments", ledger, "csv");
    expect(csv.split("\n")[0]).toContain("Share (%)");
    expect(csv).toContain("Gave notes"); // the ledger export keeps everything that's live
  });

  it("people who leave the crew keep their contributions on record", async () => {
    await leaveCrew(db(ivy), crewId);
    const ledger = await listContributions(db(owner), owner.creatorId, { projectId });
    expect(ledger.filter((c) => c.contributor.id === ivy.creatorId).length).toBeGreaterThanOrEqual(3);
    // They can still see their own entries.
    expect((await listContributions(db(ivy), ivy.creatorId, { projectId })).every((c) => c.contributor.id === ivy.creatorId)).toBe(true);
  });
});
