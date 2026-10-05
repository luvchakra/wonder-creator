"use client";
import { cn } from "@wonder/ui";
import { ArrowLeft, ChevronLeft, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { fromTarget, popTo, subscribeTrail, trailSnapshot, trailTarget } from "./nav-memory";

/**
 * Back goes where you came from (docs/ui-redesign/back-navigation.md). The target is, in order: the most recent page in
 * this tab's trail with a different path; the link's `?from=`; the page's `home`. Its name says where it goes ("Back to
 * Platform 3"). Before hydration, and in a new tab, it is a plain link to `home`. It pushes the target (never
 * history.back()) and pops the trail, so a second Back keeps going back.
 *
 * `variant="icon"`: the round arrow of a top bar. `variant="text"`: "← Name" above a page's title. `variant="close"`: the
 * X of a full-screen page (Preview, Read) — the same return, named "Close, back to …".
 */
export function BackLink({
  home,
  homeLabel,
  variant = "text",
  className,
  onBeforeLeave,
}: {
  /** Where Back goes when nothing better is known: the page's natural home for its context. */
  home: string;
  /** What `home` is called ("the Creative Room", "Materials", a title). */
  homeLabel: string;
  variant?: "icon" | "text" | "close";
  className?: string;
  /** Flush pending work (an autosave) before leaving; Back never loses work. */
  onBeforeLeave?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const raw = useSyncExternalStore(subscribeTrail, trailSnapshot, () => null);
  const search = useSyncExternalStore(subscribeTrail, () => window.location.search, () => "");
  const fromTrail = raw ? trailTarget(raw, `${pathname}${search}`) : null;
  const fromLink = raw !== null ? fromTarget(new URLSearchParams(search).get("from")) : null;
  const target = fromTrail?.p ?? fromLink ?? home;
  const label = fromTrail ? (fromTrail.t ?? nameOf(fromTrail.p) ?? homeLabel) : fromLink ? (nameOf(fromLink) ?? homeLabel) : homeLabel;
  const name = `Back to ${label}`;

  return (
    <Link
      href={target}
      aria-label={variant === "close" ? `Close, back to ${label}` : name}
      onClick={async (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        await onBeforeLeave?.();
        if (fromTrail) popTo(fromTrail.p);
        router.push(target);
      }}
      className={cn(
        variant === "icon"
          ? "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-black/5"
          : variant === "close"
            ? "fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 inline-flex size-11 items-center justify-center rounded-full bg-surface/85 text-ink-muted shadow-[var(--shadow-card)] backdrop-blur hover:text-ink"
            : "-ml-2 inline-flex min-h-11 max-w-full items-center gap-1 rounded-full pr-3 text-[13.5px] font-medium text-ink-muted hover:text-ink",
        className,
      )}
    >
      {variant === "icon" ? (
        <ArrowLeft className="size-5" aria-hidden />
      ) : variant === "close" ? (
        <X className="size-5" aria-hidden />
      ) : (
        <>
          <ChevronLeft className="size-5 shrink-0" aria-hidden />
          <span className="truncate">{display(label)}</span>
        </>
      )}
    </Link>
  );
}

/** "the Creative Room" reads "Creative Room" beside the arrow. */
const display = (label: string) => label.replace(/^the /, "").replace(/^./, (c) => c.toUpperCase());

/** A name for a page known only by its address. */
function nameOf(p: string): string | null {
  const path = p.split(/[?#]/)[0]!;
  if (path === "/") return "Home";
  const rules: Array<[RegExp, string]> = [
    [/^\/rooms\/[^/]+$/, "the Creative Room"],
    [/^\/rooms$/, "Creative Rooms"],
    [/^\/creations\/[^/]+\/(write|image|audio|studio)$/, "the Creation"],
    [/^\/creations\/[^/]+/, "the Creation"],
    [/^\/materials\/collections\//, "the Collection"],
    [/^\/materials\/[^/]+$/, "the Material"],
    [/^\/materials/, "Materials"],
    [/^\/huddles/, "Huddles"],
    [/^\/pulse/, "Pulse"],
    [/^\/communities/, "the Community"],
    [/^\/messages/, "Messages"],
    [/^\/scrapbook/, "Scrapbook"],
    [/^\/explore/, "Explore"],
    [/^\/settings/, "Settings"],
    [/^\/me/, "Me"],
  ];
  return rules.find(([re]) => re.test(path))?.[1] ?? null;
}
