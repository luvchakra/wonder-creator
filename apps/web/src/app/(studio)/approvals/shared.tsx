import type { ApprovalState } from "@wonder/creator-brain";
import { Badge } from "@wonder/ui";

export const STATE_TEXT: Record<ApprovalState, { label: string; tone: "neutral" | "accent" | "success" | "warning" | "danger" }> = {
  pending: { label: "Waiting for you", tone: "accent" },
  approved: { label: "Approved, in progress", tone: "accent" },
  executed: { label: "Approved and done", tone: "success" },
  failed: { label: "Approved, didn't finish", tone: "danger" },
  declined: { label: "Declined", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  expired: { label: "Expired", tone: "warning" },
};

export function StateBadge({ state }: { state: ApprovalState }) {
  const s = STATE_TEXT[state];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
