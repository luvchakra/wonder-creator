import { acceptProposal, declineProposal, withdrawProposal } from "@wonder/creator-studio";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept"), confirmStale: z.boolean().default(false) }),
  z.object({ action: z.literal("decline"), note: z.string().max(500).optional() }),
  z.object({ action: z.literal("withdraw") }),
]);

/** Accept or decline (the owner), or withdraw (the proposer). Accepting a proposal on an older version needs confirmStale. */
export const POST = withApi<{ proposalId: string }>(async ({ db, req }, { proposalId }) => {
  const id = requireUuid(proposalId, "proposal");
  const b = body.parse(await readJson(req));
  if (b.action === "accept") return { version: await acceptProposal(db, id, b.confirmStale) };
  if (b.action === "decline") await declineProposal(db, id, b.note);
  else await withdrawProposal(db, id);
  return { ok: true };
});
