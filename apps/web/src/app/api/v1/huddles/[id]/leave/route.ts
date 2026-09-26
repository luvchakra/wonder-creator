import { leaveHuddle } from "@wonder/creator-huddle";
import { selectMediaProvider } from "@wonder/creator-huddle/media";
import { after } from "next/server";
import { requireUuid, withApi } from "@/lib/api";

export const POST = withApi<{ id: string }>(async ({ db }, { id }) => {
  const huddleId = requireUuid(id, "Huddle");
  const res = await leaveHuddle(db, huddleId);
  if (res.dissolved) after(() => selectMediaProvider().endRoom({ huddleId }));
  return res;
});
