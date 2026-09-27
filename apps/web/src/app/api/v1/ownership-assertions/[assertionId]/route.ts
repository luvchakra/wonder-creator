import { respondToAssertion } from "@wonder/creator-projects";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** The piece's owner acknowledges or disputes a claim; the person who made it can withdraw it. */
export const POST = withApi<{ assertionId: string }>(async ({ db, req }, { assertionId }) => {
  await respondToAssertion(db, requireUuid(assertionId, "claim"), await readJson(req));
  return { ok: true };
});
