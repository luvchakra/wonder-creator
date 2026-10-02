import { DomainError, fromDbError } from "@wonder/core";
import { requireUuid, withApi } from "@/lib/api";

/** POST /api/v1/personal-sources/candidates/:id/dismiss — not this one; it won't come back. */
export const POST = withApi<{ id: string }>(
  async ({ db }, { id }) => {
    requireUuid(id);
    const { data, error } = await db.from("context_candidates").update({ state: "dismissed" }).eq("id", id).in("state", ["new", "reviewed"]).select("id").maybeSingle();
    if (error) throw fromDbError(error);
    if (!data) throw new DomainError("not_found", "We couldn't find that.");
    return { ok: true };
  },
  { feature: "personal_sources_enabled", rateLimit: 60 },
);
