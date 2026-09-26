/**
 * Viewer-facing Huddle state. Derived purely from server state so a dissolved Huddle
 * can never be shown as live.
 */
export type HuddleViewState = "draft" | "live" | "join_request_pending" | "approved" | "joined" | "leaving" | "dissolving" | "dissolved";

export interface ServerHuddleSnapshot {
  status: "live" | "dissolving" | "dissolved" | null; // null = not visible / not found
  myParticipantStatus: "joining" | "joined" | "left" | null;
  myPendingRequest: boolean;
  leaving?: boolean;
}

export function viewState(s: ServerHuddleSnapshot): HuddleViewState {
  if (s.status === null || s.status === "dissolved") return "dissolved";
  if (s.status === "dissolving") return "dissolving";
  if (s.leaving) return "leaving";
  if (s.myParticipantStatus === "joined") return "joined";
  if (s.myParticipantStatus === "joining") return "approved";
  if (s.myPendingRequest) return "join_request_pending";
  return "live";
}

export function formatElapsed(startedAt: string, now: Date = new Date()): string {
  const secs = Math.max(0, Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return h ? `${h}:${mm}:${String(s).padStart(2, "0")}` : `${mm}:${String(s).padStart(2, "0")}`;
}

/** "Maya · Arjun · Sofia" with overflow. */
export function participantLine(names: string[], total: number): string {
  const shown = names.filter(Boolean).slice(0, 3).map((n) => n.split(" ")[0]);
  const extra = total - shown.length;
  return extra > 0 ? `${shown.join(" · ")} + ${extra}` : shown.join(" · ");
}

export const HEARTBEAT_MS = 25_000;
export const STALE_AFTER_SECONDS = 90;
