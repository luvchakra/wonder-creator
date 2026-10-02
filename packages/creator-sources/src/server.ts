import { createHash } from "node:crypto";
import { DomainError, fromDbError, log } from "@wonder/core";
import { createMaterial } from "@wonder/creator-library";
import type { Db, JsonValue } from "@wonder/db";
import { syncBudgets, type SyncBudgets } from "./budgets";
import { ConnectorError } from "./errors";
import { buildCandidates } from "./grouping";
import { isSensitive, safeExcerpt, safeTitle } from "./redact";
import { ACTIVE_JOB, type ContextRecord, type JobStatus, type Provider, type RecordInput, type SourceType, type SyncMode } from "./types";

/**
 * The Personal Sources pipeline (docs/personal-sources.md). Server only: it runs on the service client, always scoped by
 * a server-resolved creator id. Requests never wait for it — `requestSync` records a job and returns at once; the
 * route runs `runSyncJobs` after the response, in bounded slices that checkpoint as they go, and the cron worker picks
 * up anything left (a crash, a yield, a rate-limit pause).
 */

// ---------------------------------------------------------------------------------------------------- connectors

export interface ConnectionRow {
  id: string;
  creator_id: string;
  provider: Provider;
  status: string;
  scope_settings: Record<string, unknown>;
  last_successful_sync_at: string | null;
}

export interface ConnectorContext {
  service: Db;
  creatorId: string;
  connection: ConnectionRow;
  /** The provider's opaque cursor from the last committed checkpoint; null on a first sync. */
  cursor: string | null;
  /** Records to fetch in this page. */
  limit: number;
  budgets: SyncBudgets;
  signal: AbortSignal;
  now: Date;
}

export interface PageResult {
  items: RecordInput[];
  /** The cursor to commit once these items are indexed. */
  nextCursor: string | null;
  /** True when there's nothing more to fetch in this scope. */
  done: boolean;
  /** Bytes this page cost in total (listing included); defaults to the items' own. */
  bytes?: number;
}

export interface Connector {
  provider: Provider;
  /** The parts of the scope settings that change what is fetched (hashed into the cursor key). */
  scope(settings: Record<string, unknown>): Record<string, unknown>;
  fetchPage(ctx: ConnectorContext): Promise<PageResult>;
  /** Full content for one record the creator chose to import (hydration L4). Optional: notes already are Materials. */
  hydrate?(ctx: Omit<ConnectorContext, "cursor" | "limit">, record: { providerItemId: string; sourceType: SourceType }): Promise<{ title: string | null; text: string | null }>;
  /** Ask the provider to forget the grant when the creator disconnects (best effort). */
  revoke?(ctx: Pick<ConnectorContext, "service" | "creatorId" | "connection">): Promise<void>;
}

export type ConnectorRegistry = Partial<Record<Provider, Connector>>;

export interface SourcesDeps {
  service: Db;
  connectors: ConnectorRegistry;
  budgets?: SyncBudgets;
  now?: () => Date;
}

// ---------------------------------------------------------------------------------------------------- requesting

export function scopeHash(provider: Provider, scope: Record<string, unknown>): string {
  const canonical = JSON.stringify(scope, Object.keys(scope).sort());
  return createHash("sha256").update(`${provider}|${canonical}`).digest("hex").slice(0, 32);
}

export interface RequestedJob {
  id: string;
  connectionId: string | null;
  status: JobStatus;
  reused: boolean;
}

/**
 * Ask for a sync of one connection or all of them. A matching active job is returned instead of a second one; the
 * hourly budget only counts new jobs. Returns quickly: nothing here talks to a provider.
 */
