/**
 * Personal Sources (docs/personal-sources.md): Connect, Discover, Review and Bring In stay separate. Sync discovers;
 * the creator decides what becomes creative material.
 */

export const PROVIDERS = ["gmail", "google_calendar", "native_notes", "external_notes", "phone_photos", "cloud_photos"] as const;
export type Provider = (typeof PROVIDERS)[number];

export type ConnectionStatus = "not_connected" | "connected" | "queued" | "syncing" | "partially_synced" | "paused" | "needs_reconnect" | "error";
export type JobStatus = "queued" | "running" | "partially_complete" | "paused" | "completed" | "cancelled" | "failed";
export type SyncMode = "quick" | "targeted" | "deeper";
export type SourceType = "email" | "event" | "note" | "photo" | "file";
export type CandidateState = "new" | "reviewed" | "dismissed" | "imported" | "expired";

/** Statuses a job is still working in. */
export const ACTIVE_JOB: readonly JobStatus[] = ["queued", "running", "paused"];

export const PROVIDER_LABEL: Record<Provider, string> = {
  gmail: "Gmail",
  google_calendar: "Calendar",
  native_notes: "Notes",
  external_notes: "Other notes",
  phone_photos: "Photos",
  cloud_photos: "Cloud photos",
};

export const SOURCE_NOUN: Record<SourceType, [string, string]> = {
  email: ["email", "emails"],
  event: ["event", "events"],
  note: ["note", "notes"],
  photo: ["photo", "photos"],
  file: ["file", "files"],
};

/** One record as a connector reports it: metadata and at most a safe excerpt (hydration L1–L2). */
export interface RecordInput {
  providerItemId: string;
  sourceType: SourceType;
  occurredAt: string | null;
  title?: string | null;
  excerpt?: string | null;
  place?: string | null;
  previewRef?: string | null;
  hydrationLevel?: 0 | 1 | 2;
  fingerprint?: string | null;
  materialId?: string | null;
  signals?: Record<string, unknown>;
  /** Approximate bytes this record cost to fetch, for the job's byte budget. */
  bytes?: number;
}

/** A record as the index keeps it. */
export interface ContextRecord {
  id: string;
  connectionId: string;
  provider: Provider;
  sourceType: SourceType;
  occurredAt: string | null;
  title: string | null;
  excerpt: string | null;
  place: string | null;
  previewRef: string | null;
  fingerprint: string | null;
  materialId: string | null;
  signals: Record<string, unknown>;
}

/** A group worth exploring: references to records, never a Material itself. */
export interface CandidateDraft {
  signature: string;
  title: string;
  explanation: string;
  quote: string | null;
  recordIds: string[];
  counts: Partial<Record<SourceType, number>>;
  score: number;
}
