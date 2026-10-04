import { claimPart, inviteToPart, leavePart, removeFromPart } from "@wonder/creator-projects";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** With a creatorId: invite them to this part only. Without: join the part yourself (crew members). */
export const POST = withApi<{ id: string; partId: string }>(
  async ({ db, req }, { partId }) => {
    const body = (await readJson(req, 10_000)) as { creatorId?: string };
    const id = requireUuid(partId, "Part");
    if (body.creatorId) await inviteToPart(db, id, body);
    else await claimPart(db, id);
    return { ok: true };
  },
  { rateLimit: 30 },
);

const removeSchema = z.object({ creatorId: z.string().uuid().optional() });

/** With a creatorId: take them off the part (the Room's owner or admins). Without: leave it yourself. */
export const DELETE = withApi<{ id: string; partId: string }>(async ({ db, req }, { partId }) => {
  const { creatorId } = removeSchema.parse(await readJson(req, 10_000));
  const id = requireUuid(partId, "Part");
  if (creatorId) await removeFromPart(db, id, creatorId);
  else await leavePart(db, id);
  return { ok: true };
});
