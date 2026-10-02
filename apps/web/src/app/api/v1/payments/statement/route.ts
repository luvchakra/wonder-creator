import { audit, fromDbError } from "@wonder/core";
import { withApi } from "@/lib/api";

/** Spreadsheet-safe cell: quoted, and never read as a formula (CSV injection). */
function cell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/**
 * GET /api/v1/payments/statement?year=YYYY — the creator's payment ledger lines for a year as CSV (double entry, minor
 * units, provider references), for their accountant. Only their own books (RLS); the download is audited.
 */
export const GET = withApi(async ({ db, creatorId, req, requestId }) => {
  const y = Number(req.nextUrl.searchParams.get("year"));
  const year = Number.isInteger(y) && y >= 2020 && y <= 2100 ? y : new Date().getUTCFullYear();
  const { data, error } = await db.rpc("my_payment_statement", { p_from: `${year}-01-01`, p_to: `${year}-12-31` });
  if (error) throw fromDbError(error);
  const head = ["posted_at", "journal_id", "account", "debit_minor", "credit_minor", "currency", "memo", "order_id", "refund_id", "provider", "provider_payment_ref", "description"];
  const lines = [head.join(","), ...(data ?? []).map((r) => head.map((k) => cell((r as Record<string, unknown>)[k])).join(","))];
  await audit(db, { action: "business.statement_exported", objectType: "creator", objectId: creatorId, metadata: { year }, requestId }).catch(() => undefined);
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="wonder-creator-payments-${year}.csv"`, "cache-control": "no-store" },
  });
}, { rateLimit: 10 });
