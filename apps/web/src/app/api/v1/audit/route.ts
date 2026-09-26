import { withApi } from "@/lib/api";
import { listAudit } from "@/lib/audit";

/** The creator's own security & audit history, filtered by category and date range. */
export const GET = withApi(async ({ db, req }) => listAudit(db, Object.fromEntries(req.nextUrl.searchParams)));
