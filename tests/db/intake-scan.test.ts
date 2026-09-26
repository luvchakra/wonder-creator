import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OfflineProvider } from "@wonder/creator-brain";
import { receiveFile } from "@wonder/creator-send";
import type { MalwareScanner } from "@wonder/core/server";
import type { Db as AppDb } from "@wonder/db";
import { randomUUID } from "node:crypto";
import { adminClient, cleanupTestCreators, createTestCreator, type TestCreator } from "./helpers";

const admin = adminClient();
let a: TestCreator;
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 0x1f, 0x15, 0xc4, 0x89, ...new Array(64).fill(0)]);

const scanner = (verdict: "clean" | "malicious" | "unknown"): MalwareScanner & { calls: number } => ({
  name: "stub",
  configured: true,
  calls: 0,
  async scan() {
    this.calls++;
    return { verdict, provider: "stub" };
  },
});

beforeAll(async () => {
  a = await createTestCreator("scan");
});
afterAll(cleanupTestCreators);

const deps = (s: MalwareScanner) => ({ db: a.client as unknown as AppDb, service: admin as unknown as AppDb, creatorId: a.creatorId, provider: new OfflineProvider(), scanner: s });

describe("intake malware check", () => {
  it("quarantines a known-malicious file and stores nothing", async () => {
    const s = scanner("malicious");
    const bytes = new Uint8Array([...png, ...new TextEncoder().encode(randomUUID())]);
    await expect(receiveFile(deps(s), { batchId: randomUUID(), bytes, filename: "bad.png" })).rejects.toMatchObject({ code: "security_rejected" });
    expect(s.calls).toBe(1);
    const { data: items } = await admin.from("intake_items").select("state, error_code, material_id, storage_object_id").eq("creator_id", a.creatorId);
    expect(items).toEqual([expect.objectContaining({ state: "quarantined", error_code: "security_rejected", material_id: null, storage_object_id: null })]);
    const { data: objects } = await admin.from("storage_objects").select("id").eq("creator_id", a.creatorId);
    expect(objects).toEqual([]);
  });

  it("keeps a clean file and records the scan on the material", async () => {
    const s = scanner("clean");
    const bytes = new Uint8Array([...png, ...new TextEncoder().encode(randomUUID())]);
    const item = await receiveFile(deps(s), { batchId: randomUUID(), bytes, filename: "good.png" });
    expect(item.state).toBe("extracting");
    const { data: m } = await admin.from("creative_materials").select("security_status, metadata").eq("id", item.material_id!).single();
    expect(m?.security_status).toBe("clean");
    expect((m?.metadata as { malwareScan?: unknown }).malwareScan).toEqual({ provider: "stub", verdict: "clean" });
  });
});
