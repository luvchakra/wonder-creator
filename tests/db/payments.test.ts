import { randomUUID } from "node:crypto";
import { addLicense, createArtifact } from "@wonder/creator-studio";
import type { Db as AppDb } from "@wonder/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, cleanupTestCreators, createTestCreator, expectDenied, expectNoRowsAffected, expectOk, type TestCreator } from "./helpers";

// Payments (migration 070): orders opened from the licence, provider events applied once, balanced immutable ledger.
const admin = adminClient();
let owner: TestCreator;
let payer: TestCreator;
let stranger: TestCreator;
let piece: string;
let license: string;
let orderId: string;
const db = (x: TestCreator) => x.client as unknown as AppDb;
const sha = () => randomUUID().replace(/-/g, "").padEnd(64, "0");

const apply = (args: { kind: string; ref?: string; payment?: string; refund?: string; amount?: number; currency?: string; eventId?: string }) =>
  admin.rpc("payment_apply_event", {
    p_provider: "razorpay",
    p_event_id: args.eventId ?? `evt_${randomUUID()}`,
    p_event_type: `test.${args.kind}`,
    p_body_sha256: sha(),
    p_kind: args.kind,
    p_ref: args.ref,
    p_payment: args.payment,
    p_refund_ref: args.refund,
    p_amount: args.amount,
    p_currency: args.currency,
  });

async function paidLicence(fee: number, currency = "INR") {
  const lic = await addLicense(db(owner), owner.creatorId, piece, { licenseType: "commercial", mode: "paid_nonexclusive", feeAmount: fee, feeCurrency: currency, licenseeName: "Payer", status: "active" });
  expectOk(await admin.from("licenses").update({ licensee_creator_id: payer.creatorId }).eq("id", lic.id).select("id"));
  return lic.id;
}

beforeAll(async () => {
  [owner, payer, stranger] = await Promise.all([createTestCreator("payOwner"), createTestCreator("payPayer"), createTestCreator("payStranger")]);
  piece = (await createArtifact(db(owner), owner.creatorId, { artifactType: "poem", title: "Monsoon", content: "Rain.", authorKind: "creator", provenance: { origin: "typed" } })).id;
  license = await paidLicence(5000);
});
afterAll(cleanupTestCreators);

describe("opening an order", () => {
  it("takes the amount, currency and payee from the licence; owner and licensee share one live order", async () => {
    const o = expectOk(await owner.client.rpc("payment_order_open", { p_license: license }));
    expect(o).toMatchObject({ creator_id: owner.creatorId, payer_creator_id: payer.creatorId, amount_minor: 500000, currency: "INR", status: "created" });
    expect(o.description).toBe("Commercial licence — Monsoon");
    orderId = o.id;
    expect(expectOk(await payer.client.rpc("payment_order_open", { p_license: license })).id).toBe(orderId);
    expect(expectOk(await payer.client.from("payment_orders").select("id").eq("id", orderId))).toHaveLength(1);
  });

  it("nobody else can open or see it; a free or draft licence can't be paid; clients can't write orders", async () => {
    expectDenied(await stranger.client.rpc("payment_order_open", { p_license: license }), "P0002");
    expectDenied(await anonClient().rpc("payment_order_open", { p_license: license }));
    expect(expectOk(await stranger.client.from("payment_orders").select("id").eq("id", orderId))).toHaveLength(0);
    const free = await addLicense(db(owner), owner.creatorId, piece, { licenseType: "editorial", mode: "free_license", status: "active" });
    expect(expectDenied(await owner.client.rpc("payment_order_open", { p_license: free.id })).message).toMatch(/no fee/);
    const draft = await addLicense(db(owner), owner.creatorId, piece, { licenseType: "commercial", mode: "paid_nonexclusive", feeAmount: 10, feeCurrency: "INR", status: "draft" });
    expect(expectDenied(await owner.client.rpc("payment_order_open", { p_license: draft.id })).message).toMatch(/active licence/);
    expectDenied(await owner.client.from("payment_orders").insert({ creator_id: owner.creatorId, license_id: license, description: "x", amount_minor: 1, currency: "INR" }));
    expectNoRowsAffected(await owner.client.from("payment_orders").update({ status: "paid" }).eq("id", orderId).select("id"));
    expectNoRowsAffected(await payer.client.from("payment_orders").update({ amount_minor: 1 }).eq("id", orderId).select("id"));
  });

  it("only the server records the provider checkout", async () => {
    expectDenied(await owner.client.rpc("payment_order_attach", { p_order: orderId, p_provider: "razorpay", p_ref: "plink_x", p_url: "https://rzp.io/i/x", p_expires_at: new Date(Date.now() + 3_600_000).toISOString() }));
    const o = expectOk(await admin.rpc("payment_order_attach", { p_order: orderId, p_provider: "razorpay", p_ref: `plink_${orderId}`, p_url: "https://rzp.io/i/x", p_expires_at: new Date(Date.now() + 3_600_000).toISOString() }));
    expect(o.status).toBe("open");
  });
});

