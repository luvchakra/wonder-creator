/**
 * The navbar Context Strip (docs/ui-redesign/context-strip.md): one quiet line that says *what is happening* here —
 * never a menu, ticker or dashboard. The Palette says what to do next; the strip only reduces uncertainty.
 */

export type StripTone = "neutral" | "active" | "success" | "warning" | "error" | "live";

/** §12 priorities: lower is more important. */
export const PRIORITY = {
  error: 1,
  offline: 2,
  external: 3,
  live: 4,
  pending: 5,
  save: 6,
  /** The AI-phrased creative context line (ai-context-line.md P6): below every operational state, above lifecycle. */
  semantic: 6.5,
  lifecycle: 7,
  presence: 8,
  metadata: 9,
} as const;

export interface StripItem {
  id: string;
  text: string;
  /** Narrow screens use this instead of `text` (§17). */
  shortText?: string;
  tone: StripTone;
  priority: number;
  /** Tapping reveals useful detail (§8); most items are informational only. */
  href?: string;
  /** A live timer: the strip appends the elapsed time since this instant, without announcing every second (§26). */
  since?: string;
  /** Transient states return to the stable context after this instant (§13). */
  expiresAt?: number;
}

/** What a screen knows about itself, from data it already loaded (§27: never fetch just to fill the navbar). */
export interface StripFacts {
  /** Creation version number and visibility (e.g. v4 · Private). */
  version?: number;
  visibility?: "private" | "shared" | "public" | null;
  /** Where it's published (a destination name), or how many destinations. */
  publishedTo?: string | null;
  publishState?: "publishing" | "failed" | "scheduled" | null;
  scheduledFor?: string | null;
  /** Counted things on a list screen: [count, singular, plural]. */
  count?: [number, string, string];
  selectedCount?: number;
  importingCount?: number;
  /** Material detail: "Photo · 14 Sep", "Voice · 02:14". */
  kindLabel?: string;
  date?: string | null;
  durationSeconds?: number | null;
  /** A long-running step on this object ("Transcribing…", "Understanding…"). */
  processing?: string | null;
  /** Something finished worth a quiet mention ("Transcript ready"). */
  ready?: string | null;
  /** A live Huddle. */
  liveSince?: string | null;
  participantCount?: number;
  /** Other collaborators present on this object (hidden at zero, §24). */
  collaboratorCount?: number;
  pendingApprovalCount?: number;
  dueAt?: string | null;
  /** Home: the Creation in progress, or a waiting CreativeMind idea. */
  continueTitle?: string | null;
  ideasWaiting?: number;
  /** A settings section, or a plain label when nothing richer applies ("Choose how to begin"). */
  label?: string | null;
}

export interface StripModel {
  primary: StripItem | null;
  /** Shown on wider screens only (§17). */
  secondary: StripItem | null;
}
