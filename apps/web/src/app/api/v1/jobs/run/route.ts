import { timingSafeEqual } from "node:crypto";
import { isDomainError, log } from "@wonder/core";
import { indexStaleSubjects, runImageGeneration, runImageRevision, selectProvider } from "@wonder/creator-brain";
import { processIntake } from "@wonder/creator-send";
import { attemptPublication, duePublications } from "@wonder/creator-studio";
import { NextResponse, type NextRequest } from "next/server";
import { mirrorSoundtrack } from "@wonder/creator-soundtrack/server";
import { imageWorkerDeps } from "@/lib/images";
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
 * presence (dissolving empty Huddles), backfills search embeddings and sends scheduled publications
 * that are due, retries image generations and runs the retention purge. Protected by CRON_SECRET.
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
      if (job.kind === "image.generate" && job.subject_id) {
        await runImageGeneration(imageWorkerDeps(), job.subject_id);
      }
      if (job.kind === "image.revise" && job.subject_id) {
        await runImageRevision(imageWorkerDeps(), job.subject_id);
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
  // Mirror licensed Soundtrack files into storage, a few per run (hash-checked; see @wonder/creator-soundtrack).
  const soundtrack = await mirrorSoundtrack(service, { limit: 10 }).catch(() => ({ mirrored: [], failed: [] }));
  // Backfill semantic-search embeddings (missing or stale after edits) across creators.
  const indexed = await indexStaleSubjects(service, selectProvider(), { limit: 100 }).catch((e) => {
    log("warn", "jobs.index_failed", { error: e instanceof Error ? e.message.slice(0, 200) : "unknown" });
    return 0;
  });
  // Scheduled publications whose time has come (each already approved by its creator).
  const published: Array<{ id: string; status: string }> = [];
  for (const due of await duePublications(service).catch(() => [])) {
    try {
      const p = await attemptPublication({ service, creatorId: due.creator_id, appOrigin: req.nextUrl.origin }, due.id);
      published.push({ id: p.id, status: p.status });
    } catch (e) {
      log("warn", "jobs.publication_failed", { publicationId: due.id, error: isDomainError(e) ? e.code : "internal" });
    }
  }
  // Storage limitation (GDPR Art. 5(1)(e); DPDP §8(7)): purge what has outlived its purpose — docs/compliance/privacy.md.
  const retention = await service.rpc("run_retention");
  if (retention.error) log("warn", "jobs.retention_failed", { error: retention.error.message.slice(0, 200) });
  return NextResponse.json({ staleParticipants: cleaned.data ?? 0, jobs: results, indexed, publications: published, soundtrack: soundtrack.mirrored.length, retention: retention.data ?? null });
}

export const GET = run;
export const POST = run;
