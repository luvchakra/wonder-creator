/**
 * The WonderJobs careers API, as a plain client (owner, 21 Oct 2026; docs/careers.md). WonderJobs runs everything behind
 * /careers: the jobs, storing applications, every email, reminders, decisions and deletion. This app only shows its data
 * and forwards what an applicant submits. This module has no Next.js or database dependency so it can be tested with a
 * mocked fetch; `wonderjobs.ts` wires it to the stored key and is the only module pages and routes import.
 *
 * Rules it keeps: one fixed host (an override only for https://*.wonderapps.biz); the key only in the Authorization
 * header, never in a message or a log; 8 s timeout; a GET is retried once after a network error or a 5xx, a POST never;
 * 429 is "busy" with the server's Retry-After; responses are never cached by fetch (the job list may be kept in memory
 * for 60 s by the caller). Logs carry only the path's job id, the status and the time taken.
 */

export const WONDERJOBS_BASE = "https://jobs.wonderapps.biz";
const TIMEOUT_MS = 8_000;

export type WorkMode = "remote" | "hybrid" | "onsite";
export type CareerJob = {
  id: string;
  title: string;
  location: string;
  workMode: WorkMode;
  jobType?: string;
  salaryMin?: number;
  salaryMax?: number;
  currency: string;
  description: string;
  skills: string[];
  company: string;
  updatedAt: string;
};
export type CareerSite = { name: string; retentionMonths: number | null };
export type ApplicationStatus = {
  status: "new" | "reviewing" | "interview" | "offer" | "hired" | "rejected" | "withdrawn";
  statusLabel: string;
  jobTitle: string;
  company: string;
  appliedAt: string;
  updatedAt: string;
  canWithdraw: boolean;
};
export type ApplicationInput = {
  name: string;
  email: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  resumeUrl: string;
  coverNote?: string;
  consent: true;
};

export type Failure =
  | { ok: false; kind: "not_configured" }
  | { ok: false; kind: "unauthorized" }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "conflict"; message: string }
  | { ok: false; kind: "bad_request"; message: string }
  | { ok: false; kind: "busy"; retryAfter: number | null }
  | { ok: false; kind: "unavailable" };
export type Result<T> = { ok: true; data: T } | Failure;

/** The words people see for each failure (a 400 or 409 shows WonderJobs' own message). */
export function failureMessage(f: Failure): string {
  switch (f.kind) {
    case "conflict":
    case "bad_request":
      return f.message;
    case "busy":
      return "WonderJobs is busy. Please try again shortly.";
    case "not_found":
      return "This position is no longer open.";
    case "not_configured":
      return "Careers isn't set up yet.";
    case "unauthorized":
    case "unavailable":
      return "Careers is unavailable right now. Please try again later.";
  }
}

/** WonderJobs' address: the fixed host, or an override only when it's an https *.wonderapps.biz origin. */
export function wonderJobsBase(override?: string | null): string {
  if (!override) return WONDERJOBS_BASE;
  try {
    const u = new URL(override.trim());
    if (u.protocol === "https:" && u.hostname.endsWith(".wonderapps.biz") && !u.username && !u.password && !u.port) return u.origin;
  } catch {
    /* not a URL */
  }
  return WONDERJOBS_BASE;
}

export const KEY_PATTERN = /^wjcs_[A-Za-z0-9_-]{8,200}$/;
/** "wjcs_••••••••abcd": all anyone sees of a saved key. */
export const maskKey = (last4: string) => `wjcs_••••••••${last4}`;

export type Log = (event: string, fields: Record<string, string | number>) => void;
export interface ClientOptions {
  key: string | null;
  base?: string;
  fetch?: typeof fetch;
  log?: Log;
  timeoutMs?: number;
}

const ID = /^[A-Za-z0-9_-]{1,80}$/;

