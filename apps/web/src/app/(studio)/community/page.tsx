import { COMMUNITY_FILTERS, COMMUNITY_FILTER_LABEL, communityFeed, type CommunityFilter } from "@wonder/creator-community";
import { EmptyState, cn } from "@wonder/ui";
import Link from "next/link";
import { CommunityCardItem } from "@/components/community/cards";
import { NewConversationButton } from "@/components/community/new-conversation";
import { PaletteScope } from "@/components/creative-palette";
import { ExploreNav } from "@/components/explore-nav";
import { communityView } from "@/lib/community";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Community" };

const EMPTY: Record<CommunityFilter, { title: string; body: string }> = {
  for_you: { title: "It's quiet here for now", body: "Start a conversation — ask something, share how you work, or say what you're looking for." },
  conversations: { title: "No conversations yet", body: "Start one about an idea you're turning over." },
  help: { title: "Nobody's asking right now", body: "When someone asks, wants feedback or is looking for something, it shows here." },
  people: { title: "No one to show yet", body: "Creators you can see appear here, people you've worked with first." },
};

/**
 * Community (docs/community.md): a creative exchange layer inside Explore — what creators are making, thinking about,
 * asking for and offering. Four small views; a short, curated list each; no follower counts, likes, karma, trending or
 * endless scroll. Muted and blocked creators never appear.
 */
export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ filter?: string; before?: string }> }) {
  const sp = await searchParams;
  const filter: CommunityFilter = sp.filter && (COMMUNITY_FILTERS as readonly string[]).includes(sp.filter) ? (sp.filter as CommunityFilter) : "for_you";
  const { db, creator } = await requireSession();
  const feed = await communityView(db, await communityFeed(db, creator.id, filter, { before: sp.before && !Number.isNaN(Date.parse(sp.before)) ? sp.before : null }));
  return (
    <>
      <PaletteScope context={{ page: "explore" }} />
      <div className="mx-auto max-w-2xl space-y-3">
        <ExploreNav current="community" />
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-[24px] leading-tight text-ink">Community</h1>
          <NewConversationButton />
        </div>
        <nav aria-label="Community" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {COMMUNITY_FILTERS.map((f) => (
            <Link key={f} href={f === "for_you" ? "/community" : `/community?filter=${f}`} aria-current={filter === f ? "page" : undefined} className="inline-flex min-h-11 shrink-0 items-center">
              <span className={cn("inline-flex h-8 items-center rounded-full px-3.5 text-[13px] font-medium", filter === f ? "bg-accent-soft text-accent-ink ring-1 ring-accent/30" : "bg-surface-muted text-ink-muted hover:text-ink")}>
                {COMMUNITY_FILTER_LABEL[f]}
              </span>
            </Link>
          ))}
        </nav>
        {feed.cards.length ? (
          <ul className="space-y-2" aria-label={COMMUNITY_FILTER_LABEL[filter]}>
            {feed.cards.map((c) => (
              <CommunityCardItem key={`${c.kind}:${c.kind === "conversation" ? c.conversation.id : c.kind === "huddle" ? c.huddle.huddleId : c.kind === "person" ? c.person.id : c.id}`} card={c} />
            ))}
          </ul>
        ) : (
          <EmptyState title={EMPTY[filter].title} body={EMPTY[filter].body} action={filter === "people" ? undefined : <NewConversationButton />} />
        )}
        {feed.nextBefore ? (
          <Link href={`/community?filter=${filter}&before=${encodeURIComponent(feed.nextBefore)}`} className="inline-flex min-h-11 items-center text-[13.5px] font-medium text-accent-ink hover:underline">
            Show more
          </Link>
        ) : null}
      </div>
    </>
  );
}
