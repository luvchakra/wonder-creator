import { DEFAULT_BUDGETS, requestSync, runSyncJobs, type Connector, type ConnectorContext, type SourcesDeps } from "@wonder/creator-sources/server";
import { afterAll, describe, expect, it } from "vitest";
import { adminClient, cleanupTestCreators, createTestCreator, expectOk } from "./helpers";

/**
 * Personal Sources hardening (spec §14 F, §15): a huge mailbox, slow and hanging providers, congestion across creators
 * and the hourly budget. Synthetic connectors stand in for providers; the engine, database and guarantees are real.
 */
const admin = adminClient();
afterAll(cleanupTestCreators);

/** A Gmail-like source with `total` messages that pages forever unless something stops it. */
function hugeMailbox(total: number, calls: { pages: number; items: number }, opts: { delayMs?: number; ignoreSignal?: boolean } = {}): Connector {
  return {
    provider: "gmail",
    scope: () => ({}),
    async fetchPage(ctx: ConnectorContext) {
      calls.pages++;
      const from = Number(ctx.cursor ?? 0);
      if (opts.delayMs) {
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, opts.delayMs);
          if (!opts.ignoreSignal) ctx.signal.addEventListener("abort", () => (clearTimeout(t), reject(Object.assign(new Error("aborted"), { name: "TimeoutError" }))), { once: true });
        });
      }
      const n = Math.min(ctx.limit, total - from);
      calls.items += n;
      const items = Array.from({ length: n }, (_, i) => ({ providerItemId: `m${from + i}`, sourceType: "email" as const, occurredAt: new Date(Date.now() - (from + i) * 60_000).toISOString(), title: `Message ${from + i}`, bytes: 2_000 }));
      return { items, nextCursor: String(from + n), done: from + n >= total };
    },
  };
}

async function gmailFor(label: string) {
  const c = await createTestCreator(label);
  const conn = expectOk(await admin.from("source_connections").insert({ creator_id: c.creatorId, provider: "gmail", status: "connected" }).select("id").single()).id;
  return { c, conn };
}

