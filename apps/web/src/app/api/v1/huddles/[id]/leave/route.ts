import { leaveHuddle } from "@wonder/creator-huddle";
import { selectMediaProvider } from "@wonder/creator-huddle/media";
import { after } from "next/server";
import { requireUuid, withApi } from "@/lib/api";

export const POST = withApi<{ id: string }>(async ({ db, creatorId }, { id }) => {
  const huddleId = requireUuid(id, "Huddle");
  const res = await leaveHuddle(db, huddleId);
  const media = selectMediaProvider();
  // A lingering client (another tab, a dropped leave) must not keep media after leaving.
  after(() => (res.dissolved ? media.endRoom({ huddleId }) : media.evictParticipant({ huddleId, creatorId })));
  return res;
});
