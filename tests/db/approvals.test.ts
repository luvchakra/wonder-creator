import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { approveProposal, create, discover, editProposal, getApproval, listApprovals, rejectProposal, resolveProposal, selectProvider } from "@wonder/creator-brain";
import { setAutonomy } from "@wonder/creator-identity";
import type { Db as AppDb } from "@wonder/db";
import { cleanupTestCreators, createMaterial, createTestCreator, expectDenied, expectOk, loose, type TestCreator } from "./helpers";

const provider = selectProvider({ WONDERCREATOR_AI_PROVIDER: "offline" });
let a: TestCreator;
let b: TestCreator;
const db = (c: TestCreator) => c.client as unknown as AppDb;
const deps = (c: TestCreator) => ({ db: db(c), creatorId: c.creatorId, provider });

async function propose(instruction = "A poem about the harbour at dusk") {
  const res = await create(deps(a), { artifactType: "poem", instruction, materialIds: [] });
  if (res.kind !== "proposal") throw new Error("expected a proposal");
  return res.proposal;
}

beforeAll(async () => {
  [a, b] = await Promise.all([createTestCreator("apprOwner"), createTestCreator("apprOther")]);
  await setAutonomy(db(a), a.creatorId, "creative_generation", "execute_with_approval");
});
afterAll(cleanupTestCreators);

describe("Approval Center", () => {
  it("lists what's waiting, with the exact parameters, and only to its creator", async () => {
    const p = await propose();
    const [view] = await listApprovals(db(a), { state: "open" });
    expect(view).toMatchObject({ id: p.id, state: "pending", domain: "creative_generation", rightsImplications: false, cost: "No cost", editable: true });
    expect(view.parameters).toEqual(expect.arrayContaining([{ label: "Kind of piece", value: "poem" }, { label: "Request", value: "A poem about the harbour at dusk" }]));
    expect(new Date(view.expiresAt).getTime()).toBeGreaterThan(Date.now() + 6 * 86400_000);
    expect(await listApprovals(db(b), { state: "open" })).toEqual([]);
    await expect(getApproval(db(b), p.id)).rejects.toThrow(/couldn't find/);
    await expect(approveProposal(deps(b), p.id)).rejects.toThrow();
  });

  it("an approval runs once, and its parameters can't be changed underneath it", async () => {
    const p = await propose("A poem about lamps");
    // Parameters are fixed once proposed, even for the creator.
    expectDenied(await loose(a.client).from("ai_proposals").update({ payload: { artifactType: "screenplay", instruction: "x", materialIds: [] } }).eq("id", p.id), "42501");
    const res = await approveProposal(deps(a), p.id);
    expect(res.kind).toBe("artifact");
    await expect(approveProposal(deps(a), p.id)).rejects.toThrow(/already been handled/);
    const view = await getApproval(db(a), p.id);
    expect(view.state).toBe("executed");
    // Decided proposals can't be reopened.
    expectDenied(await loose(a.client).from("ai_proposals").update({ status: "pending" }).eq("id", p.id), "55000");
  });

  it("declining keeps a note; cancelled and declined proposals can't then be approved", async () => {
    const p = await propose("A poem about rain");
    await rejectProposal(deps(a), p.id, "Not this week");
    expect(await getApproval(db(a), p.id)).toMatchObject({ state: "declined", decisionNote: "Not this week" });
    await expect(approveProposal(deps(a), p.id)).rejects.toThrow(/already been handled/);
    const q = await propose("A poem about wind");
    await resolveProposal(db(a), q.id, "cancelled");
    await expect(approveProposal(deps(a), q.id)).rejects.toThrow(/already been handled/);
  });

  it("editing makes a new proposal and cancels the old one", async () => {
    const p = await propose("A poem about bridges");
    const next = await editProposal(db(a), a.creatorId, p.id, { artifactType: "story", instruction: "A story about bridges" });
    expect(next.supersedes).toBe(p.id);
    expect((await getApproval(db(a), p.id)).state).toBe("cancelled");
    const view = await getApproval(db(a), next.id);
    expect(view.parameters).toEqual(expect.arrayContaining([{ label: "Kind of piece", value: "story" }, { label: "Request", value: "A story about bridges" }]));
    await expect(editProposal(db(a), a.creatorId, p.id, { instruction: "again" })).rejects.toThrow(/already been handled/);
  });

  it("expired proposals can't be approved", async () => {
    const p = await propose("A poem about snow");
    // The guard forbids changing expiry, so insert an already-expired copy.
    const row = expectOk(
      await a.client
        .from("ai_proposals")
        .insert({ creator_id: a.creatorId, domain: p.domain, action: p.action, understood: p.understood, plan: p.plan, impact: p.impact, payload: p.payload, expires_at: new Date(Date.now() - 1000).toISOString() })
        .select("id")
        .single(),
    );
    await expect(approveProposal(deps(a), row.id)).rejects.toThrow(/expired/);
    expect((await getApproval(db(a), row.id)).state).toBe("expired");
  });

  it("changing autonomy affects what comes next, never what was already decided", async () => {
    const done = await propose("A poem about ferries");
    await approveProposal(deps(a), done.id);
    const waiting = await propose("A poem about gulls");
    // Turning creation up to auto doesn't approve what's waiting…
    await setAutonomy(db(a), a.creatorId, "creative_generation", "auto_execute");
    expect((await getApproval(db(a), waiting.id)).state).toBe("pending");
    // …and turning it off stops a waiting approval from running, without touching what already ran.
    await setAutonomy(db(a), a.creatorId, "creative_generation", "never");
    await expect(approveProposal(deps(a), waiting.id)).rejects.toThrow(/Never/);
    expect((await getApproval(db(a), waiting.id)).state).toBe("failed");
    expect((await getApproval(db(a), done.id)).state).toBe("executed");
    // Suggestions follow the same setting.
    const note = await createMaterial(a, "Gulls over the pier");
    await expect(discover(deps(a), { materialIds: [note], instruction: "What could this become?" })).rejects.toThrow(/Never/);
    await setAutonomy(db(a), a.creatorId, "creative_generation", "execute_with_approval");
  });

  it("every decision is in the creator's audit log", async () => {
    const actions = expectOk(await a.client.from("audit_logs").select("action").eq("object_type", "ai_proposal")).map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["approval.approved", "approval.executed", "approval.rejected", "approval.cancelled", "approval.expired", "approval.failed"]));
  });
});
