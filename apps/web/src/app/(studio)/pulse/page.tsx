import { COMMUNITY_FILTERS, COMMUNITY_FILTER_LABEL, communityFeed, listCommunities, type CommunityFilter } from "@wonder/creator-community";
import { Search } from "lucide-react";
import { StartCommunityButton } from "@/components/community/community-actions";
import { communityAvatars } from "@/lib/communities";
import { EmptyState, KIT, cn } from "@wonder/ui";
import Link from "next/link";
import { CommunityCardItem } from "@/components/community/cards";
import { CommunitiesList } from "@/components/community/communities-list";
import { NewConversationButton } from "@/components/community/new-conversation";
import { PaletteScope } from "@/components/creative-palette";
import { ExploreNav } from "@/components/explore-nav";
import { communityView } from "@/lib/community";
import { requireSession } from "@/lib/session";
import { flagOn } from "@/lib/features";
import { notFound } from "next/navigation";

export const metadata = { title: "Pulse" };

const EMPTY: Record<CommunityFilter, { title: string; body: string }> = {
  for_you: { title: "It's quiet here for now", body: "Start a conversation — ask something, share how you work, or say what you're looking for." },
  conversations: { title: "No conversations yet", body: "Start one about an idea you're turning over." },
  help: { title: "Nobody's asking right now", body: "When someone asks, wants feedback or is looking for something, it shows here." },
  people: { title: "No one to show yet", body: "Creators you can see appear here, people you've worked with first." },
};

/**
 * Pulse (docs/community.md; "Community" in code): a creative exchange layer inside Explore — what creators are making, thinking about,
 * asking for and offering. Four small views; a short, curated list each; no follower counts, likes, karma, trending or
 * endless scroll. Muted and blocked creators never appear.
 */
export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ filter?: string; before?: string; q?: string }> }) {
  if (!flagOn("community_enabled")) notFound();
  const sp = await searchParams;
  const communitiesOn = flagOn("communities_enabled");
  // Communities (docs/communities.md) sit beside the four views: lasting places people join around an interest.
  if (communitiesOn && sp.filter === "communities") return <CommunitiesView query={sp.q} />;
  const filter: CommunityFilter = sp.filter && (COMMUNITY_FILTERS as readonly string[]).includes(sp.filter) ? (sp.filter as CommunityFilter) : "for_you";
  const { db, creator } = await requireSession();
  const feed = await communityView(db, await communityFeed(db, creator.id, filter, { before: sp.before && !Number.isNaN(Date.parse(sp.before)) ? sp.before : null }));
  return (
    <>
      <PaletteScope context={{ page: "explore" }} />
      <div className="mx-auto max-w-2xl space-y-3">
        <ExploreNav current="community" />
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-[24px] leading-tight text-ink">Pulse</h1>
          <NewConversationButton />
        </div>
        <nav aria-label="Pulse" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          <FilterChips current={filter} communities={communitiesOn} />
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
          <Link href={`/pulse?filter=${filter}&before=${encodeURIComponent(feed.nextBefore)}`} className="inline-flex min-h-11 items-center text-[13.5px] font-medium text-accent-ink hover:underline">
            Show more
          </Link>
        ) : null}
      </div>
    </>
  );
}

function FilterChips({ current, communities }: { current: CommunityFilter | "communities"; communities: boolean }) {
  const views: Array<{ key: CommunityFilter | "communities"; href: string; label: string }> = COMMUNITY_FILTERS.map((f) => ({ key: f, href: f === "for_you" ? "/pulse" : `/pulse?filter=${f}`, label: COMMUNITY_FILTER_LABEL[f] }));
  // Communities sit right after For you, so the chip is in view at phone width.
  const all = communities ? [views[0]!, { key: "communities" as const, href: "/pulse?filter=communities", label: "Communities" }, ...views.slice(1)] : views;
  return all.map((f) => (
    <Link key={f.key} href={f.href} aria-current={current === f.key ? "page" : undefined} className="inline-flex min-h-11 shrink-0 items-center">
      <span className={cn("inline-flex h-8 items-center rounded-full px-3.5 text-[13px] font-medium", current === f.key ? "bg-accent-soft text-accent-ink ring-1 ring-accent/30" : "bg-surface-muted text-ink-muted hover:text-ink")}>{f.label}</span>
    </Link>
  ));
}

/** Communities: the ones you're in, then ones to discover — latest activity first, searchable by name or interest. */
async function CommunitiesView({ query }: { query?: string }) {
  const { db } = await requireSession();
  const q = query?.trim().slice(0, 80) || undefined;
  const list = await listCommunities(db, { query: q, limit: 40 }).catch(() => []);
  const mine = list.filter((c) => c.isMember);
  const others = list.filter((c) => !c.isMember);
  const pictures = await communityAvatars(list.map((c) => c.avatarObjectId));
  return (
    <>
      <PaletteScope context={{ page: "explore" }} />
      <div className="mx-auto max-w-2xl space-y-3">
        <ExploreNav current="community" />
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-[24px] leading-tight text-ink">Communities</h1>
          <StartCommunityButton />
        </div>
        <nav aria-label="Pulse" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          <FilterChips current="communities" communities />
        </nav>
        <form role="search" action="/pulse" className="relative">
          <input type="hidden" name="filter" value="communities" />
          <label htmlFor="community-search" className="sr-only">
            Find a community
          </label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <input
            id="community-search"
            name="q"
            type="search"
            defaultValue={q ?? ""}
            maxLength={80}
            placeholder="Find a community by interest"
            className="h-11 w-full rounded-full border border-border-soft bg-surface pl-10 pr-4 text-[14px] text-ink placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </form>
        {list.length ? (
          <>
            {mine.length ? <CommunitiesList title="Your communities" items={mine} pictures={pictures} /> : null}
            {others.length ? <CommunitiesList title={q ? "Communities" : "Discover communities"} items={others} pictures={pictures} /> : null}
          </>
        ) : (
          <EmptyState
            art={KIT.painted.lavenderSprig}
            title={q ? "No community matches that" : "No communities yet"}
            body={q ? "Try another word, or start the community you were looking for." : "Start one around something you love making — anyone can find it and join."}
            action={<StartCommunityButton />}
          />
        )}
      </div>
    </>
  );
}