export async function requestSync(deps: SourcesDeps, creatorId: string, opts: { connectionId?: string; mode?: SyncMode } = {}): Promise<{ parent: RequestedJob | null; jobs: RequestedJob[] }> {
  const { service, connectors } = deps;
  const budgets = deps.budgets ?? syncBudgets();
  const mode = opts.mode ?? "quick";
  let q = service.from("source_connections").select("id, creator_id, provider, status, scope_settings, last_successful_sync_at").eq("creator_id", creatorId);
  if (opts.connectionId) q = q.eq("id", opts.connectionId);
  const { data: conns, error } = await q;
  if (error) throw fromDbError(error);
  const runnable = ((conns ?? []) as ConnectionRow[]).filter((c) => connectors[c.provider] && c.status !== "needs_reconnect");
  if (opts.connectionId && !runnable.length) {
    if (!conns?.length) throw new DomainError("not_found", "We couldn't find that source.");
    throw new DomainError("conflict", conns[0]!.status === "needs_reconnect" ? "Reconnect this source first." : "This source can't sync yet.");
  }
  if (!runnable.length) return { parent: null, jobs: [] };

  const keyed = runnable.map((c) => {
    const hash = scopeHash(c.provider, connectors[c.provider]!.scope(c.scope_settings ?? {}));
    return { c, hash, key: `${creatorId}:${c.id}:${hash}:${mode}` };
  });
  const { data: active } = await service
    .from("source_sync_jobs")
    .select("id, connection_id, status, idempotency_key")
    .eq("creator_id", creatorId)
    .in("status", ACTIVE_JOB as JobStatus[]);
  const activeByKey = new Map((active ?? []).map((j) => [j.idempotency_key, j]));
  const activeByConn = new Map((active ?? []).filter((j) => j.connection_id).map((j) => [j.connection_id!, j]));

  const fresh = keyed.filter((k) => !activeByKey.has(k.key) && !activeByConn.has(k.c.id));
  if (fresh.length) {
    const since = new Date((deps.now?.() ?? new Date()).getTime() - 3_600_000).toISOString();
    const { count } = await service.from("source_sync_jobs").select("id", { count: "exact", head: true }).eq("creator_id", creatorId).is("parent_id", null).gte("created_at", since);
    if ((count ?? 0) >= budgets.creatorHourly) throw new DomainError("rate_limited", "You've synced a lot in the last hour. Try again a little later.");
  }

  // "Sync all" is a light parent: its children run one after another, never all at once (spec §9).
  let parent: RequestedJob | null = null;
  if (!opts.connectionId && keyed.length > 1 && fresh.length) {
    const key = `${creatorId}:all:${mode}`;
    const existing = activeByKey.get(key);
    if (existing) parent = { id: existing.id, connectionId: null, status: existing.status as JobStatus, reused: true };
    else {
      const ins = await service.from("source_sync_jobs").insert({ creator_id: creatorId, mode, idempotency_key: key, priority: 3, status: "queued", phase: "queued" }).select("id, status").single();
      if (ins.error && ins.error.code !== "23505") throw fromDbError(ins.error);
      const row = ins.data ?? (await service.from("source_sync_jobs").select("id, status").eq("idempotency_key", key).in("status", ACTIVE_JOB as JobStatus[]).single()).data;
      if (row) parent = { id: row.id, connectionId: null, status: row.status as JobStatus, reused: !ins.data };
    }
  }

  const jobs: RequestedJob[] = [];
  for (const k of keyed) {
    const existing = activeByKey.get(k.key) ?? activeByConn.get(k.c.id);
    if (existing) {
      jobs.push({ id: existing.id, connectionId: k.c.id, status: existing.status as JobStatus, reused: true });
      continue;
    }
    const ins = await service
      .from("source_sync_jobs")
      .insert({ creator_id: creatorId, connection_id: k.c.id, parent_id: parent?.id ?? null, scope_hash: k.hash, mode, idempotency_key: k.key, priority: 3, status: "queued", phase: "queued" })
      .select("id, status")
      .single();
    if (ins.data) {
      jobs.push({ id: ins.data.id, connectionId: k.c.id, status: "queued", reused: false });
      await service.from("source_connections").update({ status: "queued" }).eq("id", k.c.id).eq("creator_id", creatorId);
      continue;
    }
    // A concurrent tap won the race: hand back its job.
    if (ins.error?.code !== "23505") throw fromDbError(ins.error);
    const { data: row } = await service.from("source_sync_jobs").select("id, status").eq("connection_id", k.c.id).in("status", ACTIVE_JOB as JobStatus[]).limit(1).maybeSingle();
    if (row) jobs.push({ id: row.id, connectionId: k.c.id, status: row.status as JobStatus, reused: true });
  }
  log("info", "sources.sync_requested", { creatorId, mode, jobs: jobs.length, reused: jobs.filter((j) => j.reused).length });
  return { parent, jobs };
}

