import { myConsents, recordConsents } from "@wonder/creator-identity";
import { readJson, withApi } from "@/lib/api";

/** The creator's current consent choices (latest per purpose) — GDPR Art. 7; DPDP §6. */
export const GET = withApi(async ({ db }) => ({ consents: await myConsents(db) }));

/** Record choices against the current notice version. Append-only: withdrawing is a new `granted: false` row. */
export const POST = withApi(async ({ db, creatorId, req }) => ({ consents: await recordConsents(db, creatorId, await readJson(req)) }), { rateLimit: 30 });
