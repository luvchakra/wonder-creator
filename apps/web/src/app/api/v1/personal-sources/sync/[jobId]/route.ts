import { DomainError } from "@wonder/core";
import { requireUuid, withApi } from "@/lib/api";

/** GET /api/v1/personal-sources/sync/:jobId — where a sync is: its phase and counts, never a made-up percentage. */
export const GET = withApi<{ jobId: string }>(
  async ({ db }, { jobId }) => {
    requireUuid(jobId);
    const { data: job } = await db
      .from("source_sync_jobs")
      .select("id, connection_id, parent_id, status, phase, scanned_count, indexed_count, candidate_count, error_code, started_at, finished_at")
      .eq("id", jobId)
      .maybeSingle();
    if (!job) throw new DomainError("not_found", "We couldn't find that sync.");
    const { data: children } = await db.from("source_sync_jobs").select("id, connection_id, status, phase, scanned_count, error_code").eq("parent_id", jobId);
    return { job, children: children ?? [] };
  },
  { feature: "personal_sources_enabled" },
);