describe("provider events", () => {
  it("a payment of a different amount is never settled", async () => {
    expect(expectOk(await apply({ kind: "paid", ref: `plink_${orderId}`, payment: "pay_short", amount: 100, currency: "INR" }))).toBe("ignored");
    expect(expectOk(await owner.client.from("payment_orders").select("status").eq("id", orderId).single()).status).toBe("open");
  });

  it("paid: order settles, a balanced journal posts, and the expected income is marked received — once", async () => {
    const eventId = `evt_${randomUUID()}`;
    expect(expectOk(await apply({ eventId, kind: "paid", ref: `plink_${orderId}`, payment: `pay_${orderId}`, amount: 500000, currency: "INR" }))).toBe("applied");
    expect(expectOk(await apply({ eventId, kind: "paid", ref: `plink_${orderId}`, payment: `pay_${orderId}`, amount: 500000, currency: "INR" }))).toBe("duplicate");
    expect(expectOk(await apply({ kind: "paid", ref: `plink_${orderId}`, payment: `pay_${orderId}`, amount: 500000, currency: "INR" }))).toBe("duplicate_state");

    const o = expectOk(await owner.client.from("payment_orders").select("status, paid_at, provider_payment_ref").eq("id", orderId).single());
    expect(o).toMatchObject({ status: "paid", provider_payment_ref: `pay_${orderId}` });
    const ledger = expectOk(await owner.client.from("ledger_entries").select("account, debit_minor, credit_minor, currency").eq("order_id", orderId));
    expect(ledger).toEqual(expect.arrayContaining([
      { account: "provider_clearing:razorpay", debit_minor: 500000, credit_minor: 0, currency: "INR" },
      { account: "creator_payable", debit_minor: 0, credit_minor: 500000, currency: "INR" },
    ]));
    expect(ledger).toHaveLength(2);
    const rec = expectOk(await owner.client.from("business_records").select("status, payment_order_id, amount").eq("source_id", license));
    expect(rec).toEqual([{ status: "received", payment_order_id: orderId, amount: 5000 }]);
    // The payer sees the order but not the owner's books.
    expect(expectOk(await payer.client.from("ledger_entries").select("id").eq("order_id", orderId))).toHaveLength(0);
    // A paid licence can't be opened for payment again.
    expect(expectDenied(await payer.client.rpc("payment_order_open", { p_license: license })).message).toMatch(/already paid/);
  });

  it("unknown orders are recorded as unmatched, not applied", async () => {
    expect(expectOk(await apply({ kind: "paid", ref: "plink_nobody", payment: "pay_nobody", amount: 1, currency: "INR" }))).toBe("unmatched");
  });
});

