import { DomainError, fromDbError, log } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";
import { signWebhook } from "./publishing";

/**
 * P1-20 Analytics Foundation (plan §41). Outcomes come only from the platforms that carried the work: a connected
 * destination reports numbers for a publication, signed like our publishes are. We never invent a metric, never
 * compute a "quality" or "value" score, and never store like counts. What's shown is labelled as platform-reported.
 */

export const PLATFORM_METRICS = ["views", "plays", "impressions", "reach", "watch_seconds", "completions", "shares", "saves", "comments", "clicks", "followers_gained"] as const;
export type PlatformMetric = (typeof PLATFORM_METRICS)[number];

export const METRIC_LABEL: Record<PlatformMetric, [string, string]> = {
  views: ["view", "views"],
  plays: ["play", "plays"],
  impressions: ["impression", "impressions"],
  reach: ["person reached", "people reached"],
  watch_seconds: ["second watched", "seconds watched"],
  completions: ["completion", "completions"],
  shares: ["share", "shares"],
  saves: ["save", "saves"],
  comments: ["comment", "comments"],
  clicks: ["click", "clicks"],
  followers_gained: ["new follower", "new followers"],
};

/** Constant-time string comparison (no node:crypto, so this module stays importable anywhere). */
function sameSignature(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** How far a report's signature timestamp may drift (replay window). */
const WINDOW_SECONDS = 300;

export const metricsReportSchema = z
  .object({
    observedAt: z.string().datetime({ offset: true }).optional(),
    metrics: z.record(z.string(), z.number().finite().nonnegative().max(1e14)),
  })
  .strict();

export interface MetricsReport {
  publicationId: string;
  timestamp: string | null;
  signature: string | null;
  body: string;
  now?: number;
}

/**
 * Verify and store a platform's report (server only; `service` is the pipeline client). The publication must be
 * published to a still-connected webhook destination, and the body must be signed with that destination's secret
 * (`x-wonder-timestamp`, `x-wonder-signature: v1=<hex HMAC-SHA256 of "timestamp.body">`). Unknown metrics are refused
 * by name — including likes — so nothing unreported or disallowed slips in.
 */
export async function recordPlatformMetrics(service: Db, r: MetricsReport): Promise<{ stored: number }> {
  const now = r.now ?? Date.now();
  const ts = Number(r.timestamp);
  if (!r.timestamp || !Number.isFinite(ts) || Math.abs(now / 1000 - ts) > WINDOW_SECONDS) throw new DomainError("unauthenticated", "This report isn't signed for now.");
  const { data: pub } = await service.from("publications").select("id, creator_id, artifact_id, status, destination_kind, destination_id, destination_name").eq("id", r.publicationId).maybeSingle();
  if (!pub || pub.destination_kind !== "webhook" || !pub.destination_id) throw new DomainError("not_found", "Unknown publication.");
  const { data: dest } = await service.from("publishing_destinations").select("id, name, signing_secret, status").eq("id", pub.destination_id).maybeSingle();
  if (!dest || dest.status !== "active") throw new DomainError("not_found", "Unknown publication.");
  const expected = `v1=${await signWebhook(dest.signing_secret, ts, r.body)}`;
  const given = r.signature ?? "";
  if (!sameSignature(given, expected)) throw new DomainError("unauthenticated", "Signature doesn't match.");
  if (pub.status !== "published") throw new DomainError("conflict", "That publication isn't published.");

  let parsed: z.infer<typeof metricsReportSchema>;
  try {
    parsed = metricsReportSchema.parse(JSON.parse(r.body));
  } catch {
    throw new DomainError("validation", "Send { observedAt?, metrics: { views: 120, … } }.");
  }
  const unknown = Object.keys(parsed.metrics).filter((k) => !(PLATFORM_METRICS as readonly string[]).includes(k));
  if (unknown.length) throw new DomainError("validation", `Not accepted: ${unknown.slice(0, 5).join(", ")}. Accepted: ${PLATFORM_METRICS.join(", ")}.`);
  const observedAt = parsed.observedAt ?? new Date(now).toISOString();
  if (Date.parse(observedAt) > now + 60_000) throw new DomainError("validation", "observedAt is in the future.");
  const rows = Object.entries(parsed.metrics).map(([metric, value]) => ({
    publication_id: pub.id,
    creator_id: pub.creator_id,
    artifact_id: pub.artifact_id,
    destination_id: dest.id,
    reported_by: dest.name,
    metric,
    value,
    observed_at: observedAt,
  }));
  if (!rows.length) return { stored: 0 };
  const { error } = await service.from("publication_metrics").upsert(rows, { onConflict: "publication_id,metric,observed_at" });
  if (error) throw fromDbError(error);
  log("info", "analytics.platform_report", { metrics: rows.length });
  return { stored: rows.length };
}

export interface PublicationOutcome {
  publicationId: string;
  reportedBy: string;
  /** Latest reported value per metric, with when the platform observed it. */
  metrics: Array<{ metric: PlatformMetric; value: number; observedAt: string }>;
}

/** Latest platform-reported numbers per publication (RLS: the creator's own). Nothing reported → not listed. */
export async function publicationOutcomes(db: Db, filter: { artifactId?: string; publicationIds?: string[] }): Promise<PublicationOutcome[]> {
  let q = db.from("publication_metrics").select("publication_id, reported_by, metric, value, observed_at").order("observed_at", { ascending: false }).limit(2000);
  if (filter.artifactId) q = q.eq("artifact_id", filter.artifactId);
  if (filter.publicationIds) q = q.in("publication_id", filter.publicationIds.length ? filter.publicationIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data, error } = await q;
  if (error) throw fromDbError(error);
  const by = new Map<string, PublicationOutcome>();
  for (const r of data ?? []) {
    const o = by.get(r.publication_id) ?? { publicationId: r.publication_id, reportedBy: r.reported_by, metrics: [] };
    if (!o.metrics.some((m) => m.metric === r.metric)) o.metrics.push({ metric: r.metric as PlatformMetric, value: Number(r.value), observedAt: r.observed_at });
    by.set(r.publication_id, o);
  }
  return [...by.values()].map((o) => ({ ...o, metrics: o.metrics.sort((a, b) => PLATFORM_METRICS.indexOf(a.metric) - PLATFORM_METRICS.indexOf(b.metric)) }));
}

/** "1,204 views · 38 shares" — plain counts, never a score. */
export function formatOutcome(o: PublicationOutcome, locale = "en"): string {
  const n = new Intl.NumberFormat(locale);
  return o.metrics
    .slice(0, 4)
    .map((m) => `${n.format(m.value)} ${METRIC_LABEL[m.metric][m.value === 1 ? 0 : 1]}`)
    .join(" · ");
}
