import { listCrewMessages, postCrewMessage } from "@wonder/creator-projects";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

const query = z.object({ before: z.string().datetime({ offset: true }).optional() });

/** The crew's chat (active members only), oldest first; `before` pages back. */
export const GET = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => listCrewMessages(db, creatorId, requireUuid(id, "crew"), query.parse(Object.fromEntries(req.nextUrl.searchParams))));

export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => ({ message: await postCrewMessage(db, creatorId, requireUuid(id, "crew"), await readJson(req, 20_000)) }), { rateLimit: 60 });
