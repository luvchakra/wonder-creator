import { dismissFinding, findingsOf, reviewQuality } from "@wonder/creator-brain";
import { z } from "zod";
import { readJson, requireUuid, withApi } from "@/lib/api";
import { brainDeps } from "@/lib/brain";

export const maxDuration = 120;

/** The latest review and its actionable findings (owner only, via RLS). */
export const GET = withApi<{ id: string }>(async ({ db }, { id }) => {
  const { data } = await db.from("quality_reports").select("*").eq("artifact_id", requireUuid(id, "piece")).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return { report: data, findings: data ? findingsOf(data) : [] };
});

/** Review the current version: suggestions only, never a rewrite. */
export const POST = withApi<{ id: string }>(async ({ db, creatorId, requestId }, { id }) => reviewQuality(brainDeps(db, creatorId, { correlationId: requestId }), requireUuid(id, "piece")), { rateLimit: 20 });

const dismissSchema = z.object({ reportId: z.string().uuid(), key: z.string().min(1).max(60), dismissed: z.boolean().default(true) });

/** Set a finding aside (or bring it back). Rights/provenance findings can't be dismissed. */
export const PATCH = withApi<{ id: string }>(async ({ db, req }, { id }) => {
  const b = dismissSchema.parse(await readJson(req));
  await dismissFinding(db, requireUuid(id, "piece"), b.reportId, b.key, b.dismissed);
  return { ok: true };
});
