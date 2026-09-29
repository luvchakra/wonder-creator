import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, cleanupTestCreators, createMaterial, createTestCreator, expectDenied, expectNoRowsAffected, expectOk, loose, type TestCreator } from "./helpers";

// Phase 02 — Quick Capture receipts: server-written, so a retried capture lands exactly once.
const admin = adminClient();
let a: TestCreator;
let b: TestCreator;
const clientId = randomUUID();

beforeAll(async () => {
  [a, b] = await Promise.all([createTestCreator("capA"), createTestCreator("capB")]);
  const mat = await createMaterial(a, "Quick note");
  expectOk(await admin.from("capture_receipts").insert({ creator_id: a.creatorId, client_id: clientId, kind: "note", material_id: mat }));
});
afterAll(cleanupTestCreators);

describe("capture receipts", () => {
  it("one per capture id: a second claim is refused", async () => {
    expectDenied(await admin.from("capture_receipts").insert({ creator_id: a.creatorId, client_id: clientId, kind: "note" }), "23505");
  });
  it("the creator reads their own; nobody writes them from the browser", async () => {
    expect(expectOk(await a.client.from("capture_receipts").select("client_id").eq("client_id", clientId))).toHaveLength(1);
    expectDenied(await loose(a.client).from("capture_receipts").insert({ creator_id: a.creatorId, client_id: randomUUID(), kind: "note" }));
    expectNoRowsAffected(await loose(a.client).from("capture_receipts").delete().eq("client_id", clientId).select("client_id"));
  });
  it("another creator sees nothing", async () => {
    expect(expectOk(await b.client.from("capture_receipts").select("client_id").eq("client_id", clientId))).toEqual([]);
  });
});
