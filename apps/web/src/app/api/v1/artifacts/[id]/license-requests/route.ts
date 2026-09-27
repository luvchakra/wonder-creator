import { listLicenseRequests, requestLicense } from "@wonder/creator-studio";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** The owner sees every request for the piece; anyone else only their own (RLS). */
export const GET = withApi<{ id: string }>(async ({ db }, { id }) => ({ requests: await listLicenseRequests(db, requireUuid(id, "Creation")) }));

/** Ask the owner for a license (proposed use + terms). */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => ({ request: await requestLicense(db, creatorId, requireUuid(id, "Creation"), await readJson(req)) }), { rateLimit: 10 });
