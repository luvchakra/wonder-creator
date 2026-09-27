import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startHuddle } from "@wonder/creator-huddle";
import { createProject, deleteProject, getProject, linkToProject, listProjects, projectCandidates, projectConversationIds, projectsWith, setProjectItemNote, unlinkFromProject, updateProject } from "@wonder/creator-projects";
import { startConversation } from "@wonder/creator-talk";
import type { Db as AppDb } from "@wonder/db";
import { adminClient, cleanupTestCreators, createArtifact, createMaterial, createTestCreator, expectDenied, expectOk, type TestCreator } from "./helpers";

const admin = adminClient();
let a: TestCreator; // owner
let b: TestCreator; // another creator
let material: string;
let piece: string;
let othersMaterial: string;
let othersPiece: string;
let huddle: string;
const db = (x: TestCreator) => x.client as unknown as AppDb;

beforeAll(async () => {
  [a, b] = await Promise.all([createTestCreator("projOwner"), createTestCreator("projOther")]);
  [material, piece, othersMaterial, othersPiece] = await Promise.all([createMaterial(a, "Monsoon voice memo"), createArtifact(a, { title: "Goa sunrise poem" }), createMaterial(b, "B's private note"), createArtifact(b, { title: "B's draft" })]);
  huddle = await startHuddle(db(a), { topic: "Shot list jam" });
});
afterAll(async () => {
  await a.client.rpc("huddle_end", { p_huddle: huddle });
  await cleanupTestCreators();
});

describe("projects", () => {
  it("are private to their owner and audited", async () => {
    const p = await createProject(db(a), a.creatorId, { title: "A Life in Moments", brief: "A short film about memory.", goals: ["Finish the script", "Shoot in Goa"] });
    expect(p).toMatchObject({ status: "idea", goals: ["Finish the script", "Shoot in Goa"] });
    expect((await listProjects(db(a))).map((x) => x.id)).toContain(p.id);
    expect(expectOk(await b.client.from("projects").select("id").eq("id", p.id))).toEqual([]);
    expectDenied(await b.client.from("projects").insert({ creator_id: a.creatorId, title: "Impersonated" }));
    // Another creator's update or delete touches nothing.
    expect(expectOk(await b.client.from("projects").update({ title: "Hijacked" }).eq("id", p.id).select("id"))).toEqual([]);
    expect(expectOk(await b.client.from("projects").delete().eq("id", p.id).select("id"))).toEqual([]);

    await updateProject(db(a), p.id, { status: "active" });
    const audit = expectOk(await admin.from("audit_logs").select("action, metadata").eq("object_id", p.id).order("created_at"));
    expect(audit.map((r) => r.action)).toEqual(["project.created", "project.status"]);
    expect(audit[1].metadata).toMatchObject({ from: "idea", to: "active" });
  });

  it("validate goals, budget and cover", async () => {
    const p = await createProject(db(a), a.creatorId, { title: "Budgeted" });
    await expect(createProject(db(a), a.creatorId, { title: "" })).rejects.toThrow();
    await expect(updateProject(db(a), p.id, { goals: Array.from({ length: 13 }, (_, i) => `Goal ${i}`) })).rejects.toThrow();
    await expect(updateProject(db(a), p.id, { budget: { enabled: true, currency: "rupees" } })).rejects.toThrow(/three-letter/);
    await updateProject(db(a), p.id, { budget: { enabled: true, amount: 125000, currency: "inr", note: "Travel and gear" }, rightsNote: "Music is licensed for festival use only." });
    const row = expectOk(await a.client.from("projects").select("budget_enabled, budget_amount, budget_currency, rights_note").eq("id", p.id).single());
    expect(row).toMatchObject({ budget_enabled: true, budget_amount: 125000, budget_currency: "INR", rights_note: "Music is licensed for festival use only." });
    // The cover must be the owner's own material.
    await expect(updateProject(db(a), p.id, { coverMaterialId: othersMaterial })).rejects.toThrow(/own images/);
    await updateProject(db(a), p.id, { coverMaterialId: material });
    // Goals are checked in the database too.
    expectDenied(await a.client.from("projects").update({ goals: [""] }).eq("id", p.id));
  });
});

