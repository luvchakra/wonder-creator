import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  cleanupTestCreators,
  createProvenance,
  createTestCreator,
  expectOk,
  registerStorageObject,
  type TestCreator,
} from "./helpers";

const admin = adminClient();
let a: TestCreator;
let provenanceId: string;

beforeAll(async () => {
  a = await createTestCreator("pipeline");
  provenanceId = await createProvenance(a);
});
afterAll(cleanupTestCreators);

const pipelineColumns = "security_status, processing_state, storage_object_id, source_url, extracted_text";

async function insertMaterial(extra: Record<string, unknown>) {
  return expectOk(
    await a.client
      .from("creative_materials")
      .insert({ creator_id: a.creatorId, type: "note", title: "m", provenance_id: provenanceId, ...extra })
      .select(`id, ${pipelineColumns}`)
      .single(),
  );
}

describe("material pipeline state is server-controlled", () => {
  it("plain text is forced to clean/ready regardless of what the client sends", async () => {
    const row = await insertMaterial({ text_content: "hello", security_status: "quarantined", processing_state: "failed" });
    expect(row).toMatchObject({ security_status: "clean", processing_state: "ready" });
  });

  it("a material with a source_url starts pending/received even if the client claims clean", async () => {
    const row = await insertMaterial({
      type: "url",
      source_url: "https://example.com",
      security_status: "clean",
      processing_state: "ready",
    });
    expect(row).toMatchObject({ security_status: "pending", processing_state: "received" });
  });

  it("a material with a storage object starts pending/received even if the client claims clean", async () => {
    const storageId = await registerStorageObject(a);
    const row = await insertMaterial({
      type: "image",
      storage_object_id: storageId,
      security_status: "clean",
      processing_state: "understood",
    });
    expect(row).toMatchObject({ security_status: "pending", processing_state: "received", storage_object_id: storageId });
  });

  it("client updates cannot change pipeline columns (silently kept) but can change editable fields", async () => {
    const storageId = await registerStorageObject(a);
    const created = await insertMaterial({ type: "image", storage_object_id: storageId, source_url: "https://example.com/a" });
    const otherStorage = await registerStorageObject(a);
    const updated = expectOk(
      await a.client
        .from("creative_materials")
        .update({
          title: "renamed",
          security_status: "clean",
          processing_state: "ready",
          storage_object_id: otherStorage,
          source_url: "https://evil.example",
          extracted_text: "injected",
        })
        .eq("id", created.id)
        .select(`title, ${pipelineColumns}`)
        .single(),
    );
    expect(updated).toEqual({
      title: "renamed",
      security_status: "pending",
      processing_state: "received",
      storage_object_id: storageId,
      source_url: "https://example.com/a",
      extracted_text: null,
    });
  });

  it("clearing storage_object_id from the client is also ignored", async () => {
    const storageId = await registerStorageObject(a);
    const created = await insertMaterial({ type: "image", storage_object_id: storageId });
    await a.client.from("creative_materials").update({ storage_object_id: null }).eq("id", created.id);
    const row = expectOk(await admin.from("creative_materials").select("storage_object_id").eq("id", created.id).single());
    expect(row.storage_object_id).toBe(storageId);
  });

  it("the service role can advance the pipeline", async () => {
    const storageId = await registerStorageObject(a);
    const created = await insertMaterial({ type: "image", storage_object_id: storageId });
    const updated = expectOk(
      await admin
        .from("creative_materials")
        .update({ security_status: "clean", processing_state: "ready", extracted_text: "ocr text" })
        .eq("id", created.id)
        .select(pipelineColumns)
        .single(),
    );
    expect(updated).toMatchObject({ security_status: "clean", processing_state: "ready", extracted_text: "ocr text" });
  });

  it("the service role can insert with an explicit pipeline state", async () => {
    const row = expectOk(
      await admin
        .from("creative_materials")
        .insert({
          creator_id: a.creatorId,
          type: "note",
          provenance_id: provenanceId,
          security_status: "quarantined",
          processing_state: "quarantined",
        })
        .select("security_status, processing_state")
        .single(),
    );
    expect(row).toEqual({ security_status: "quarantined", processing_state: "quarantined" });
  });
});