export function createWonderJobsClient(opts: ClientOptions) {
  const doFetch = opts.fetch ?? fetch;
  const base = opts.base ?? WONDERJOBS_BASE;
  const log: Log = opts.log ?? (() => undefined);
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;

  async function call<T>(path: string, method: "GET" | "POST", logId: string, body?: unknown): Promise<Result<T>> {
    if (!opts.key) return { ok: false, kind: "not_configured" };
    const attempts = method === "GET" ? 2 : 1;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const started = Date.now();
      let res: Response;
      try {
        res = await doFetch(`${base}/api/careers/v1${path}`, {
          method,
          headers: { authorization: `Bearer ${opts.key}`, accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
          body: body ? JSON.stringify(body) : undefined,
          cache: "no-store",
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (e) {
        // Network error or timeout: never the request itself (it may carry an applicant's details) or the key.
        log("careers.unreachable", { job: logId, attempt, ms: Date.now() - started, error: e instanceof Error ? e.name : "error" });
        if (attempt < attempts) continue;
        return { ok: false, kind: "unavailable" };
      }
      log("careers.call", { job: logId, method, status: res.status, ms: Date.now() - started });
      const json = (await res.json().catch(() => ({}))) as T & { error?: unknown };
      const message = typeof json.error === "string" && json.error.trim() ? json.error.trim().slice(0, 300) : null;
      if (res.ok) return { ok: true, data: json };
      if (res.status >= 500 && attempt < attempts) continue;
      if (res.status === 400) return { ok: false, kind: "bad_request", message: message ?? "Check the details and try again." };
      if (res.status === 401) return { ok: false, kind: "unauthorized" };
      if (res.status === 404) return { ok: false, kind: "not_found" };
      if (res.status === 409) return { ok: false, kind: "conflict", message: message ?? "You've already applied for this position." };
      if (res.status === 429) {
        const ra = Number(res.headers.get("retry-after"));
        return { ok: false, kind: "busy", retryAfter: Number.isFinite(ra) && ra > 0 ? Math.min(ra, 3600) : null };
      }
      return { ok: false, kind: "unavailable" };
    }
    return { ok: false, kind: "unavailable" };
  }

  return {
    async listJobs(): Promise<Result<{ site: CareerSite; jobs: CareerJob[] }>> {
      const r = await call<{ site?: Partial<CareerSite>; jobs?: CareerJob[] }>("/jobs", "GET", "-");
      return r.ok ? { ok: true, data: { site: site(r.data.site), jobs: Array.isArray(r.data.jobs) ? r.data.jobs : [] } } : r;
    },
    async getJob(id: string): Promise<Result<{ site: CareerSite; job: CareerJob }>> {
      if (!ID.test(id)) return { ok: false, kind: "not_found" };
      const r = await call<{ site?: Partial<CareerSite>; job?: CareerJob }>(`/jobs/${encodeURIComponent(id)}`, "GET", id);
      if (!r.ok) return r;
      return r.data.job ? { ok: true, data: { site: site(r.data.site), job: r.data.job } } : { ok: false, kind: "not_found" };
    },
    async apply(id: string, input: ApplicationInput): Promise<Result<{ id: string }>> {
      if (!ID.test(id)) return { ok: false, kind: "not_found" };
      const r = await call<{ ok?: boolean; id?: string }>(`/jobs/${encodeURIComponent(id)}/applications`, "POST", id, input);
      return r.ok ? { ok: true, data: { id: String(r.data.id ?? "") } } : r;
    },
    /** The applicant's own application. The token travels in the body, never in a URL this server requests. */
    async status(token: string, action: "view" | "withdraw"): Promise<Result<ApplicationStatus>> {
      if (!/^[A-Za-z0-9_.-]{16,200}$/.test(token)) return { ok: false, kind: "not_found" };
      const r = await call<{ application?: ApplicationStatus }>("/applications/status", "POST", "status", { token, action });
      if (!r.ok) return r;
      return r.data.application ? { ok: true, data: r.data.application } : { ok: false, kind: "not_found" };
    },
  };
}

function site(s: Partial<CareerSite> | undefined): CareerSite {
  const months = s?.retentionMonths;
  return { name: typeof s?.name === "string" ? s.name : "Careers", retentionMonths: typeof months === "number" && months > 0 ? Math.round(months) : null };
}
