import { DomainError } from "@wonder/core";
import { requireUuid, withApi } from "@/lib/api";
import { candidateDetail } from "@/lib/sources";

/** GET /api/v1/personal-sources/candidates/:id — the group and its items (safe titles and excerpts only). */
export const GET = withApi<{ id: string }>(
  async ({ db }, { id }) => {
    requireUuid(id);
    const candidate = await candidateDetail(db, id);
    if (!candidate) throw new DomainError("not_found", "We couldn't find that.");
    return { candidate };
  },
  { feature: "personal_sources_enabled" },
);
