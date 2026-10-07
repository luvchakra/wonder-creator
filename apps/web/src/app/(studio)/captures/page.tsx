import { KIT, PageTitle, chipBase, cn } from "@wonder/ui";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { CAPTURE_KINDS, CAPTURE_KIND_LABEL, recentCaptures, type CaptureKind } from "@/lib/captures";
import { requireSession } from "@/lib/session";
import { CaptureDays } from "./capture-days";

export const metadata = { title: "My captures" };

/**
 * My captures (owner, 7 Oct 2026: "an option to look back on quick notes, voice notes etc from home page itself"): what
 * was caught with Quick Capture, newest first, by day — notes to read, voice notes to play here, pictures and videos as
 * frames. Each opens its Material. One filter row; nothing else to press.
 */
export default async function CapturesPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { db, creator } = await requireSession();
  const sp = await searchParams;
  const kind = (CAPTURE_KINDS as readonly string[]).includes(sp.kind ?? "") ? (sp.kind as CaptureKind) : null;
  const { items, next } = await recentCaptures(db, creator.id, { kind, limit: 30 });
  const filters: (CaptureKind | null)[] = [null, ...CAPTURE_KINDS];

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink home="/" homeLabel="Home" className="mb-1" />
      <PageTitle art={KIT.painted.leafSprigSage} title="My captures" subtitle="Notes, voice notes, pictures and videos — as you caught them." className="mb-3 sm:mb-4" />
      <nav aria-label="Kind of capture" className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {filters.map((f) => (
          <Link
            key={f ?? "all"}
            href={f ? `/captures?kind=${f}` : "/captures"}
            aria-current={f === kind ? "true" : undefined}
            className={cn(chipBase, "border", f === kind ? "border-accent bg-accent text-white" : "border-border bg-surface text-ink-muted hover:border-[#cfd0ff]")}
          >
            {f ? CAPTURE_KIND_LABEL[f] : "All"}
          </Link>
        ))}
      </nav>
      {items.length ? (
        <CaptureDays key={kind ?? "all"} kind={kind} initial={items} next={next} />
      ) : (
        <p className="rounded-2xl border border-border-soft bg-surface/80 px-4 py-6 text-center text-[14px] text-ink-muted">
          {kind ? `No ${CAPTURE_KIND_LABEL[kind].toLowerCase()} yet.` : "Nothing caught yet."}{" "}
          <Link href="/" className="text-accent-ink underline underline-offset-2">
            Catch something on Home
          </Link>
        </p>
      )}
    </div>
  );
}