/** Ask a job (or a Sync-all parent and its children) to stop; the worker stops at its next checkpoint. */
export async function cancelSync(service: Db, creatorId: string, jobId: string): Promise<void> {
  const { data: job } = await service.from("source_sync_jobs").select("id, status").eq("id", jobId).eq("creator_id", creatorId).maybeSingle();
  if (!job) throw new DomainError("not_found", "We couldn't find that sync.");
  const ids = [jobId, ...((await service.from("source_sync_jobs").select("id").eq("parent_id", jobId).eq("creator_id", creatorId)).data ?? []).map((j) => j.id)];
  await service.from("source_sync_jobs").update({ cancel_requested: true }).in("id", ids).eq("creator_id", creatorId);
  // Jobs that haven't started yet stop right away.
  await service.from("source_sync_jobs").update({ status: "cancelled", phase: "cancelled", finished_at: new Date().toISOString() }).in("id", ids).eq("creator_id", creatorId).in("status", ["queued", "paused"]);
  await settleConnections(service, creatorId);
}

// ---------------------------------------------------------------------------------------------------- running

type JobRow = {
  id: string;
  creator_id: string;
  connection_id: string | null;
  parent_id: string | null;
  scope_hash: string;
  mode: string;
  status: JobStatus;
  attempts: number;
  scanned_count: number;
  indexed_count: number;
  pages_fetched: number;
  transferred_bytes: number;
  heartbeat_at: string | null;
  started_at: string | null;
};
const JOB_COLS = "id, creator_id, connection_id, parent_id, scope_hash, mode, status, attempts, scanned_count, indexed_count, pages_fetched, transferred_bytes, heartbeat_at, started_at";

/**
 * Work through runnable jobs — one creator's, or anyone's (the cron worker) — until there are none or `deadlineMs`
 * passes. Respects the global and per-creator caps: when they're full the job stays queued for a later run.
 */
export async function runSyncJobs(deps: SourcesDeps, opts: { creatorId?: string; deadlineMs?: number } = {}): Promise<{ ran: number }> {
  const budgets = deps.budgets ?? syncBudgets();
  const now = deps.now ?? (() => new Date());
  const stop = Date.now() + (opts.deadlineMs ?? budgets.sliceMs * 2);
  let ran = 0;
  while (Date.now() < stop) {
    const job = await claimNext(deps.service, budgets, now(), opts.creatorId);
    if (!job) break;
    ran++;
    await runSlice(deps, budgets, job, Math.min(stop, Date.now() + budgets.sliceMs));
  }
  return { ran };
}

async function claimNext(service: Db, budgets: SyncBudgets, now: Date, creatorId?: string): Promise<JobRow | null> {
  const staleBefore = new Date(now.getTime() - budgets.staleMs).toISOString();
  // A job left `running` without a heartbeat crashed: it resumes from its last committed checkpoint.
  let q = service
    .from("source_sync_jobs")
    .select(JOB_COLS)
    .not("connection_id", "is", null)
    .or(`and(status.in.(queued,paused),run_after.lte.${now.toISOString()}),and(status.eq.running,heartbeat_at.lt.${staleBefore})`)
    .order("priority")
    .order("created_at")
    .limit(5);
  if (creatorId) q = q.eq("creator_id", creatorId);
  const { data } = await q;
  for (const job of (data ?? []) as JobRow[]) {
    const running = await service.from("source_sync_jobs").select("id, creator_id").eq("status", "running").gte("heartbeat_at", staleBefore);
    const all = running.data ?? [];
    if (all.length >= budgets.globalRunning) return null;
    if (all.filter((j) => j.creator_id === job.creator_id).length >= budgets.creatorRunning) continue;
    let claim = service
      .from("source_sync_jobs")
      .update({ status: "running", phase: "checking", heartbeat_at: now.toISOString(), started_at: job.started_at ?? now.toISOString() })
      .eq("id", job.id)
      .eq("status", job.status);
    claim = job.status === "running" ? claim.eq("heartbeat_at", job.heartbeat_at!) : claim;
    const { data: won } = await claim.select(JOB_COLS).maybeSingle();
    if (won) return won as JobRow;
  }
  return null;
}

