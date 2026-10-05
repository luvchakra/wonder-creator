"use client";
import { navIconClass } from "./nav-icon";
import { Popover, PopoverContent, PopoverTrigger, Spinner } from "@wonder/ui";
import { AlertCircle, Bell, Brain, Loader, Scale, Share2, UserPlus, Users, UsersRound, MessageCircle, MessageCircleQuestion, FilePenLine, Quote, Signature } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/client";
import { RelativeTime } from "./client-time";

interface Item {
  id: string;
  kind: "proposal" | "join_request" | "huddle_invite" | "intake_failed" | "run_active" | "run_unfinished" | "license_request" | "license_response" | "shared_with_you" | "crew_invite" | "crew_question" | "proposal_review" | "proposal_decided" | "collaborator_added" | "rights_claim" | "message" | "testimonial" | "testimonial_shown" | "song_signoff";
  title: string;
  detail: string | null;
  href: string;
  at: string;
}

const ICON = { proposal: Brain, join_request: UserPlus, huddle_invite: Users, intake_failed: AlertCircle, run_active: Loader, run_unfinished: AlertCircle, license_request: Scale, license_response: Scale, shared_with_you: Share2, crew_invite: UsersRound, crew_question: MessageCircleQuestion, proposal_review: FilePenLine, proposal_decided: FilePenLine, collaborator_added: UserPlus, rights_claim: Scale, message: MessageCircle, testimonial: Quote, testimonial_shown: Quote, song_signoff: Signature } as const;
const POLL_MS = 60_000;

/** Things waiting on the creator. Derived from live state, so items leave once they're resolved. */
export function NotificationsButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ notifications: Item[] }>("/api/v1/notifications");
      setItems(res.notifications);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  // Refresh on navigation (resolving something usually means visiting it) and on a slow poll while visible.
  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const t = setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load, pathname]);

  const count = items?.length ?? 0;
  const label = count ? `Notifications, ${count} waiting` : "Notifications";

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) void load();
      }}
    >
      <PopoverTrigger className={navIconClass()} aria-label={label}>
        <Bell className="size-5" aria-hidden />
        {count ? (
          <span aria-hidden className="absolute right-1 top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold leading-5 text-white">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent label="Notifications">
        <h2 className="px-2 pb-1 pt-1.5 text-sm font-semibold text-ink">Waiting for you</h2>
        {error && !items ? (
          <p role="alert" className="px-2 py-3 text-sm text-danger">
            {error}
          </p>
        ) : !items ? (
          <div className="flex justify-center py-6">
            <Spinner label="Loading notifications" />
          </div>
        ) : !items.length ? (
          <p className="px-2 py-4 text-sm text-ink-muted">Nothing is waiting for you right now.</p>
        ) : (
          <ul className="max-h-[min(24rem,60vh)] overflow-auto">
            {items.map((n) => {
              const Icon = ICON[n.kind] ?? Bell;
              return (
                <li key={n.id}>
                  <Link href={n.href} onClick={() => setOpen(false)} className="flex min-h-11 gap-3 rounded-xl px-2 py-2 hover:bg-surface-muted focus-visible:outline-2">
                    <Icon className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-[15px] text-ink">{n.title}</span>
                      {n.detail ? <span className="block truncate text-sm text-ink-subtle">{n.detail}</span> : null}
                      <span className="block text-xs text-ink-subtle">
                        <RelativeTime iso={n.at} />
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
