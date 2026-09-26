import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  cleanupTestCreators,
  createArtifact,
  createMaterial,
  createTestCreator,
  createVersion,
  expectDenied,
  expectNoRowsAffected,
  expectOk,
  type TestCreator,
} from "./helpers";

const admin = adminClient();
let a: TestCreator;
let b: TestCreator;
let artifactId: string;
let rightsId: string;

async function eventsFor(rights: string): Promise<string[]> {
  const rows = expectOk(
    await a.client.from("rights_events").select("event, created_at").eq("rights_id", rights).order("created_at"),
  );
  return rows.map((r) => r.event);
}

beforeAll(async () => {
  [a, b] = await Promise.all([createTestCreator("rightsA"), createTestCreator("rightsB")]);
  artifactId = await createArtifact(a, { title: "Rights subject" });
});
afterAll(cleanupTestCreators);

describe("rights history", () => {
  it("inserting a rights record writes a rights event", async () => {
    rightsId = expectOk(
      await a.client
        .from("rights_records")
        .insert({ artifact_id: artifactId, creator_id: a.creatorId, copyright_holder: "A" })
        .select("id")
        .single(),
    ).id;
    expect(await eventsFor(rightsId)).toEqual(["rights.created"]);
  });

  it("updating the rights record writes a rights event", async () => {
    expectOk(await a.client.from("rights_records").update({ derivatives_allowed: true }).eq("id", rightsId));
    expect(await eventsFor(rightsId)).toEqual(["rights.created", "derivatives.changed"]);
  });

  it("license and owner writes write rights events", async () => {
    const licenseId = expectOk(
      await a.client
        .from("licenses")
        .insert({ rights_id: rightsId, creator_id: a.creatorId, license_type: "editorial" })
        .select("id")
        .single(),
    ).id;
    expectOk(await a.client.from("licenses").update({ status: "active" }).eq("id", licenseId));
    expectOk(
      await a.client
        .from("rights_owners")
        .insert({ rights_id: rightsId, creator_id: a.creatorId, owner_name: "A", share_percent: 100 }),
    );
    const events = await eventsFor(rightsId);
    expect(events).toEqual(
      expect.arrayContaining(["license.created", "license.activated", "owner.added"]),
    );
    expect(events).toHaveLength(5);
  });

  it("rights changes are also audited for the acting creator", async () => {
    const rows = expectOk(
      await a.client.from("audit_logs").select("action, actor_creator_id").eq("object_id", rightsId),
    );
    expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(["rights.insert", "rights.update"]));
    expect(rows.every((r) => r.actor_creator_id === a.creatorId)).toBe(true);
  });

  it("rights events cannot be forged or rewritten by the client", async () => {
    expectDenied(
      await a.client.from("rights_events").insert({ rights_id: rightsId, creator_id: a.creatorId, event: "forged" }),
      "42501",
    );
    expectNoRowsAffected(
      await a.client.from("rights_events").update({ event: "rewritten" }).eq("rights_id", rightsId).select(),
    );
    expectDenied(await admin.from("rights_events").update({ event: "rewritten" }).eq("rights_id", rightsId), "42501");
  });
});

describe("rights isolation", () => {
  it("B cannot read A's rights record, licenses or events", async () => {
    expect(expectOk(await b.client.from("rights_records").select("id").eq("id", rightsId))).toHaveLength(0);
    expect(expectOk(await b.client.from("licenses").select("id").eq("rights_id", rightsId))).toHaveLength(0);
    expect(expectOk(await b.client.from("rights_owners").select("id").eq("rights_id", rightsId))).toHaveLength(0);
    expect(expectOk(await b.client.from("rights_events").select("id").eq("rights_id", rightsId))).toHaveLength(0);
  });

  it("B cannot create a rights record for A's artifact", async () => {
    const other = await createArtifact(a, { title: "No rights yet" });
    expectDenied(
      await b.client.from("rights_records").insert({ artifact_id: other, creator_id: b.creatorId, copyright_holder: "B" }),
      "42501",
    );
    expectDenied(
      await b.client.from("rights_records").insert({ artifact_id: other, creator_id: a.creatorId, copyright_holder: "B" }),
      "42501",
    );
  });

  it("B cannot update A's rights record", async () => {
    expectNoRowsAffected(
      await b.client.from("rights_records").update({ copyright_holder: "B" }).eq("id", rightsId).select(),
    );
    const row = expectOk(await admin.from("rights_records").select("copyright_holder").eq("id", rightsId).single());
    expect(row.copyright_holder).toBe("A");
  });

  it("B cannot add licenses or owners to A's rights record", async () => {
    expectDenied(
      await b.client.from("licenses").insert({ rights_id: rightsId, creator_id: b.creatorId, license_type: "commercial" }),
      "42501",
    );
    expectDenied(
      await b.client
        .from("rights_owners")
        .insert({ rights_id: rightsId, creator_id: b.creatorId, owner_name: "B", share_percent: 50 }),
      "42501",
    );
  });

  it("B cannot revoke or delete A's licenses", async () => {
    expectNoRowsAffected(await b.client.from("licenses").update({ status: "revoked" }).eq("rights_id", rightsId).select());
    expectNoRowsAffected(await b.client.from("licenses").delete().eq("rights_id", rightsId).select());
    const rows = expectOk(await admin.from("licenses").select("status").eq("rights_id", rightsId));
    expect(rows).toEqual([{ status: "active" }]);
  });

  it("A cannot re-point its rights record at B's artifact", async () => {
    const bArtifact = await createArtifact(b, { title: "B's work" });
    // No RETURNING: the read policy would mask the write by failing the response, not the update.
    await a.client.from("rights_records").update({ artifact_id: bArtifact }).eq("id", rightsId);
    const row = expectOk(await admin.from("rights_records").select("artifact_id").eq("id", rightsId).single());
    expect(row.artifact_id).toBe(artifactId);
  });
});

