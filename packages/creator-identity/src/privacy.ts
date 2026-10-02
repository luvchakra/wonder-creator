import { DomainError, fromDbError } from "@wonder/core";
import type { Db } from "@wonder/db";
import { z } from "zod";
import { CONSENT_PURPOSES, NOTICE_VERSION, REQUEST_KINDS, type ConsentPurpose } from "./privacy-options";

/**
 * Privacy compliance (GDPR / DPDP): consent records, data-principal requests and the personal-data export.
 * docs/compliance/privacy.md.
 */

export interface ConsentState {
  purpose: ConsentPurpose;
  notice_version: string;
  granted: boolean;
  created_at: string;
}

export async function myConsents(db: Db): Promise<ConsentState[]> {
  const { data, error } = await db.rpc("my_consents");
  if (error) throw fromDbError(error);
  return (data ?? []) as ConsentState[];
}

export const consentSchema = z.object({
  method: z.enum(["sign_up", "onboarding", "consent_prompt", "settings"]),
  choices: z.array(z.object({ purpose: z.enum(CONSENT_PURPOSES), granted: z.boolean() })).min(1).max(CONSENT_PURPOSES.length),
});

/** Records choices against the current notice version (append-only; the latest choice per purpose wins). */
export async function recordConsents(db: Db, creatorId: string, raw: unknown): Promise<ConsentState[]> {
  const v = consentSchema.parse(raw);
  const rows = v.choices.map((c) => ({ creator_id: creatorId, purpose: c.purpose, granted: c.granted, notice_version: NOTICE_VERSION, method: v.method }));
  const { error } = await db.from("consent_records").insert(rows);
  if (error) throw fromDbError(error);
  return myConsents(db);
}

export const privacyRequestSchema = z.object({
  kind: z.enum(REQUEST_KINDS),
  details: z.string().trim().max(4000).default(""),
});

export async function filePrivacyRequest(db: Db, creatorId: string, raw: unknown) {
  const v = privacyRequestSchema.parse(raw);
  if ((v.kind === "correction" || v.kind === "nomination" || v.kind === "grievance" || v.kind === "objection") && v.details.length < 5) {
    throw new DomainError("validation", "Tell us a little more so we can act on it.");
  }
  const { data, error } = await db.from("privacy_requests").insert({ creator_id: creatorId, kind: v.kind, details: v.details }).select("id, kind, status, due_at, created_at").single();
  if (error) throw fromDbError(error);
  return data;
}

export async function myPrivacyRequests(db: Db) {
  const { data, error } = await db.from("privacy_requests").select("id, kind, details, status, response, due_at, created_at, closed_at").order("created_at", { ascending: false }).limit(50);
  if (error) throw fromDbError(error);
  return data ?? [];
}

/**
 * Every table holding the creator's own rows, exported in full (GDPR Art. 15/20; DPDP §11). A test checks that every
 * table with a `creator_id` column is either here or in EXPORT_EXCLUDED with a reason, so new tables can't be missed.
 */
export const EXPORT_TABLES = [
  "creators", "creator_disciplines", "creator_skills", "creator_languages", "creator_interests", "creator_voice_profiles", "creator_boundaries",
  "creator_autonomy_policies", "creator_open_to", "creator_pages", "creator_visits", "brand_profiles", "collaboration_profiles", "collaborator_shortlist",
  "consent_records", "privacy_requests",
  "creative_materials", "creative_material_tags", "storage_objects", "provenance_records", "reference_shelves", "reference_items", "material_collections",
  "material_collection_items", "intake_items", "capture_receipts",
  "conversations", "conversation_messages", "conversation_attachments", "creative_memories", "creative_memory_feedback",
  "artifacts", "artifact_versions", "artifact_version_sources", "artifact_comments", "artifact_change_proposals", "artifact_shares", "lineage_edges",
  "carousels", "carousel_slides", "image_generations", "image_generation_assets", "image_asset_revisions", "studio_sessions", "studio_sources", "quality_reports",
  "rights_records", "rights_owners", "rights_events", "licenses", "ownership_assertions",
  "publications", "publication_attempts", "publication_metrics", "publication_signoffs", "publishing_destinations", "publishing_preferences", "published_works", "published_revisions",
  "market_listings", "business_records", "campaign_invitations", "campaign_deliverables", "payment_orders", "payment_refunds", "ledger_entries",
  "projects", "project_items", "project_task_assignees", "project_task_comments", "crews", "crew_members", "crew_messages", "crew_message_reads",
  "huddle_participants", "huddle_messages", "huddle_events", "huddle_history", "huddle_preserved_items",
  "direct_messages", "direct_thread_reads", "scrapbook_posts", "scrapbook_attachments", "scrapbook_replies",
  "open_conversations", "open_conversation_replies", "open_conversation_reads", "open_conversation_invites",
  "dejavus", "dejavu_moments", "dejavu_suggestions", "moment_references", "moment_connections", "soundtrack_favourites",
  "ai_runs", "ai_run_steps", "ai_tool_calls", "ai_proposals",
  "source_connections", "source_sync_cursors", "source_sync_jobs", "source_context_records", "context_candidates",
] as const;

/** Tables with a creator_id that aren't exported, and why. */
export const EXPORT_EXCLUDED: Record<string, string> = {
  search_embeddings: "Derived numeric vectors of content already in the export; regenerated from it.",
  creator_ai_keys: "Holds only a reference to an encrypted vault secret (the key itself is never readable back).",
  domain_events: "Internal system events; the creator's own actions are in audit_logs.",
  jobs: "Transient processing queue entries, purged after 30 days.",
  platform_moderators: "Operator appointment; not the creator's personal data.",
  reconciliation_exceptions: "Operator control evidence about payment records; the records themselves are exported.",
  source_connection_secrets: "Holds only a reference to an encrypted vault credential for a connected source (never readable back).",
};

/** Rows where the creator is referenced by another column. */
const OTHER_OWNER_COLUMNS: Array<[string, string]> = [
  ["creator_follows", "follower_creator_id"],
  ["creator_blocks", "blocker_creator_id"],
  ["license_requests", "requester_creator_id"],
  ["audit_logs", "actor_creator_id"],
  ["huddle_join_requests", "requester_creator_id"],
  ["payment_orders", "payer_creator_id"],
];

export async function exportPersonalData(db: Db, creatorId: string): Promise<Record<string, unknown>> {
  const loose = db as unknown as { from: (t: string) => { select: (s: string) => { eq: (c: string, v: string) => { limit: (n: number) => Promise<{ data: unknown[] | null }> } } } };
  const out: Record<string, unknown> = {};
  const { data: user } = await db.auth.getUser();
  out.account = { email: user.user?.email ?? null, createdAt: user.user?.created_at ?? null, lastSignInAt: user.user?.last_sign_in_at ?? null };
  for (const t of EXPORT_TABLES) {
    const { data } = await loose.from(t).select("*").eq(t === "creators" ? "id" : "creator_id", creatorId).limit(10000);
    out[t] = data ?? [];
  }
  for (const [t, col] of OTHER_OWNER_COLUMNS) {
    const { data } = await loose.from(t).select("*").eq(col, creatorId).limit(10000);
    out[`${t}__by_${col}`] = data ?? [];
  }
  return out;
}
