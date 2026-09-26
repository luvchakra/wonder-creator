import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  cleanupTestCreators,
  createArtifact,
  createMaterial,
  createProvenance,
  createTestCreator,
  createVersion,
  expectDenied,
  expectNoRowsAffected,
  expectOk,
  fakeSha,
  loose,
  registerStorageObject,
  type TestCreator,
} from "./helpers";

const admin = adminClient();
let a: TestCreator;
let b: TestCreator;

// A's rows
const A: Record<string, string> = {};
// B's own rows (used as otherwise-valid references when tampering)
const B: Record<string, string> = {};

async function seedCreator(c: TestCreator, into: Record<string, string>) {
  const db = c.client;
  const me = c.creatorId;
  into.provenance = await createProvenance(c);
  into.material = await createMaterial(c, "material");
  // storage_objects, intake_items and jobs are server-managed: seed them with the secret key.
  into.storageObject = await registerStorageObject(c);
  into.intake = expectOk(
    await admin
      .from("intake_items")
      .insert({ creator_id: me, batch_id: randomUUID(), input_kind: "text", instruction: "private instruction" })
      .select("id")
      .single(),
  ).id;
  into.conversation = expectOk(
    await db.from("conversations").insert({ creator_id: me, title: "private chat" }).select("id").single(),
  ).id;
  into.message = expectOk(
    await db
      .from("conversation_messages")
      .insert({ creator_id: me, conversation_id: into.conversation, role: "creator", content: "private message" })
      .select("id")
      .single(),
  ).id;
  into.memory = expectOk(
    await db
      .from("creative_memories")
      .insert({ creator_id: me, category: "creative_fact", statement: "private memory", source_kind: "creator" })
      .select("id")
      .single(),
  ).id;
  into.aiRun = expectOk(
    await db
      .from("ai_runs")
      .insert({ creator_id: me, intent: "write", provider: "test", model: "test-model" })
      .select("id")
      .single(),
  ).id;
  into.artifact = await createArtifact(c, { title: "private artifact" });
  into.version = (await createVersion(c, into.artifact, "private content")).id;
  into.shelf = expectOk(
    await db.from("reference_shelves").insert({ creator_id: me, name: "shelf" }).select("id").single(),
  ).id;
  into.referenceItem = expectOk(
    await db
      .from("reference_items")
      .insert({ creator_id: me, shelf_id: into.shelf, material_id: into.material, note: "private note" })
      .select("id")
      .single(),
  ).id;
  into.job = expectOk(
    await admin.from("jobs").insert({ creator_id: me, kind: "test.job", payload: { secret: true } }).select("id").single(),
  ).id;
  into.collection = expectOk(
    await db.from("material_collections").insert({ creator_id: me, name: "collection" }).select("id").single(),
  ).id;
  expectOk(
    await db
      .from("material_collection_items")
      .insert({ collection_id: into.collection, material_id: into.material, creator_id: me }),
  );
  expectOk(await db.from("creative_material_tags").insert({ material_id: into.material, creator_id: me, tag: "mine" }));
}

beforeAll(async () => {
  [a, b] = await Promise.all([createTestCreator("isoA"), createTestCreator("isoB")]);
  await Promise.all([seedCreator(a, A), seedCreator(b, B)]);
});
afterAll(cleanupTestCreators);

interface TableSpec {
  table: string;
  key: string; // key into A
  column: string; // a text column to tamper with
}

const tables: TableSpec[] = [
  { table: "creative_materials", key: "material", column: "title" },
  { table: "provenance_records", key: "provenance", column: "source_url" },
  { table: "intake_items", key: "intake", column: "instruction" },
  { table: "conversations", key: "conversation", column: "title" },
  { table: "conversation_messages", key: "message", column: "content" },
  { table: "creative_memories", key: "memory", column: "statement" },
  { table: "ai_runs", key: "aiRun", column: "model" },
  { table: "artifacts", key: "artifact", column: "title" },
  { table: "artifact_versions", key: "version", column: "label" },
  { table: "reference_shelves", key: "shelf", column: "name" },
  { table: "reference_items", key: "referenceItem", column: "note" },
  { table: "storage_objects", key: "storageObject", column: "original_filename" },
  { table: "jobs", key: "job", column: "kind" },
  { table: "material_collections", key: "collection", column: "name" },
];

