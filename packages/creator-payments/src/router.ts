import { DomainError } from "@wonder/core";
import { RazorpayProvider } from "./providers/razorpay";
import { StripeProvider } from "./providers/stripe";
import type { FetchLike, PaymentProvider, ProviderName } from "./providers/types";

export interface PaymentsConfig {
  stripe?: { secretKey: string; webhookSecret: string };
  razorpay?: { keyId: string; keySecret: string; webhookSecret: string };
}

/** Reads provider credentials from the server environment. A provider counts only when all its keys are present. */
export function paymentsConfigFromEnv(env: Record<string, string | undefined> = process.env): PaymentsConfig {
  const v = (k: string) => env[k]?.trim() || undefined;
  const sk = v("STRIPE_SECRET_KEY");
  const swh = v("STRIPE_WEBHOOK_SECRET");
  const rid = v("RAZORPAY_KEY_ID");
  const rsec = v("RAZORPAY_KEY_SECRET");
  const rwh = v("RAZORPAY_WEBHOOK_SECRET");
  return {
    stripe: sk && swh ? { secretKey: sk, webhookSecret: swh } : undefined,
    razorpay: rid && rsec && rwh ? { keyId: rid, keySecret: rsec, webhookSecret: rwh } : undefined,
  };
}

export function paymentsReadiness(config: PaymentsConfig): { stripe: boolean; razorpay: boolean; any: boolean } {
  return { stripe: !!config.stripe, razorpay: !!config.razorpay, any: !!(config.stripe || config.razorpay) };
}

export function providerByName(name: ProviderName, config: PaymentsConfig, fetchImpl?: FetchLike): PaymentProvider {
  if (name === "stripe" && config.stripe) return new StripeProvider(config.stripe.secretKey, config.stripe.webhookSecret, fetchImpl);
  if (name === "razorpay" && config.razorpay) return new RazorpayProvider(config.razorpay.keyId, config.razorpay.keySecret, config.razorpay.webhookSecret, fetchImpl);
  throw new DomainError("provider_unavailable", "Payments aren't connected.");
}

/**
 * Which provider collects a payment: Razorpay for INR (UPI, Indian cards, netbanking) when it's connected; Stripe for
 * every other currency, and for INR when Razorpay isn't connected. Deterministic, so a retry picks the same one.
 */
export function chooseProvider(currency: string, config: PaymentsConfig): ProviderName {
  const c = currency.toUpperCase();
  if (c === "INR" && config.razorpay) return "razorpay";
  if (config.stripe) return "stripe";
  throw new DomainError("provider_unavailable", c === "INR" || !config.razorpay ? "Payments aren't connected." : `Payments in ${c} aren't connected.`);
}
