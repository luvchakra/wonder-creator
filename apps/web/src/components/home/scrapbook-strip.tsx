import { hiddenCreators } from "@wonder/creator-community";
import { listPosts } from "@wonder/creator-library";
import type { Db } from "@wonder/db";
import { Avatar } from "@wonder/ui";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { RelativeTime } from "@/components/client-time";
import { avatarUrls } from "@/lib/avatars";
import { ScrapbookCompose } from "./scrapbook-compose";

/**
 * The Scrapbook at the top of Home (owner, 2 Oct 2026): one thin compose row, then two or three thin rows with the
 * last scraps written by anyone the creator can see, newest first — never a feed: no likes, counts or ranking, and
 * muted or blocked creators never appear. "All" opens the Scrapbook.
 */
const ROWS = 3;

export async function ScrapbookStrip({ db, viewer }: { db: Db; viewer: { id: string; name: string } }) {
  const [{ posts }, hidden] = await Promise.all([listPosts(db, viewer.id, { scope: "everyone" }, { limit: 12 }).catch(() => ({ posts: [] })), hiddenCreators(db, viewer.id).catch(() => new Set<string>())]);
  const shown = posts.filter((p) => !hidden.has(p.author.id) && (p.body.trim() || p.attachments.length)).slice(0, ROWS);
  const avatars = await avatarUrls(db, [viewer.id, ...shown.map((p) => p.author.id)]).catch(() => ({}) as Record<string, string>);

  return (
    <section aria-labelledby="scrapbook-strip-title" className="relative">
      <div className="flex items-center justify-between gap-2">
        <h2 id="scrapbook-strip-title" className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
          Scrapbook
        </h2>
        <Link href="/scrapbook" className="inline-flex min-h-11 items-center gap-0.5 text-[13px] font-medium text-accent-ink hover:underline">
          All <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      <div className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-surface/90 shadow-[var(--shadow-card)]">
        <ScrapbookCompose name={viewer.name} avatarUrl={avatars[viewer.id]} />
        {shown.length ? (
          <ul aria-label="Last written in the Scrapbook" className="divide-y divide-border-soft">
            {shown.map((p) => {
              const text = p.body.trim() || p.attachments[0]?.title || "A fragment";
              const who = p.mine ? "You" : p.author.name.split(" ")[0];
              return (
                <li key={p.id}>
                  <Link href={`/scrapbook/${p.id}`} className="flex min-h-11 items-center gap-2 px-3 py-1.5 hover:bg-surface-muted">
                    <Avatar name={p.author.name} src={avatars[p.author.id]} size={24} />
                    <span className="min-w-0 flex-1 truncate font-display text-[15px] italic leading-snug text-ink">{text}</span>
                    <span className="shrink-0 text-[11.5px] text-ink-subtle">
                      {who} · <RelativeTime iso={p.createdAt} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-3 py-2 text-[12.5px] text-ink-subtle">Nothing written yet. The last scraps from people you can see show here.</p>
        )}
      </div>
    </section>
  );
}
