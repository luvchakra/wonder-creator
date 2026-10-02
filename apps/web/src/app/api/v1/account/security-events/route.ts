import { audit } from "@wonder/core";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { describeRequest } from "@/lib/device";

/**
 * Recorded by the app right after a sign-in, sign-up, two-step verification change or password reset, so it shows in
 * the creator's security history. Client-reported, so it records only the creator's own events.
 */
export const POST = withApi(async ({ db, creatorId, req, requestId }) => {
  const { event } = z.object({ event: z.enum(["signed_in", "signed_up", "mfa_verified", "mfa_enrolled", "mfa_removed", "password_reset"]) }).parse(await readJson(req));
  await audit(db, { action: `auth.${event}`, objectType: "creator", objectId: creatorId, metadata: describeRequest(req), requestId });
  return { ok: true };
}, { rateLimit: 10, allowPendingMfa: true });
