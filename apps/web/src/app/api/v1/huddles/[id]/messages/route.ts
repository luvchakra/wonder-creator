import { sendMessage } from "@wonder/creator-huddle";
import { readJson, requireUuid, withApi } from "@/lib/api";

export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => ({ message: await sendMessage(db, creatorId, requireUuid(id, "Huddle"), await readJson(req, 10_000)) }), { rateLimit: 40 });
