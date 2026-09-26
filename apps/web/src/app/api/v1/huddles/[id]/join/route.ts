import { cancelRequest, requestJoin } from "@wonder/creator-huddle";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

export const POST = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  const { message } = z.object({ message: z.string().trim().max(280).optional() }).parse(await readJson(req));
  return { requestId: await requestJoin(db, requireUuid(id, "Huddle"), message) };
}, { rateLimit: 20 });

export const DELETE = withApi<{ id: string }>(async ({ db, req }) => {
  const { requestId } = z.object({ requestId: z.string().uuid() }).parse(await readJson(req));
  await cancelRequest(db, requestId);
  return { ok: true };
});
