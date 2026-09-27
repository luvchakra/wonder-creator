import { answerInvite, askAboutInvite } from "@wonder/creator-projects";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

const body = z.object({ body: z.string(), inviteeId: z.string().uuid().optional() });

/**
 * Questions about an invitation. The invitee asks ({ body }); the crew's owner or an admin answers
 * ({ inviteeId, body }). Only they and the invitee can read the thread.
 */
export const POST = withApi<{ id: string }>(
  async ({ db, req }, { id }) => {
    const crewId = requireUuid(id, "crew");
    const b = body.parse(await readJson(req));
    if (b.inviteeId) await answerInvite(db, crewId, b.inviteeId, b);
    else await askAboutInvite(db, crewId, b);
    return { ok: true };
  },
  { rateLimit: 30 },
);
