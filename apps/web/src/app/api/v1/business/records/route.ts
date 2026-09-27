import { addBusinessEntry, listBusinessRecords } from "@wonder/creator-studio";
import { readJson, withApi } from "@/lib/api";

/** GET /api/v1/business/records — the creator's economic records. POST — add their own entry. */
export const GET = withApi(async ({ db }) => ({ records: await listBusinessRecords(db) }));
export const POST = withApi(async ({ db, creatorId, req }) => ({ record: await addBusinessEntry(db, creatorId, await readJson(req)) }), { rateLimit: 30 });
