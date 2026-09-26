import { listApprovals } from "@wonder/creator-brain";
import { getAutonomy } from "@wonder/creator-identity";
import { AUTONOMY_DOMAINS, AUTONOMY_LEVELS } from "@wonder/creator-identity/autonomy";
import { EmptyState, PageTitle, SectionHeader } from "@wonder/ui";
import { ChevronRight, Clock, Scale } from "lucide-react";
import Link from "next/link";
import { RelativeTime } from "@/components/client-time";
import { requireSession } from "@/lib/session";
import { StateBadge } from "./shared";

export const metadata = { title: "Approvals" };

export default async function ApprovalsPage() {
  const { db, creator } = await requireSession();
  const [open, closed, autonomy] = await Promise.all([listApprovals(db, { state: "open" }), listApprovals(db, { state: "closed", limit: 30 }), getAutonomy(db, creator.id)]);
  // A pending proposal past its expiry is history, not something to act on.
  const pending = open.filter((a) => a.state === "pending");
  const history = [...open.filter((a) => a.state !== "pending"), ...closed].sort((x, y) => (y.resolvedAt ?? y.expiresAt).localeCompare(x.resolvedAt ?? x.expiresAt));
  const urgent = pending.filter((a) => a.urgent);
  const byDomain = new Map<string, typeof pending>();
  for (const a of pending.filter((x) => !x.urgent)) byDomain.set(a.domainLabel, [...(byDomain.get(a.domainLabel) ?? []), a]);
  const asking = AUTONOMY_DOMAINS.filter((d) => autonomy[d.domain] === "execute_with_approval");
  const levelLabel = (d: (typeof AUTONOMY_DOMAINS)[number]) => AUTONOMY_LEVELS.find((l) => l.level === autonomy[d.domain])?.label ?? autonomy[d.domain];

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Approvals" subtitle="What CreatorBrain wants to do, waiting on your OK. Nothing here happens until you approve it." />

      <section aria-labelledby="pending-h" className="space-y-6">
        <h2 id="pending-h" className="sr-only">
          Waiting for you
        </h2>
        {pending.length === 0 ? (
          <EmptyState title="Nothing waiting" body="When CreatorBrain needs your OK before acting, it shows up here with exactly what it will do." />
        ) : null}
        {urgent.length ? <Group title="Expiring soon" items={urgent} /> : null}
        {[...byDomain].map(([domain, items]) => (
          <Group key={domain} title={domain} items={items} />
        ))}
      </section>

      <section aria-labelledby="autonomy-h" className="mt-10 rounded-2xl border border-border-soft bg-surface p-5">
        <h2 id="autonomy-h" className="text-lg font-semibold text-ink">
          Your autonomy settings
        </h2>
        <p className="mt-1 text-[15px] text-ink-muted">
          {asking.length ? `CreatorBrain asks before acting on ${asking.map((d) => d.label.toLowerCase()).join(", ")}.` : "No areas are set to ask for approval."} Rights, commerce and destructive actions can never run on their own.
        </p>
        <details className="mt-3">
          <summary className="min-h-11 cursor-pointer py-2 text-[15px] font-medium text-accent-ink">See every area</summary>
          <ul className="mt-2 grid gap-1 text-[15px] sm:grid-cols-2">
            {AUTONOMY_DOMAINS.map((d) => (
              <li key={d.domain} className="flex justify-between gap-3 rounded-lg px-2 py-1.5">
                <span className="text-ink">{d.label}</span>
                <span className="text-ink-muted">{levelLabel(d)}</span>
              </li>
            ))}
          </ul>
        </details>
        <Link href="/settings?section=autonomy" className="mt-3 inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-accent-ink hover:underline">
          Change autonomy settings <ChevronRight className="size-4" aria-hidden />
        </Link>
      </section>

      <section className="mt-10">
        <SectionHeader title="History" />
        {history.length ? (
          <ul className="divide-y divide-border-soft rounded-2xl border border-border-soft bg-surface">
            {history.map((a) => (
              <li key={a.id}>
                <Link href={`/approvals/${a.id}`} className="flex min-h-11 items-center gap-3 px-4 py-3 hover:bg-black/[0.02]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] text-ink">{a.actionLabel}</p>
                    <p className="truncate text-sm text-ink-muted">{a.target.title ?? a.understood}</p>
                  </div>
                  <StateBadge state={a.state} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-ink-muted">Decisions you make will be listed here.</p>
        )}
      </section>
    </div>
  );
}

function Group({ title, items }: { title: string; items: Awaited<ReturnType<typeof listApprovals>> }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">{title}</h3>
      <ul className="space-y-3">
        {items.map((a) => (
          <li key={a.id}>
            <Link href={`/approvals/${a.id}`} className="block rounded-2xl border border-border-soft bg-surface p-4 hover:border-[#cfd0ff]">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-ink">{a.actionLabel}</p>
                <ChevronRight className="mt-0.5 size-5 shrink-0 text-ink-muted" aria-hidden />
              </div>
              <p className="mt-1 line-clamp-2 text-[15px] text-ink-muted">{a.understood}</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
                {a.target.title ? <span>{a.target.title}</span> : null}
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-4" aria-hidden /> Expires <RelativeTime iso={a.expiresAt} />
                </span>
                {a.rightsImplications ? (
                  <span className="inline-flex items-center gap-1">
                    <Scale className="size-4" aria-hidden /> Affects rights
                  </span>
                ) : null}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
