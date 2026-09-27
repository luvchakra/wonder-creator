import { contributionSummary, listContributions, recordContribution } from "@wonder/creator-projects";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** The project's ledger (including pieces linked to it), with a per-person summary. */
export const GET = withApi<{ id: string }>(async ({ db, creatorId }, { id }) => {
  const entries = await listContributions(db, creatorId, { projectId: requireUuid(id, "project") });
  return { entries, summary: contributionSummary(entries) };
});

/** Record a contribution by hand (the project's owner and admins, for people in the project). */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => ({ id: await recordContribution(db, creatorId, { ...((await readJson(req)) as object), projectId: requireUuid(id, "project") }) }));
