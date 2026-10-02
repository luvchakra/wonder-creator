import { DomainError } from "@wonder/core";
import { hmacHex, sameHex } from "./signature";
import type { Checkout, CheckoutRequest, FetchLike, NormalisedEvent, PaymentProvider, RefundRequest, RefundResult } from "./types";

const API = "https://api.razorpay.com/v1";

/** Razorpay Payment Links (hosted page: UPI, cards, netbanking, wallets) over the REST API. */
export class RazorpayProvider implements PaymentProvider {
  readonly name = "razorpay" as const;
  constructor(
    private readonly keyId: string,
    private readonly keySecret: string,
    private readonly webhookSecret: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  private async call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<{ ok: boolean; json: T & { error?: { description?: string; code?: string } } }> {
    const res = await this.fetchImpl(`${API}${path}`, {
      method,
      headers: { authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    }).catch((e: unknown) => {
      // Network failure or timeout: the provider couldn't be reached.
      throw new DomainError("provider_failed", "The payment provider couldn't be reached. Try again.", { cause: e });
    });
    return { ok: res.ok, json: (await res.json().catch(() => ({}))) as T & { error?: { description?: string; code?: string } } };
  }

  async createCheckout(req: CheckoutRequest): Promise<Checkout> {
    type Link = { id: string; short_url: string; expire_by: number; reference_id?: string; status?: string };
    // Razorpay needs expire_by at least 15 minutes ahead.
    const expireBy = Math.floor(Math.max(req.expiresAt.getTime(), Date.now() + 20 * 60_000) / 1000);
    const created = await this.call<Link>("POST", "/payment_links", {
      amount: req.amountMinor,
      currency: req.currency.toUpperCase(),
      description: req.description.slice(0, 2048),
      // reference_id is unique per account: it makes creating the link for an order idempotent.
      reference_id: req.orderId,
      expire_by: expireBy,
      callback_url: req.returnUrl,
      callback_method: "get",
      reminder_enable: false,
      notes: { order_id: req.orderId },
    });
    let link: Link | undefined = created.ok ? created.json : undefined;
    if (!link) {
      // A retry after a crash: the link already exists for this order — use it.
      const found = await this.call<{ payment_links?: Link[] }>("GET", `/payment_links?reference_id=${encodeURIComponent(req.orderId)}`);
      link = found.json.payment_links?.find((l) => l.reference_id === req.orderId && l.status !== "cancelled" && l.status !== "expired");
    }
    if (!link) throw new DomainError("provider_failed", "The payment provider didn't accept that. Try again.", { cause: { code: created.json.error?.code } });
    return { ref: link.id, url: link.short_url, expiresAt: new Date(link.expire_by * 1000) };
  }

  async refund(req: RefundRequest): Promise<RefundResult> {
    const r = await this.call<{ id: string; status: string }>("POST", `/payments/${encodeURIComponent(req.paymentRef)}/refund`, {
      amount: req.amountMinor,
      receipt: req.refundId.slice(0, 40),
      notes: { refund_id: req.refundId },
    });
    if (!r.ok) throw new DomainError("provider_failed", "The payment provider didn't accept the refund.", { cause: { code: r.json.error?.code } });
    return { ref: r.json.id, failed: r.json.status === "failed" };
  }

  parseWebhook(headers: Headers, body: string): NormalisedEvent {
    const sig = headers.get("x-razorpay-signature") ?? "";
    if (!sig || !sameHex(sig, hmacHex(this.webhookSecret, body))) throw new DomainError("security_rejected", "Bad signature.");
    const e = JSON.parse(body) as { event: string; created_at?: number; payload: Record<string, { entity: Record<string, unknown> } | undefined> };
    // Razorpay sends a unique id per event in this header; fall back to a stable digest of the body.
    const eventId = headers.get("x-razorpay-event-id") ?? `body-${hmacHex("razorpay-event", body).slice(0, 40)}`;
    const base = { provider: this.name, eventId, eventType: String(e.event) };
    const link = e.payload?.payment_link?.entity ?? {};
    const payment = e.payload?.payment?.entity ?? {};
    const refund = e.payload?.refund?.entity ?? {};
    const str = (v: unknown) => (typeof v === "string" ? v : undefined);
    const num = (v: unknown) => (typeof v === "number" ? v : undefined);
    switch (e.event) {
      case "payment_link.paid":
        return { ...base, kind: "paid", ref: str(link.id), payment: str(payment.id), amountMinor: num(payment.amount) ?? num(link.amount_paid), currency: str(payment.currency) ?? str(link.currency) };
      case "payment_link.expired":
      case "payment_link.cancelled":
        return { ...base, kind: "expired", ref: str(link.id) };
      case "refund.processed":
        return { ...base, kind: "refund_succeeded", payment: str(refund.payment_id), refundRef: str(refund.id), amountMinor: num(refund.amount), currency: str(refund.currency) };
      case "refund.failed":
        return { ...base, kind: "refund_failed", payment: str(refund.payment_id), refundRef: str(refund.id) };
      default:
        return { ...base, kind: "ignored" };
    }
  }
}
