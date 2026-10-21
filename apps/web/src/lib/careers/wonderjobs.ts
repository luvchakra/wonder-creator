import "server-only";
import { log } from "@wonder/core";
import { serviceClient, serviceConfigured } from "@/lib/supabase/service";
import { createWonderJobsClient, KEY_PATTERN, maskKey, wonderJobsBase, type CareerJob, type CareerSite, type Result } from "./client";

/**
 * WonderJobs, wired to this server (docs/careers.md). The career-site key lives in Supabase Vault (migration …096),
 * set by a platform administrator; `WONDERJOBS_CAREERS_KEY` is only a fallback when none is saved. It's read with the
 * service role, kept on this instance for a minute, and only ever sent as the Authorization header. The open jobs are
 * kept for up to a minute too; nothing about an applicant is ever kept.
 */

const KEY_TTL_MS = 60_000;
const JOBS_TTL_MS = 60_000;
let keyCache: { value: { key: string | null; source: "database" | "environment" | "none"; hint: string | null; updatedAt: string | null }; until: number } | null = null;
let jobsCache: { value: Result<{ site: CareerSite; jobs: CareerJob[] }>; until: number } | null = null;

type KeyState = { key: string | null; source: "database" | "environment" | "none"; hint: string | null; updatedAt: string | null };

async function readKey(): Promise<KeyState> {
  if (keyCache && keyCache.until > Date.now()) return keyCache.value;
  let value: KeyState = { key: null, source: "none", hint: null, updatedAt: null };
  if (serviceConfigured()) {
    const db = serviceClient();
    const [secret, row] = await Promise.all([db.rpc("careers_key_secret"), db.from("careers_connection").select("hint, updated_at").maybeSingle()]);
    if (secret.error) log("warn", "careers.key_unreadable", { code: secret.error.code ?? "unknown" });
    if (secret.data) value = { key: secret.data, source: "database", hint: row.data?.hint ?? null, updatedAt: row.data?.updated_at ?? null };
  }
  if (!value.key) {
    const env = process.env.WONDERJOBS_CAREERS_KEY?.trim();
    if (env && KEY_PATTERN.test(env)) value = { key: env, source: "environment", hint: env.slice(-4), updatedAt: null };
  }
  keyCache = { value, until: Date.now() + KEY_TTL_MS };
  return value;
}

function forgetCaches() {
  keyCache = null;
  jobsCache = null;
}

const logCall = (event: string, fields: Record<string, string | number>) => log(event === "careers.call" && Number(fields.status) < 400 ? "info" : "warn", event, fields);

function client(key: string | null) {
  return createWonderJobsClient({ key, base: wonderJobsBase(process.env.WONDERJOBS_CAREERS_URL), log: logCall });
}

export async function careersJobs() {
  if (jobsCache && jobsCache.until > Date.now()) return jobsCache.value;
  const r = await client((await readKey()).key).listJobs();
  // Only a good answer is kept; a failure is asked again next time.
  if (r.ok) jobsCache = { value: r, until: Date.now() + JOBS_TTL_MS };
  return r;
}

export async function careersJob(id: string) {
  return client((await readKey()).key).getJob(id);
}

export async function careersApply(id: string, input: Parameters<ReturnType<typeof createWonderJobsClient>["apply"]>[1]) {
  return client((await readKey()).key).apply(id, input);
}

export async function careersStatus(token: string, action: "view" | "withdraw") {
  return client((await readKey()).key).status(token, action);
}

/** What an administrator may see about the key: never the key. */
export async function careersKeyView(): Promise<{ configured: boolean; source: "database" | "environment" | "none"; masked: string | null; updatedAt: string | null }> {
  const k = await readKey();
  return { configured: !!k.key, source: k.source, masked: k.hint ? maskKey(k.hint) : null, updatedAt: k.updatedAt };
}

export async function saveCareersKey(creatorId: string, key: string) {
  const trimmed = key.trim();
  if (!KEY_PATTERN.test(trimmed)) return { ok: false as const, message: "That isn't a career-site key. It starts with wjcs_." };
  const res = await serviceClient().rpc("careers_key_store", { p_creator: creatorId, p_secret: trimmed, p_hint: trimmed.slice(-4) });
  forgetCaches();
  if (res.error) {
    log("error", "careers.key_save_failed", { code: res.error.code ?? "unknown" });
    return { ok: false as const, message: "The key couldn't be saved. Please try again." };
  }
  return { ok: true as const };
}

export async function clearCareersKey(creatorId: string) {
  const res = await serviceClient().rpc("careers_key_clear", { p_creator: creatorId });
  forgetCaches();
  if (res.error) {
    log("error", "careers.key_clear_failed", { code: res.error.code ?? "unknown" });
    return { ok: false as const };
  }
  return { ok: true as const };
}

/** "Test connection": asks WonderJobs for the jobs with the saved key. */
export async function testCareersConnection(): Promise<{ state: "connected"; jobs: number; site: string } | { state: "wrong_key" } | { state: "not_configured" } | { state: "unavailable" }> {
  forgetCaches();
  const r = await careersJobs();
  if (r.ok) return { state: "connected", jobs: r.data.jobs.length, site: r.data.site.name };
  if (r.kind === "unauthorized") return { state: "wrong_key" };
  if (r.kind === "not_configured") return { state: "not_configured" };
  return { state: "unavailable" };
}
