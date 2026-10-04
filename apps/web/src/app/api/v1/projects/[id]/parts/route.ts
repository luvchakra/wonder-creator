import { addPart, listParts, partsTimeline } from "@wonder/creator-projects";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** The Room's parts and timeline (anyone who can open the Room). */
export const GET = withApi<{ id: string }>(async ({ db, creatorId }, { id }) => {
  const parts = await listParts(db, requireUuid(id, "Creative Room"), creatorId);
  return { parts, timeline: await partsTimeline(db, id, parts) };
});

/** Add a part (the Room's owner or admins). */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => ({ id: await addPart(db, creatorId, requireUuid(id, "Creative Room"), await readJson(req)) }), { rateLimit: 30 });
