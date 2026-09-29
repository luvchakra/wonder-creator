import { getCreatorPage, saveCreatorPage } from "@wonder/creator-studio";
import { readJson, withApi } from "@/lib/api";

/** GET/PATCH /api/v1/creator-page — the creator's curated public home: sections, featured work, public DejaVus and Moments, links. */
export const GET = withApi(async ({ db, creatorId }) => ({ page: await getCreatorPage(db, creatorId) }));
export const PATCH = withApi(async ({ db, creatorId, req }) => ({ page: await saveCreatorPage(db, creatorId, await readJson(req)) }), { rateLimit: 60 });
