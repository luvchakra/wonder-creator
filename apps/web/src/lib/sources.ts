import "server-only";
import { countsLine, PROVIDER_LABEL, type ConnectionStatus, type JobStatus, type Provider } from "@wonder/creator-sources";
import { nativeNotes, runSyncJobs, type ConnectorRegistry, type SourcesDeps } from "@wonder/creator-sources/server";
import type { Db } from "@wonder/db";
import { serviceClient } from "@/lib/supabase/service";

/**
 * Personal Sources in the app (docs/personal-sources.md). Which providers can be connected here, the deps the pipeline
 * runs with, and the views the screens read. Providers without a working connector are listed honestly as not set up.
 */

/** The order sources are listed in (board "Personal Sources", 2 Oct 2026). */
export const SOURCE_ORDER: Provider[] = ["gmail", "google_calendar", "native_notes", "phone_photos"];

export const PROVIDER_HINT: Record<Provider, string> = {
  gmail: "Trips, plans and ideas from your mail",
  google_calendar: "Trips, events and meaningful days",
  native_notes: "Your own notes and ideas in Wonder Creator",
  external_notes: "Notes you keep elsewhere",
  phone_photos: "Photos you choose from your phone",
  cloud_photos: "Photos from a cloud library",
};

/** Connectors that work on this server. */
export function connectors(): ConnectorRegistry {
  return { native_notes: nativeNotes };
}

/** Sources the creator can connect right now without a provider consent screen. */
export const DIRECT_CONNECT: Provider[] = ["native_notes"];

export function sourcesDeps(): SourcesDeps {
  return { service: serviceClient(), connectors: connectors() };
}

/** Run a creator's queued sync work after the response; anything left is picked up by the job worker. */
export async function drainSync(creatorId: string): Promise<void> {
  await runSyncJobs(sourcesDeps(), { creatorId, deadlineMs: 45_000 });
}

export interface SourceRow {
  provider: Provider;
  label: string;
  hint: string;
  connectionId: string | null;
  status: ConnectionStatus;
  lastSyncedAt: string | null;
  /** Can be connected from here now. */
  available: boolean;
  activeJob: { id: string; status: JobStatus; phase: string; scanned: number } | null;
}

export async function sourceRows(db: Db): Promise<SourceRow[]> {
  const [{ data: conns }, { data: jobs }] = await Promise.all([
    db.from("source_connections").select("id, provider, status, last_successful_sync_at"),
    db.from("source_sync_jobs").select("id, connection_id, status, phase, scanned_count").in("status", ["queued", "running", "paused"]).not("connection_id", "is", null),
  ]);
  const reg = connectors();
  return SOURCE_ORDER.map((provider) => {
    const c = (conns ?? []).find((x) => x.provider === provider);
    const j = c ? (jobs ?? []).find((x) => x.connection_id === c.id) : undefined;
    return {
      provider,
      label: PROVIDER_LABEL[provider],
      hint: PROVIDER_HINT[provider],
      connectionId: c?.id ?? null,
      status: (c?.status ?? "not_connected") as ConnectionStatus,
      lastSyncedAt: c?.last_successful_sync_at ?? null,
      available: !!reg[provider] && DIRECT_CONNECT.includes(provider),
      activeJob: j ? { id: j.id, status: j.status as JobStatus, phase: j.phase, scanned: j.scanned_count } : null,
    };
  });
}

export interface CandidateCard {
  id: string;
  title: string;
  explanation: string;
  quote: string | null;
  counts: string;
  state: string;
}

/** The few groups worth exploring, best first. */
export async function candidateCards(db: Db, limit = 5): Promise<CandidateCard[]> {
  const { data } = await db
    .from("context_candidates")
    .select("id, title, explanation, quote, counts, state")
    .in("state", ["new", "reviewed"])
    .gt("expires_at", new Date().toISOString())
    .order("score", { ascending: false })
    .limit(limit);
  return (data ?? []).map((c) => ({ id: c.id, title: c.title, explanation: c.explanation, quote: c.quote, counts: countsLine(c.counts as Record<string, number>), state: c.state }));
}

export interface CandidateItem {
  id: string;
  sourceType: "email" | "event" | "note" | "photo" | "file";
  provider: Provider;
  title: string | null;
  excerpt: string | null;
  occurredAt: string | null;
  previewRef: string | null;
  imported: boolean;
}

/** One group with its items, for the review screen. Only safe titles and excerpts ever leave the index. */
export async function candidateDetail(db: Db, id: string): Promise<(CandidateCard & { items: CandidateItem[] }) | null> {
  const { data: c } = await db.from("context_candidates").select("id, title, explanation, quote, counts, state, record_ids").eq("id", id).maybeSingle();
  if (!c) return null;
  const { data: rs } = c.record_ids.length
    ? await db
        .from("source_context_records")
        .select("id, source_type, safe_title, safe_excerpt, occurred_at, preview_ref, material_id, hydration_level, source_connections(provider)")
        .in("id", c.record_ids)
        .order("occurred_at", { ascending: false })
    : { data: [] };
  return {
    id: c.id,
    title: c.title,
    explanation: c.explanation,
    quote: c.quote,
    counts: countsLine(c.counts as Record<string, number>),
    state: c.state,
    items: (rs ?? []).map((r) => ({
      id: r.id,
      sourceType: r.source_type as CandidateItem["sourceType"],
      provider: ((r.source_connections as { provider?: string } | null)?.provider ?? "native_notes") as Provider,
      title: r.safe_title,
      excerpt: r.safe_excerpt,
      occurredAt: r.occurred_at,
      previewRef: r.preview_ref,
      imported: r.hydration_level === 4,
    })),
  };
}

/** Home's "From your world": whether anything is connected, the best candidate, how many more, and running syncs. */
export async function homeWorld(db: Db): Promise<{ connected: boolean; candidate: CandidateCard | null; more: number; activeJobIds: string[] }> {
  const [{ count }, cards, { data: jobs }] = await Promise.all([
    db.from("source_connections").select("id", { count: "exact", head: true }),
    candidateCards(db, 5),
    db.from("source_sync_jobs").select("id").in("status", ["queued", "running", "paused"]).not("connection_id", "is", null),
  ]);
  return { connected: (count ?? 0) > 0, candidate: cards[0] ?? null, more: Math.max(0, cards.length - 1), activeJobIds: (jobs ?? []).map((j) => j.id) };
}
