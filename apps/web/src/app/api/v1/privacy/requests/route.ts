import { filePrivacyRequest, myPrivacyRequests } from "@wonder/creator-identity";
import { readJson, withApi } from "@/lib/api";

/** Data-principal requests the creator has filed, with status and the date we owe an answer by. */
export const GET = withApi(async ({ db }) => ({ requests: await myPrivacyRequests(db) }));

/** File a request (access, correction, erasure, portability, objection, consent withdrawal, nomination, grievance). */
export const POST = withApi(async ({ db, creatorId, req }) => ({ request: await filePrivacyRequest(db, creatorId, await readJson(req)) }), { rateLimit: 10 });
