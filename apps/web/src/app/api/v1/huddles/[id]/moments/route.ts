import { saveMoment } from "@wonder/creator-huddle";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** Save a chat message as your own material (yours, or others' only where the host allowed saving when it was sent). */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => {
  const { messageId } = z.object({ messageId: z.string().uuid() }).parse(await readJson(req));
  return { material: await saveMoment(db, creatorId, requireUuid(id, "Huddle"), messageId) };
}, { rateLimit: 30 });
