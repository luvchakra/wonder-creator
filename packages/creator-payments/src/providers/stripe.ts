import { DomainError } from "@wonder/core";
import { hmacHex, sameHex } from "./signature";
import type { Checkout, CheckoutRequest, FetchLike, NormalisedEvent, PaymentProvider, RefundRequest, RefundResult } from "./types";

const API = "https://api.stripe.com/v1";
/** Stripe's recommended replay window for webhook timestamps. */
export const STRIPE_TOLERANCE_SECONDS = 300;

function form(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

/** Stripe Checkout (hosted page; card data never reaches us) over the REST API. */
export class StripeProvider implements PaymentProvider {
  readonly name = "stripe" as const;
  constructor(
    private readonly secretKey: string,
    private readonly webhookSecret: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  private async call<T>(path: string, params: Record<string, string | number>, idempotencyKey: string): Promise<T> {
    const res = await this.fetchImpl(`${API}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.secretKey}`, "content-type": "application/x-www-form-urlencoded", "idempotency-key": idempotencyKey },
      body: form(params),
      signal: AbortSignal.timeout(15_000),
    }).catch((e: unknown) => {
      // Network failure or timeout: the provider couldn't be reached.
      throw new DomainError("provider_failed", "The payment provider couldn't be reached. Try again.", { cause: e });
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; code?: string } };
    if (!res.ok) throw new DomainError("provider_failed", "The payment provider didn't accept that. Try again.", { cause: { status: res.status, code: json.error?.code } });
    return json;
  }

  async createCheckout(req: CheckoutRequest): Promise<Checkout> {
    const s = await this.call<{ id: string; url: string; expires_at: number }>(
      "/checkout/sessions",
      {
        mode: "payment",
        success_url: req.returnUrl,
        cancel_url: req.cancelUrl,
        client_reference_id: req.orderId,
        "line_items[0][quantity]": 1,
        "line_items[0][price_data][currency]": req.currency.toLowerCase(),
        "line_items[0][price_data][unit_amount]": req.amountMinor,
        "line_items[0][price_data][product_data][name]": req.description,
        "metadata[order_id]": req.orderId,
        "payment_intent_data[metadata][order_id]": req.orderId,
        // Stripe allows 30 minutes to 24 hours.
        expires_at: Math.floor(Math.min(Math.max(req.expiresAt.getTime(), Date.now() + 31 * 60_000), Date.now() + 23.5 * 3_600_000) / 1000),
      },
      `order-${req.orderId}`,
    );
    return { ref: s.id, url: s.url, expiresAt: new Date(s.expires_at * 1000) };
  }

  async refund(req: RefundRequest): Promise<RefundResult> {
    const r = await this.call<{ id: string; status: string }>("/refunds", { payment_intent: req.paymentRef, amount: req.amountMinor, "metadata[refund_id]": req.refundId }, `refund-${req.refundId}`);
    return { ref: r.id, failed: r.status === "failed" || r.status === "canceled" };
  }

  parseWebhook(headers: Headers, body: string, now = new Date()): NormalisedEvent {
    const header = headers.get("stripe-signature") ?? "";
    const parts = header.split(",").map((p) => p.trim().split("=") as [string, string]);
    const t = Number(parts.find(([k]) => k === "t")?.[1]);
    const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v ?? "");
    if (!Number.isFinite(t) || !sigs.length) throw new DomainError("security_rejected", "Missing signature.");
    if (Math.abs(now.getTime() / 1000 - t) > STRIPE_TOLERANCE_SECONDS) throw new DomainError("security_rejected", "Stale signature.");
    const expected = hmacHex(this.webhookSecret, `${t}.${body}`);
    if (!sigs.some((s) => sameHex(s, expected))) throw new DomainError("security_rejected", "Bad signature.");

    const e = JSON.parse(body) as { id: string; type: string; data: { object: Record<string, unknown> } };
    const o = e.data?.object ?? {};
    const base = { provider: this.name, eventId: String(e.id), eventType: String(e.type) };
    const str = (v: unknown) => (typeof v === "string" ? v : undefined);
    const num = (v: unknown) => (typeof v === "number" ? v : undefined);
    switch (e.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        if (o.payment_status !== "paid") return { ...base, kind: "ignored" };
        return { ...base, kind: "paid", ref: str(o.id), payment: str(o.payment_intent), amountMinor: num(o.amount_total), currency: str(o.currency)?.toUpperCase() };
      case "checkout.session.async_payment_failed":
        return { ...base, kind: "failed", ref: str(o.id) };
      case "checkout.session.expired":
        return { ...base, kind: "expired", ref: str(o.id) };
      case "refund.created":
      case "refund.updated":
      case "refund.failed": {
        const kind = o.status === "succeeded" ? "refund_succeeded" : o.status === "failed" || o.status === "canceled" ? "refund_failed" : "ignored";
        return { ...base, kind, payment: str(o.payment_intent), refundRef: str(o.id), amountMinor: num(o.amount), currency: str(o.currency)?.toUpperCase() };
      }
      default:
        return { ...base, kind: "ignored" };
    }
  }
}
