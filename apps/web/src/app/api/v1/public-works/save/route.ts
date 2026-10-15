import { savePublishedWork } from "@wonder/creator-studio";
import { readJson, withApi } from "@/lib/api";
import { siteOrigin } from "@/lib/public-pages";
import { track } from "@/lib/telemetry";

/** POST /api/v1/public-works/save { handle, slug } — "Save reference" (CreatorPublish §21): someone's published work, linked and credited, in your Materials. */
export const POST = withApi(
  async ({ db, creatorId, req }) => {
    const r = await savePublishedWork(db, creatorId, await readJson(req), await siteOrigin());
    if (!r.already) track(db, "published_work_saved", creatorId);
    return r;
  },
  { rateLimit: 30, reindex: true },
);