describe("links", () => {
  it("reference work without owning it; only your own work (and your Huddles) can be linked", async () => {
    const p = await createProject(db(a), a.creatorId, { title: "Linked" });
    expect(await linkToProject(db(a), a.creatorId, p.id, { kind: "material", ids: [material] })).toBe(1);
    expect(await linkToProject(db(a), a.creatorId, p.id, { kind: "artifact", ids: [piece] })).toBe(1);
    expect(await linkToProject(db(a), a.creatorId, p.id, { kind: "huddle", ids: [huddle] })).toBe(1);
    // Already there: skipped, not duplicated.
    expect(await linkToProject(db(a), a.creatorId, p.id, { kind: "material", ids: [material] })).toBe(0);

    await expect(linkToProject(db(a), a.creatorId, p.id, { kind: "material", ids: [othersMaterial] })).rejects.toThrow(/only your own work/);
    await expect(linkToProject(db(a), a.creatorId, p.id, { kind: "artifact", ids: [othersPiece] })).rejects.toThrow(/only your own work/);
    // Nobody else can add to (or read) your project.
    await expect(linkToProject(db(b), b.creatorId, p.id, { kind: "material", ids: [othersMaterial] })).rejects.toThrow(/only your own work/);
    expect(expectOk(await b.client.from("project_items").select("id").eq("project_id", p.id))).toEqual([]);
    // B's Huddle that A never joined can't be linked.
    const bHuddle = await startHuddle(db(b), { topic: "B only", discoverability: "invite_only" });
    await expect(linkToProject(db(a), a.creatorId, p.id, { kind: "huddle", ids: [bHuddle] })).rejects.toThrow(/only your own work/);
    await b.client.rpc("huddle_end", { p_huddle: bHuddle });

    const { items } = await getProject(db(a), p.id);
    expect(items.map((i) => [i.kind, i.title])).toEqual(expect.arrayContaining([["material", "Monsoon voice memo"], ["artifact", "Goa sunrise poem"], ["huddle", "Shot list jam"]]));
    expect(await projectsWith(db(a), "artifact", piece)).toContain(p.id);
    // Candidates leave out what's already linked, and never offer someone else's work.
    const cands = await projectCandidates(db(a), a.creatorId, p.id, "material");
    expect(cands.map((c) => c.id)).not.toContain(material);
    expect(cands.map((c) => c.id)).not.toContain(othersMaterial);
  });

  it("a link's target never changes; notes can", async () => {
    const p = await createProject(db(a), a.creatorId, { title: "Notes" });
    await linkToProject(db(a), a.creatorId, p.id, { kind: "material", ids: [material] });
    const [item] = (await getProject(db(a), p.id)).items;
    await setProjectItemNote(db(a), p.id, item.id, "Opening line comes from here");
    expect((await getProject(db(a), p.id)).items[0].note).toBe("Opening line comes from here");
    expectDenied(await a.client.from("project_items").update({ material_id: othersMaterial }).eq("id", item.id));
  });

  it("unlinking and deleting the project never delete the work", async () => {
    const p = await createProject(db(a), a.creatorId, { title: "Doomed" });
    await linkToProject(db(a), a.creatorId, p.id, { kind: "material", ids: [material] });
    await linkToProject(db(a), a.creatorId, p.id, { kind: "artifact", ids: [piece] });
    const conv = await startConversation(db(a), a.creatorId, "Ideas for the opening", null, p.id);
    const [first] = (await getProject(db(a), p.id)).items;
    await unlinkFromProject(db(a), p.id, first.id);
    await deleteProject(db(a), p.id);
    expect(expectOk(await a.client.from("creative_materials").select("id").eq("id", material))).toHaveLength(1);
    expect(expectOk(await a.client.from("artifacts").select("id").eq("id", piece))).toHaveLength(1);
    // The conversation stays, just without its project.
    expect(expectOk(await a.client.from("conversations").select("project_id").eq("id", conv.id).single())).toEqual({ project_id: null });
    expect(expectOk(await admin.from("project_items").select("id").eq("project_id", p.id))).toEqual([]);
    expect(expectOk(await admin.from("audit_logs").select("action").eq("object_id", p.id).eq("action", "project.deleted"))).toHaveLength(1);
  });
});

describe("conversations in a project", () => {
  it("start in the project, are listed there, and only in your own projects", async () => {
    const p = await createProject(db(a), a.creatorId, { title: "Talky", brief: "Keep it tender." });
    const conv = await startConversation(db(a), a.creatorId, "Where should the film open?", null, p.id);
    expect(conv.project_id).toBe(p.id);
    expect(await projectConversationIds(db(a), p.id)).toEqual([conv.id]);
    expect((await getProject(db(a), p.id)).items.map((i) => i.kind)).toEqual(["conversation"]);
    // B can't put a conversation into A's project.
    await expect(startConversation(db(b), b.creatorId, "Sneaky", null, p.id)).rejects.toThrow();
    const bConv = await startConversation(db(b), b.creatorId, "Mine");
    expectDenied(await b.client.from("conversations").update({ project_id: p.id }).eq("id", bConv.id));
  });
});
