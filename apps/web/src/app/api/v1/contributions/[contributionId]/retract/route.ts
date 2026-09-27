import { retractContribution } from "@wonder/creator-projects";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";

/** Retract (managers). The entry stays on record, marked retracted with the reason. */
export const POST = withApi<{ contributionId: string }>(async ({ db, req }, { contributionId }) => {
  await retractContribution(db, requireUuid(contributionId, "contribution"), z.object({ reason: z.string().trim().min(1, "Say why.").max(500) }).parse(await readJson(req)).reason);
  return { ok: true };
});
