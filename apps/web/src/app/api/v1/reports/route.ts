import { report, type ReportContext } from "@wonder/creator-huddle";
import { z } from "zod";
import { readJson, withApi } from "@/lib/api";

/** POST /api/v1/reports `{contextType, contextId, reportedCreatorId?, reason, details?}` — for Community items. */
export const POST = withApi(
  async ({ db, creatorId, req }) => {
    const body = (await readJson(req)) as Record<string, unknown>;
    const { contextType, contextId } = z
      .object({ contextType: z.enum(["open_conversation", "open_conversation_reply", "scrapbook_post", "profile"]), contextId: z.string().uuid() })
      .parse(body);
    await report(db, creatorId, contextType as ReportContext, contextId, body);
    return { ok: true };
  },
  { rateLimit: 10 },
);
