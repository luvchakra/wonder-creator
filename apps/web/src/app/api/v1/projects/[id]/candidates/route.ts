import { PROJECT_ITEM_KINDS, projectCandidates } from "@wonder/creator-projects";
import { z } from "zod";
import { requireUuid, withApi } from "@/lib/api";

const query = z.object({ kind: z.enum(PROJECT_ITEM_KINDS), q: z.string().max(100).default("") });

/** The creator's own work of one kind that isn't in the project yet. */
export const GET = withApi<{ id: string }>(async ({ db, creatorId, req }, { id }) => {
  const { kind, q } = query.parse(Object.fromEntries(req.nextUrl.searchParams));
  return { candidates: await projectCandidates(db, creatorId, requireUuid(id, "Creative Room"), kind, q) };
});