async function runSlice(deps: SourcesDeps, budgets: SyncBudgets, job: JobRow, until: number): Promise<void> {
  const { service } = deps;
  const now = () => deps.now?.() ?? new Date();
  const { data: conn } = await service
    .from("source_connections")
    .select("id, creator_id, provider, status, scope_settings, last_successful_sync_at")
    .eq("id", job.connection_id!)
    .eq("creator_id", job.creator_id)
    .maybeSingle();
  if (!conn) return finish(service, job, "cancelled", { phase: "disconnected" });
  const connection = conn as ConnectionRow;
  const connector = deps.connectors[connection.provider];
  if (!connector) return finish(service, job, "failed", { error_code: "provider_unavailable" });
  await service.from("source_connections").update({ status: "syncing" }).eq("id", connection.id);

  const { data: cur } = await service.from("source_sync_cursors").select("provider_cursor").eq("connection_id", connection.id).eq("scope_hash", job.scope_hash).maybeSingle();
  let cursor = cur?.provider_cursor ?? null;
  const counters = { scanned: job.scanned_count, indexed: job.indexed_count, pages: job.pages_fetched, bytes: Number(job.transferred_bytes) };

  for (;;) {
    const { data: live } = await service.from("source_sync_jobs").select("cancel_requested").eq("id", job.id).single();
    if (live?.cancel_requested) return finish(service, job, "cancelled", { phase: "cancelled" }, counters);
    if (counters.scanned >= budgets.quickRecordCap || counters.pages >= budgets.pageCap || counters.bytes >= budgets.byteCap) {
      return complete(deps, budgets, job, connection, counters, "partially_complete");
    }
    if (Date.now() >= until) {
      // Out of time for this slice: yield and let the next run continue from the committed checkpoint.
      await service.from("source_sync_jobs").update({ status: "paused", phase: "waiting", run_after: now().toISOString(), heartbeat_at: null }).eq("id", job.id);
      return;
    }

    let page: PageResult;
    try {
      const limit = Math.min(budgets.pageSize, budgets.quickRecordCap - counters.scanned);
      page = await connector.fetchPage({ service, creatorId: job.creator_id, connection, cursor, limit, budgets, signal: AbortSignal.timeout(budgets.callTimeoutMs), now: now() });
    } catch (e) {
      return failSlice(service, budgets, job, connection, e, counters, now());
    }

    // Normalise, filter and redact centrally, whatever the connector sent (spec §8, §11).
    const expires = new Date(now().getTime() + budgets.recordDays * 86_400_000).toISOString();
    const rows = page.items
      .filter((r) => !isSensitive(r.title, r.excerpt))
      .map((r) => ({
        creator_id: job.creator_id,
        connection_id: connection.id,
        provider_item_id: r.providerItemId.slice(0, 500),
        source_type: r.sourceType,
        occurred_at: r.occurredAt,
        safe_title: safeTitle(r.title),
        safe_excerpt: safeExcerpt(r.excerpt),
        place: r.place ? r.place.slice(0, 200) : null,
        preview_ref: r.previewRef ?? null,
        hydration_level: r.hydrationLevel ?? (r.excerpt ? 2 : 1),
        fingerprint: r.fingerprint ?? null,
        signals: (r.signals ?? {}) as JsonValue,
        material_id: r.materialId ?? null,
        expires_at: expires,
      }));
    if (rows.length) {
      const { error } = await service.from("source_context_records").upsert(rows, { onConflict: "connection_id,provider_item_id" });
      if (error) return failSlice(service, budgets, job, connection, new ConnectorError("retryable", "index write failed"), counters, now());
    }
    // Commit the checkpoint only after the records it covers are indexed.
    await service
      .from("source_sync_cursors")
      .upsert({ connection_id: connection.id, scope_hash: job.scope_hash, creator_id: job.creator_id, provider_cursor: page.nextCursor, last_committed_at: now().toISOString() }, { onConflict: "connection_id,scope_hash" });
    cursor = page.nextCursor;
    counters.scanned += page.items.length;
    counters.indexed += rows.length;
    counters.pages += 1;
    counters.bytes += page.bytes ?? page.items.reduce((n, r) => n + (r.bytes ?? 0), 0);
    await service
      .from("source_sync_jobs")
      .update({ scanned_count: counters.scanned, indexed_count: counters.indexed, pages_fetched: counters.pages, transferred_bytes: counters.bytes, heartbeat_at: now().toISOString() })
      .eq("id", job.id);
    if (page.done) return complete(deps, budgets, job, connection, counters, "completed");
  }
}

