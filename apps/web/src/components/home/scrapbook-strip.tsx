import { hiddenCreators } from "@wonder/creator-community";
import { listPosts } from "@wonder/creator-library";
import type { Db } from "@wonder/db";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { avatarUrls } from "@/lib/avatars";
import { ScrapbookCompose } from "./scrapbook-compose";
import { ScrapbookRows } from "./scrapbook-rows";

/**
 * My Scrapbook at the top of Home (owner, 2–3 Oct 2026): a fixed section — one thin compose row, then the creator's
 * own last scraps as thin rows (each opens in place; one at a time), then "All scraps". Never a feed: no likes, counts
 * or ranking. Others' scraps live in Pulse.
 */
const ROWS = 3;

export async function ScrapbookStrip({ db, viewer }: { db: Db; viewer: { id: string; name: string } }) {
  const [{ posts }, hidden] = await Promise.all([listPosts(db, viewer.id, { scope: "creator", authorId: viewer.id }, { limit: 12 }).catch(() => ({ posts: [] })), hiddenCreators(db, viewer.id).catch(() => new Set<string>())]);
  const shown = posts.filter((p) => !hidden.has(p.author.id) && (p.body.trim() || p.attachments.length)).slice(0, ROWS);
  const avatars = await avatarUrls(db, [viewer.id, ...shown.map((p) => p.author.id)]).catch(() => ({}) as Record<string, string>);

  return (
    <section aria-labelledby="scrapbook-strip-title" className="relative">
      <h2 id="scrapbook-strip-title" className="flex min-h-11 items-center text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
        My Scrapbook
      </h2>
      <div className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-surface/90 shadow-[var(--shadow-card)]">
        <ScrapbookCompose name={viewer.name} avatarUrl={avatars[viewer.id]} />
        {shown.length ? (
          <ScrapbookRows posts={shown} avatars={avatars} />
        ) : (
          <p className="px-3 py-2 text-[12.5px] text-ink-subtle">Nothing written yet. Your last scraps show here.</p>
        )}
        <Link href="/scrapbook" className="flex min-h-11 items-center gap-2.5 px-3 py-1.5 text-[13.5px] font-medium text-accent-ink hover:bg-surface-muted">
          <span className="min-w-0 flex-1">All scraps</span>
          <ChevronRight className="size-4 shrink-0" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
