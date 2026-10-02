import { readJson, withApi } from "@/lib/api";
import { orderAlbum } from "@/lib/album";

/** POST `{ids}` — set your album's order. */
export const POST = withApi(async ({ db, creatorId, req }) => (await orderAlbum(db, creatorId, await readJson(req)), { ok: true }), { feature: "photo_album_enabled", rateLimit: 30 });
