import type { Enums } from "@wonder/db";

export type IntakeState = Enums<"intake_state">;

/** Allowed transitions. FAILED keeps the original; retry re-enters at VALIDATING/EXTRACTING. */
export const TRANSITIONS: Record<IntakeState, IntakeState[]> = {
  received: ["validating", "failed"],
  validating: ["security_review", "quarantined", "failed"],
  security_review: ["extracting", "quarantined", "failed"],
  extracting: ["normalizing", "failed"],
  normalizing: ["understood", "ready", "failed"],
  understood: ["ready", "failed"],
  ready: ["extracting"], // re-process on request
  failed: ["validating", "extracting"],
  quarantined: [],
};

export function canTransition(from: IntakeState, to: IntakeState): boolean {
  return TRANSITIONS[from].includes(to);
}

export const STATE_LABEL: Record<IntakeState, string> = {
  received: "Received",
  validating: "Checking the file",
  security_review: "Security check",
  extracting: "Extracting text and details",
  normalizing: "Organizing",
  understood: "Understood",
  ready: "Ready",
  failed: "Needs attention",
  quarantined: "Held for safety",
};

export const PIPELINE_STEPS: Array<{ state: IntakeState; label: string }> = [
  { state: "received", label: "Ingest" },
  { state: "security_review", label: "Check" },
  { state: "extracting", label: "Extract" },
  { state: "understood", label: "Understand" },
  { state: "ready", label: "Ready" },
];

export function stepIndex(state: IntakeState): number {
  const order: IntakeState[] = ["received", "validating", "security_review", "extracting", "normalizing", "understood", "ready"];
  const i = order.indexOf(state);
  if (i < 0) return -1;
  if (i <= 1) return 0;
  if (i === 2) return 1;
  if (i <= 4) return 2;
  if (i === 5) return 3;
  return 4;
}
