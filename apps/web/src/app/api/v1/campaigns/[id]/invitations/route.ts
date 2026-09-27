import { z } from "zod";
import { inviteToCampaign, withdrawInvite } from "@wonder/creator-projects";
import { readJson, withApi } from "@/lib/api";

/** Invite a creator who's open to brand work (POST { handle | creatorId, note }), or withdraw an open invitation (DELETE ?creatorId). */
export const POST = withApi<{ id: string }>(async ({ db, req }, { id }) => (await inviteToCampaign(db, id, await readJson(req)), { ok: true }), { rateLimit: 30 });
export const DELETE = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  const creatorId = z.string().uuid().parse(req.nextUrl.searchParams.get("creatorId"));
  await withdrawInvite(db, id, creatorId);
  return { ok: true };
});
