import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  cleanupTestCreators,
  createArtifact,
  createProvenance,
  createTestCreator,
  createVersion,
  expectDenied,
  expectNoRowsAffected,
  expectOk,
  type ArtifactVersion,
  type TestCreator,
} from "./helpers";

const admin = adminClient();
const anon = anonClient();
let a: TestCreator; // owner
let b: TestCreator; // other creator
let c: TestCreator; // contributor

beforeAll(async () => {
  [a, b, c] = await Promise.all([createTestCreator("artA"), createTestCreator("artB"), createTestCreator("artC")]);
});
afterAll(cleanupTestCreators);

describe("artifact creation", () => {
  it("requires a provenance record", async () => {
    const err = expectDenied(
      await a.client
        .from("artifacts")
        // @ts-expect-error provenance_id is required by the schema; this checks the DB enforces it too
        .insert({ creator_id: a.creatorId, artifact_type: "poem", category: "writing", title: "No provenance" }),
    );
    // RLS (owns_provenance) or NOT NULL, whichever fires first.
    expect(["42501", "23502"]).toContain(err.code);
  });

  it("returns the created row from insert().select() (standard supabase-js pattern)", async () => {
    const provenanceId = await createProvenance(a);
    const res = await a.client
      .from("artifacts")
      .insert({ creator_id: a.creatorId, artifact_type: "poem", category: "writing", title: "Returned", provenance_id: provenanceId })
      .select("id, title")
      .single();
    expect(expectOk(res).title).toBe("Returned");
  });
});

