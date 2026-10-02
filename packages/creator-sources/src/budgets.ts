/**
 * Resource ceilings (spec §6, §9). Proposed starting points, not throughput promises: each can be tuned under load with
 * WONDERCREATOR_SOURCES_<NAME> (e.g. WONDERCREATOR_SOURCES_QUICK_RECORD_CAP=100). When a ceiling is reached the job
 * checkpoints and ends `partially_complete` — it never claims to have scanned everything.
 */
export interface SyncBudgets {
  /** Records per metadata page. */
  pageSize: number;
  /** Records one Quick Sync may index per source. */
  quickRecordCap: number;
  /** Provider pages one job may fetch. */
  pageCap: number;
  /** Bytes one job may transfer. */
  byteCap: number;
  /** Wall time one worker slice may run before it yields (ms). */
  sliceMs: number;
  /** Timeout for one provider call (ms). */
  callTimeoutMs: number;
  /** Retries before a job fails. */
  maxAttempts: number;
  /** Candidate groups kept per creator. */
  candidateCap: number;
  /** Candidate groups CreativeMind may enrich per run. */
  aiGroupCap: number;
  /** Active (running) sync jobs across the whole system. */
  globalRunning: number;
  /** Active (running) sync jobs per creator. */
  creatorRunning: number;
  /** Sync requests per creator per hour. */
  creatorHourly: number;
  /** How long a running job may go without a heartbeat before it's treated as crashed and resumed (ms). */
  staleMs: number;
  /** Days a discovered record is kept unless the creator imports it. */
  recordDays: number;
  /** Initial look-back for a first sync (days). */
  initialLookbackDays: number;
}

export const DEFAULT_BUDGETS: SyncBudgets = {
  pageSize: 50,
  quickRecordCap: 250,
  pageCap: 10,
  byteCap: 5_000_000,
  sliceMs: 20_000,
  callTimeoutMs: 10_000,
  maxAttempts: 3,
  candidateCap: 5,
  aiGroupCap: 10,
  globalRunning: 8,
  creatorRunning: 1,
  creatorHourly: 12,
  staleMs: 120_000,
  recordDays: 30,
  initialLookbackDays: 30,
};

const ENV_NAME: Record<keyof SyncBudgets, string> = {
  pageSize: "PAGE_SIZE",
  quickRecordCap: "QUICK_RECORD_CAP",
  pageCap: "PAGE_CAP",
  byteCap: "BYTE_CAP",
  sliceMs: "SLICE_MS",
  callTimeoutMs: "CALL_TIMEOUT_MS",
  maxAttempts: "MAX_ATTEMPTS",
  candidateCap: "CANDIDATE_CAP",
  aiGroupCap: "AI_GROUP_CAP",
  globalRunning: "GLOBAL_RUNNING",
  creatorRunning: "CREATOR_RUNNING",
  creatorHourly: "CREATOR_HOURLY",
  staleMs: "STALE_MS",
  recordDays: "RECORD_DAYS",
  initialLookbackDays: "INITIAL_LOOKBACK_DAYS",
};

/** Budgets with any positive-integer overrides from the environment; anything else keeps the default. */
export function syncBudgets(env: Record<string, string | undefined> = process.env): SyncBudgets {
  const out = { ...DEFAULT_BUDGETS };
  for (const key of Object.keys(out) as Array<keyof SyncBudgets>) {
    const raw = env[`WONDERCREATOR_SOURCES_${ENV_NAME[key]}`];
    const n = raw ? Number(raw) : NaN;
    if (Number.isInteger(n) && n > 0) out[key] = n;
  }
  // The candidate list stays small whatever the configuration says (spec §6: up to 5 on Home).
  out.candidateCap = Math.min(out.candidateCap, 5);
  return out;
}