describe.each(tables)("cross-creator isolation: $table", ({ table, key, column }) => {
  it("B cannot read A's row", async () => {
    const rows = expectOk(await loose(b.client).from(table).select("id").eq("id", A[key]));
    expect(rows).toHaveLength(0);
  });

  it("A can read A's row (sanity)", async () => {
    const rows = expectOk(await loose(a.client).from(table).select("id").eq("id", A[key]));
    expect(rows).toHaveLength(1);
  });

  it("B cannot update A's row", async () => {
    expectNoRowsAffected(
      await loose(b.client).from(table).update({ [column]: "tampered" }).eq("id", A[key]).select("id"),
    );
    const row = expectOk(await loose(admin).from(table).select(column).eq("id", A[key]).single()) as unknown as Record<
      string,
      unknown
    >;
    expect(row[column]).not.toBe("tampered");
  });

  it("B cannot delete A's row", async () => {
    expectNoRowsAffected(await loose(b.client).from(table).delete().eq("id", A[key]).select("id"));
    const rows = expectOk(await loose(admin).from(table).select("id").eq("id", A[key]));
    expect(rows).toHaveLength(1);
  });
});

describe("cross-creator isolation: link tables", () => {
  it("B cannot read A's tags or collection items", async () => {
    expect(
      expectOk(await b.client.from("creative_material_tags").select("tag").eq("material_id", A.material)),
    ).toHaveLength(0);
    expect(
      expectOk(await b.client.from("material_collection_items").select("material_id").eq("collection_id", A.collection)),
    ).toHaveLength(0);
  });

  it("B cannot delete A's tags or collection items", async () => {
    expectNoRowsAffected(await b.client.from("creative_material_tags").delete().eq("material_id", A.material).select());
    expectNoRowsAffected(
      await b.client.from("material_collection_items").delete().eq("collection_id", A.collection).select(),
    );
    expect(expectOk(await admin.from("creative_material_tags").select("tag").eq("material_id", A.material))).toHaveLength(1);
    expect(
      expectOk(await admin.from("material_collection_items").select("material_id").eq("collection_id", A.collection)),
    ).toHaveLength(1);
  });
});

describe("ID tampering: B cannot insert rows owned by A", () => {
  const cases: Array<[string, () => Record<string, unknown>]> = [
    ["provenance_records", () => ({ creator_id: a.creatorId, origin: "typed" })],
    [
      "creative_materials",
      () => ({ creator_id: a.creatorId, type: "note", title: "forged", provenance_id: B.provenance }),
    ],
    ["intake_items", () => ({ creator_id: a.creatorId, batch_id: randomUUID(), input_kind: "text" })],
    ["conversations", () => ({ creator_id: a.creatorId, title: "forged" })],
    [
      "conversation_messages",
      () => ({ creator_id: a.creatorId, conversation_id: A.conversation, role: "brain", content: "forged" }),
    ],
    [
      "creative_memories",
      () => ({ creator_id: a.creatorId, category: "creative_fact", statement: "forged", source_kind: "creator" }),
    ],
    ["ai_runs", () => ({ creator_id: a.creatorId, intent: "x", provider: "x", model: "x" })],
    [
      "artifacts",
      () => ({ creator_id: a.creatorId, artifact_type: "poem", category: "writing", title: "forged", provenance_id: B.provenance }),
    ],
    [
      "artifact_versions",
      () => ({ creator_id: a.creatorId, artifact_id: A.artifact, version_number: 99, author_kind: "creator" }),
    ],
    ["reference_shelves", () => ({ creator_id: a.creatorId, name: "forged" })],
    ["reference_items", () => ({ creator_id: a.creatorId, material_id: A.material })],
    [
      "storage_objects",
      () => ({
        creator_id: a.creatorId,
        bucket: "creator-media",
        path: `${a.creatorId}/${randomUUID()}`,
        mime_type: "text/plain",
        size_bytes: 1,
        sha256: fakeSha(),
      }),
    ],
    ["jobs", () => ({ creator_id: a.creatorId, kind: "forged" })],
    ["material_collections", () => ({ creator_id: a.creatorId, name: "forged" })],
    ["creative_material_tags", () => ({ creator_id: a.creatorId, material_id: A.material, tag: "forged" })],
  ];

  it.each(cases)("%s", async (table, row) => {
    expectDenied(await loose(b.client).from(table).insert(row()), "42501");
  });
});

