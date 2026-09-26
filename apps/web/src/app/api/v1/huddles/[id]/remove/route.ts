import { removeParticipant } from "@wonder/creator-huddle";
import { selectMediaProvider } from "@wonder/creator-huddle/media";
import { after } from "next/server";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

export const POST = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  const huddleId = requireUuid(id, "Huddle");
  const { creatorId } = z.object({ creatorId: z.string().uuid() }).parse(await readJson(req));
  await removeParticipant(db, huddleId, creatorId);
  // Cut their audio/video now; the control plane already refuses them a new token.
  after(() => selectMediaProvider().evictParticipant({ huddleId, creatorId }));
  return { ok: true };
});
