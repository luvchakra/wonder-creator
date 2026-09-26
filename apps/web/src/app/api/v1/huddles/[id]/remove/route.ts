import { removeParticipant } from "@wonder/creator-huddle";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

export const POST = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  const { creatorId } = z.object({ creatorId: z.string().uuid() }).parse(await readJson(req));
  await removeParticipant(db, requireUuid(id, "Huddle"), creatorId);
  return { ok: true };
});
