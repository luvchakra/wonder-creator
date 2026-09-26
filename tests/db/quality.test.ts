import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyQualityFindings, approveProposal, dismissFinding, findingsOf, RIGHTS_CHECK_KEY, reviewQuality, selectProvider } from "@wonder/creator-brain";
import { handleTurn } from "@wonder/creator-talk";
import type { Db as AppDb } from "@wonder/db";
import { cleanupTestCreators, createTestCreator, expectOk, type TestCreator } from "./helpers";

const provider = selectProvider({ WONDERCREATOR_AI_PROVIDER: "offline" });
let a: TestCreator;
let b: TestCreator;
let artifactId: string;
const deps = (c: TestCreator) => ({ db: c.client as unknown as AppDb, creatorId: c.creatorId, provider });

/** A material that came from a web link (outside the creator's own work). */
async function linkMaterial(c: TestCreator): Promise<string> {
  const prov = expectOk(await c.client.from("provenance_records").insert({ creator_id: c.creatorId, origin: "url", source_url: "https://example.com/harbour" }).select("id").single());
  return expectOk(await c.client.from("creative_materials").insert({ creator_id: c.creatorId, type: "note", title: "Harbour article", text_content: "Notes on the old harbour.", provenance_id: prov.id }).select("id").single()).id;
}

beforeAll(async () => {
  [a, b] = await Promise.all([createTestCreator("qualityA"), createTestCreator("qualityB")]);
  const mat = await linkMaterial(a);
  const r = await handleTurn(deps(a), { message: "Write a poem about the harbour", materialIds: [mat] });
  artifactId = (r.messages[r.messages.length - 1].payload as { artifactId: string }).artifactId;
});
afterAll(cleanupTestCreators);

describe("quality review & selective refinement", () => {
  it("flags outside material from provenance, and that note can't be dismissed", async () => {
    const report = expectOk(await a.client.from("quality_reports").select("*").eq("artifact_id", artifactId).single());
    const rights = findingsOf(report).find((f) => f.key === `c:${RIGHTS_CHECK_KEY}`);
    expect(rights?.state).toBe("open");
    expect(rights?.detail).toMatch(/web link/);
    await expect(dismissFinding(a.client as unknown as AppDb, artifactId, report.id, `c:${RIGHTS_CHECK_KEY}`)).rejects.toThrow(/stay visible/);
    await expect(applyQualityFindings(deps(a), artifactId, { reportId: report.id, keys: [`c:${RIGHTS_CHECK_KEY}`] })).rejects.toThrow(/can't be fixed by rewriting/);
  });

  it("applies only the chosen suggestion as a preview; keeping it makes a traceable version", async () => {
    const report = expectOk(await a.client.from("quality_reports").select("*").eq("artifact_id", artifactId).single());
    const before = expectOk(await a.client.from("artifacts").select("current_version_id").eq("id", artifactId).single());

    const res = await applyQualityFindings(deps(a), artifactId, { reportId: report.id, keys: ["s0"] });
    expect(res.kind).toBe("proposal"); // always a preview, whatever the autonomy setting
    // Nothing changed yet.
    expect(expectOk(await a.client.from("artifacts").select("current_version_id").eq("id", artifactId).single()).current_version_id).toBe(before.current_version_id);

    const kept = await approveProposal(deps(a), (res as { proposal: { id: string } }).proposal.id);
    expect(kept.kind).toBe("version");
    const v = expectOk(await a.client.from("artifact_versions").select("change_summary, parent_version_id, version_number").eq("id", (kept as { versionId: string }).versionId).single());
    expect(v.change_summary).toBe("Applied quality suggestions: Try a closer detail");
    expect(v.parent_version_id).toBe(before.current_version_id);
    const after = expectOk(await a.client.from("quality_reports").select("applied").eq("id", report.id).single());
    expect(after.applied).toEqual(["s0"]);

    // The old review no longer matches the current version.
    await expect(applyQualityFindings(deps(a), artifactId, { reportId: report.id, keys: ["c:pacing"] })).rejects.toThrow(/earlier version/);
  });

  it("a fresh review of the new version still carries the rights note (regeneration can't hide it)", async () => {
    const r = await reviewQuality(deps(a), artifactId);
    expect(r.checks.find((c) => c.key === RIGHTS_CHECK_KEY)?.status).toBe("attention");
    await dismissFinding(a.client as unknown as AppDb, artifactId, r.reportId, "s0");
    const report = expectOk(await a.client.from("quality_reports").select("*").eq("id", r.reportId).single());
    expect(findingsOf(report).find((f) => f.key === "s0")?.state).toBe("dismissed");
    await expect(applyQualityFindings(deps(a), artifactId, { reportId: r.reportId, keys: ["s0"] })).rejects.toThrow(/already applied or set aside/);
  });

  it("another creator can't see, dismiss or apply someone else's findings", async () => {
    const report = expectOk(await a.client.from("quality_reports").select("id").eq("artifact_id", artifactId).order("created_at", { ascending: false }).limit(1).single());
    await expect(dismissFinding(b.client as unknown as AppDb, artifactId, report.id, "c:pacing")).rejects.toThrow(/couldn't find/);
    await expect(applyQualityFindings(deps(b), artifactId, { reportId: report.id, keys: ["c:pacing"] })).rejects.toThrow();
  });
});
