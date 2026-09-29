import { log } from "@wonder/core";

/**
 * Product telemetry (docs/phases/02-home-quick-capture.md §16): outcomes, not engagement. Only named events and a few
 * plain properties are recorded — never text, titles, transcripts or anything the creator wrote. Home is not optimised
 * for time spent; there is deliberately no dwell-time or scroll tracking.
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

export function track(event: TelemetryEvent, creatorId: string, props: TelemetryProps = {}) {
  log("info", "telemetry", { event, creatorId, ...props });
}
