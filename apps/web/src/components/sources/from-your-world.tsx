import { KIT, KitArt, buttonClasses } from "@wonder/ui";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { CandidateCard } from "@/lib/sources";
import { SyncChip } from "./sync-chip";

/**
 * Home › From your world (Personal Sources spec §3): at most one thing worth exploring from the creator's connected
 * sources, with a quiet Sync. Rendered from the index only — Home never waits for a provider or for AI.
 */
export function FromYourWorld({ connected, candidate, more, activeJobIds }: { connected: boolean; candidate: CandidateCard | null; more: number; activeJobIds: string[] }) {
  return (
    <section aria-labelledby="world-title" className="relative isolate overflow-hidden rounded-2xl border border-border-soft bg-surface/90 px-3 py-2.5 shadow-[var(--shadow-card)]">
      <KitArt art={KIT.wash.washLavender} sizes="16rem" className="pointer-events-none absolute -right-12 -top-16 -z-10 h-auto w-64 opacity-60" />
      <KitArt art={KIT.painted.lavenderSprig} sizes="5rem" className="pointer-events-none absolute -bottom-2 right-1 -z-10 h-auto w-16 opacity-70" />
      <div className="flex items-center justify-between gap-2">
        <h2 id="world-title" className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
          From your world
        </h2>
        {connected ? <SyncChip activeJobIds={activeJobIds} /> : null}
      </div>
      {candidate ? (
        <div className="pr-14">
          <p className="mt-0.5 font-display text-[19px] leading-snug text-ink">{candidate.title}</p>
          {candidate.counts ? <p className="text-[12.5px] text-ink-muted">{candidate.counts}</p> : null}
          {candidate.quote ? <p className="mt-1 line-clamp-2 font-display text-[14px] italic leading-snug text-ink-muted">“{candidate.quote}”</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-3">
            <Link href={`/sources/candidates/${candidate.id}`} className={buttonClasses({ variant: "soft", size: "sm" })}>
              Explore <ArrowRight className="size-4" aria-hidden />
            </Link>
            {more > 0 ? (
              <Link href="/sources" className="inline-flex min-h-11 items-center text-[13px] font-medium text-accent-ink underline-offset-4 hover:underline">
                {more} more
              </Link>
            ) : null}
          </div>
        </div>
      ) : connected ? (
        <p className="mt-1 pr-14 text-[13.5px] text-ink-muted">
          Nothing new from your world yet.{" "}
          <Link href="/sources" className="font-medium text-accent-ink underline-offset-4 hover:underline">
            Your sources
          </Link>
        </p>
      ) : (
        <div className="pr-14">
          <p className="mt-1 text-[13.5px] leading-snug text-ink-muted">Discover useful context from places you already keep your memories.</p>
          <Link href="/sources" className={buttonClasses({ variant: "soft", size: "sm", className: "mt-2" })}>
            Connect sources
          </Link>
        </div>
      )}
    </section>
  );
}
