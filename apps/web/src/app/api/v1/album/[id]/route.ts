import { readJson, requireUuid, withApi } from "@/lib/api";
import { removeAlbumPhoto, updateAlbumPhoto } from "@/lib/album";

/** PATCH `{caption}` — caption one of your photos. */
export const PATCH = withApi<{ id: string }>(async ({ db, req }, { id }) => (await updateAlbumPhoto(db, requireUuid(id, "photo"), await readJson(req)), { ok: true }), { feature: "photo_album_enabled", rateLimit: 60 });

/** DELETE — take a photo out of your album (its files are deleted). */
export const DELETE = withApi<{ id: string }>(async ({ db, creatorId }, { id }) => (await removeAlbumPhoto(db, creatorId, requireUuid(id, "photo")), { ok: true }), { feature: "photo_album_enabled", rateLimit: 60 });