describe("B cannot link A's material into B's structures", () => {
  it("collection item pointing at A's material", async () => {
    expectDenied(
      await b.client
        .from("material_collection_items")
        .insert({ collection_id: B.collection, material_id: A.material, creator_id: b.creatorId }),
      "42501",
    );
  });

  it("collection item in A's collection", async () => {
    expectDenied(
      await b.client
        .from("material_collection_items")
        .insert({ collection_id: A.collection, material_id: B.material, creator_id: b.creatorId }),
      "42501",
    );
  });

  it("reference item pointing at A's material", async () => {
    expectDenied(
      await b.client.from("reference_items").insert({ creator_id: b.creatorId, shelf_id: B.shelf, material_id: A.material }),
      "42501",
    );
  });

  it("reference item on A's shelf", async () => {
    expectDenied(
      await b.client.from("reference_items").insert({ creator_id: b.creatorId, shelf_id: A.shelf, material_id: B.material }),
      "42501",
    );
  });

  it("tag on A's material", async () => {
    expectDenied(
      await b.client.from("creative_material_tags").insert({ creator_id: b.creatorId, material_id: A.material, tag: "x" }),
      "42501",
    );
  });

  it("lineage edge with A's material as source", async () => {
    expectDenied(
      await b.client.from("lineage_edges").insert({
        creator_id: b.creatorId,
        source_type: "material",
        source_id: A.material,
        target_type: "artifact",
        target_id: B.artifact,
        relationship: "created_from",
      }),
      "42501",
    );
  });

  it("lineage edge with A's material or A's private artifact as target", async () => {
    expectDenied(
      await b.client.from("lineage_edges").insert({
        creator_id: b.creatorId,
        source_type: "material",
        source_id: B.material,
        target_type: "material",
        target_id: A.material,
        relationship: "inspired_by",
      }),
      "42501",
    );
    expectDenied(
      await b.client.from("lineage_edges").insert({
        creator_id: b.creatorId,
        source_type: "artifact",
        source_id: A.artifact,
        target_type: "artifact",
        target_id: B.artifact,
        relationship: "derived_from",
      }),
      "42501",
    );
  });

  it("conversation message in A's conversation", async () => {
    expectDenied(
      await b.client
        .from("conversation_messages")
        .insert({ creator_id: b.creatorId, conversation_id: A.conversation, role: "creator", content: "intrude" }),
      "42501",
    );
  });

  it("conversation attachment of A's material or A's private artifact", async () => {
    expectDenied(
      await b.client.from("conversation_attachments").insert({ creator_id: b.creatorId, message_id: B.message, material_id: A.material }),
      "42501",
    );
    expectDenied(
      await b.client.from("conversation_attachments").insert({ creator_id: b.creatorId, message_id: B.message, artifact_id: A.artifact }),
      "42501",
    );
  });

  it("owner can do all of the above with their own rows (sanity)", async () => {
    expectOk(
      await b.client.from("lineage_edges").insert({
        creator_id: b.creatorId,
        source_type: "material",
        source_id: B.material,
        target_type: "artifact",
        target_id: B.artifact,
        relationship: "created_from",
      }),
    );
    expectOk(
      await b.client.from("conversation_attachments").insert({ creator_id: b.creatorId, message_id: B.message, material_id: B.material }),
    );
  });
});

