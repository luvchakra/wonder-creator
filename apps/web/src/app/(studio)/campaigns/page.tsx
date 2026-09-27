import { listCampaigns } from "@wonder/creator-projects";
import { Badge, EmptyState, KIT, PageTitle } from "@wonder/ui";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { NewCampaign } from "./new-campaign";

export const metadata = { title: "Campaigns" };

const STATUS: Record<string, string> = { draft: "Draft", open: "Open", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled" };

/** Campaigns (P1-16): the brand collaborations you run, and the invitations you've been sent. */
export default async function CampaignsPage() {
  const { db, creator } = await requireSession();
  const { running, joined } = await listCampaigns(db, creator.id);
  const row = (c: { id: string; brand_name: string; title: string; status: string; due_on: string | null }, extra?: React.ReactNode) => (
    <li key={c.id}>
      <Link href={`/campaigns/${c.id}`} className="flex min-h-[52px] items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-muted">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{c.title}</span>
          <span className="block truncate text-xs text-ink-subtle">
            {c.brand_name}
            {c.due_on ? ` · due ${c.due_on}` : ""}
          </span>
        </span>
        {extra}
        <Badge>{STATUS[c.status] ?? c.status}</Badge>
      </Link>
    </li>
  );
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageTitle art={KIT.painted.flowerBranch} title="Campaigns" subtitle="Brand collaborations: the brief, who's in, what's delivered and approved." action={<NewCampaign />} />
      {joined.length ? (
        <section aria-labelledby="joined" className="rounded-2xl border border-border-soft bg-surface p-2">
          <h2 id="joined" className="px-3 pb-1 pt-2 text-[15px] font-semibold text-ink">
            Brand invitations
          </h2>
          <ul className="divide-y divide-border-soft/70">{joined.map((c) => row(c, c.invitation === "invited" ? <Badge tone="accent">Invited</Badge> : null))}</ul>
        </section>
      ) : null}
      {running.length ? (
        <section aria-labelledby="running" className="rounded-2xl border border-border-soft bg-surface p-2">
          <h2 id="running" className="px-3 pb-1 pt-2 text-[15px] font-semibold text-ink">
            Campaigns you run
          </h2>
          <ul className="divide-y divide-border-soft/70">{running.map((c) => row(c))}</ul>
        </section>
      ) : null}
      {!running.length && !joined.length ? (
        <EmptyState title="No campaigns yet" body="Start a brief for a brand collaboration, then invite creators who are open to brand work." action={<NewCampaign />} />
      ) : null}
    </div>
  );
}
