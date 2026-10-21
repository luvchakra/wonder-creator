import { describe, expect, it, vi } from "vitest";
import { APPLIED, handleApplication, LIMITS, validateApplication } from "./apply";

const good = { name: "  Asha Rao ", email: "Asha@Example.com", resumeUrl: "https://drive.google.com/file/d/1", consent: true };
const ok = async () => ({ ok: true as const, data: { id: "a1" } });

describe("apply", () => {
  it("trims, lower-cases the email, and drops empty optional fields", () => {
    expect(validateApplication(good)).toEqual({ ok: true, input: { name: "Asha Rao", email: "asha@example.com", resumeUrl: "https://drive.google.com/file/d/1", consent: true } });
  });

  it("refuses missing or wrong fields, http links and a long cover note", () => {
    const r = validateApplication({ name: "", email: "nope", resumeUrl: "http://x.example/cv", linkedinUrl: "javascript:alert(1)", coverNote: "x".repeat(LIMITS.coverNote + 1), consent: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["consent", "coverNote", "email", "linkedinUrl", "name", "resumeUrl"]);
  });

  it("pretends success for the honeypot and never forwards it", async () => {
    const apply = vi.fn(ok);
    const limited = vi.fn(async () => false);
    const r = await handleApplication("j1", { ...good, website: "http://spam" }, { apply, limited });
    expect(r).toEqual({ status: 200, body: { ok: true, message: APPLIED } });
    expect(apply).not.toHaveBeenCalled();
  });

  it("stops at the rate limit before forwarding", async () => {
    const apply = vi.fn(ok);
    const r = await handleApplication("j1", good, { apply, limited: async () => true });
    expect(r.status).toBe(429);
    expect(r.retryAfter).toBe(3600);
    expect(apply).not.toHaveBeenCalled();
  });

  it("says it was sent only after WonderJobs says 200, and passes 400/409/404 through", async () => {
    expect((await handleApplication("j1", good, { apply: ok, limited: async () => false })).body).toEqual({ ok: true, message: APPLIED });
    const with_ = (kind: object) => handleApplication("j1", good, { apply: async () => ({ ok: false, ...kind }) as never, limited: async () => false });
    expect(await with_({ kind: "conflict", message: "Already applied." })).toEqual({ status: 409, body: { error: "Already applied." } });
    expect(await with_({ kind: "bad_request", message: "Bad link." })).toEqual({ status: 400, body: { error: "Bad link." } });
    expect(await with_({ kind: "not_found" })).toEqual({ status: 404, body: { error: "This position is no longer open.", gone: true } });
    const down = await with_({ kind: "unavailable" });
    expect(down.status).toBe(503);
    expect("ok" in down.body).toBe(false);
  });

  it("validates before forwarding", async () => {
    const apply = vi.fn(ok);
    const r = await handleApplication("j1", { ...good, resumeUrl: "" }, { apply, limited: async () => false });
    expect(r.status).toBe(400);
    expect(apply).not.toHaveBeenCalled();
  });
});
