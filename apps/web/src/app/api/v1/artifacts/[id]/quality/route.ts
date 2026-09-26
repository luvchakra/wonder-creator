import { reviewQuality } from "@wonder/creator-brain";
import { requireUuid, withApi } from "@/lib/api";
import { brainDeps } from "@/lib/brain";

export const maxDuration = 120;

export const GET = withApi<{ id: string }>(async ({ db }, { id }) => {
  const { data } = await db.from("quality_reports").select("*").eq("artifact_id", requireUuid(id, "piece")).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return { report: data };
});

export const POST = withApi<{ id: string }>(async ({ db, creatorId, requestId }, { id }) => reviewQuality(brainDeps(db, creatorId, { correlationId: requestId }), requireUuid(id, "piece")), { rateLimit: 20 });
