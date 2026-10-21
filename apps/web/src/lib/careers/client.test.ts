import { describe, expect, it, vi } from "vitest";
import { createWonderJobsClient, failureMessage, maskKey, wonderJobsBase, WONDERJOBS_BASE } from "./client";

// Made-up fixtures: repeated characters, so they read (and scan) as fixtures, not secrets.
const KEY = `wjcs_${"x".repeat(16)}wxyz`;
const json = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const job = { id: "j1", title: "Designer", location: "Pune", workMode: "hybrid", currency: "INR", description: "x", skills: [], company: "W", updatedAt: "2026-10-01T00:00:00Z" };

describe("WonderJobs client", () => {
  it("sends the key only as a Bearer header, to the fixed host, uncached", async () => {
    const f = vi.fn(async () => json(200, { site: { name: "S", retentionMonths: 12 }, jobs: [job] }));
    const r = await createWonderJobsClient({ key: KEY, fetch: f as unknown as typeof fetch }).listJobs();
    expect(r).toMatchObject({ ok: true, data: { site: { name: "S", retentionMonths: 12 }, jobs: [job] } });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${WONDERJOBS_BASE}/api/careers/v1/jobs`);
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${KEY}`);
    expect(init.cache).toBe("no-store");
    expect(url).not.toContain(KEY);
  });

  it("never puts the key in a message or a log, even when the request throws", async () => {
    const logs: unknown[] = [];
    const f = vi.fn(async () => {
      throw new Error(`boom ${KEY}`);
    });
    const r = await createWonderJobsClient({ key: KEY, fetch: f as unknown as typeof fetch, log: (e, x) => logs.push([e, x]) }).listJobs();
    expect(r).toEqual({ ok: false, kind: "unavailable" });
    expect(JSON.stringify(logs)).not.toContain(KEY);
    expect(failureMessage(r as never)).not.toContain(KEY);
  });

  it("gives up after the timeout", async () => {
    const f = vi.fn((_: string, init: RequestInit) => new Promise<Response>((_, reject) => init.signal!.addEventListener("abort", () => reject(new DOMException("timed out", "TimeoutError")))));
    const r = await createWonderJobsClient({ key: KEY, fetch: f as unknown as typeof fetch, timeoutMs: 20 }).getJob("j1");
    expect(r).toEqual({ ok: false, kind: "unavailable" });
  });

  it("retries a GET once after a network error or a 5xx, and never a POST", async () => {
    const flaky = vi.fn().mockResolvedValueOnce(json(503, {})).mockResolvedValueOnce(json(200, { job, site: { name: "S", retentionMonths: null } }));
    expect(await createWonderJobsClient({ key: KEY, fetch: flaky }).getJob("j1")).toMatchObject({ ok: true });
    expect(flaky).toHaveBeenCalledTimes(2);
    const post = vi.fn(async () => json(503, {}));
    const input = { name: "A", email: "a@b.co", resumeUrl: "https://x.example/cv", consent: true as const };
    expect(await createWonderJobsClient({ key: KEY, fetch: post as unknown as typeof fetch }).apply("j1", input)).toEqual({ ok: false, kind: "unavailable" });
    expect(post).toHaveBeenCalledTimes(1);
    const down = vi.fn(async () => {
      throw new TypeError("network");
    });
    await createWonderJobsClient({ key: KEY, fetch: down as unknown as typeof fetch }).apply("j1", input);
    expect(down).toHaveBeenCalledTimes(1);
  });

  it("maps 401, 404, 409, 400 and 429 to the right outcomes and words", async () => {
    const one = (res: Response) => createWonderJobsClient({ key: KEY, fetch: (async () => res) as unknown as typeof fetch });
    const input = { name: "A", email: "a@b.co", resumeUrl: "https://x.example/cv", consent: true as const };
    expect(await one(json(401, { error: "bad key" })).listJobs()).toEqual({ ok: false, kind: "unauthorized" });
    expect(await one(json(404, { error: "gone" })).getJob("j1")).toEqual({ ok: false, kind: "not_found" });
    const conflict = await one(json(409, { error: "You've already applied for this job." })).apply("j1", input);
    expect(conflict).toEqual({ ok: false, kind: "conflict", message: "You've already applied for this job." });
    expect(failureMessage(conflict as never)).toBe("You've already applied for this job.");
    expect(await one(json(400, { error: "Résumé link must be https." })).apply("j1", input)).toEqual({ ok: false, kind: "bad_request", message: "Résumé link must be https." });
    const busy = await one(json(429, { error: "slow down" }, { "retry-after": "30" })).apply("j1", input);
    expect(busy).toEqual({ ok: false, kind: "busy", retryAfter: 30 });
    expect(failureMessage(busy as never)).toMatch(/busy, try again shortly|try again shortly/i);
    expect(failureMessage({ ok: false, kind: "not_found" })).toBe("This position is no longer open.");
  });

  it("says it isn't set up when there's no key, without calling anyone", async () => {
    const f = vi.fn();
    expect(await createWonderJobsClient({ key: null, fetch: f }).listJobs()).toEqual({ ok: false, kind: "not_configured" });
    expect(f).not.toHaveBeenCalled();
  });

  it("sends the status token in the body, never in the URL it requests", async () => {
    const token = `wjst_${"t".repeat(20)}`;
    const f = vi.fn(async () => json(200, { application: { status: "reviewing", statusLabel: "In review", jobTitle: "D", company: "W", appliedAt: "x", updatedAt: "y", canWithdraw: true } }));
    const r = await createWonderJobsClient({ key: KEY, fetch: f as unknown as typeof fetch }).status(token, "view");
    expect(r).toMatchObject({ ok: true, data: { statusLabel: "In review" } });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${WONDERJOBS_BASE}/api/careers/v1/applications/status`);
    expect(url).not.toContain(token);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ token, action: "view" });
  });

  it("allows only an https *.wonderapps.biz host as an override", () => {
    expect(wonderJobsBase("https://staging.wonderapps.biz")).toBe("https://staging.wonderapps.biz");
    for (const bad of ["http://staging.wonderapps.biz", "https://evil.com", "https://wonderapps.biz.evil.com", "https://user:pw@x.wonderapps.biz", "not a url"]) expect(wonderJobsBase(bad)).toBe(WONDERJOBS_BASE);
    expect(wonderJobsBase(null)).toBe(WONDERJOBS_BASE);
  });

  it("masks a key down to its last four", () => {
    expect(maskKey("wxyz")).toBe("wjcs_••••••••wxyz");
  });
});