describe("artifact versions", () => {
  let artifactId: string;
  let v1: { id: string; content: string };
  let v2: { id: string };

  beforeAll(async () => {
    artifactId = await createArtifact(a, { title: "Versioned" });
  });

  it("creates version 1 and moves current_version_id", async () => {
    const row = await createVersion(a, artifactId, "first draft");
    expect(row.version_number).toBe(1);
    expect(row.parent_version_id).toBeNull();
    expect(row.creator_id).toBe(a.creatorId);
    expect(row.created_by_creator_id).toBe(a.creatorId);
    v1 = row;
    const art = expectOk(await a.client.from("artifacts").select("current_version_id").eq("id", artifactId).single());
    expect(art.current_version_id).toBe(v1.id);
  });

  it("increments the version number and links the parent", async () => {
    const row = await createVersion(a, artifactId, "second draft");
    expect(row.version_number).toBe(2);
    expect(row.parent_version_id).toBe(v1.id);
    v2 = row;
    const art = expectOk(await a.client.from("artifacts").select("current_version_id").eq("id", artifactId).single());
    expect(art.current_version_id).toBe(v2.id);
  });

  it("records an ArtifactVersionCreated domain event for the owner", async () => {
    const events = expectOk(
      await a.client
        .from("domain_events")
        .select("event_type, creator_id, payload")
        .eq("aggregate_id", artifactId)
        .eq("event_type", "ArtifactVersionCreated"),
    );
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.creator_id === a.creatorId)).toBe(true);
  });

  it("versions are immutable for the owner", async () => {
    const res = await a.client.from("artifact_versions").update({ content: "rewritten" }).eq("id", v1.id).select();
    expectNoRowsAffected(res);
    const row = expectOk(await admin.from("artifact_versions").select("content").eq("id", v1.id).single());
    expect(row.content).toBe("first draft");
  });

  it("versions are immutable even with the secret key", async () => {
    expectDenied(await admin.from("artifact_versions").update({ content: "rewritten" }).eq("id", v1.id), "42501");
  });

  it("restore creates a new version rather than rewriting history", async () => {
    const row = await createVersion(a, artifactId, v1.content, v1.id);
    expect(row.version_number).toBe(3);
    expect(row.author_kind).toBe("restore");
    expect(row.restored_from_version_id).toBe(v1.id);
    expect(row.parent_version_id).toBe(v2.id);
    const versions = expectOk(
      await a.client.from("artifact_versions").select("version_number").eq("artifact_id", artifactId).order("version_number"),
    );
    expect(versions.map((v) => v.version_number)).toEqual([1, 2, 3]);
    const art = expectOk(await a.client.from("artifacts").select("current_version_id").eq("id", artifactId).single());
    expect(art.current_version_id).toBe(row.id);
  });

  it("rejects restoring from a version of a different artifact", async () => {
    const other = await createArtifact(a, { title: "Other" });
    const otherV = await createVersion(a, other, "other");
    expectDenied(
      await a.client.rpc("create_artifact_version", {
        p_artifact_id: artifactId,
        p_content: "x",
        p_label: "Restore",
        p_author_kind: "restore",
        p_restored_from: otherV.id,
      }),
      "22023",
    );
  });

  it("another creator cannot create a version on A's artifact", async () => {
    expectDenied(
      await b.client.rpc("create_artifact_version", {
        p_artifact_id: artifactId,
        p_content: "hijack",
        p_label: "Hijack",
        p_author_kind: "creator",
      }),
      "P0002",
    );
    expectDenied(
      await b.client.from("artifact_versions").insert({
        artifact_id: artifactId,
        creator_id: b.creatorId,
        version_number: 50,
        author_kind: "creator",
        content: "hijack",
      }),
      "42501",
    );
    const count = expectOk(await admin.from("artifact_versions").select("id").eq("artifact_id", artifactId));
    expect(count).toHaveLength(3);
  });

  it("the owner cannot bypass the RPC with a forged version row on someone else's artifact", async () => {
    const bArtifact = await createArtifact(b, { title: "B's" });
    expectDenied(
      await a.client.from("artifact_versions").insert({
        artifact_id: bArtifact,
        creator_id: a.creatorId,
        version_number: 1,
        author_kind: "creator",
      }),
      "42501",
    );
  });

  it("archived artifacts do not accept new versions", async () => {
    const archived = await createArtifact(a, { title: "Archived", status: "archived" });
    expectDenied(
      await a.client.rpc("create_artifact_version", {
        p_artifact_id: archived,
        p_content: "x",
        p_label: "x",
        p_author_kind: "creator",
      }),
      "22023",
    );
  });

  it("rejects an author kind outside creator/ai/restore", async () => {
    expectDenied(
      await a.client.rpc("create_artifact_version", {
        p_artifact_id: artifactId,
        p_content: "x",
        p_label: "x",
        p_author_kind: "system",
      }),
      "22023",
    );
  });

  it("rejects someone else's AI run id", async () => {
    const bRun = expectOk(
      await b.client.from("ai_runs").insert({ creator_id: b.creatorId, intent: "x", provider: "x", model: "x" }).select("id").single(),
    ).id;
    expectDenied(
      await a.client.rpc("create_artifact_version", {
        p_artifact_id: artifactId,
        p_content: "x",
        p_label: "x",
        p_author_kind: "ai",
        p_ai_run_id: bRun,
      }),
      "42501",
    );
  });

  it("an AI-authored version records the owner's run and no creator author", async () => {
    const run = expectOk(
      await a.client.from("ai_runs").insert({ creator_id: a.creatorId, intent: "x", provider: "x", model: "x" }).select("id").single(),
    ).id;
    const art = await createArtifact(a, { title: "AI authored" });
    const res = await a.client
      .rpc("create_artifact_version", {
        p_artifact_id: art,
        p_content: "generated",
        p_label: "AI draft",
        p_author_kind: "ai",
        p_ai_run_id: run,
      })
      .single();
    const row = expectOk(res) as unknown as ArtifactVersion;
    expect(row.created_by_ai_run_id).toBe(run);
    expect(row.created_by_creator_id).toBeNull();
  });

  it("deleting an AI run that authored a version nulls the reference and keeps the version", async () => {
    const run = expectOk(
      await a.client.from("ai_runs").insert({ creator_id: a.creatorId, intent: "x", provider: "x", model: "x" }).select("id").single(),
    ).id;
    const art = await createArtifact(a, { title: "Run deleted" });
    const res = await a.client
      .rpc("create_artifact_version", { p_artifact_id: art, p_content: "gen", p_label: "AI", p_author_kind: "ai", p_ai_run_id: run })
      .single();
    const version = expectOk(res) as unknown as ArtifactVersion;
    expect(expectOk(await a.client.from("ai_runs").delete().eq("id", run).select("id"))).toHaveLength(1);
    const row = expectOk(await admin.from("artifact_versions").select("created_by_ai_run_id, content").eq("id", version.id).single());
    expect(row).toEqual({ created_by_ai_run_id: null, content: "gen" });
  });

  it("other version columns stay immutable (secret key)", async () => {
    const otherRun = expectOk(
      await admin.from("ai_runs").insert({ creator_id: a.creatorId, intent: "x", provider: "x", model: "x" }).select("id").single(),
    ).id;
    expectDenied(await admin.from("artifact_versions").update({ label: "relabelled" }).eq("id", v2.id), "42501");
    expectDenied(await admin.from("artifact_versions").update({ version_number: 42 }).eq("id", v2.id), "42501");
    expectDenied(await admin.from("artifact_versions").update({ created_by_ai_run_id: otherRun }).eq("id", v2.id), "42501");
    expectDenied(await admin.from("artifact_versions").update({ parent_version_id: v2.id }).eq("id", v1.id), "42501");
    expectDenied(
      await admin.from("artifact_versions").update({ created_by_creator_id: b.creatorId }).eq("id", v1.id),
      "42501",
    );
  });

  it("the owner can delete an artifact that has several versions", async () => {
    const id = await createArtifact(a, { title: "To delete" });
    await createVersion(a, id, "one");
    await createVersion(a, id, "two");
    const res = await a.client.from("artifacts").delete().eq("id", id).select("id");
    expect(expectOk(res)).toHaveLength(1);
    expect(expectOk(await admin.from("artifact_versions").select("id").eq("artifact_id", id))).toHaveLength(0);
  });
});

