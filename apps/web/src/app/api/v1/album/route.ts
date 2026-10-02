import { DomainError } from "@wonder/core";
import { withApi } from "@/lib/api";
import { addAlbumPhoto, albumOf } from "@/lib/album";
import { track } from "@/lib/telemetry";

/** GET /api/v1/album?creator=<id> — a creator's album as the caller may see it. */
export const GET = withApi(
  async ({ db, creatorId, req }) => {
    const who = req.nextUrl.searchParams.get("creator") ?? creatorId;
    if (!/^[0-9a-f-]{36}$/i.test(who)) throw new DomainError("validation", "Say whose album.");
    return { photos: await albumOf(db, who) };
  },
  { feature: "photo_album_enabled" },
);

/** POST multipart `file` (+ `caption`) — add a photo to your album. Checked, resized, metadata stripped. */
export const POST = withApi(
  async ({ db, creatorId, req }) => {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new DomainError("validation", "Choose a photo.");
    const caption = form.get("caption");
    const id = await addAlbumPhoto(db, creatorId, file, typeof caption === "string" ? caption.slice(0, 200) : null);
    track(db, "album_photo_added", creatorId);
    return Response.json({ id }, { status: 201 });
  },
  { feature: "photo_album_enabled", rateLimit: 60 },
);
