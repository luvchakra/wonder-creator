import { updateContribution } from "@wonder/creator-projects";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** Refine a contribution: its contributor edits the description; managers edit credit, rights, compensation, share. */
export const PATCH = withApi<{ contributionId: string }>(async ({ db, req }, { contributionId }) => {
  await updateContribution(db, requireUuid(contributionId, "contribution"), await readJson(req));
  return { ok: true };
});
