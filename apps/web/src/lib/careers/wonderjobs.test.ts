import { beforeEach, describe, expect, it, vi } from "vitest";

/** The key setting, with the database and WonderJobs mocked: never a real call. */
const state: { secret: string | null; hint: string | null; calls: Array<[string, unknown]> } = { secret: null, hint: null, calls: [] };
vi.mock("@/lib/supabase/service", () => ({
  serviceConfigured: () => true,
  serviceClient: () => ({
    rpc: async (fn: string, args: Record<string, string>) => {
      state.calls.push([fn, args]);
      if (fn === "careers_key_store") {
        state.secret = args.p_secret!;
        state.hint = args.p_hint!;
        return { data: [{ hint: args.p_hint, updated_at: "2026-10-21T10:00:00Z" }], error: null };
      }
      if (fn === "careers_key_clear") {
        state.secret = state.hint = null;
        return { data: null, error: null };
      }
      if (fn === "careers_key_secret") return { data: state.secret, error: null };
      return { data: null, error: { code: "x" } };
    },
    from: () => ({ select: () => ({ maybeSingle: async () => ({ data: state.hint ? { hint: state.hint, updated_at: "2026-10-21T10:00:00Z" } : null, error: null }) }) }),
  }),
}));

// Made-up fixtures: repeated characters, so they read (and scan) as fixtures, not secrets.
const KEY = `wjcs_${"x".repeat(16)}abcd`;

beforeEach(() => {
  state.secret = state.hint = null;
  state.calls = [];
  vi.unstubAllGlobals();
  delete process.env.WONDERJOBS_CAREERS_KEY;
});

describe("the career-site key setting", () => {
  it("stores the key through the encrypted store with only the last four as its hint, and shows only a mask", async () => {
    const m = await import("./wonderjobs");
    expect(await m.saveCareersKey("creator-1", `  ${KEY} `)).toEqual({ ok: true });
    expect(state.calls[0]).toEqual(["careers_key_store", { p_creator: "creator-1", p_secret: KEY, p_hint: "abcd" }]);
    const view = await m.careersKeyView();
    expect(view).toEqual({ configured: true, source: "database", masked: "wjcs_••••••••abcd", updatedAt: "2026-10-21T10:00:00Z" });
    expect(JSON.stringify(view)).not.toContain(KEY);
  });

  it("refuses anything that isn't a career-site key, without storing it", async () => {
    const m = await import("./wonderjobs");
    expect((await m.saveCareersKey("creator-1", "sk-something-else")).ok).toBe(false);
    expect(state.calls).toEqual([]);
  });

  it("clears the key; the environment key is only a fallback", async () => {
    const m = await import("./wonderjobs");
    await m.saveCareersKey("creator-1", KEY);
    process.env.WONDERJOBS_CAREERS_KEY = `wjcs_${"e".repeat(16)}wxyz`;
    expect((await m.careersKeyView()).source).toBe("database");
    await m.clearCareersKey("creator-1");
    expect(state.calls.at(-1)?.[0]).toBe("careers_key_clear");
    expect(await m.careersKeyView()).toMatchObject({ source: "environment", masked: "wjcs_••••••••wxyz" });
  });

  it("Test connection reports Connected with the count, Wrong key, or Unavailable", async () => {
    const m = await import("./wonderjobs");
    await m.saveCareersKey("creator-1", KEY);
    const reply = (status: number, body: unknown) => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
    reply(200, { site: { name: "Wonder careers", retentionMonths: 12 }, jobs: [{ id: "a" }, { id: "b" }] });
    expect(await m.testCareersConnection()).toEqual({ state: "connected", jobs: 2, site: "Wonder careers" });
    reply(401, { error: "bad key" });
    expect(await m.testCareersConnection()).toEqual({ state: "wrong_key" });
    reply(503, {});
    expect(await m.testCareersConnection()).toEqual({ state: "unavailable" });
  });
});
