import { hiddenCreators } from "@wonder/creator-community";
import { listPosts } from "@wonder/creator-library";
import type { Db } from "@wonder/db";
import { Avatar, KIT, KitArt } from "@wonder/ui";
import { ChevronRight, PenLine } from "lucide-react";
import Link from "next/link";
import { RelativeTime } from "@/components/client-time";
import { avatarUrls } from "@/lib/avatars";

/**
 * The Scrapbook at the top of Home (owner, 2 Oct 2026: "make the scrapbook appear in the homepage top"). The latest
 * thoughts, sketches and fragments from everyone the creator can see, in the order they were shared — a short strip,
 * never a feed: a handful of cards, no likes, no counts, no ranking. Muted and blocked creators never appear.
 */
const WASHES = [KIT.wash.washPeach, KIT.wash.washLavender, KIT.wash.washMint, KIT.wash.washLilacSky] as const;

export async function ScrapbookStrip({ db, viewerId }: { db: Db; viewerId: string }) {
  const [{ posts }, hidden] = await Promise.all([listPosts(db, viewerId, { scope: "everyone" }, { limit: 12 }).catch(() => ({ posts: [] })), hiddenCreators(db, viewerId).catch(() => new Set<string>())]);
  const shown = posts.filter((p) => !hidden.has(p.author.id) && (p.body.trim() || p.attachments.some((a) => a.fileUrl && a.mimeType?.startsWith("image/")))).slice(0, 8);
  const avatars = await avatarUrls(db, shown.map((p) => p.author.id)).catch(() => ({}) as Record<string, string>);

  return (
    <section aria-labelledby="scrapbook-strip-title" className="relative -mx-4 sm:mx-0">
      <div className="flex items-center justify-between gap-2 px-4 sm:px-0">
        <h2 id="scrapbook-strip-title" className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
          Scrapbook
        </h2>
        <Link href="/scrapbook" className="inline-flex min-h-11 items-center gap-0.5 text-[13px] font-medium text-accent-ink hover:underline">
          {shown.length ? "All" : "Open"} <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      {shown.length ? (
        <ul aria-label="Latest in the Scrapbook" className="flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:px-0">
          {shown.map((p, i) => {
            const image = p.attachments.find((a) => a.fileUrl && a.mimeType?.startsWith("image/"));
            const first = (p.mine ? "You" : p.author.name).split(" ")[0];
            return (
              <li key={p.id} className="w-[168px] shrink-0 snap-start sm:w-[184px]">
                <Link href={`/scrapbook/${p.id}`} aria-label={`${p.mine ? "Your" : `${p.author.name}'s`} ${p.kind}`} className="group relative isolate flex h-[164px] flex-col overflow-hidden rounded-2xl border border-border-soft bg-surface shadow-[var(--shadow-card)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                  {image ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.fileUrl!} alt="" loading="lazy" className="absolute inset-0 -z-10 size-full object-cover transition-opacity group-hover:opacity-95" />
                      <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-[#1e1b4b]/75 via-[#1e1b4b]/15 to-transparent" />
                    </>
                  ) : (
                    <span aria-hidden className="absolute inset-0 -z-10">
                      <KitArt art={WASHES[i % WASHES.length]!} className="size-full object-cover opacity-90" />
                    </span>
                  )}
                  <span className="mt-auto space-y-1 p-2.5">
                    {p.body.trim() ? <span className={`line-clamp-3 block whitespace-pre-line font-display text-[14.5px] italic leading-snug ${image ? "text-white" : "text-ink"}`}>{p.body}</span> : null}
                    <span className={`flex items-center gap-1.5 text-[11.5px] ${image ? "text-white/85" : "text-ink-muted"}`}>
                      <Avatar name={p.author.name} src={avatars[p.author.id]} size={18} />
                      <span className="truncate">
                        {first} · <RelativeTime iso={p.createdAt} />
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
          <li className="w-[120px] shrink-0 snap-start">
            <Link href="/scrapbook" className="flex h-[164px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-[image:var(--gradient-card)] px-2 text-center text-[13px] font-medium text-ink hover:border-accent">
              <PenLine className="size-5 text-accent" aria-hidden /> Share a thought
            </Link>
          </li>
        </ul>
      ) : (
        <Link href="/scrapbook" className="mx-4 flex min-h-12 items-center gap-3 rounded-2xl border border-dashed border-border bg-[image:var(--gradient-card)] px-3.5 py-2.5 hover:border-accent sm:mx-0">
          <KitArt art={KIT.painted.blossomSprig} sizes="2.5rem" className="h-10 w-auto shrink-0" />
          <span>
            <span className="block text-[14.5px] font-medium text-ink">Nothing in the Scrapbook yet</span>
            <span className="block text-[12.5px] text-ink-muted">Share a thought, a sketch or a fragment — in the order it happens, no likes.</span>
          </span>
        </Link>
      )}
    </section>
  );
}
