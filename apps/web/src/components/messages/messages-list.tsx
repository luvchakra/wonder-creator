"use client";
import { Avatar, cn } from "@wonder/ui";
import { Check, Search, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { RelativeTime } from "@/components/client-time";

export interface MessageRow {
  id: string;
  href: string;
  title: string;
  /** A direct conversation shows the person; a crew chat shows the Creative Room. */
  kind: "direct" | "crew";
  avatarUrl: string | null;
  preview: string | null;
  previewMine: boolean;
  at: string | null;
  unread: number;
}

/**
 * The conversation list (owner, 3 Oct 2026: "as clean and useful as WhatsApp"): one row per conversation, newest
 * first — a face, the name, the last line with "You:" and a tick when it's yours, the time on the right and a small
 * accent count when something is unread (then the name and line read bold). One search field filters by name or last
 * line. Direct conversations and crew chats sit in one list, crew chats marked by the room.
 */
export function MessagesList({ rows }: { rows: MessageRow[] }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = needle ? rows.filter((r) => r.title.toLowerCase().includes(needle) || r.preview?.toLowerCase().includes(needle)) : rows;
  return (
    <div className="space-y-2">
      <label className="relative block">
        <span className="sr-only">Search conversations</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search conversations"
          className="h-10 w-full rounded-full border border-border-soft bg-surface pl-9 pr-3 text-[14px] text-ink placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-accent"
        />
      </label>
      {shown.length ? (
        <ul aria-label="Conversations" className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-surface/95 shadow-[var(--shadow-card)]">
          {shown.map((r) => (
            <li key={r.id}>
              <Link href={r.href} className="flex min-h-[60px] items-center gap-3 px-3 py-2 hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-accent">
                {r.kind === "crew" ? (
                  <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink">
                    <Users className="size-5" />
                  </span>
                ) : (
                  <Avatar name={r.title} src={r.avatarUrl} size={44} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={cn("min-w-0 flex-1 truncate text-[15px] text-ink", r.unread ? "font-semibold" : "font-medium")}>{r.title}</span>
                    {r.at ? (
                      <span className={cn("shrink-0 text-[11.5px]", r.unread ? "font-medium text-accent-ink" : "text-ink-subtle")}>
                        <RelativeTime iso={r.at} />
                      </span>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={cn("flex min-w-0 flex-1 items-center gap-1 truncate text-[13.5px]", r.unread ? "text-ink" : "text-ink-muted")}>
                      {r.previewMine ? <Check className="size-3.5 shrink-0 text-ink-subtle" aria-label="You: " /> : null}
                      <span className="truncate">{r.preview ?? (r.kind === "crew" ? "Crew chat" : "Say hello")}</span>
                    </span>
                    {r.unread ? (
                      <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-5 text-white" aria-label={`${r.unread} unread`}>
                        {r.unread > 99 ? "99+" : r.unread}
                      </span>
                    ) : null}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-3 py-6 text-center text-[13.5px] text-ink-muted">{needle ? "No conversation matches that." : "No conversations yet."}</p>
      )}
    </div>
  );
}
