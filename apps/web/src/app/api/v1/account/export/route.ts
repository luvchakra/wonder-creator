import { audit } from "@wonder/core";
import { exportPersonalData } from "@wonder/creator-identity";
import { NOTICE_VERSION } from "@wonder/creator-identity/privacy-options";
import { withApi } from "@/lib/api";

/**
 * Personal-data export (GDPR Art. 15 and 20; DPDP §11): every table holding the creator's rows, as machine-readable
 * JSON. RLS guarantees only their own rows; EXPORT_TABLES is checked against the schema in tests/db/privacy.test.ts.
 */
export const GET = withApi(async ({ db, creatorId, requestId }) => {
  const data = await exportPersonalData(db, creatorId);
  const out = { exportedAt: new Date().toISOString(), noticeVersion: NOTICE_VERSION, format: "wonder-creator-export/2", ...data };
  await audit(db, { action: "account.exported", objectType: "creator", objectId: creatorId, requestId });
  return new Response(JSON.stringify(out, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="wonder-creator-export.json"`, "cache-control": "no-store" },
  });
}, { rateLimit: 5 });
