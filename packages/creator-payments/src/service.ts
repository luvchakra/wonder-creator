import { createHash } from "node:crypto";
import { DomainError, fromDbError } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";
import { chooseProvider, providerByName, type PaymentsConfig } from "./router";
import type { FetchLike, ProviderName } from "./providers/types";

/**
 * Payments: open a hosted checkout for a licence fee, refund it, and apply provider webhooks. Money state is written
 * only by security-definer functions (migration 070) — the session client opens/refunds as the creator, the service
 * client records provider references and applies verified events. docs/compliance/payments.md.
 */

type Order = { id: string; status: string; provider: ProviderName | null; checkout_url: string | null; expires_at: string; amount_minor: number; currency: string; description: string; provider_payment_ref: string | null };

/** DB refusals that the creator should read as they are. */
const KNOWN: Array<[RegExp, string]> = [
  [/only an active licence/, "Only an active licence can be paid."],
  [/no fee/, "This licence has no fee to pay."],
  [/already paid/, "This licence is already paid."],
  [/license not found|order not found/, "We couldn't find that."],
  [/only a paid order/, "Only a paid order can be refunded."],
  [/refund exceeds/, "That's more than was paid (or is already being refunded)."],
];
function dbError(error: { code?: string; message?: string }): DomainError {
  const hit = KNOWN.find(([re]) => re.test(error.message ?? ""));
  if (!hit) return fromDbError(error);
  return new DomainError(error.code === "P0002" ? "not_found" : error.code === "23505" ? "conflict" : "validation", hit[1], { cause: error });
}

export interface PaymentDeps {
  /** The creator's session client. */
  db: Db;
  /** Service client — only for recording provider references (pipeline-owned state). */
  service: Db;
  config: PaymentsConfig;
  appOrigin: string;
  fetchImpl?: FetchLike;
}

/** Opens (or reuses) the order for a licence and returns where to pay. Never charges twice: one live order per licence. */
export async function openCheckout(deps: PaymentDeps, licenseId: string): Promise<{ orderId: string; checkoutUrl: string; provider: ProviderName }> {
  const { data, error } = await deps.db.rpc("payment_order_open", { p_license: licenseId });
  if (error) throw dbError(error);
  const order = data as unknown as Order;
  if (order.status === "open" && order.checkout_url && order.provider && new Date(order.expires_at).getTime() > Date.now() + 5 * 60_000) {
    return { orderId: order.id, checkoutUrl: order.checkout_url, provider: order.provider };
  }
  const name = order.provider ?? chooseProvider(order.currency, deps.config);
  const provider = providerByName(name, deps.config, deps.fetchImpl);
  const returnUrl = `${deps.appOrigin}/payments/${order.id}`;
  const checkout = await provider.createCheckout({
    orderId: order.id,
    amountMinor: Number(order.amount_minor),
    currency: order.currency,
    description: order.description,
    returnUrl,
    cancelUrl: `${returnUrl}?cancelled=1`,
    expiresAt: new Date(order.expires_at),
  });
  const attached = await deps.service.rpc("payment_order_attach", { p_order: order.id, p_provider: name, p_ref: checkout.ref, p_url: checkout.url, p_expires_at: checkout.expiresAt.toISOString() });
  if (attached.error) throw dbError(attached.error);
  return { orderId: order.id, checkoutUrl: checkout.url, provider: name };
}

export const refundSchema = z.object({
  amountMinor: z.number().int().positive(),
  reason: z.string().trim().min(3).max(500),
});

/** The payee refunds (part of) a paid order. The caller has already re-checked their password (step-up). */
export async function requestRefund(deps: PaymentDeps, orderId: string, raw: unknown): Promise<{ refundId: string; status: "pending" | "failed" }> {
  const v = refundSchema.parse(raw);
  const { data, error } = await deps.db.rpc("payment_refund_request", { p_order: orderId, p_amount_minor: v.amountMinor, p_reason: v.reason });
  if (error) throw dbError(error);
  const refund = data as unknown as { id: string };
  const { data: order } = await deps.db.from("payment_orders").select("provider, provider_payment_ref").eq("id", orderId).single();
  if (!order?.provider || !order.provider_payment_ref) throw new DomainError("validation", "This payment can't be refunded here.");
  let result: { ref: string | null; failed: boolean };
  try {
    const r = await providerByName(order.provider as ProviderName, deps.config, deps.fetchImpl).refund({ refundId: refund.id, paymentRef: order.provider_payment_ref, amountMinor: v.amountMinor });
    result = { ref: r.ref, failed: r.failed };
  } catch (e) {
    await deps.service.rpc("payment_refund_attach", { p_refund: refund.id, p_ref: null as unknown as string, p_failed: true });
    throw e;
  }
  const attached = await deps.service.rpc("payment_refund_attach", { p_refund: refund.id, p_ref: result.ref as string, p_failed: result.failed });
  if (attached.error) throw dbError(attached.error);
  return { refundId: refund.id, status: result.failed ? "failed" : "pending" };
}

/**
 * Applies a provider webhook: verify the signature, normalise, and let `payment_apply_event` move the money state
 * atomically and idempotently. Returns the outcome (applied, duplicate, ignored, unmatched…).
 */
export async function applyWebhook(service: Db, config: PaymentsConfig, name: ProviderName, headers: Headers, body: string, now?: Date): Promise<string> {
  const provider = providerByName(name, config);
  const event = provider.parseWebhook(headers, body, now);
  const { data, error } = await service.rpc("payment_apply_event", {
    p_provider: name,
    p_event_id: event.eventId,
    p_event_type: event.eventType,
    p_body_sha256: createHash("sha256").update(body).digest("hex"),
    p_kind: event.kind,
    p_ref: event.ref,
    p_payment: event.payment,
    p_refund_ref: event.refundRef,
    p_amount: event.amountMinor,
    p_currency: event.currency?.toUpperCase(),
  });
  if (error) throw fromDbError(error);
  return data as string;
}

/** Payments the creator received (as payee) or made (as payer), newest first. */
export async function listPayments(db: Db, opts: { licenseId?: string } = {}) {
  let q = db
    .from("payment_orders")
    .select("id, creator_id, payer_creator_id, license_id, artifact_id, description, amount_minor, currency, provider, status, refunded_minor, paid_at, created_at, checkout_url, expires_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (opts.licenseId) q = q.eq("license_id", opts.licenseId);
  const { data, error } = await q;
  if (error) throw fromDbError(error);
  return data ?? [];
}

export async function getPayment(db: Db, orderId: string) {
  const { data, error } = await db
    .from("payment_orders")
    .select("id, creator_id, payer_creator_id, license_id, artifact_id, description, amount_minor, currency, provider, status, refunded_minor, paid_at, created_at, checkout_url, expires_at")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new DomainError("not_found", "We couldn't find that payment.");
  return data;
}
