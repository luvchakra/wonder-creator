import { getPayment } from "@wonder/creator-payments";
import { requireUuid, withApi } from "@/lib/api";

/** GET /api/v1/payments/:id — one payment, for its payee or payer (the return page polls this). */
export const GET = withApi<{ id: string }>(async ({ db }, { id }) => ({ payment: await getPayment(db, requireUuid(id, "payment")) }));