describe("Personal Sources under load", () => {
  it("a 100,000-message mailbox never triggers whole-account retrieval: one Quick Sync stops at its budget", async () => {
    const { c } = await gmailFor("loadHuge");
    const calls = { pages: 0, items: 0 };
    const deps: SourcesDeps = { service: admin, connectors: { gmail: hugeMailbox(100_000, calls) }, budgets: DEFAULT_BUDGETS };
    const r = await requestSync(deps, c.creatorId);
    await runSyncJobs(deps, { creatorId: c.creatorId });
    const job = expectOk(await admin.from("source_sync_jobs").select("status, phase, scanned_count, pages_fetched").eq("id", r.jobs[0]!.id).single());
    expect(job).toMatchObject({ status: "partially_complete", phase: "limit" });
    expect(job.scanned_count).toBeLessThanOrEqual(DEFAULT_BUDGETS.quickRecordCap);
    expect(job.pages_fetched).toBeLessThanOrEqual(DEFAULT_BUDGETS.pageCap);
    expect(calls.items).toBeLessThanOrEqual(DEFAULT_BUDGETS.quickRecordCap);
    expect(expectOk(await c.client.from("source_context_records").select("id"))).toHaveLength(job.scanned_count);
    // The index never holds the mailbox: the next Quick Sync continues from the checkpoint, again bounded.
    const r2 = await requestSync(deps, c.creatorId);
    await runSyncJobs(deps, { creatorId: c.creatorId });
    expect(expectOk(await admin.from("source_sync_jobs").select("scanned_count").eq("id", r2.jobs[0]!.id).single()).scanned_count).toBeLessThanOrEqual(DEFAULT_BUDGETS.quickRecordCap);
    expect(calls.items).toBeLessThanOrEqual(2 * DEFAULT_BUDGETS.quickRecordCap);
  });

  it("the byte budget stops a heavy source too", async () => {
    const { c } = await gmailFor("loadBytes");
    const calls = { pages: 0, items: 0 };
    const deps: SourcesDeps = { service: admin, connectors: { gmail: hugeMailbox(10_000, calls) }, budgets: { ...DEFAULT_BUDGETS, byteCap: 150_000 } };
    const r = await requestSync(deps, c.creatorId);
    await runSyncJobs(deps, { creatorId: c.creatorId });
    const job = expectOk(await admin.from("source_sync_jobs").select("status, transferred_bytes").eq("id", r.jobs[0]!.id).single());
    expect(job.status).toBe("partially_complete");
    expect(Number(job.transferred_bytes)).toBeLessThan(150_000 + 50 * 2_000);
  });

  it("a slow provider yields the worker at the slice limit and resumes later from its checkpoint", async () => {
    const { c } = await gmailFor("loadSlow");
    const calls = { pages: 0, items: 0 };
    const deps: SourcesDeps = { service: admin, connectors: { gmail: hugeMailbox(120, calls, { delayMs: 400 }) }, budgets: { ...DEFAULT_BUDGETS, pageSize: 20, sliceMs: 900 } };
    const r = await requestSync(deps, c.creatorId);
    await runSyncJobs(deps, { creatorId: c.creatorId, deadlineMs: 1_000 });
    const mid = expectOk(await admin.from("source_sync_jobs").select("status, phase, scanned_count").eq("id", r.jobs[0]!.id).single());
    expect(mid).toMatchObject({ status: "paused", phase: "waiting" });
    expect(mid.scanned_count).toBeGreaterThan(0);
    for (let i = 0; i < 10; i++) await runSyncJobs(deps, { creatorId: c.creatorId, deadlineMs: 1_000 });
    const end = expectOk(await admin.from("source_sync_jobs").select("status, scanned_count").eq("id", r.jobs[0]!.id).single());
    expect(end).toEqual({ status: "completed", scanned_count: 120 });
    expect(expectOk(await c.client.from("source_context_records").select("id"))).toHaveLength(120);
  });

  it("a hanging provider — even one that ignores its abort signal — times out, backs off and finally fails, alone", async () => {
    const { c, conn } = await gmailFor("loadHang");
    const calls = { pages: 0, items: 0 };
    const deps: SourcesDeps = { service: admin, connectors: { gmail: hugeMailbox(10, calls, { delayMs: 5_000, ignoreSignal: true }) }, budgets: { ...DEFAULT_BUDGETS, callTimeoutMs: 300, maxAttempts: 2 } };
    const r = await requestSync(deps, c.creatorId);
    const t0 = Date.now();
    await runSyncJobs(deps, { creatorId: c.creatorId });
    expect(Date.now() - t0).toBeLessThan(3_000);
    const first = expectOk(await admin.from("source_sync_jobs").select("status, phase, attempts, run_after").eq("id", r.jobs[0]!.id).single());
    expect(first).toMatchObject({ status: "paused", phase: "retrying", attempts: 1 });
    expect(Date.parse(first.run_after)).toBeGreaterThan(Date.now() + 10_000);
    await admin.from("source_sync_jobs").update({ run_after: new Date().toISOString() }).eq("id", r.jobs[0]!.id);
    await runSyncJobs(deps, { creatorId: c.creatorId });
    expect(expectOk(await admin.from("source_sync_jobs").select("status, error_code").eq("id", r.jobs[0]!.id).single())).toEqual({ status: "failed", error_code: "sync_failed" });
    expect(expectOk(await c.client.from("source_connections").select("status").eq("id", conn).single()).status).toBe("error");
  });

  it("congestion: the global cap leaves others queued; one creator can't take more than their share", async () => {
    const calls = { pages: 0, items: 0 };
    const deps: SourcesDeps = { service: admin, connectors: { gmail: hugeMailbox(5, calls) }, budgets: { ...DEFAULT_BUDGETS, globalRunning: 1 } };
    const busy = await gmailFor("loadBusy");
    const waiting = await gmailFor("loadWaiting");
    // Someone else's job is running right now (fresh heartbeat).
    const running = (await requestSync(deps, busy.c.creatorId)).jobs[0]!.id;
    await admin.from("source_sync_jobs").update({ status: "running", heartbeat_at: new Date().toISOString() }).eq("id", running);
    const queued = (await requestSync(deps, waiting.c.creatorId)).jobs[0]!.id;
    expect(await runSyncJobs(deps, { creatorId: waiting.c.creatorId })).toEqual({ ran: 0 });
    expect(expectOk(await admin.from("source_sync_jobs").select("status").eq("id", queued).single()).status).toBe("queued");
    // Once the system has room, it runs.
    await admin.from("source_sync_jobs").update({ status: "completed", heartbeat_at: null }).eq("id", running);
    await runSyncJobs(deps, { creatorId: waiting.c.creatorId });
    expect(expectOk(await admin.from("source_sync_jobs").select("status").eq("id", queued).single()).status).toBe("completed");
  });

  it("the hourly budget stops a creator from hammering Sync, while repeated taps still get the active job", async () => {
    const { c } = await gmailFor("loadHourly");
    const calls = { pages: 0, items: 0 };
    const deps: SourcesDeps = { service: admin, connectors: { gmail: hugeMailbox(1, calls) }, budgets: { ...DEFAULT_BUDGETS, creatorHourly: 2 } };
    for (let i = 0; i < 2; i++) {
      await requestSync(deps, c.creatorId);
      await runSyncJobs(deps, { creatorId: c.creatorId });
    }
    await expect(requestSync(deps, c.creatorId)).rejects.toMatchObject({ code: "rate_limited" });
    // An active job is still handed back without counting.
    const fresh = await gmailFor("loadHourly2");
    const a = await requestSync({ ...deps, budgets: { ...DEFAULT_BUDGETS, creatorHourly: 1 } }, fresh.c.creatorId);
    const b = await requestSync({ ...deps, budgets: { ...DEFAULT_BUDGETS, creatorHourly: 1 } }, fresh.c.creatorId);
    expect(b.jobs[0]).toMatchObject({ id: a.jobs[0]!.id, reused: true });
  });
});
