import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { countsLine, PROVIDER_LABEL, type ConnectionStatus, type JobStatus, type Provider } from "@wonder/creator-sources";
import { calendarConnector, gmailConnector, nativeNotes, runSyncJobs, type ConnectorRegistry, type GoogleClient, type GoogleSource, type SourcesDeps } from "@wonder/creator-sources/server";
import type { Db } from "@wonder/db";
import { serviceClient } from "./supabase/service";

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

/**
 * The Google OAuth client for Personal Sources (Gmail; Calendar later). Separate from Google sign-in, which Supabase
 * handles: signing in grants nothing here. Null until GOOGLE_OAUTH_CLIENT_ID / _SECRET are set (docs/personal-sources.md).
 */
export function googleClient(): GoogleClient | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** The refresh token for one connection, read on the server only. */
async function sourceSecret(creatorId: string, connectionId: string): Promise<string | null> {
  const { data } = await serviceClient().rpc("source_secret_read", { p_creator: creatorId, p_connection: connectionId });
  return (data as string | null) ?? null;
}

/**
 * Kill switches (spec §13), read on every request: WONDERCREATOR_SOURCES_DISABLED=gmail,google_calendar turns off one
 * failing provider without touching the rest; WONDERCREATOR_SOURCES_AI=off stops enrichment; WONDERCREATOR_SOURCES_HOME=off
 * hides the Home card. The whole feature: WONDERCREATOR_FLAG_PERSONAL_SOURCES_ENABLED=off.
 */
export function disabledProviders(): Set<string> {
  return new Set((process.env.WONDERCREATOR_SOURCES_DISABLED ?? "").split(",").map((s) => s.trim()).filter(Boolean));
}
export const sourcesAiOn = () => process.env.WONDERCREATOR_SOURCES_AI?.trim().toLowerCase() !== "off";
export const sourcesHomeOn = () => process.env.WONDERCREATOR_SOURCES_HOME?.trim().toLowerCase() !== "off";

/** Connectors that work on this server (and aren't switched off). */
export function connectors(): ConnectorRegistry {
  const google = googleClient();
  const all: ConnectorRegistry = { native_notes: nativeNotes, ...(google ? { gmail: gmailConnector(google, sourceSecret), google_calendar: calendarConnector(google, sourceSecret) } : {}) };
  const off = disabledProviders();
  return Object.fromEntries(Object.entries(all).filter(([p]) => !off.has(p))) as ConnectorRegistry;
}

/** Sources the creator can connect right now without a provider consent screen. */
export const DIRECT_CONNECT: Provider[] = ["native_notes"];
/** Sources the creator feeds by choosing items on their device (no background access). */
export const PICK_CONNECT: Provider[] = ["phone_photos"];
/** Sources connected through the provider's own consent screen. */
export const OAUTH_CONNECT: Provider[] = ["gmail", "google_calendar"];

/** The creator's CreativeMind model, only when it's live (enrichment is never faked). */
export async function creatorModel(creatorId: string) {
  if (!sourcesAiOn()) return null;
  const { providerFor } = await import("./brain");
  const { provider } = await providerFor(creatorId);
  return provider.live ? provider : null;
}

export function sourcesDeps(): SourcesDeps {
  return { service: serviceClient(), connectors: connectors(), model: creatorModel };
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
  /** Connects through the provider's consent screen (not a direct insert). */
  oauth: boolean;
  /** Fed by choosing items on the device (Photos). */
  pick: boolean;
  /** Account the source belongs to, e.g. the Gmail address. */
  account: string | null;
  /** Switched off on this server for now (a provider incident); nothing is lost. */
  paused: boolean;
  activeJob: { id: string; status: JobStatus; phase: string; scanned: number } | null;
}

export async function sourceRows(db: Db): Promise<SourceRow[]> {
  const [{ data: conns }, { data: jobs }] = await Promise.all([
    db.from("source_connections").select("id, provider, status, last_successful_sync_at, account_display_name"),
    db.from("source_sync_jobs").select("id, connection_id, status, phase, scanned_count").in("status", ["queued", "running", "paused"]).not("connection_id", "is", null),
  ]);
  const reg = connectors();
  const off = disabledProviders();
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
      available: PICK_CONNECT.includes(provider) || (!!reg[provider] && (DIRECT_CONNECT.includes(provider) || OAUTH_CONNECT.includes(provider))),
      pick: PICK_CONNECT.includes(provider),
      oauth: OAUTH_CONNECT.includes(provider),
      account: c?.account_display_name ?? null,
      paused: off.has(provider),
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
  /** The creator's own photo from the group, when there is one (real imagery first). */
  cover: string | null;
  /** CreativeMind's one concise possibility for this group, when a live model has looked at it. */
  suggestion: string | null;
}

