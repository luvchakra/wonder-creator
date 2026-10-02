import { requestRefund } from "@wonder/creator-payments";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";
import { paymentDeps } from "@/lib/payments";
import { requirePassword } from "@/lib/step-up";

/**
 * POST /api/v1/payments/:id/refunds `{amountMinor, reason, password}` — the payee refunds (part of) a payment.
 * Money leaving: the password is asked again, the request is audited, and the provider's webhook settles it.
 */
export const POST = withApi<{ id: string }>(async ({ db, userId, req }, { id }) => {
  const body = z.object({ amountMinor: z.number().int().positive(), reason: z.string().trim().min(3).max(500), password: z.string().max(200).optional() }).parse(await readJson(req));
  await requirePassword(db, userId, body.password, "issue a refund");
  return requestRefund(paymentDeps(db, req), requireUuid(id, "payment"), { amountMinor: body.amountMinor, reason: body.reason });
}, { rateLimit: 5 });
