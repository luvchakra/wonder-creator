import { moderateConversation } from "@wonder/creator-community";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** POST `{remove, reason}` — platform moderators only (checked and audited in the database). */
export const POST = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  const b = z.object({ remove: z.boolean(), reason: z.string().trim().max(300).optional() }).parse(await readJson(req));
  await moderateConversation(db, requireUuid(id, "conversation"), b.remove, b.reason);
  return { ok: true };
}, { feature: "open_conversations_enabled" });
