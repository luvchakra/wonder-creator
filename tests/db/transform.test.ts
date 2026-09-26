import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { selectProvider, transform } from "@wonder/creator-brain";
import { createVersion } from "@wonder/creator-studio";
import { handleTurn } from "@wonder/creator-talk";
import type { Db as AppDb } from "@wonder/db";
import { cleanupTestCreators, createMaterial, createTestCreator, expectOk, type TestCreator } from "./helpers";

const provider = selectProvider({ WONDERCREATOR_AI_PROVIDER: "offline" });
let a: TestCreator;
let b: TestCreator;
let source: string;
let material: string;
let v1: string;
const deps = (c: TestCreator) => ({ db: c.client as unknown as AppDb, creatorId: c.creatorId, provider });

beforeAll(async () => {
  [a, b] = await Promise.all([createTestCreator("deriveA"), createTestCreator("deriveB")]);
  material = await createMaterial(a, "Lighthouse notes");
  const r = await handleTurn(deps(a), { message: "Write a poem about the lighthouse", materialIds: [material] });
  source = (r.messages[r.messages.length - 1].payload as { artifactId: string }).artifactId;
  v1 = expectOk(await a.client.from("artifacts").select("current_version_id").eq("id", source).single()).current_version_id!;
  await createVersion(a.client as unknown as AppDb, source, { content: "A second version of the lighthouse poem.", label: "Revised", authorKind: "creator" });
  // Jointly owned, with a credited contributor.
  const rights = expectOk(await a.client.from("rights_records").select("id").eq("artifact_id", source).single());
  expectOk(await a.client.from("rights_records").update({ ownership_kind: "joint" }).eq("id", rights.id).select("id"));
  await a.client.from("rights_owners").delete().eq("rights_id", rights.id);
  expectOk(await a.client.from("rights_owners").insert([
    { rights_id: rights.id, creator_id: a.creatorId, owner_creator_id: a.creatorId, owner_name: "A", share_percent: 60 },
    { rights_id: rights.id, creator_id: a.creatorId, owner_name: "Co-writer", share_percent: 40 },
  ]));
  expectOk(await a.client.from("artifact_contributors").insert({ artifact_id: source, contributor_creator_id: b.creatorId, role: "Editor", added_by_creator_id: a.creatorId }));
});
afterAll(cleanupTestCreators);

describe("artifact transformation", () => {
  it("a derivative knows its source, the version, the material, the contributors and the rights that followed it", async () => {
    const res = await transform(deps(a), { artifactId: source, targetType: "lyrics", instruction: "Make it singable.", versionId: v1 });
    const d = res.artifact.id;
    expect(res.inherited).toMatchObject({ sourceArtifactId: source, sourceVersionId: v1, sourceVersionNumber: 1, materials: 1, contributors: 1 });

    const edges = expectOk(await a.client.from("lineage_edges").select("source_type, source_id, relationship").eq("target_type", "artifact").eq("target_id", d));
    expect(edges).toEqual(
      expect.arrayContaining([
        { source_type: "artifact", source_id: source, relationship: "adapted_from" },
        { source_type: "artifact_version", source_id: v1, relationship: "derived_from" },
        { source_type: "material", source_id: material, relationship: "references" },
      ]),
    );
    const contributors = expectOk(await a.client.from("artifact_contributors").select("contributor_creator_id, role").eq("artifact_id", d));
    expect(contributors).toEqual([{ contributor_creator_id: b.creatorId, role: "Editor" }]);
    const rights = expectOk(await a.client.from("rights_records").select("ownership_kind, notes, rights_owners(owner_name, share_percent)").eq("artifact_id", d).single());
    expect(rights.ownership_kind).toBe("joint");
    expect(rights.notes).toMatch(/Derived from “.*” \(v1\)/);
    expect((rights.rights_owners as Array<{ owner_name: string }>).map((o) => o.owner_name).sort()).toEqual(["A", "Co-writer"]);
    // The derivative is a private draft; the source is untouched.
    const art = expectOk(await a.client.from("artifacts").select("privacy, status").eq("id", d).single());
    expect(art).toMatchObject({ privacy: "creator_private", status: "draft" });
  });

  it("a version from another piece can't be used", async () => {
    const other = await handleTurn(deps(a), { message: "Write a poem about rain" });
    const otherArtifact = (other.messages[other.messages.length - 1].payload as { artifactId: string }).artifactId;
    const otherVersion = expectOk(await a.client.from("artifacts").select("current_version_id").eq("id", otherArtifact).single()).current_version_id;
    await expect(transform(deps(a), { artifactId: source, targetType: "lyrics", instruction: "x", versionId: otherVersion })).rejects.toThrow(/couldn't find that version/);
  });

  it("someone else's work: invisible while private, refused without permission, credited when allowed", async () => {
    await expect(transform(deps(b), { artifactId: source, targetType: "lyrics", instruction: "x" })).rejects.toThrow();

    expectOk(await a.client.from("artifacts").update({ status: "final", privacy: "public" }).eq("id", source).select("id"));
    await expect(transform(deps(b), { artifactId: source, targetType: "lyrics", instruction: "x" })).rejects.toThrow(/hasn't allowed derivatives/);

    expectOk(await a.client.from("rights_records").update({ derivatives_allowed: true }).eq("artifact_id", source).select("id"));
    const res = await transform(deps(b), { artifactId: source, targetType: "lyrics", instruction: "Make it singable." });
    const d = res.artifact.id;
    expect(res.inherited.materials).toBe(0); // A's private material never reaches B
    const contributors = expectOk(await b.client.from("artifact_contributors").select("contributor_creator_id, role").eq("artifact_id", d));
    expect(contributors).toEqual([{ contributor_creator_id: a.creatorId, role: "Original creator" }]);
    const rights = expectOk(await b.client.from("rights_records").select("attribution_required, derivatives_allowed, notes").eq("artifact_id", d).single());
    expect(rights).toMatchObject({ attribution_required: true, derivatives_allowed: false });
    expect(rights.notes).toMatch(/credit them/);
  });
});
