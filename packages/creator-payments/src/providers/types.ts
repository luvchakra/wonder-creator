export type ProviderName = "stripe" | "razorpay";

export interface CheckoutRequest {
  orderId: string;
  amountMinor: number;
  currency: string;
  description: string;
  /** Where the payer comes back to (our /payments/return page). */
  returnUrl: string;
  cancelUrl: string;
  expiresAt: Date;
}

export interface Checkout {
  ref: string;
  url: string;
  expiresAt: Date;
}

export interface RefundRequest {
  refundId: string;
  paymentRef: string;
  amountMinor: number;
}

export interface RefundResult {
  ref: string;
  failed: boolean;
}

/** A verified provider event, reduced to what the ledger needs (see `payment_apply_event`). */
export interface NormalisedEvent {
  provider: ProviderName;
  eventId: string;
  eventType: string;
  kind: "paid" | "expired" | "failed" | "refund_succeeded" | "refund_failed" | "ignored";
  ref?: string;
  payment?: string;
  refundRef?: string;
  amountMinor?: number;
  currency?: string;
}

export interface PaymentProvider {
  readonly name: ProviderName;
  createCheckout(req: CheckoutRequest): Promise<Checkout>;
  refund(req: RefundRequest): Promise<RefundResult>;
  /** Verifies the signature and parses the event; throws `security_rejected` when it isn't genuine. */
  parseWebhook(headers: Headers, body: string, now?: Date): NormalisedEvent;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
