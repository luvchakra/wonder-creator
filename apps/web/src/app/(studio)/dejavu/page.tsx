import { listDejaVus } from "@wonder/creator-moments";
import { EmptyState, buttonClasses } from "@wonder/ui";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { flagOn } from "@/lib/features";
import { notFound } from "next/navigation";

export const metadata = { title: "DejaVus" };

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** Every recurring thread, most recently used first (docs/moments-dejavu.md). One list, no dashboard. */
export default async function DejaVusPage() {
  if (!flagOn("dejavu_enabled")) notFound();
  const { db } = await requireSession();
  const all = await listDejaVus(db);
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <h1 className="font-display text-[22px] leading-tight text-ink">DejaVus</h1>
      {all.length ? (
        <ul className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-surface" aria-label="Your DejaVus">
          {all.map((d) => (
            <li key={d.id}>
              <Link href={`/dejavu/${d.id}`} className="flex min-h-12 items-center gap-3 px-3 py-2 hover:bg-surface-muted">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium text-ink">{d.name}</span>
                  <span className="block text-[12.5px] text-ink-subtle">
                    {d.count} {d.count === 1 ? "Moment" : "Moments"} · used {shortDate(d.lastUsedAt)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No DejaVus yet"
          body="Give any Material or Creation a DejaVu — a person, place, idea or feeling that keeps coming back."
          action={
            <Link href="/space?tab=ideas" className={buttonClasses({ size: "md" })}>
              Open Materials
            </Link>
          }
        />
      )}
    </div>
  );
}
