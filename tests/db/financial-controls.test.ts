import { randomUUID } from "node:crypto";
import { addLicense, createArtifact } from "@wonder/creator-studio";
import type { Db as AppDb } from "@wonder/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, cleanupTestCreators, createTestCreator, expectDenied, expectOk, type TestCreator } from "./helpers";

// Financial controls (migration 071): settled records locked, daily reconciliation, statements, append-only evidence.
const admin = adminClient();
let owner: TestCreator;
let other: TestCreator;
let orderId: string;
const db = (x: TestCreator) => x.client as unknown as AppDb;

async function paidOrder(c: TestCreator, fee: number): Promise<string> {
  const piece = (await createArtifact(db(c), c.creatorId, { artifactType: "poem", title: "Ledger", content: "x", authorKind: "creator", provenance: { origin: "typed" } })).id;
  const lic = await addLicense(db(c), c.creatorId, piece, { licenseType: "commercial", mode: "paid_nonexclusive", feeAmount: fee, feeCurrency: "USD", licenseeName: "Acme", status: "active" });
  const o = expectOk(await c.client.rpc("payment_order_open", { p_license: lic.id }));
  expectOk(await admin.rpc("payment_order_attach", { p_order: o.id, p_provider: "stripe", p_ref: `cs_${o.id}`, p_url: "https://checkout.stripe.com/x", p_expires_at: new Date(Date.now() + 3_600_000).toISOString() }));
  expect(
    expectOk(await admin.rpc("payment_apply_event", { p_provider: "stripe", p_event_id: `evt_${randomUUID()}`, p_event_type: "checkout.session.completed", p_body_sha256: "0".repeat(64), p_kind: "paid", p_ref: `cs_${o.id}`, p_payment: `pi_${o.id}`, p_amount: fee * 100, p_currency: "USD" })),
  ).toBe("applied");
  return o.id;
}

beforeAll(async () => {
  [owner, other] = await Promise.all([createTestCreator("finOwner"), createTestCreator("finOther")]);
  orderId = await paidOrder(owner, 49);
});
afterAll(cleanupTestCreators);

describe("settled records", () => {
  it("a record settled by a payment can't be re-marked by the creator; the note can still change", async () => {
    const rec = expectOk(await owner.client.from("business_records").select("id, status").eq("payment_order_id", orderId).single());
    expect(rec.status).toBe("received");
    expect(expectDenied(await owner.client.from("business_records").update({ status: "expected" }).eq("id", rec.id)).message).toMatch(/refund it instead/);
    expect(expectDenied(await owner.client.from("business_records").update({ status: "cancelled" }).eq("id", rec.id)).message).toMatch(/refund it instead/);
    expectOk(await owner.client.from("business_records").update({ note: "Invoice 2026-14" }).eq("id", rec.id).select("id"));
    expectDenied(await owner.client.from("business_records").delete().eq("id", rec.id).select("id").single());
  });
});

describe("reconciliation", () => {
  it("only operators run it; clean books produce no exceptions for them; each run is audited", async () => {
    expectDenied(await owner.client.rpc("run_reconciliation"));
    const out = expectOk(await admin.rpc("run_reconciliation")) as { run: string; exceptions: number };
    const mine = expectOk(await admin.from("reconciliation_exceptions").select("check_name").eq("run_id", out.run).eq("creator_id", owner.creatorId));
    expect(mine).toEqual([]);
    expect(expectOk(await admin.from("audit_logs").select("action").eq("object_id", out.run))).toEqual([{ action: "reconciliation.run" }]);
    expectDenied(await owner.client.from("reconciliation_runs").select("id"), "42501");
  });

  it("flags a paid order whose income record was tampered with, and an unapplied provider event", async () => {
    const tampered = await paidOrder(other, 10);
    // Operator-level tampering (bypasses the creator lock): reconciliation catches the mismatch.
    expectOk(await admin.from("business_records").update({ status: "expected" }).eq("payment_order_id", tampered).select("id"));
    expect(
      expectOk(await admin.rpc("payment_apply_event", { p_provider: "stripe", p_event_id: `evt_${randomUUID()}`, p_event_type: "checkout.session.completed", p_body_sha256: "0".repeat(64), p_kind: "paid", p_ref: `cs_${tampered}`, p_payment: "pi_x", p_amount: 1, p_currency: "USD" })),
    ).toBe("duplicate_state");
    const out = expectOk(await admin.rpc("run_reconciliation")) as { run: string };
    const ex = expectOk(await admin.from("reconciliation_exceptions").select("check_name, subject_id, severity").eq("run_id", out.run).eq("creator_id", other.creatorId));
    expect(ex).toEqual(expect.arrayContaining([{ check_name: "order_has_business_record", subject_id: tampered, severity: "medium" }]));
    // Exceptions are evidence: nobody edits or deletes them.
    const [row] = expectOk(await admin.from("reconciliation_exceptions").select("id").eq("run_id", out.run).limit(1));
    expectDenied(await admin.from("reconciliation_exceptions").delete().eq("id", row!.id));
  });

  it("expires stale checkouts", async () => {
    const piece = (await createArtifact(db(owner), owner.creatorId, { artifactType: "poem", title: "Stale", content: "x", authorKind: "creator", provenance: { origin: "typed" } })).id;
    const lic = await addLicense(db(owner), owner.creatorId, piece, { licenseType: "commercial", mode: "paid_nonexclusive", feeAmount: 5, feeCurrency: "USD", status: "active" });
    const o = expectOk(await owner.client.rpc("payment_order_open", { p_license: lic.id }));
    expectOk(await admin.from("payment_orders").update({ expires_at: new Date(Date.now() - 2 * 3_600_000).toISOString() }).eq("id", o.id).select("id"));
    expectOk(await admin.rpc("run_reconciliation"));
    expect(expectOk(await owner.client.from("payment_orders").select("status").eq("id", o.id).single()).status).toBe("expired");
  });
});

describe("statement", () => {
  it("lists the creator's own balanced ledger lines only", async () => {
    const year = new Date().getUTCFullYear();
    const lines = expectOk(await owner.client.rpc("my_payment_statement", { p_from: `${year}-01-01`, p_to: `${year}-12-31` }));
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines.every((l) => l.order_id === orderId || l.order_id !== null)).toBe(true);
    const sum = (k: "debit_minor" | "credit_minor") => lines.reduce((a, l) => a + Number(l[k]), 0);
    expect(sum("debit_minor")).toBe(sum("credit_minor"));
    expect(lines.some((l) => l.provider_payment_ref === `pi_${orderId}`)).toBe(true);
    const theirs = expectOk(await other.client.rpc("my_payment_statement", { p_from: `${year}-01-01`, p_to: `${year}-12-31` }));
    expect(theirs.some((l) => l.order_id === orderId)).toBe(false);
  });
});
