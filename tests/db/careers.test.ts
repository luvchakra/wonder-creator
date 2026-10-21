import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, cleanupTestCreators, createTestCreator, expectOk, loose, type TestCreator } from "./helpers";

const admin = adminClient();
let a: TestCreator;
// A made-up key: repeated characters, so it reads (and scans) as a fixture, not a secret.
const KEY = `wjcs_${"x".repeat(16)}abcd`;

beforeAll(async () => {
  a = await createTestCreator("careersA");
});
afterAll(async () => {
  await admin.rpc("careers_key_clear", { p_creator: a.creatorId });
  await cleanupTestCreators();
});

describe("WonderJobs career-site key", () => {
  it("only the server (service role) can store, read or clear it, and nobody signed in can see the row", async () => {
    for (const fn of ["careers_key_store", "careers_key_secret", "careers_key_clear"] as const) {
      const res = await loose(a.client).rpc(fn, { p_creator: a.creatorId, p_secret: KEY, p_hint: "abcd" });
      expect(res.error, fn).not.toBeNull();
    }
    expect((await loose(a.client).from("careers_connection").insert({ vault_secret_id: a.creatorId, hint: "x" })).error).not.toBeNull();
    expect((await loose(a.client).from("careers_connection").select("*")).data ?? []).toEqual([]);
  });

  it("keeps the key encrypted in Vault, only the last four beside it, and audits who saved it", async () => {
    const saved = expectOk(await admin.rpc("careers_key_store", { p_creator: a.creatorId, p_secret: KEY, p_hint: "abcd" }));
    expect(saved[0]).toMatchObject({ hint: "abcd" });
    const row = expectOk(await admin.from("careers_connection").select("*"));
    expect(JSON.stringify(row)).not.toContain(KEY);
    expect(expectOk(await admin.rpc("careers_key_secret"))).toBe(KEY);
    const audit = expectOk(await admin.from("audit_logs").select("action, actor_creator_id, metadata").eq("actor_creator_id", a.creatorId).eq("action", "admin.careers_key_saved"));
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit)).not.toContain(KEY);
    expect(audit[0]!.metadata).toMatchObject({ last4: "abcd" });
  });

  it("refuses anything that isn't a career-site key", async () => {
    expect((await admin.rpc("careers_key_store", { p_creator: a.creatorId, p_secret: "sk-not-a-wonderjobs-key", p_hint: "-key" })).error?.code).toBe("22023");
  });

  it("clears the key and its secret, and audits that too", async () => {
    expectOk(await admin.rpc("careers_key_clear", { p_creator: a.creatorId }));
    expect((await admin.rpc("careers_key_secret")).data).toBeNull();
    const audit = expectOk(await admin.from("audit_logs").select("action").eq("actor_creator_id", a.creatorId).eq("action", "admin.careers_key_cleared"));
    expect(audit).toHaveLength(1);
  });
});
