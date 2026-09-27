import { setFavorite } from "@wonder/creator-soundtrack/server";
import { withApi } from "@/lib/api";

/** PUT / DELETE /api/v1/soundtrack/favourites/:trackId — favourite a song (♥) or not. */
export const PUT = withApi<{ trackId: string }>(async ({ db, creatorId }, { trackId }) => (await setFavorite(db, creatorId, trackId, true), { ok: true }), { rateLimit: 60 });
export const DELETE = withApi<{ trackId: string }>(async ({ db, creatorId }, { trackId }) => (await setFavorite(db, creatorId, trackId, false), { ok: true }), { rateLimit: 60 });
