import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, cleanupTestCreators, createTestCreator, expectOk, loose, type TestCreator } from "./helpers";

const admin = adminClient();
let a: TestCreator;
let b: TestCreator;
const SECRET = "sk-ant-test-0123456789abcd";

beforeAll(async () => {
  [a, b] = await Promise.all([createTestCreator("byokA"), createTestCreator("byokB")]);
});
afterAll(cleanupTestCreators);

describe("BYOK key storage", () => {
  it("only the server (service role) can store or read secrets", async () => {
    for (const fn of ["byok_store", "byok_secret", "byok_remove", "byok_update"] as const) {
      const res = await loose(a.client).rpc(fn, { p_creator: a.creatorId, p_provider: "anthropic", p_secret: SECRET, p_hint: "abcd", p_status: "valid", p_models: [] });
      expect(res.error, fn).not.toBeNull();
    }
    expect((await loose(a.client).from("creator_ai_keys").insert({ creator_id: a.creatorId, provider: "anthropic", vault_secret_id: a.creatorId, hint: "x", status: "valid" })).error).not.toBeNull();
  });

  it("stores the secret encrypted; creators see only a hint and status", async () => {
    const stored = expectOk(await admin.rpc("byok_store", { p_creator: a.creatorId, p_provider: "anthropic", p_secret: SECRET, p_hint: "abcd", p_status: "valid", p_models: ["claude-a", "claude-b"] }));
    expect(stored).toMatchObject({ provider: "anthropic", hint: "abcd", status: "valid", use_for_brain: true });
    const mine = expectOk(await a.client.from("creator_ai_keys").select("*"));
    expect(JSON.stringify(mine)).not.toContain(SECRET);
    expect(expectOk(await b.client.from("creator_ai_keys").select("*"))).toEqual([]);
    expect(expectOk(await admin.rpc("byok_secret", { p_creator: a.creatorId, p_provider: "anthropic" }))).toBe(SECRET);
  });

  it("rotates in place, keeps preferences valid, and removes the secret for good", async () => {
    expectOk(await admin.rpc("byok_update", { p_creator: a.creatorId, p_provider: "anthropic", p_default_model: "claude-b" }));
    await expect(Promise.resolve(admin.rpc("byok_update", { p_creator: a.creatorId, p_provider: "anthropic", p_default_model: "not-a-model" })).then((r) => r.error?.code)).resolves.toBe("22023");
    const rotated = expectOk(await admin.rpc("byok_store", { p_creator: a.creatorId, p_provider: "anthropic", p_secret: "sk-ant-new-9999999999wxyz", p_hint: "wxyz", p_status: "valid", p_models: ["claude-b"] }));
    expect(rotated).toMatchObject({ hint: "wxyz", default_model: "claude-b" });
    expect(rotated.rotated_at).toBeTruthy();
    expect(expectOk(await admin.rpc("byok_secret", { p_creator: a.creatorId, p_provider: "anthropic" }))).toBe("sk-ant-new-9999999999wxyz");
    expectOk(await admin.rpc("byok_remove", { p_creator: a.creatorId, p_provider: "anthropic" }));
    expect((await admin.rpc("byok_secret", { p_creator: a.creatorId, p_provider: "anthropic" })).data).toBeNull();
    expect(expectOk(await a.client.from("creator_ai_keys").select("provider"))).toEqual([]);
  });

  it("the key's lifecycle is in the creator's audit log, without the secret", async () => {
    const rows = expectOk(await a.client.from("audit_logs").select("action, metadata").eq("object_type", "ai_provider"));
    expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(["ai_key.connected", "ai_key.preferences", "ai_key.rotated", "ai_key.removed"]));
    expect(JSON.stringify(rows)).not.toMatch(/sk-ant/);
  });
});
