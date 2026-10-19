"use client";
import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, lastWriteAt } from "@/lib/client";
import { usePoll } from "@/lib/use-poll";
import { navIconClass } from "./nav-icon";

const POLL_MS = 60_000;

/**
 * Messages in the top bar (owner, 2 Oct 2026): one tap to your conversations, with a quiet dot-count when something is
 * unread (direct conversations and crew chats). Refreshes on navigation and on a slow poll while the tab is visible.
 */
export function MessagesButton() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  const loadedAt = useRef(0);
  const load = useCallback(async () => {
    try {
      const r = await api<{ unread: Array<{ unread: number }> }>("/api/v1/messages/unread");
      loadedAt.current = Date.now();
      setUnread(r.unread.reduce((n, x) => n + x.unread, 0));
    } catch {
      // A failed count never blocks the link itself.
    }
  }, []);

  // On navigation — but not twice within a few seconds unless this tab just changed something (reading a thread, say);
  // then on a slow poll that pauses while the tab is hidden and catches up when it returns.
  useEffect(() => {
    const first = setTimeout(() => (Date.now() - loadedAt.current > 15_000 || lastWriteAt() > loadedAt.current) && void load(), 0);
    return () => clearTimeout(first);
  }, [load, pathname]);
  usePoll(load, POLL_MS);

  const here = pathname?.startsWith("/messages");
  return (
    <Link
      href="/messages"
      aria-label={unread ? `Messages, ${unread} unread` : "Messages"}
      aria-current={here ? "page" : undefined}
      className={navIconClass(here)}
    >
      <MessageCircle className="size-5" aria-hidden />
      {unread ? (
        <span aria-hidden className="absolute right-1 top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold leading-5 text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
