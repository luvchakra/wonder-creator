import { configureHuddle, relatedItem, roomState } from "@wonder/creator-huddle";
import { selectMediaProvider } from "@wonder/creator-huddle/media";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** Room state. Participants see everything; others only what RLS allows (their own request). */
export const GET = withApi<{ id: string }>(async ({ db, creatorId }, { id }) => {
  const huddleId = requireUuid(id, "Huddle");
  const state = await roomState(db, huddleId, creatorId);
  const related = state.me?.status === "joined" ? await relatedItem(db, huddleId).catch(() => null) : null;
  return { ...state, related, media: { configured: selectMediaProvider().configured } };
}, { rateLimit: 240 });

/** Host settings while live: description, related piece/material, whether chat moments may be saved. */
export const PATCH = withApi<{ id: string }>(async ({ db, req }, { id }) => ({ huddle: await configureHuddle(db, requireUuid(id, "Huddle"), await readJson(req)) }), { rateLimit: 30 });
