import { cancelSync } from "@wonder/creator-sources/server";
import { requireUuid, withApi } from "@/lib/api";
import { serviceClient } from "@/lib/supabase/service";

/** POST /api/v1/personal-sources/sync/:jobId/cancel — stop at the next checkpoint; what was indexed stays. */
export const POST = withApi<{ jobId: string }>(
  async ({ creatorId }, { jobId }) => {
    requireUuid(jobId);
    await cancelSync(serviceClient(), creatorId, jobId);
    return { ok: true };
  },
  { feature: "personal_sources_enabled", rateLimit: 30 },
);
