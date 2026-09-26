import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanupTestCreators, createTestCreator, expectDenied, expectOk, loose, type TestCreator } from "./helpers";

const admin = adminClient();
let a: TestCreator;

beforeAll(async () => {
  a = await createTestCreator("rateLimits");
});
afterAll(cleanupTestCreators);

describe("shared rate limits", () => {
  it("counts hits per key within a window and refuses past the limit", async () => {
    const key = `test:${randomUUID()}`;
    const hit = async () => expectOk(await admin.rpc("rate_limit_hit", { p_key: key, p_limit: 2, p_window_seconds: 3600 }));
    expect(await hit()).toBe(true);
    expect(await hit()).toBe(true);
    expect(await hit()).toBe(false);
    // Other keys are independent.
    expect(expectOk(await admin.rpc("rate_limit_hit", { p_key: `${key}:other`, p_limit: 2, p_window_seconds: 3600 }))).toBe(true);
  });

  it("rejects nonsensical limits", async () => {
    expectDenied(await admin.rpc("rate_limit_hit", { p_key: "k", p_limit: 0, p_window_seconds: 60 }));
    expectDenied(await admin.rpc("rate_limit_hit", { p_key: "k", p_limit: 5, p_window_seconds: 0 }));
  });

  it("cannot be called by signed-in creators or anonymous callers (they can't spend someone else's limit)", async () => {
    const args = { p_key: `victim:${randomUUID()}`, p_limit: 1, p_window_seconds: 60 };
    expectDenied(await a.client.rpc("rate_limit_hit", args));
    expectDenied(await anonClient().rpc("rate_limit_hit", args));
  });

  it("counters are not readable or writable through the API", async () => {
    const read = await loose(a.client).from("rate_limit_counters").select("*");
    expect(read.data ?? []).toEqual([]);
    expectDenied(await loose(a.client).from("rate_limit_counters").insert({ key: "x", window_start: new Date().toISOString() }));
    const anonRead = await loose(anonClient()).from("rate_limit_counters").select("*");
    expect(anonRead.data ?? []).toEqual([]);
  });
});