type Counters = { scanned: number; indexed: number; pages: number; bytes: number };

async function complete(deps: SourcesDeps, budgets: SyncBudgets, job: JobRow, connection: ConnectionRow, counters: Counters, status: "completed" | "partially_complete") {
  const { service } = deps;
  const at = (deps.now?.() ?? new Date()).toISOString();
  await service.from("source_sync_jobs").update({ phase: "grouping", heartbeat_at: at }).eq("id", job.id);
  const candidates = await rebuildCandidates(service, job.creator_id, { now: deps.now?.() ?? new Date(), budgets });
  await service.from("source_sync_cursors").update({ last_successful_sync_at: at }).eq("connection_id", connection.id).eq("scope_hash", job.scope_hash);
  await service.from("source_connections").update({ last_successful_sync_at: at, last_error_code: null }).eq("id", connection.id);
  await finish(service, job, status, { phase: status === "completed" ? "done" : "limit", candidate_count: candidates }, counters);
  log("info", "sources.sync_finished", { provider: connection.provider, status, scanned: counters.scanned, indexed: counters.indexed, pages: counters.pages, bytes: counters.bytes, candidates });
}

async function failSlice(service: Db, budgets: SyncBudgets, job: JobRow, connection: ConnectionRow, e: unknown, counters: Counters, now: Date) {
  const err = e instanceof ConnectorError ? e : new ConnectorError(e instanceof Error && e.name === "TimeoutError" ? "retryable" : "fatal", e instanceof Error ? e.name : "error");
  log("warn", "sources.sync_error", { provider: connection.provider, kind: err.kind, attempts: job.attempts + 1 });
  if (err.kind === "revoked") {
    await service.from("source_connections").update({ status: "needs_reconnect", last_error_code: "revoked" }).eq("id", connection.id);
    return finish(service, job, "failed", { error_code: "needs_reconnect" }, counters, false);
  }
  const attempts = job.attempts + 1;
  if (err.kind === "fatal" || attempts >= budgets.maxAttempts) {
    await service.from("source_connections").update({ last_error_code: err.kind === "rate_limited" ? "rate_limited" : "sync_failed" }).eq("id", connection.id);
    return finish(service, job, "failed", { error_code: err.kind === "rate_limited" ? "rate_limited" : "sync_failed" }, counters);
  }
  // Retryable or rate-limited: pause with bounded exponential backoff and jitter, honouring Retry-After.
  const backoff = Math.min(15 * 60_000, 30_000 * 2 ** (attempts - 1)) * (0.8 + Math.random() * 0.4);
  const wait = Math.max(backoff, err.retryAfterMs ?? 0);
  await service
    .from("source_sync_jobs")
    .update({ status: "paused", phase: err.kind === "rate_limited" ? "rate_limited" : "retrying", attempts, run_after: new Date(now.getTime() + wait).toISOString(), heartbeat_at: null })
    .eq("id", job.id);
  await service.from("source_connections").update({ status: "paused" }).eq("id", connection.id);
}

async function finish(service: Db, job: JobRow, status: JobStatus, extra: Record<string, unknown>, counters?: Counters, settle = true) {
  await service
    .from("source_sync_jobs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      heartbeat_at: null,
      ...(counters ? { scanned_count: counters.scanned, indexed_count: counters.indexed, pages_fetched: counters.pages, transferred_bytes: counters.bytes } : {}),
      ...extra,
    })
    .eq("id", job.id);
  if (job.parent_id) await settleParent(service, job.parent_id);
  if (settle) await settleConnections(service, job.creator_id);
}

/** A Sync-all parent finishes when its children have: completed, partial, or cancelled/failed. */
async function settleParent(service: Db, parentId: string) {
  const { data: kids } = await service.from("source_sync_jobs").select("status").eq("parent_id", parentId);
  const states = (kids ?? []).map((k) => k.status as JobStatus);
  if (!states.length || states.some((s) => (ACTIVE_JOB as string[]).includes(s))) return;
  const status: JobStatus = states.every((s) => s === "completed")
    ? "completed"
    : states.every((s) => s === "cancelled")
      ? "cancelled"
      : states.some((s) => s === "completed" || s === "partially_complete")
        ? "partially_complete"
        : "failed";
  await service.from("source_sync_jobs").update({ status, phase: "done", finished_at: new Date().toISOString() }).eq("id", parentId).in("status", ACTIVE_JOB as JobStatus[]);
}

