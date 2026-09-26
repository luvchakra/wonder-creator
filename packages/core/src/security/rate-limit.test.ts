import { describe, expect, it } from "vitest";
import type { Db } from "@wonder/db";
import { createMemoryRateLimiter, createSharedRateLimiter } from "./rate-limit";

describe("memory rate limiter", () => {
  it("allows up to the limit then throws, and resets after the window", async () => {
    let t = 0;
    const rl = createMemoryRateLimiter(() => t);
    await rl.check("k", 2, 1000);
    await rl.check("k", 2, 1000);
    await expect(rl.check("k", 2, 1000)).rejects.toThrow(/little fast/);
    t = 1001;
    await expect(rl.check("k", 2, 1000)).resolves.toBeUndefined();
  });
});

describe("shared rate limiter", () => {
  const fakeDb = (reply: { data: boolean | null; error: { code: string } | null }, calls: unknown[] = []) =>
    ({ rpc: async (fn: string, args: unknown) => (calls.push([fn, args]), reply) }) as unknown as Db;

  it("asks the shared store with the key, limit and window in seconds", async () => {
    const calls: unknown[] = [];
    const rl = createSharedRateLimiter(() => fakeDb({ data: true, error: null }, calls));
    await rl.check("user:/api:POST", 60, 60_000);
    expect(calls).toEqual([["rate_limit_hit", { p_key: "user:/api:POST", p_limit: 60, p_window_seconds: 60 }]]);
  });

  it("rejects when the shared store says the window is spent", async () => {
    const rl = createSharedRateLimiter(() => fakeDb({ data: false, error: null }));
    await expect(rl.check("k", 60, 60_000)).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("rejects local bursts without a round trip", async () => {
    const calls: unknown[] = [];
    const rl = createSharedRateLimiter(() => fakeDb({ data: true, error: null }, calls));
    await rl.check("k", 1, 60_000);
    await expect(rl.check("k", 1, 60_000)).rejects.toMatchObject({ code: "rate_limited" });
    expect(calls).toHaveLength(1);
  });

  it("falls back to the local limit when the store errors or isn't configured", async () => {
    await expect(createSharedRateLimiter(() => fakeDb({ data: null, error: { code: "57P01" } })).check("k", 5, 60_000)).resolves.toBeUndefined();
    await expect(createSharedRateLimiter(() => null).check("k", 5, 60_000)).resolves.toBeUndefined();
  });
});
