import { heartbeat } from "@wonder/creator-huddle";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

export const POST = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  const b = z.object({ audio: z.boolean().optional(), video: z.boolean().optional() }).parse(await readJson(req));
  return { status: await heartbeat(db, requireUuid(id, "Huddle"), b.audio, b.video) };
}, { rateLimit: 30 });
