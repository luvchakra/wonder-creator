import { applyWebhook, paymentsConfigFromEnv } from "@wonder/creator-payments";
import { DomainError, isDomainError, log } from "@wonder/core";
import { withApi } from "@/lib/api";
import { serviceClient } from "@/lib/supabase/service";

/**
 * POST /api/v1/payments/webhooks/stripe — Stripe events (`Stripe-Signature`: HMAC-SHA256 of "t.body", 5-minute window).
 * No session: the signature is the authentication. Applied once per provider event id; amounts are checked
 * against the order before anything settles.
 */
export const POST = withApi(
  async ({ req, requestId }) => {
    const body = await req.text();
    if (body.length > 256_000) throw new DomainError("payload_too_large", "That event is too large.");
    try {
      const outcome = await applyWebhook(serviceClient(), paymentsConfigFromEnv(), "stripe", req.headers, body);
      return { received: true, outcome };
    } catch (e) {
      if (isDomainError(e) && e.code === "security_rejected") log("warn", "payments.webhook_rejected", { requestId, provider: "stripe", reason: e.message });
      throw e;
    }
  },
  { public: true, rateLimit: 600 },
);
