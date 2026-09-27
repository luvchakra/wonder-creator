import { inviteToCrew, removeFromCrew, setCrewRole } from "@wonder/creator-projects";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** Invite a creator ({ creatorId, access, roleTitle, note }). Owner or admins; admins invite members only. */
export const POST = withApi<{ id: string }>(
  async ({ db, req }, { id }) => {
    await inviteToCrew(db, requireUuid(id, "crew"), await readJson(req));
    return { ok: true };
  },
  { rateLimit: 30 },
);

/** Change someone's role title, or (owner only) their access. */
export const PATCH = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  await setCrewRole(db, requireUuid(id, "crew"), await readJson(req));
  return { ok: true };
});

/** Remove a member or cancel an invitation. Their record (and what they contributed) stays. */
export const DELETE = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  const { creatorId } = z.object({ creatorId: z.string().uuid() }).parse(await readJson(req));
  await removeFromCrew(db, requireUuid(id, "crew"), creatorId);
  return { ok: true };
});
