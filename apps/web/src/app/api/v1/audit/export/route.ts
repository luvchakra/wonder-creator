import { audit } from "@wonder/core";
import { withApi } from "@/lib/api";
import { auditCsv, listAudit } from "@/lib/audit";

/** Download the filtered history as CSV (up to 1,000 entries). Exporting is itself recorded. */
export const GET = withApi(async ({ db, creatorId, req, requestId }) => {
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const { entries } = await listAudit(db, { ...params, before: undefined, limit: 1000 });
  await audit(db, { action: "audit.exported", objectType: "creator", objectId: creatorId, metadata: { category: params.category ?? "all", from: params.from ?? null, to: params.to ?? null }, requestId });
  return new Response(auditCsv(entries), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="wonder-creator-activity.csv"`, "cache-control": "no-store" },
  });
}, { rateLimit: 10 });
