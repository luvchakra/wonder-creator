import { timingSafeEqual } from "node:crypto";
import { isDomainError, log } from "@wonder/core";
import { indexStaleSubjects, selectProvider } from "@wonder/creator-brain";
import { processIntake } from "@wonder/creator-send";
import { NextResponse, type NextRequest } from "next/server";
import { serviceClient } from "@/lib/supabase/service";

export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || got.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

/**
 * Durable background worker (Vercel Cron): retries pending intake jobs, cleans up stale Huddle
 * presence (dissolving empty Huddles) and backfills search embeddings. Protected by CRON_SECRET.
 */
async function run(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: { code: "forbidden" } }, { status: 403 });
  const service = serviceClient();
  const cleaned = await service.rpc("huddle_cleanup_stale", { p_timeout_seconds: 90 });
  const { data: jobs } = await service
    .from("jobs")
    .select("*")
    .in("status", ["pending", "failed"])
    .lte("run_after", new Date().toISOString())
    .lt("attempts", 3)
    .order("created_at")
    .limit(10);
  const results: Array<{ id: string; ok: boolean }> = [];
  for (const job of jobs ?? []) {
    // Claim the job (optimistic lock on status).
    const claim = await service.from("jobs").update({ status: "running", attempts: job.attempts + 1 }).eq("id", job.id).eq("status", job.status).select("id");
    if (!claim.data?.length) continue;
    try {
      if (job.kind === "intake.process" && job.subject_id) {
        // Worker context has no creator session: pipeline writes use the service client scoped by
        // job.creator_id, and no creator-profile context is ever assembled here.
        await processIntake({ db: service, service, creatorId: job.creator_id, provider: selectProvider() }, job.subject_id);
      }
      await service.from("jobs").update({ status: "succeeded", last_error: null }).eq("id", job.id);
      results.push({ id: job.id, ok: true });
    } catch (e) {
      const dead = job.attempts + 1 >= job.max_attempts;
      await service
        .from("jobs")
        .update({ status: dead ? "dead" : "failed", last_error: isDomainError(e) ? e.code : "internal", run_after: new Date(Date.now() + 60_000 * 2 ** job.attempts).toISOString() })
        .eq("id", job.id);
      log("warn", "jobs.failed", { jobId: job.id, kind: job.kind, dead });
      results.push({ id: job.id, ok: false });
    }
  }
  // Backfill semantic-search embeddings (missing or stale after edits) across creators.
  const indexed = await indexStaleSubjects(service, selectProvider(), { limit: 100 }).catch((e) => {
    log("warn", "jobs.index_failed", { error: e instanceof Error ? e.message.slice(0, 200) : "unknown" });
    return 0;
  });
  return NextResponse.json({ staleParticipants: cleaned.data ?? 0, jobs: results, indexed });
}

export const GET = run;
export const POST = run;
