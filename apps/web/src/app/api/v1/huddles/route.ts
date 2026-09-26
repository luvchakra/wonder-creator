import { liveCards, startHuddle } from "@wonder/creator-huddle";
import { selectMediaProvider } from "@wonder/creator-huddle/media";
import { after } from "next/server";
import { readJson, withApi } from "@/lib/api";
import { sweepStalePresence } from "@/lib/presence";

/** Live Huddles: public metadata only. */
export const GET = withApi(async ({ db, req }) => {
  after(sweepStalePresence);
  const creator = req.nextUrl.searchParams.get("creator");
  return { huddles: await liveCards(db, { limit: 48, creatorId: creator && /^[0-9a-f-]{36}$/i.test(creator) ? creator : undefined }) };
});

export const POST = withApi(async ({ db, req }) => {
  const id = await startHuddle(db, await readJson(req));
  const media = selectMediaProvider();
  if (media.configured) await media.createRoom({ huddleId: id }).catch(() => undefined);
  return { id };
}, { rateLimit: 10 });