// Regression: foreign references on a creator's own rows must point at rows that creator owns.
describe("foreign references must belong to the caller", () => {
  const artifactRow = (overrides: Record<string, unknown>) => ({
    creator_id: b.creatorId,
    artifact_type: "poem",
    category: "writing",
    title: "tampered",
    provenance_id: B.provenance,
    ...overrides,
  });

  it("B cannot attach A's storage object to B's material", async () => {
    expectDenied(
      await b.client.from("creative_materials").insert({
        creator_id: b.creatorId,
        type: "image",
        provenance_id: B.provenance,
        storage_object_id: A.storageObject,
      }),
      "42501",
    );
  });

  it("B cannot use A's provenance record for B's material", async () => {
    expectDenied(
      await b.client.from("creative_materials").insert({ creator_id: b.creatorId, type: "note", provenance_id: A.provenance }),
      "42501",
    );
  });

  it("B cannot re-point B's material at A's provenance record", async () => {
    await b.client.from("creative_materials").update({ provenance_id: A.provenance }).eq("id", B.material);
    const row = expectOk(await admin.from("creative_materials").select("provenance_id").eq("id", B.material).single());
    expect(row.provenance_id).not.toBe(A.provenance);
  });

  it("B can attach B's own storage object to B's material (sanity)", async () => {
    expectOk(
      await b.client.from("creative_materials").insert({
        creator_id: b.creatorId,
        type: "image",
        provenance_id: B.provenance,
        storage_object_id: B.storageObject,
      }),
    );
  });

  it("B cannot use A's provenance record for B's artifact", async () => {
    expectDenied(await b.client.from("artifacts").insert(artifactRow({ provenance_id: A.provenance })), "42501");
  });

  it("B cannot use A's material as cover for B's artifact", async () => {
    expectDenied(await b.client.from("artifacts").insert(artifactRow({ cover_material_id: A.material })), "42501");
  });

  it("B cannot create an artifact with a preset current_version_id", async () => {
    expectDenied(await b.client.from("artifacts").insert(artifactRow({ current_version_id: A.version })), "42501");
  });

  it("B cannot update B's artifact to use A's cover material, provenance or version", async () => {
    for (const patch of [{ cover_material_id: A.material }, { provenance_id: A.provenance }, { current_version_id: A.version }]) {
      await b.client.from("artifacts").update(patch).eq("id", B.artifact);
    }
    const row = expectOk(
      await admin.from("artifacts").select("cover_material_id, provenance_id, current_version_id").eq("id", B.artifact).single(),
    );
    expect(row.cover_material_id).toBeNull();
    expect(row.provenance_id).not.toBe(A.provenance);
    expect(row.current_version_id).toBe(B.version);
  });

  it("B cannot tag a message of B's with A's AI run", async () => {
    expectDenied(
      await b.client.from("conversation_messages").insert({
        creator_id: b.creatorId,
        conversation_id: B.conversation,
        role: "brain",
        content: "x",
        ai_run_id: A.aiRun,
      }),
      "42501",
    );
  });

  it("B cannot link B's AI run to A's conversation or A's artifact", async () => {
    expectDenied(
      await b.client
        .from("ai_runs")
        .insert({ creator_id: b.creatorId, intent: "x", provider: "x", model: "x", conversation_id: A.conversation }),
      "42501",
    );
    expectDenied(
      await b.client
        .from("ai_runs")
        .insert({ creator_id: b.creatorId, intent: "x", provider: "x", model: "x", artifact_id: A.artifact }),
      "42501",
    );
  });

  it("B cannot attach steps or tool calls to A's AI run", async () => {
    expectDenied(await b.client.from("ai_run_steps").insert({ creator_id: b.creatorId, run_id: A.aiRun, step: "generate" }), "42501");
    expectDenied(
      await b.client.from("ai_tool_calls").insert({
        creator_id: b.creatorId,
        run_id: A.aiRun,
        tool: "x",
        autonomy_domain: "research",
        decision: "allowed",
      }),
      "42501",
    );
  });

  it("B cannot attach proposals to A's AI run or A's conversation", async () => {
    const proposal = { creator_id: b.creatorId, domain: "publishing" as const, action: "x", understood: "x", plan: "x", impact: "x" };
    expectDenied(await b.client.from("ai_proposals").insert({ ...proposal, run_id: A.aiRun }), "42501");
    expectDenied(await b.client.from("ai_proposals").insert({ ...proposal, conversation_id: A.conversation }), "42501");
  });

  it("B cannot attach feedback to A's memory", async () => {
    expectDenied(
      await b.client.from("creative_memory_feedback").insert({ creator_id: b.creatorId, memory_id: A.memory, kind: "remove" }),
      "42501",
    );
  });

  it("owned references still work (sanity)", async () => {
    expectOk(await b.client.from("ai_run_steps").insert({ creator_id: b.creatorId, run_id: B.aiRun, step: "plan" }));
    expectOk(await b.client.from("creative_memory_feedback").insert({ creator_id: b.creatorId, memory_id: B.memory, kind: "confirm" }));
    expectOk(
      await b.client.from("conversation_messages").insert({
        creator_id: b.creatorId,
        conversation_id: B.conversation,
        role: "brain",
        content: "ok",
        ai_run_id: B.aiRun,
      }),
    );
  });

  // Found after the hardening migration: these references are still unchecked.
  it("B cannot attach an attachment to A's conversation message", async () => {
    expectDenied(
      await b.client
        .from("conversation_attachments")
        .insert({ creator_id: b.creatorId, message_id: A.message, material_id: B.material }),
    );
  });

  it("B cannot use A's storage object as B's avatar", async () => {
    await b.client.from("creators").update({ avatar_object_id: A.storageObject }).eq("id", b.creatorId);
    const row = expectOk(await admin.from("creators").select("avatar_object_id").eq("id", b.creatorId).single());
    expect(row.avatar_object_id).not.toBe(A.storageObject);
  });

  it("B cannot file a quality report for B's artifact against A's version", async () => {
    expectDenied(
      await b.client
        .from("quality_reports")
        .insert({ creator_id: b.creatorId, artifact_id: B.artifact, version_id: A.version }),
    );
  });
});

