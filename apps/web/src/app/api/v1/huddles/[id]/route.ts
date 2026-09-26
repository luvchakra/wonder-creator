import { roomState } from "@wonder/creator-huddle";
import { selectMediaProvider } from "@wonder/creator-huddle/media";
import { requireUuid, withApi } from "@/lib/api";

/** Room state. Participants see everything; others only what RLS allows (their own request). */
export const GET = withApi<{ id: string }>(async ({ db, creatorId }, { id }) => {
  const state = await roomState(db, requireUuid(id, "Huddle"), creatorId);
  return { ...state, media: { configured: selectMediaProvider().configured } };
}, { rateLimit: 240 });
