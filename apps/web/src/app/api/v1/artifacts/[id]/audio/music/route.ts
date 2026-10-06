import { saveAudioMusic } from "@wonder/creator-studio";
import { TRACKS } from "@wonder/creator-soundtrack";
import { readJson, requireUuid, withApi } from "@/lib/api";

/**
 * POST /api/v1/artifacts/:id/audio/music — background music under the take (owner, 6 Oct 2026): the track (from the
 * library — its title, artist, license and credit are taken from here, not from the request), its trim, tempo and
 * level, and the mix the creator's device made. `{ bed: null }` takes the music away. A new version either way.
 */
export const POST = withApi<{ id: string }>(
  async ({ db, creatorId, req }, { id }) => ({
    version: await saveAudioMusic(db, creatorId, requireUuid(id, "Creation"), await readJson(req, 20_000), (trackId) => {
      const t = TRACKS.find((x) => x.id === trackId);
      return t ? { id: t.id, title: t.title, artist: t.artist, license: t.license, attribution: t.attribution ?? null, duration: t.duration } : null;
    }),
  }),
  { rateLimit: 30, reindex: true },
);
