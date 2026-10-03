"use client";
import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { navIconClass } from "./nav-icon";

const POLL_MS = 60_000;

/**
 * Messages in the top bar (owner, 2 Oct 2026): one tap to your conversations, with a quiet dot-count when something is
 * unread (direct conversations and crew chats). Refreshes on navigation and on a slow poll while the tab is visible.
 */
export function MessagesButton() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await api<{ unread: Array<{ unread: number }> }>("/api/v1/messages/unread");
      setUnread(r.unread.reduce((n, x) => n + x.unread, 0));
    } catch {
      // A failed count never blocks the link itself.
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const t = setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load, pathname]);

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
