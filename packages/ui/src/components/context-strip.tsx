"use client";
import * as React from "react";
import { cn } from "../cn";

export type ContextStripTone = "neutral" | "active" | "success" | "warning" | "error" | "live";

export interface ContextStripSignal {
  id: string;
  text: string;
  shortText?: string;
  tone: ContextStripTone;
  href?: string;
  /** Live timer start: elapsed mm:ss is appended, visually only. */
  since?: string;
}

const TONE: Record<ContextStripTone, string> = {
  neutral: "text-ink-muted",
  active: "text-accent-ink",
  success: "text-success-ink",
  warning: "text-warning-ink",
  error: "text-danger",
  live: "text-live",
};

// Colour is never the only signal (§7.2): each tone that needs attention carries a small glyph too.
const GLYPH: Partial<Record<ContextStripTone, string>> = { success: "✓", warning: "!", error: "!", live: "●", active: "•" };

function elapsedSince(since: string) {
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(since)) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** mm:ss since `since`, ticking each second after hydration (the server can't know the viewer's clock). */
function useElapsed(since?: string) {
  const [elapsed, setElapsed] = React.useState<{ since: string; text: string } | null>(null);
  React.useEffect(() => {
    if (!since) return;
    const tick = () => setElapsed({ since, text: elapsedSince(since) });
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [since]);
  return since && elapsed?.since === since ? elapsed.text : null;
}

function Signal({ signal, secondary, LinkComponent }: { signal: ContextStripSignal; secondary?: boolean; LinkComponent?: React.ElementType }) {
  const elapsed = useElapsed(signal.since);
  const glyph = GLYPH[signal.tone];
  const body = (
    <span key={signal.text} className={cn("inline-flex min-w-0 items-center gap-1.5 motion-safe:animate-[fade-in_140ms_ease-out]", TONE[signal.tone])}>
      {glyph ? (
        <span aria-hidden className={cn("shrink-0 text-[10px] leading-none", signal.tone === "live" && "motion-safe:animate-pulse")}>
          {glyph}
        </span>
      ) : null}
      {/* Narrow screens fall back to the short form only when the full text wouldn't comfortably fit (§17). */}
      {signal.shortText && signal.text.length + (signal.since ? 8 : 0) > 18 ? (
        <>
          <span className={cn("truncate", secondary ? "" : "hidden sm:inline")}>{signal.text}</span>
          {secondary ? null : <span className="truncate sm:hidden">{signal.shortText}</span>}
        </>
      ) : (
        <span className="truncate">{signal.text}</span>
      )}
      {elapsed ? (
        <span aria-hidden className="shrink-0 tabular-nums">
          · {elapsed}
        </span>
      ) : null}
    </span>
  );
  if (!signal.href) return body;
  const L = LinkComponent ?? "a";
  return (
    <L href={signal.href} className="-my-2 inline-flex min-h-11 min-w-0 items-center rounded-full px-1 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent">
      {body}
    </L>
  );
}

/**
 * The navbar Context Strip (docs/ui-redesign/context-strip.md): one line — a primary signal and, from `sm` up, at most
 * one secondary — at 12–13px, no wrapping, crossfading on change. It's a status, not a menu: only signals with a
 * useful destination are links. Screen readers get the full text; only errors are announced (§26).
 */
export function ContextStrip({ primary, secondary, LinkComponent, className }: { primary: ContextStripSignal | null; secondary?: ContextStripSignal | null; LinkComponent?: React.ElementType; className?: string }) {
  if (!primary) return <div className={cn("min-w-0 flex-1", className)} aria-hidden />;
  const label = [primary.text, secondary?.text].filter(Boolean).join(", ");
  return (
    <div className={cn("flex min-w-0 flex-1 justify-center", className)}>
      <p role="status" aria-live={primary.tone === "error" ? "assertive" : "off"} aria-label={label} className="flex h-7 min-w-0 max-w-[11.5rem] items-center gap-3 whitespace-nowrap rounded-full px-2.5 text-[12.5px] font-medium sm:max-w-md">
        <Signal signal={primary} LinkComponent={LinkComponent} />
        {secondary ? (
          <span className="hidden min-w-0 items-center gap-3 md:inline-flex">
            <span aria-hidden className="h-3 w-px bg-border" />
            <Signal signal={secondary} secondary LinkComponent={LinkComponent} />
          </span>
        ) : null}
      </p>
    </div>
  );
}
