import { describe, expect, it } from "vitest";
import { formatMinor, toMinor, fromMinor } from "./money";
import { hmacHex } from "./providers/signature";
import { RazorpayProvider } from "./providers/razorpay";
import { StripeProvider } from "./providers/stripe";
import { chooseProvider, paymentsConfigFromEnv } from "./router";

const stripe = new StripeProvider("sk_test_x", "whsec_test");
const razorpay = new RazorpayProvider("rzp_test", "secret", "rzp_whsec");

function stripeHeaders(body: string, t = Math.floor(Date.now() / 1000), secret = "whsec_test") {
  return new Headers({ "stripe-signature": `t=${t},v1=${hmacHex(secret, `${t}.${body}`)}` });
}

describe("money", () => {
  it("converts to and from minor units by currency exponent", () => {
    expect(toMinor(1250.5, "INR")).toBe(125050);
    expect(toMinor(0.1 + 0.2, "USD")).toBe(30);
    expect(toMinor(1500, "JPY")).toBe(1500);
    expect(toMinor(1.234, "KWD")).toBe(1234);
    expect(fromMinor(125050, "INR")).toBe(1250.5);
    expect(formatMinor(125050, "INR", "en-IN")).toBe("₹1,250.50");
  });
});

describe("routing", () => {
  const both = paymentsConfigFromEnv({ STRIPE_SECRET_KEY: "sk", STRIPE_WEBHOOK_SECRET: "wh", RAZORPAY_KEY_ID: "id", RAZORPAY_KEY_SECRET: "s", RAZORPAY_WEBHOOK_SECRET: "w" });
  it("INR goes to Razorpay, everything else to Stripe", () => {
    expect(chooseProvider("INR", both)).toBe("razorpay");
    expect(chooseProvider("usd", both)).toBe("stripe");
    expect(chooseProvider("INR", { stripe: both.stripe })).toBe("stripe");
  });
  it("is honest when nothing (or nothing for that currency) is connected", () => {
    expect(() => chooseProvider("INR", {})).toThrow("Payments aren't connected.");
    expect(() => chooseProvider("EUR", { razorpay: both.razorpay })).toThrow("Payments in EUR aren't connected.");
    // A half-configured provider doesn't count.
    expect(paymentsConfigFromEnv({ STRIPE_SECRET_KEY: "sk" }).stripe).toBeUndefined();
  });
});

describe("Stripe webhooks", () => {
  const paid = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: { id: "cs_1", payment_status: "paid", amount_total: 125050, currency: "inr", payment_intent: "pi_1" } } });
  it("accepts a genuine, fresh event and normalises it", () => {
    expect(stripe.parseWebhook(stripeHeaders(paid), paid)).toEqual({ provider: "stripe", eventId: "evt_1", eventType: "checkout.session.completed", kind: "paid", ref: "cs_1", payment: "pi_1", amountMinor: 125050, currency: "INR" });
  });
  it("refuses a wrong secret, a tampered body, a stale timestamp or no signature", () => {
    expect(() => stripe.parseWebhook(stripeHeaders(paid, undefined, "whsec_other"), paid)).toThrow("Bad signature");
    expect(() => stripe.parseWebhook(stripeHeaders(paid), paid.replace("125050", "1"))).toThrow("Bad signature");
    expect(() => stripe.parseWebhook(stripeHeaders(paid, Math.floor(Date.now() / 1000) - 600), paid)).toThrow("Stale signature");
    expect(() => stripe.parseWebhook(new Headers(), paid)).toThrow("Missing signature");
  });
  it("only a paid session counts as paid; refunds map by status", () => {
    const unpaid = JSON.stringify({ id: "evt_2", type: "checkout.session.completed", data: { object: { id: "cs_2", payment_status: "unpaid" } } });
    expect(stripe.parseWebhook(stripeHeaders(unpaid), unpaid).kind).toBe("ignored");
    const refund = JSON.stringify({ id: "evt_3", type: "refund.updated", data: { object: { id: "re_1", status: "succeeded", payment_intent: "pi_1", amount: 5000, currency: "inr" } } });
    expect(stripe.parseWebhook(stripeHeaders(refund), refund)).toMatchObject({ kind: "refund_succeeded", refundRef: "re_1", payment: "pi_1", amountMinor: 5000 });
  });
});

describe("Razorpay webhooks", () => {
  const body = JSON.stringify({ event: "payment_link.paid", payload: { payment_link: { entity: { id: "plink_1", amount_paid: 125050, currency: "INR" } }, payment: { entity: { id: "pay_1", amount: 125050, currency: "INR" } } } });
  it("accepts a genuine event and normalises it", () => {
    const h = new Headers({ "x-razorpay-signature": hmacHex("rzp_whsec", body), "x-razorpay-event-id": "evt_r1" });
    expect(razorpay.parseWebhook(h, body)).toEqual({ provider: "razorpay", eventId: "evt_r1", eventType: "payment_link.paid", kind: "paid", ref: "plink_1", payment: "pay_1", amountMinor: 125050, currency: "INR" });
  });
  it("refuses a bad signature", () => {
    expect(() => razorpay.parseWebhook(new Headers({ "x-razorpay-signature": hmacHex("other", body) }), body)).toThrow("Bad signature");
    expect(() => razorpay.parseWebhook(new Headers(), body)).toThrow("Bad signature");
  });
});

describe("checkout creation", () => {
  it("Stripe: hosted checkout with the amount from the order and an idempotency key", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const p = new StripeProvider("sk_test_x", "wh", async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "cs_9", url: "https://checkout.stripe.com/c/pay/cs_9", expires_at: Math.floor(Date.now() / 1000) + 3600 }), { status: 200 });
    });
    const c = await p.createCheckout({ orderId: "ord-1", amountMinor: 4999, currency: "USD", description: "Commercial licence — Dawn", returnUrl: "https://app/payments/ord-1", cancelUrl: "https://app/payments/ord-1?cancelled=1", expiresAt: new Date(Date.now() + 86_400_000) });
    expect(new URL(c.url).host).toBe("checkout.stripe.com");
    expect(calls[0]!.url).toBe("https://api.stripe.com/v1/checkout/sessions");
    const h = new Headers(calls[0]!.init!.headers);
    expect(h.get("idempotency-key")).toBe("order-ord-1");
    const form = new URLSearchParams(String(calls[0]!.init!.body));
    expect(form.get("line_items[0][price_data][unit_amount]")).toBe("4999");
    expect(form.get("line_items[0][price_data][currency]")).toBe("usd");
    expect(form.get("metadata[order_id]")).toBe("ord-1");
  });
  it("Razorpay: reuses the existing link when the order's link was already created", async () => {
    const p = new RazorpayProvider("id", "s", "w", async (url, init) => {
      if (init?.method === "POST") return new Response(JSON.stringify({ error: { code: "BAD_REQUEST_ERROR" } }), { status: 400 });
      expect(url).toContain("reference_id=ord-2");
      return new Response(JSON.stringify({ payment_links: [{ id: "plink_2", short_url: "https://rzp.io/i/abc", expire_by: 2_000_000_000, reference_id: "ord-2", status: "created" }] }), { status: 200 });
    });
    const c = await p.createCheckout({ orderId: "ord-2", amountMinor: 50000, currency: "INR", description: "x", returnUrl: "https://a", cancelUrl: "https://a", expiresAt: new Date(Date.now() + 86_400_000) });
    expect(c).toMatchObject({ ref: "plink_2", url: "https://rzp.io/i/abc" });
  });
});