/** Each connection's status follows its newest job; needs_reconnect sticks until the creator reconnects. */
async function settleConnections(service: Db, creatorId: string) {
  const { data: conns } = await service.from("source_connections").select("id, status").eq("creator_id", creatorId);
  for (const c of conns ?? []) {
    if (c.status === "needs_reconnect") continue;
    const { data: last } = await service.from("source_sync_jobs").select("status").eq("connection_id", c.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const s = last?.status as JobStatus | undefined;
    const next = !s || s === "completed" || s === "cancelled" ? "connected" : s === "partially_complete" ? "partially_synced" : s === "failed" ? "error" : s === "paused" ? "paused" : s === "queued" ? "queued" : "syncing";
    if (next !== c.status) await service.from("source_connections").update({ status: next }).eq("id", c.id);
  }
}

// ---------------------------------------------------------------------------------------------------- candidates

/** Regroup the creator's recent index into at most a handful of candidates; dismissed and imported ones stay so. */
export async function rebuildCandidates(service: Db, creatorId: string, opts: { now: Date; budgets?: SyncBudgets; timeZone?: string }): Promise<number> {
  const budgets = opts.budgets ?? syncBudgets();
  const { data } = await service
    .from("source_context_records")
    .select("id, connection_id, source_type, occurred_at, safe_title, safe_excerpt, place, preview_ref, fingerprint, material_id, signals, source_connections(provider)")
    .eq("creator_id", creatorId)
    .order("occurred_at", { ascending: false, nullsFirst: false })
    .limit(500);
  const records: ContextRecord[] = (data ?? []).map((r) => ({
    id: r.id,
    connectionId: r.connection_id,
    provider: ((r.source_connections as { provider?: string } | null)?.provider ?? "native_notes") as Provider,
    sourceType: r.source_type as SourceType,
    occurredAt: r.occurred_at,
    title: r.safe_title,
    excerpt: r.safe_excerpt,
    place: r.place,
    previewRef: r.preview_ref,
    fingerprint: r.fingerprint,
    materialId: r.material_id,
    signals: (r.signals ?? {}) as Record<string, unknown>,
  }));
  const drafts = buildCandidates(records, { now: opts.now, timeZone: opts.timeZone, limit: budgets.candidateCap });
  if (!drafts.length) return 0;
  const { data: existing } = await service
    .from("context_candidates")
    .select("id, signature, state")
    .eq("creator_id", creatorId)
    .in(
      "signature",
      drafts.map((d) => d.signature),
    );
  const bySig = new Map((existing ?? []).map((c) => [c.signature, c]));
  let n = 0;
  for (const d of drafts) {
    const fields = { title: d.title, explanation: d.explanation, quote: d.quote, record_ids: d.recordIds, counts: d.counts as JsonValue, score: d.score };
    const prev = bySig.get(d.signature);
    if (prev) {
      if (prev.state === "dismissed" || prev.state === "imported") continue;
      await service.from("context_candidates").update(fields).eq("id", prev.id);
    } else {
      const { error } = await service.from("context_candidates").insert({ creator_id: creatorId, signature: d.signature, ...fields });
      if (error && error.code !== "23505") throw fromDbError(error);
    }
    n++;
  }
  return n;
}

// ---------------------------------------------------------------------------------------------------- import

export interface ImportResult {
  materialIds: string[];
}

/**
 * Bring chosen records from a candidate in as Materials (spec §10): only the records the creator selected, only from
 * that candidate, each with provenance. Notes that already are Materials are reused, never copied.
 */
export async function importCandidate(
  deps: SourcesDeps,
  db: Db,
  creatorId: string,
  candidateId: string,
  recordIds: string[],
  /** Photos: the Material each chosen photo's original became (uploaded from the creator's device just now). */
  photoMaterials: Record<string, string> = {},
): Promise<ImportResult> {
  const { service } = deps;
  const { data: cand } = await service.from("context_candidates").select("id, record_ids, state, imported_material_ids").eq("id", candidateId).eq("creator_id", creatorId).maybeSingle();
  if (!cand) throw new DomainError("not_found", "We couldn't find that.");
  if (cand.state === "dismissed" || cand.state === "expired") throw new DomainError("conflict", "This is no longer available.");
  const allowed = new Set(cand.record_ids);
  const chosen = [...new Set(recordIds)].filter((id) => allowed.has(id));
  if (!chosen.length) throw new DomainError("validation", "Choose at least one thing to bring in.");
  const { data: records } = await service
    .from("source_context_records")
    .select("id, connection_id, provider_item_id, source_type, occurred_at, safe_title, safe_excerpt, material_id, fingerprint, source_connections(id, creator_id, provider, status, scope_settings, last_successful_sync_at)")
    .eq("creator_id", creatorId)
    .in("id", chosen);
  const materialIds: string[] = [];
  for (const r of records ?? []) {
    if (r.material_id) {
      materialIds.push(r.material_id);
      continue;
    }
    if (r.source_type === "photo") {
      // The original never left the device during discovery; it must be the very same photo (same SHA-256).
      const mid = photoMaterials[r.id];
      if (!mid) throw new DomainError("validation", "Choose these photos again to bring them in at full quality.");
      const { data: m } = await db.from("creative_materials").select("id, storage_objects(sha256)").eq("id", mid).eq("creator_id", creatorId).maybeSingle();
      const sha = (m?.storage_objects as { sha256?: string } | null)?.sha256;
      if (!m || !sha || sha !== r.fingerprint) throw new DomainError("validation", "That isn't the same photo. Choose it again from your device.");
      materialIds.push(mid);
      await service.from("source_context_records").update({ material_id: mid, hydration_level: 4 }).eq("id", r.id).eq("creator_id", creatorId);
      continue;
    }
    const conn = r.source_connections as unknown as ConnectionRow | null;
    const connector = conn ? deps.connectors[conn.provider] : undefined;
    let title = r.safe_title;
    let text = r.safe_excerpt;
    if (connector?.hydrate && conn) {
      // Full content only now, for this one record the creator chose (hydration L4).
      const full = await connector.hydrate(
        { service, creatorId, connection: conn, budgets: deps.budgets ?? syncBudgets(), signal: AbortSignal.timeout((deps.budgets ?? syncBudgets()).callTimeoutMs), now: deps.now?.() ?? new Date() },
        { providerItemId: r.provider_item_id, sourceType: r.source_type as SourceType },
      );
      title = full.title ?? title;
      text = full.text ?? text;
    }
    const material = await createMaterial(db, creatorId, {
      type: "note",
      title: title ?? undefined,
      textContent: text ?? "",
      sourceType: `personal_source:${conn?.provider ?? "unknown"}`,
      metadata: { personalSource: { provider: conn?.provider, recordType: r.source_type, occurredAt: r.occurred_at } },
      provenance: { origin: "personal_source", details: { provider: conn?.provider, providerItemId: r.provider_item_id, candidateId } },
    });
    materialIds.push(material.id);
    await service.from("source_context_records").update({ material_id: material.id, hydration_level: 4 }).eq("id", r.id).eq("creator_id", creatorId);
  }
  await service
    .from("context_candidates")
    .update({ state: "imported", imported_material_ids: [...new Set([...cand.imported_material_ids, ...materialIds])] })
    .eq("id", candidateId)
    .eq("creator_id", creatorId);
  log("info", "sources.imported", { creatorId, records: chosen.length, materials: materialIds.length });
  return { materialIds };
}

export { ConnectorError } from "./errors";
export { nativeNotes } from "./connectors/native-notes";
export { indexPhotos, PHOTO_BATCH, THUMB_MAX_BYTES, type PhotoInput } from "./photos";
export { gmailConnector, gmailScope } from "./connectors/gmail";
export { calendarConnector, calendarScope, placeOf } from "./connectors/calendar";
export { CALENDAR_SCOPE, GMAIL_SCOPE, GOOGLE_SCOPES, googleConsent, googleExchange, googleRevoke, type GoogleClient, type GoogleSource } from "./connectors/google";
export { buildCandidates } from "./grouping";
export { syncBudgets, DEFAULT_BUDGETS, type SyncBudgets } from "./budgets";
export { redact, safeExcerpt, isSensitive } from "./redact";
