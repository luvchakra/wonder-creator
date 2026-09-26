import { DomainError } from "@wonder/core";
import { actOnLicenseRequest, getLicenseRequest, isConsequential, licenseTermsSchema, respondToLicenseRequest } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";
import { requirePassword } from "@/lib/step-up";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), note: z.string().trim().max(1000).optional(), password: z.string().optional() }),
  z.object({ action: z.literal("decline"), note: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal("counter"), note: z.string().trim().max(1000).optional(), counter: licenseTermsSchema, password: z.string().optional() }),
  z.object({ action: z.literal("accept_counter") }),
  z.object({ action: z.literal("withdraw") }),
]);

/**
 * Owner: approve / decline / counter. Requester: accept a counter / withdraw.
 * Granting or offering consequential terms (commercial, paid, limited edition, exclusive) needs the
 * owner's password; CreatorBrain can never do any of this on its own.
 */
export const POST = withApi<{ id: string }>(async ({ db, userId, req }, { id }) => {
  const requestId = requireUuid(id, "request");
  const b = body.parse(await readJson(req));
  if (b.action === "accept_counter" || b.action === "withdraw") return { request: await actOnLicenseRequest(db, requestId, b.action) };
  const current = await getLicenseRequest(db, requestId);
  if (b.action === "approve" && current.consequential) await requirePassword(db, userId, b.password, "approve this license");
  if (b.action === "counter") {
    if (isConsequential(b.counter)) await requirePassword(db, userId, b.password, "offer these license terms");
    return { request: await respondToLicenseRequest(db, requestId, { decision: "counter", note: b.note, counter: b.counter }) };
  }
  if (b.action !== "approve" && b.action !== "decline") throw new DomainError("validation", "Unknown action.");
  return { request: await respondToLicenseRequest(db, requestId, { decision: b.action, note: b.note }) };
});
