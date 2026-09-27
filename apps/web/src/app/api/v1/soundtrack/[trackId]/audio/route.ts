import { DomainError } from "@wonder/core";
import { SOUNDTRACK_BUCKET, trackAudioPath } from "@wonder/creator-soundtrack/server";
import { withApi } from "@/lib/api";
import { serviceClient } from "@/lib/supabase/service";

export const maxDuration = 60;

/**
 * GET /api/v1/soundtrack/:trackId/audio — CreativeRadio's stream for a song not yet in our storage: it's mirrored from
 * its licensed source (hash-checked) on first play, then the player is sent to the stored file. The library points
 * straight at storage once a song is mirrored.
 */
export const GET = withApi<{ trackId: string }>(
  async (_ctx, { trackId }) => {
    if (!/^[a-z0-9-]{1,60}$/.test(trackId)) throw new DomainError("not_found", "That song isn't in the library.");
    const service = serviceClient();
    const path = await trackAudioPath(service, trackId);
    const url = service.storage.from(SOUNDTRACK_BUCKET).getPublicUrl(path).data.publicUrl;
    return new Response(null, { status: 302, headers: { location: url, "cache-control": "private, max-age=3600" } });
  },
  { rateLimit: 30 },
);