describe("refunds", () => {
  let refundId: string;
  it("only the payee refunds, never more than was paid", async () => {
    expectDenied(await payer.client.rpc("payment_refund_request", { p_order: orderId, p_amount_minor: 100, p_reason: "Changed my mind" }), "P0002");
    expect(expectDenied(await owner.client.rpc("payment_refund_request", { p_order: orderId, p_amount_minor: 500001, p_reason: "Too much" })).message).toMatch(/exceeds/);
    const r = expectOk(await owner.client.rpc("payment_refund_request", { p_order: orderId, p_amount_minor: 200000, p_reason: "Partial use only" }));
    refundId = r.id;
    // While that refund is in flight, the rest is all that can still be refunded.
    expect(expectDenied(await owner.client.rpc("payment_refund_request", { p_order: orderId, p_amount_minor: 300001, p_reason: "Too much" })).message).toMatch(/exceeds/);
    expectDenied(await owner.client.rpc("payment_refund_attach", { p_refund: refundId, p_ref: "rfnd_x", p_failed: false }));
    expectOk(await admin.rpc("payment_refund_attach", { p_refund: refundId, p_ref: `rfnd_${refundId}`, p_failed: false }));
  });

  it("a confirmed refund reverses the journal; a full refund cancels the income", async () => {
    expect(expectOk(await apply({ kind: "refund_succeeded", payment: `pay_${orderId}`, refund: `rfnd_${refundId}`, amount: 200000, currency: "INR" }))).toBe("applied");
    expect(expectOk(await owner.client.from("payment_orders").select("status, refunded_minor").eq("id", orderId).single())).toEqual({ status: "partially_refunded", refunded_minor: 200000 });
    // A refund made in the provider's dashboard is recorded too, so the books match.
    expect(expectOk(await apply({ kind: "refund_succeeded", payment: `pay_${orderId}`, refund: `rfnd_dash_${orderId}`, amount: 300000, currency: "INR" }))).toBe("applied");
    expect(expectOk(await owner.client.from("payment_orders").select("status, refunded_minor").eq("id", orderId).single())).toEqual({ status: "refunded", refunded_minor: 500000 });
    const lines = expectOk(await owner.client.from("ledger_entries").select("debit_minor, credit_minor").eq("order_id", orderId));
    const sum = (k: "debit_minor" | "credit_minor") => lines.reduce((a, l) => a + Number(l[k]), 0);
    expect(sum("debit_minor")).toBe(sum("credit_minor"));
    expect(lines).toHaveLength(6);
    expect(expectOk(await owner.client.from("business_records").select("status").eq("payment_order_id", orderId).single()).status).toBe("cancelled");
  });

  it("a refund id from another order never moves money on this one", async () => {
    const other = await paidLicence(100);
    const o = expectOk(await owner.client.rpc("payment_order_open", { p_license: other }));
    expectOk(await admin.rpc("payment_order_attach", { p_order: o.id, p_provider: "razorpay", p_ref: `plink_${o.id}`, p_url: "https://rzp.io/i/y", p_expires_at: new Date(Date.now() + 3_600_000).toISOString() }));
    expect(expectOk(await apply({ kind: "paid", ref: `plink_${o.id}`, payment: `pay_${o.id}`, amount: 10000, currency: "INR" }))).toBe("applied");
    expect(expectOk(await apply({ kind: "refund_succeeded", payment: `pay_${o.id}`, refund: `rfnd_${refundId}`, amount: 10000, currency: "INR" }))).toBe("ignored");
    expect(expectOk(await owner.client.from("payment_orders").select("status").eq("id", o.id).single()).status).toBe("paid");
  });
});

describe("integrity", () => {
  it("ledger and provider events are append-only, even for the service role", async () => {
    const [line] = expectOk(await admin.from("ledger_entries").select("id").eq("order_id", orderId).limit(1));
    expectDenied(await admin.from("ledger_entries").update({ debit_minor: 1 }).eq("id", line!.id));
    expectDenied(await admin.from("ledger_entries").delete().eq("id", line!.id));
    const [ev] = expectOk(await admin.from("payment_events").select("id").eq("order_id", orderId).limit(1));
    expectDenied(await admin.from("payment_events").delete().eq("id", ev!.id));
    expectDenied(await owner.client.from("payment_events").select("id"), "42501");
    expectDenied(await owner.client.from("ledger_entries").insert({ journal_id: randomUUID(), creator_id: owner.creatorId, account: "creator_payable", credit_minor: 1, currency: "INR", memo: "free money" }));
  });

  it("every step is audited by the server in the owner's history", async () => {
    const actions = expectOk(await owner.client.from("audit_logs").select("action").in("object_id", [orderId])).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["payment.order_opened", "payment.checkout_created", "payment.amount_mismatch", "payment.received"]));
    expectDenied(await owner.client.rpc("record_audit_log", { p_action: "payment.received", p_object_type: "payment_order", p_object_id: orderId }), "42501");
  });
});
