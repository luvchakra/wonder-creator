import { report } from "@wonder/creator-huddle";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** Report a post or one of its replies for safety review. */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => {
  const body = (await readJson(req)) as Record<string, unknown>;
  const { replyId } = z.object({ replyId: z.string().uuid().optional() }).parse({ replyId: body.replyId ?? undefined });
  await report(db, creatorId, replyId ? "scrapbook_reply" : "scrapbook_post", replyId ?? requireUuid(id, "post"), body);
  return { ok: true };
}, { rateLimit: 10 });
