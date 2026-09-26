import { audit } from "@wonder/core";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";
import { describeRequest } from "@/lib/device";

/** Recorded by the app right after a sign-in or sign-up, so it shows in the creator's security history. */
export const POST = withApi(async ({ db, creatorId, req, requestId }) => {
  const { event } = z.object({ event: z.enum(["signed_in", "signed_up"]) }).parse(await readJson(req));
  await audit(db, { action: `auth.${event}`, objectType: "creator", objectId: creatorId, metadata: describeRequest(req), requestId });
  return { ok: true };
}, { rateLimit: 10 });
