import { openCheckout } from "@wonder/creator-payments";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { paymentDeps } from "@/lib/payments";

/**
 * POST /api/v1/payments/checkout `{licenseId}` — where to pay a licence fee: a hosted Stripe Checkout or Razorpay
 * payment page. The amount comes from the licence; one live order per licence, so asking twice never charges twice.
 */
export const POST = withApi(async ({ db, req }) => {
  const { licenseId } = z.object({ licenseId: z.string().uuid() }).parse(await readJson(req));
  return openCheckout(paymentDeps(db, req), licenseId);
}, { rateLimit: 10 });
