import { listPayments } from "@wonder/creator-payments";
import { withApi } from "@/lib/api";

/** GET /api/v1/payments[?licenseId=] — payments the creator received or made (RLS: payee or payer only). */
export const GET = withApi(async ({ db, req }) => {
  const licenseId = req.nextUrl.searchParams.get("licenseId") ?? undefined;
  return { payments: await listPayments(db, { licenseId: licenseId && /^[0-9a-f-]{36}$/i.test(licenseId) ? licenseId : undefined }) };
});
