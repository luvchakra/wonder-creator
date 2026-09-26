import { participantLine } from "@wonder/creator-huddle/lifecycle";
import { AvatarStack, LiveBadge, buttonClasses, cn } from "@wonder/ui";
import { Users } from "lucide-react";
import Link from "next/link";

export interface LiveCardData {
  huddleId: string;
  topic: string | null;
  participantCount: number;
  participantNames: string[];
  viewerState: "joined" | "approved" | "requested" | "none";
}

/** Public metadata only: names (where permitted), topic, count, live state and a join option. */
export function LiveHuddleCard({ h, compact }: { h: LiveCardData; compact?: boolean }) {
  const action = h.viewerState === "joined" ? "Rejoin" : h.viewerState === "approved" ? "Enter" : h.viewerState === "requested" ? "Requested" : "Request to Join";
  return (
    <article className={cn("flex flex-col rounded-2xl border border-border-soft bg-surface p-4 shadow-[var(--shadow-card)]", compact ? "min-w-64" : "")}>
      <div className="flex items-center justify-between">
        <LiveBadge />
        <span className="inline-flex items-center gap-1 text-sm text-ink-subtle">
          <Users className="size-4" aria-hidden />
          <span className="sr-only">Participants:</span> {h.participantCount}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <AvatarStack people={h.participantNames.map((n) => ({ name: n }))} size={30} />
      </div>
      <p className="mt-2 text-[15px] font-medium text-ink">{participantLine(h.participantNames, h.participantCount) || "Creators"}</p>
      <p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">{h.topic ? `Talking about ${h.topic}` : "An open conversation"}</p>
      <p className="mt-1 text-xs text-ink-subtle">
        {h.participantCount} {h.participantCount === 1 ? "creator" : "creators"}
      </p>
      <Link href={`/huddles/${h.huddleId}`} className={buttonClasses({ variant: h.viewerState === "requested" ? "soft" : "secondary", size: "sm", className: "mt-3 w-full" })}>
        {action}
      </Link>
    </article>
  );
}
