import { signedUrlsFor } from "@wonder/creator-library";
import { sourceDetail, suggestFragments } from "@wonder/creator-studio";
import { withApi } from "@/lib/api";
import { assertUuid } from "@/lib/studio";

/** GET — what a source holds, for making fragments of it: its words, how long it plays, and suggested passages. */
export const GET = withApi<{ id: string; sourceId: string }>(async ({ db }, { id, sourceId }) => {
  assertUuid(id, sourceId);
  const d = await sourceDetail(db, sourceId);
  const urls = d.audioObjectId ? await signedUrlsFor(db, [d.audioObjectId]) : {};
  return { text: d.text, durationSeconds: d.durationSeconds, mediaType: d.mediaType, audioUrl: d.audioObjectId ? (urls[d.audioObjectId] ?? null) : null, suggested: d.text ? suggestFragments(d.text) : [] };
});
