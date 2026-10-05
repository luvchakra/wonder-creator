import { saveDeck } from "@wonder/creator-studio";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** Save a Presentation's slides as a new version (creation-pages.md, step 4). */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => ({ version: await saveDeck(db, creatorId, requireUuid(id, "Creation"), await readJson(req, 300_000)) }), { rateLimit: 60, reindex: true });
