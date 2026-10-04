import { hiddenCreators } from "@wonder/creator-community";
import { listPosts } from "@wonder/creator-library";
import type { Db } from "@wonder/db";
import { avatarUrls } from "@/lib/avatars";
import { ScrapbookCompose } from "./scrapbook-compose";
import { SectionTitle } from "./section-title";
import { ScrapbookRows } from "./scrapbook-rows";

/**
 * My Scrapbook at the top of Home (owner, 2–3 Oct 2026): a fixed section — one thin compose row, then the creator's
 * own last scraps as thin rows (each opens in place; one at a time); the title opens them all. Never a feed: no likes, counts
 * or ranking. Others' scraps live in Pulse.
 */
const ROWS = 3;

export async function ScrapbookStrip({ db, viewer }: { db: Db; viewer: { id: string; name: string } }) {
  const [{ posts }, hidden] = await Promise.all([listPosts(db, viewer.id, { scope: "creator", authorId: viewer.id }, { limit: 12 }).catch(() => ({ posts: [] })), hiddenCreators(db, viewer.id).catch(() => new Set<string>())]);
  const shown = posts.filter((p) => !hidden.has(p.author.id) && (p.body.trim() || p.attachments.length)).slice(0, ROWS);
  const avatars = await avatarUrls(db, [viewer.id, ...shown.map((p) => p.author.id)]).catch(() => ({}) as Record<string, string>);

  return (
    <section aria-labelledby="scrapbook-strip-title" className="relative">
      <SectionTitle id="scrapbook-strip-title" href="/scrapbook">
        My Scrapbook
      </SectionTitle>
      <div className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-surface/90 shadow-[var(--shadow-card)]">
        <ScrapbookCompose name={viewer.name} avatarUrl={avatars[viewer.id]} />
        {shown.length ? (
          <ScrapbookRows posts={shown} avatars={avatars} />
        ) : (
          <p className="px-3 py-2 text-[12.5px] text-ink-subtle">Nothing written yet. Your last scraps show here.</p>
        )}
      </div>
    </section>
  );
}