describe("rights lifecycle", () => {
  it("the owner can delete a license (history keeps a delete event)", async () => {
    const art = await createArtifact(a, { title: "License delete" });
    const rid = expectOk(
      await a.client
        .from("rights_records")
        .insert({ artifact_id: art, creator_id: a.creatorId, copyright_holder: "A" })
        .select("id")
        .single(),
    ).id;
    const lid = expectOk(
      await a.client.from("licenses").insert({ rights_id: rid, creator_id: a.creatorId, license_type: "personal" }).select("id").single(),
    ).id;
    expect(expectOk(await a.client.from("licenses").delete().eq("id", lid).select("id"))).toHaveLength(1);
    expect(await eventsFor(rid)).toContain("license.deleted");
  });

  it("the owner can delete an artifact that has rights, licenses and owners", async () => {
    const art = await createArtifact(a, { title: "Cascade delete" });
    const rid = expectOk(
      await a.client
        .from("rights_records")
        .insert({ artifact_id: art, creator_id: a.creatorId, copyright_holder: "A" })
        .select("id")
        .single(),
    ).id;
    expectOk(await a.client.from("licenses").insert({ rights_id: rid, creator_id: a.creatorId, license_type: "personal" }));
    expectOk(
      await a.client.from("rights_owners").insert({ rights_id: rid, creator_id: a.creatorId, owner_name: "A", share_percent: 100 }),
    );
    const res = await a.client.from("artifacts").delete().eq("id", art).select("id");
    expect(expectOk(res)).toHaveLength(1);
    expect(expectOk(await admin.from("rights_records").select("id").eq("id", rid))).toHaveLength(0);
  });
});

describe("account deletion", () => {
  it("deleting a creator's account removes all of their data, including rights history", async () => {
    const x = await createTestCreator("deleteMe");
    const y = await createTestCreator("deleteMeFriend");
    const art = await createArtifact(x, { title: "Doomed" });
    await createVersion(x, art, "one");
    await createVersion(x, art, "two");
    const rid = expectOk(
      await x.client
        .from("rights_records")
        .insert({ artifact_id: art, creator_id: x.creatorId, copyright_holder: "X" })
        .select("id")
        .single(),
    ).id;
    expectOk(await x.client.from("licenses").insert({ rights_id: rid, creator_id: x.creatorId, license_type: "personal" }));
    expectOk(
      await x.client.from("rights_owners").insert({ rights_id: rid, creator_id: x.creatorId, owner_name: "X", share_percent: 100 }),
    );
    const run = expectOk(
      await x.client.from("ai_runs").insert({ creator_id: x.creatorId, intent: "x", provider: "x", model: "x" }).select("id").single(),
    ).id;
    expectOk(
      await x.client.rpc("create_artifact_version", { p_artifact_id: art, p_content: "ai", p_label: "AI", p_author_kind: "ai", p_ai_run_id: run }),
    );
    await createMaterial(x, "doomed material");
    // Shared huddle history with another creator.
    const h = expectOk(await x.client.rpc("huddle_start", { p_topic: "bye" }));
    const req = expectOk(await y.client.rpc("huddle_request_join", { p_huddle: h }));
    expectOk(await x.client.rpc("huddle_resolve_request", { p_request: req, p_approve: true }));
    expectOk(await y.client.rpc("huddle_enter", { p_huddle: h }));
    expectOk(await x.client.rpc("huddle_end", { p_huddle: h }));

    const { error } = await admin.auth.admin.deleteUser(x.userId);
    expect(error).toBeNull();
    expect(expectOk(await admin.from("creators").select("id").eq("id", x.creatorId))).toHaveLength(0);
    expect(expectOk(await admin.from("artifacts").select("id").eq("id", art))).toHaveLength(0);
    expect(expectOk(await admin.from("rights_records").select("id").eq("id", rid))).toHaveLength(0);
  });

  it("deleting a creator's account does not leave their personal tenant behind", async () => {
    // The personal tenant is named after the user's display name / email local part (PII).
    const x = await createTestCreator("orphanTenant");
    const { error } = await admin.auth.admin.deleteUser(x.userId);
    expect(error).toBeNull();
    expect(expectOk(await admin.from("tenants").select("id").eq("id", x.tenantId))).toHaveLength(0);
  });
});