describe("artifact visibility", () => {
  let privateId: string;
  let publicId: string;
  let publicV1: string;
  let publicV2: string;
  let sharedId: string;

  beforeAll(async () => {
    privateId = await createArtifact(a, { title: "Private" });
    await createVersion(a, privateId, "private body");

    publicId = await createArtifact(a, { title: "Public" });
    publicV1 = (await createVersion(a, publicId, "public v1")).id;
    publicV2 = (await createVersion(a, publicId, "public v2")).id;
    expectOk(await a.client.from("artifacts").update({ privacy: "public", status: "final" }).eq("id", publicId));
    // Anon visibility also requires a publicly viewable creator profile.
    expectOk(await a.client.from("creators").update({ visibility: "public" }).eq("id", a.creatorId));

    sharedId = await createArtifact(a, { title: "Shared with contributor" });
    await createVersion(a, sharedId, "shared body");
    expectOk(
      await a.client
        .from("artifact_contributors")
        .insert({ artifact_id: sharedId, contributor_creator_id: c.creatorId, role: "editor", added_by_creator_id: a.creatorId }),
    );
  });

  it("a private artifact and its versions are invisible to B and anon", async () => {
    for (const client of [b.client, anon]) {
      expect(expectOk(await client.from("artifacts").select("id").eq("id", privateId))).toHaveLength(0);
      expect(expectOk(await client.from("artifact_versions").select("id").eq("artifact_id", privateId))).toHaveLength(0);
    }
  });

  it("the owner still sees the full draft history of a public artifact", async () => {
    const versions = expectOk(await a.client.from("artifact_versions").select("id").eq("artifact_id", publicId));
    expect(versions.map((v) => v.id).sort()).toEqual([publicV1, publicV2].sort());
  });

  it("a public + final artifact is readable by B, but only its current version (draft history stays private)", async () => {
    expect(expectOk(await b.client.from("artifacts").select("id").eq("id", publicId))).toHaveLength(1);
    const versions = expectOk(await b.client.from("artifact_versions").select("id").eq("artifact_id", publicId));
    expect(versions.map((v) => v.id)).toEqual([publicV2]);
  });

  it("a public + final artifact is readable by anon, current version only", async () => {
    expect(expectOk(await anon.from("artifacts").select("id").eq("id", publicId))).toHaveLength(1);
    const versions = expectOk(await anon.from("artifact_versions").select("id").eq("artifact_id", publicId));
    expect(versions.map((v) => v.id)).toEqual([publicV2]);
  });

  it("a public artifact that is still a draft is not readable by others", async () => {
    const draft = await createArtifact(a, { title: "Public draft", privacy: "public" });
    expect(expectOk(await b.client.from("artifacts").select("id").eq("id", draft))).toHaveLength(0);
    expect(expectOk(await anon.from("artifacts").select("id").eq("id", draft))).toHaveLength(0);
  });

  it("B cannot update or delete A's public artifact", async () => {
    expectNoRowsAffected(await b.client.from("artifacts").update({ title: "Defaced" }).eq("id", publicId).select());
    expectNoRowsAffected(await b.client.from("artifacts").delete().eq("id", publicId).select());
    const row = expectOk(await admin.from("artifacts").select("title").eq("id", publicId).single());
    expect(row.title).toBe("Public");
  });

  it("B cannot create a version on A's public artifact", async () => {
    expectDenied(
      await b.client.rpc("create_artifact_version", {
        p_artifact_id: publicId,
        p_content: "x",
        p_label: "x",
        p_author_kind: "creator",
      }),
    );
  });

  it("a contributor can read a private artifact and its versions", async () => {
    expect(expectOk(await c.client.from("artifacts").select("id").eq("id", sharedId))).toHaveLength(1);
    expect(expectOk(await c.client.from("artifact_versions").select("id").eq("artifact_id", sharedId))).toHaveLength(1);
    expect(
      expectOk(await c.client.from("artifact_contributors").select("contributor_creator_id").eq("artifact_id", sharedId)),
    ).toEqual([{ contributor_creator_id: c.creatorId }]);
  });

  it("a contributor cannot create versions or edit the artifact", async () => {
    expectDenied(
      await c.client.rpc("create_artifact_version", {
        p_artifact_id: sharedId,
        p_content: "x",
        p_label: "x",
        p_author_kind: "creator",
      }),
    );
    expectNoRowsAffected(await c.client.from("artifacts").update({ title: "edited" }).eq("id", sharedId).select());
  });

  it("contributor access does not leak to others", async () => {
    expect(expectOk(await b.client.from("artifacts").select("id").eq("id", sharedId))).toHaveLength(0);
  });

  it("B cannot add itself as a contributor to A's artifact", async () => {
    expectDenied(
      await b.client
        .from("artifact_contributors")
        .insert({ artifact_id: privateId, contributor_creator_id: b.creatorId, role: "editor", added_by_creator_id: b.creatorId }),
      "42501",
    );
  });

  it("the owner cannot point current_version_id at another artifact's version", async () => {
    const bArtifact = await createArtifact(b, { title: "B private" });
    const bVersion = await createVersion(b, bArtifact, "b secret");
    await a.client.from("artifacts").update({ current_version_id: bVersion.id }).eq("id", privateId);
    const row = expectOk(await admin.from("artifacts").select("current_version_id").eq("id", privateId).single());
    expect(row.current_version_id).not.toBe(bVersion.id);
  });
});
