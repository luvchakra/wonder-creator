import { z } from "zod";
import { readJson, withApi } from "@/lib/api";

const schema = z.object({ workId: z.string().uuid(), kind: z.enum(["view", "complete", "share"]) });

/**
 * POST /api/v1/public/events — a published work was viewed, finished (carousel end, film/recording end) or shared
 * (§38). Daily counts only: no visitor, no cookie, no content. Open to signed-out readers.
 */
export const POST = withApi(
  async ({ db, req }) => {
    const b = schema.parse(await readJson(req, 1000));
    await db.rpc("record_publication_event", { p_work: b.workId, p_kind: b.kind });
    return { ok: true };
  },
  { public: true, rateLimit: 30 },
);
