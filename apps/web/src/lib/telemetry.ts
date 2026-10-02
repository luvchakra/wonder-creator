import { log } from "@wonder/core";
import { myConsents } from "@wonder/creator-identity";
import type { Db } from "@wonder/db";

/**
 * Product telemetry (docs/phases/02-home-quick-capture.md §16): outcomes, not engagement. Only named events and a few
 * plain properties are recorded — never text, titles, transcripts or anything the creator wrote. Home is not optimised
 * for time spent; there is deliberately no dwell-time or scroll tracking.
 *
 * Consent (GDPR Art. 6(1)(a); DPDP §6): nothing is recorded unless the creator turned on "usage measures"
 * (`product_analytics`); it's off by default and can be turned off any time in Settings › Privacy.
 */
export const TELEMETRY_EVENTS = [
  "home_opened",
  "home_mode_rendered",
  "home_continue_clicked",
  "quick_note_started",
  "quick_note_saved",
  "voice_note_started",
  "voice_note_saved",
  "voice_note_transcribed",
  "home_connection_opened",
  "home_dejavu_opened",
  "home_spark_opened",
  // Phase 05 §18 — suggestion and connection outcomes (accepted, dismissed, opened, used later), not engagement.
  "connection_opened",
  "connection_dismissed",
  "connection_used",
  "connection_why_opened",
  "dejavu_suggestion_accepted",
  "dejavu_suggestion_dismissed",
  "community_reply_used_in_studio",
  "community_thought_saved",
  "community_triage_used",
  "conversation_summary_shown",
  "huddle_from_conversation",
  "creative_room_from_conversation",
  "community_joined",
  "community_topic_started",
  "ask_community_sent",
] as const;
export type TelemetryEvent = (typeof TELEMETRY_EVENTS)[number];
export const isTelemetryEvent = (e: unknown): e is TelemetryEvent => typeof e === "string" && (TELEMETRY_EVENTS as readonly string[]).includes(e);

/** Allowed properties: short enumerations and numbers only. */
export type TelemetryProps = { mode?: "active" | "return" | "quiet" | "fallback"; slots?: number; ok?: boolean; offline?: boolean; seconds?: number; ms?: number };

export function cleanProps(raw: unknown): TelemetryProps {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1e7, Math.round(v))) : undefined);
  return {
    mode: p.mode === "active" || p.mode === "return" || p.mode === "quiet" || p.mode === "fallback" ? p.mode : undefined,
    slots: num(p.slots),
    ok: typeof p.ok === "boolean" ? p.ok : undefined,
    offline: typeof p.offline === "boolean" ? p.offline : undefined,
    seconds: num(p.seconds),
    ms: num(p.ms),
  };
}

/** Whether the signed-in creator currently allows usage measures (their latest choice; off when never asked). */
export async function analyticsAllowed(db: Db): Promise<boolean> {
  const consents = await myConsents(db).catch(() => []);
  return consents.some((c) => c.purpose === "product_analytics" && c.granted);
}

/** Records an outcome event if the creator allows it. Never blocks or fails the request it's called from. */
export function track(db: Db, event: TelemetryEvent, creatorId: string, props: TelemetryProps = {}) {
  void analyticsAllowed(db).then((ok) => {
    if (ok) log("info", "telemetry", { event, creatorId, ...props });
  });
}