describe("server-managed tables", () => {
  const storageRow = (creatorId: string) => ({
    creator_id: creatorId,
    bucket: "creator-media",
    path: `${creatorId}/${randomUUID()}`,
    mime_type: "text/plain",
    size_bytes: 1,
    sha256: fakeSha(),
  });

  it("clients cannot register storage objects, even their own", async () => {
    expectDenied(await b.client.from("storage_objects").insert(storageRow(b.creatorId)), "42501");
  });

  it("clients cannot update their own storage objects (e.g. mark them clean)", async () => {
    expectNoRowsAffected(
      await b.client.from("storage_objects").update({ security_status: "clean" }).eq("id", B.storageObject).select(),
    );
    const row = expectOk(await admin.from("storage_objects").select("security_status").eq("id", B.storageObject).single());
    expect(row.security_status).toBe("pending");
  });

  it("the server cannot register a path outside the owner's folder", async () => {
    expectDenied(await admin.from("storage_objects").insert({ ...storageRow(b.creatorId), path: `${a.creatorId}/${randomUUID()}` }), "23514");
    expectDenied(await admin.from("storage_objects").insert({ ...storageRow(b.creatorId), path: `loose-${randomUUID()}` }), "23514");
  });

  it("clients can read and delete their own storage objects", async () => {
    const id = await registerStorageObject(b);
    expect(expectOk(await b.client.from("storage_objects").select("id").eq("id", id))).toHaveLength(1);
    expect(expectOk(await b.client.from("storage_objects").delete().eq("id", id).select("id"))).toHaveLength(1);
  });

  it("clients cannot insert or update intake items", async () => {
    expectDenied(
      await b.client.from("intake_items").insert({ creator_id: b.creatorId, batch_id: randomUUID(), input_kind: "text" }),
      "42501",
    );
    expectNoRowsAffected(await b.client.from("intake_items").update({ state: "ready" }).eq("id", B.intake).select());
    const row = expectOk(await admin.from("intake_items").select("state").eq("id", B.intake).single());
    expect(row.state).toBe("received");
  });

  it("clients cannot insert or update jobs", async () => {
    expectDenied(await b.client.from("jobs").insert({ creator_id: b.creatorId, kind: "forged" }), "42501");
    expectNoRowsAffected(await b.client.from("jobs").update({ status: "succeeded" }).eq("id", B.job).select());
    const row = expectOk(await admin.from("jobs").select("status").eq("id", B.job).single());
    expect(row.status).toBe("pending");
  });

  it("clients can read their own intake items and jobs", async () => {
    expect(expectOk(await b.client.from("intake_items").select("id").eq("id", B.intake))).toHaveLength(1);
    expect(expectOk(await b.client.from("jobs").select("id").eq("id", B.job))).toHaveLength(1);
  });
});
