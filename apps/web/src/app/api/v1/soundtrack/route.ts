import { soundtrackLibrary, SOUNDTRACK_BUCKET } from "@wonder/creator-soundtrack/server";
import { withApi } from "@/lib/api";

/** GET /api/v1/soundtrack — the licensed library with where to stream each track, and the creator's favourites. */
export const GET = withApi(async ({ db, creatorId }) => soundtrackLibrary(db, creatorId, (path) => db.storage.from(SOUNDTRACK_BUCKET).getPublicUrl(path).data.publicUrl));