/** The few groups worth exploring, best first. */
export async function candidateCards(db: Db, limit = 5): Promise<CandidateCard[]> {
  const { data } = await db
    .from("context_candidates")
    .select("id, title, explanation, quote, counts, state, record_ids, suggestion")
    .in("state", ["new", "reviewed"])
    .gt("expires_at", new Date().toISOString())
    .order("score", { ascending: false })
    .limit(limit);
  const ids = [...new Set((data ?? []).flatMap((c) => c.record_ids))];
  const { data: photos } = ids.length
    ? await db.from("source_context_records").select("id, preview_ref").in("id", ids).eq("source_type", "photo").not("preview_ref", "is", null).order("occurred_at")
    : { data: [] };
  const preview = new Map((photos ?? []).map((p) => [p.id, p.preview_ref]));
  return (data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    explanation: c.explanation,
    quote: c.quote,
    counts: countsLine(c.counts as Record<string, number>),
    state: c.state,
    cover: c.record_ids.map((r) => preview.get(r)).find(Boolean) ?? null,
    suggestion: c.suggestion,
  }));
}

export interface CandidateItem {
  id: string;
  sourceType: "email" | "event" | "note" | "photo" | "file";
  provider: Provider;
  title: string | null;
  excerpt: string | null;
  occurredAt: string | null;
  previewRef: string | null;
  /** A photo's SHA-256 (to match the original on the device at import). */
  fingerprint: string | null;
  imported: boolean;
}

/** One group with its items, for the review screen. Only safe titles and excerpts ever leave the index. */
export async function candidateDetail(db: Db, id: string): Promise<(CandidateCard & { items: CandidateItem[] }) | null> {
  const { data: c } = await db.from("context_candidates").select("id, title, explanation, quote, counts, state, record_ids, suggestion").eq("id", id).maybeSingle();
  if (!c) return null;
  const { data: rs } = c.record_ids.length
    ? await db
        .from("source_context_records")
        .select("id, source_type, safe_title, safe_excerpt, occurred_at, preview_ref, material_id, hydration_level, fingerprint, source_connections(provider)")
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
    cover: (rs ?? []).find((r) => r.source_type === "photo" && r.preview_ref)?.preview_ref ?? null,
    suggestion: c.suggestion,
    items: (rs ?? []).map((r) => ({
      id: r.id,
      sourceType: r.source_type as CandidateItem["sourceType"],
      provider: ((r.source_connections as { provider?: string } | null)?.provider ?? "native_notes") as Provider,
      title: r.safe_title,
      excerpt: r.safe_excerpt,
      occurredAt: r.occurred_at,
      previewRef: r.preview_ref,
      fingerprint: r.source_type === "photo" ? r.fingerprint : null,
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

// ---------------------------------------------------------------------------------------------------- OAuth state

export const OAUTH_COOKIE = "wc_ps_oauth";
export const OAUTH_COOKIE_PATH = "/api/v1/personal-sources/google";
/** One redirect URI for every Google source (register it once in Google Cloud). */
export const googleRedirectUri = (origin: string) => `${origin}/api/v1/personal-sources/google/callback`;

type OAuthState = { state: string; verifier: string; creatorId: string; provider: GoogleSource; at: number };

/** The consent round-trip's state, sealed (AES-256-GCM) so the PKCE verifier never sits readable in the browser. */
export function sealOAuth(v: OAuthState): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", oauthKey(), iv);
  const body = Buffer.concat([c.update(JSON.stringify(v), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64url");
}

export function openOAuth(sealed: string | undefined): OAuthState | null {
  if (!sealed) return null;
  try {
    const raw = Buffer.from(sealed, "base64url");
    const d = createDecipheriv("aes-256-gcm", oauthKey(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8")) as OAuthState;
  } catch {
    return null;
  }
}

let derived: { from: string; key: Buffer } | null = null;
function oauthKey(): Buffer {
  // Derived (scrypt) from the OAuth client secret: present whenever Google sources can be connected, never sent to the
  // browser. Memoised: derivation is deliberately slow.
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "";
  if (derived?.from !== secret) derived = { from: secret, key: scryptSync(secret, "wc-personal-sources-oauth-state", 32) };
  return derived.key;
}

/** Search the creator's own index (titles, previews, places) — what discovery already found, nothing fetched. */
export async function searchIndex(db: Db, terms: string, limit = 60): Promise<CandidateItem[]> {
  const like = `*${terms.replace(/[*,()]/g, " ")}*`;
  const { data } = await db
    .from("source_context_records")
    .select("id, source_type, safe_title, safe_excerpt, occurred_at, preview_ref, material_id, hydration_level, fingerprint, source_connections(provider)")
    .or(`safe_title.ilike.${like},safe_excerpt.ilike.${like},place.ilike.${like}`)
    .order("occurred_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data ?? []).map((r) => ({
    id: r.id,
    sourceType: r.source_type as CandidateItem["sourceType"],
    provider: ((r.source_connections as { provider?: string } | null)?.provider ?? "native_notes") as Provider,
    title: r.safe_title,
    excerpt: r.safe_excerpt,
    occurredAt: r.occurred_at,
    previewRef: r.preview_ref,
    fingerprint: r.source_type === "photo" ? r.fingerprint : null,
    imported: r.hydration_level === 4,
  }));
}
