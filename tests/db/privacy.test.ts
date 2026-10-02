import { EXPORT_EXCLUDED, EXPORT_TABLES, exportPersonalData, filePrivacyRequest, recordConsents } from "@wonder/creator-identity";
import { consentNeeded } from "@wonder/creator-identity/privacy-options";
import type { Db as AppDb } from "@wonder/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanupTestCreators, createTestCreator, expectDenied, expectNoRowsAffected, expectOk, loose, SECRET_KEY, SUPABASE_URL, type TestCreator } from "./helpers";

// Privacy compliance (GDPR / DPDP): consent records, data-principal requests, retention and export coverage.
const admin = adminClient();
let a: TestCreator;
let b: TestCreator;

beforeAll(async () => {
  [a, b] = await Promise.all([createTestCreator("privacyA"), createTestCreator("privacyB")]);
});
afterAll(cleanupTestCreators);

describe("consent records", () => {
  it("a new creator has agreed to nothing; recorded choices are the latest per purpose", async () => {
    expect(consentNeeded(expectOk(await a.client.rpc("my_consents")))).toBe(true);
    const required = ["terms", "privacy_notice", "age_confirmation"].map((purpose) => ({ purpose, granted: true }));
    const after = await recordConsents(a.client as unknown as AppDb, a.creatorId, { method: "sign_up", choices: [...required, { purpose: "product_analytics", granted: true }] });
    expect(consentNeeded(after)).toBe(false);
    // Withdrawal is a new row, as easy as giving it.
    const withdrawn = await recordConsents(a.client as unknown as AppDb, a.creatorId, { method: "settings", choices: [{ purpose: "product_analytics", granted: false }] });
    expect(withdrawn.find((c) => c.purpose === "product_analytics")?.granted).toBe(false);
    expect(expectOk(await a.client.from("consent_records").select("id").eq("purpose", "product_analytics"))).toHaveLength(2);
  });

  it("records are append-only and private", async () => {
    expectNoRowsAffected(await a.client.from("consent_records").update({ granted: true }).eq("creator_id", a.creatorId).select("id"));
    expectNoRowsAffected(await a.client.from("consent_records").delete().eq("creator_id", a.creatorId).select("id"));
    expect(expectOk(await b.client.from("consent_records").select("id").eq("creator_id", a.creatorId))).toHaveLength(0);
    expectDenied(await b.client.from("consent_records").insert({ creator_id: a.creatorId, purpose: "terms", granted: false, notice_version: "x", method: "settings" }));
    expectDenied(await anonClient().from("consent_records").insert({ creator_id: a.creatorId, purpose: "terms", granted: false, notice_version: "x", method: "settings" }));
  });
});

describe("privacy requests", () => {
  it("a creator files a request with a 30-day deadline; it's audited by the server", async () => {
    const r = await filePrivacyRequest(a.client as unknown as AppDb, a.creatorId, { kind: "correction", details: "My old surname is still on a Creation." });
    expect(r.status).toBe("received");
    const days = (new Date(r.due_at).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThanOrEqual(30);
    const audit = expectOk(await admin.from("audit_logs").select("action, actor_creator_id").eq("object_id", r.id));
    expect(audit).toEqual([{ action: "privacy_request.received", actor_creator_id: a.creatorId }]);
  });

  it("the creator can't set status or due date, close it, delete it, or see anyone else's", async () => {
    expectDenied(await a.client.from("privacy_requests").insert({ creator_id: a.creatorId, kind: "access", status: "completed" }));
    expectDenied(await a.client.from("privacy_requests").insert({ creator_id: a.creatorId, kind: "access", due_at: new Date(Date.now() + 365 * 86_400_000).toISOString() }));
    expectDenied(await a.client.from("privacy_requests").insert({ creator_id: b.creatorId, kind: "access" }));
    const mine = expectOk(await a.client.from("privacy_requests").select("id"));
    expect(mine.length).toBeGreaterThan(0);
    expectNoRowsAffected(await a.client.from("privacy_requests").update({ status: "completed" }).eq("id", mine[0]!.id).select("id"));
    expectNoRowsAffected(await a.client.from("privacy_requests").delete().eq("id", mine[0]!.id).select("id"));
    expect(expectOk(await b.client.from("privacy_requests").select("id").eq("id", mine[0]!.id))).toHaveLength(0);
  });

  it("staff closing a request stamps closed_at and audits the outcome; the creator sees the answer", async () => {
    const { id } = await filePrivacyRequest(a.client as unknown as AppDb, a.creatorId, { kind: "access" });
    expectOk(await admin.from("privacy_requests").update({ status: "completed", response: "Sent to your email." }).eq("id", id));
    const row = expectOk(await a.client.from("privacy_requests").select("status, response, closed_at").eq("id", id).single());
    expect(row).toMatchObject({ status: "completed", response: "Sent to your email." });
    expect(row.closed_at).toBeTruthy();
    const actions = expectOk(await admin.from("audit_logs").select("action").eq("object_id", id)).map((x) => x.action);
    expect(actions).toEqual(expect.arrayContaining(["privacy_request.received", "privacy_request.completed"]));
  });
});

describe("retention", () => {
  it("only the service role can run the purge, and each run is audited", async () => {
    expectDenied(await a.client.rpc("run_retention"));
    const out = expectOk(await admin.rpc("run_retention")) as Record<string, number>;
    expect(out).toHaveProperty("jobs");
    expect(out).toHaveProperty("privacy_requests");
    const last = expectOk(await admin.from("audit_logs").select("action").eq("action", "retention.run").order("created_at", { ascending: false }).limit(1));
    expect(last).toHaveLength(1);
  });

  it("purges rate-limit windows older than a day", async () => {
    const key = `retention-test-${a.creatorId}`;
    expectOk(await loose(admin).from("rate_limit_counters").insert({ key, window_start: new Date(Date.now() - 3 * 86_400_000).toISOString(), count: 1 }));
    expectOk(await admin.rpc("run_retention"));
    expect(expectOk(await loose(admin).from("rate_limit_counters").select("key").eq("key", key))).toHaveLength(0);
  });
});

describe("export", () => {
  it("every table holding a creator's rows is exported or excluded with a reason", async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, { headers: { apikey: SECRET_KEY, authorization: `Bearer ${SECRET_KEY}` } });
    const spec = (await res.json()) as { definitions: Record<string, { properties?: Record<string, unknown> }> };
    const withCreator = Object.entries(spec.definitions).filter(([, d]) => d.properties && "creator_id" in d.properties).map(([t]) => t);
    expect(withCreator.length).toBeGreaterThan(50);
    const covered = new Set<string>([...EXPORT_TABLES, ...Object.keys(EXPORT_EXCLUDED)]);
    expect(withCreator.filter((t) => !covered.has(t))).toEqual([]);
    // And nothing listed for export lacks the column (the query would silently return nothing).
    expect(EXPORT_TABLES.filter((t) => t !== "creators" && !withCreator.includes(t))).toEqual([]);
  });

  it("the export holds the creator's own data and none of anyone else's", async () => {
    const out = await exportPersonalData(a.client as unknown as AppDb, a.creatorId);
    expect((out.account as { email: string }).email).toBe(a.email);
    expect((out.consent_records as unknown[]).length).toBeGreaterThan(0);
    expect((out.privacy_requests as unknown[]).length).toBeGreaterThan(0);
    const json = JSON.stringify(out);
    expect(json).not.toContain(b.creatorId);
  });
});
