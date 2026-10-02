import { OPEN_TO_LABEL, helpHeadline, type HomeCommunityGlance } from "@wonder/creator-community";
import { artifactType } from "@wonder/creator-studio/types";
import { Avatar, AvatarStack, KIT, KitArt, cn } from "@wonder/ui";
import { ArrowRight, ChevronRight, DoorOpen, FileText, HandHelping, Image as ImageIcon, MessagesSquare, Radio } from "lucide-react";
import Link from "next/link";
import { RelativeTime } from "@/components/client-time";

const WASHES = [KIT.wash.washLavender, KIT.wash.washPeach, KIT.wash.washLilacSky, KIT.wash.washRose];

/**
 * From the community (owner, 1 Oct 2026): what's alive around the creator, in one calm glance — a live Huddle, new
 * work in its own pictures, one thought, one ask and one person. A fixed handful, never a feed; "Explore" goes further.
 * Each part appears only when there's something real; the section disappears when there's nothing.
 */
export function CommunityGlance({ g, avatars }: { g: HomeCommunityGlance & { covers: Record<string, string> }; avatars: Record<string, string> }) {
  return (
    <section id="community" aria-labelledby="community-title" className="relative isolate scroll-mt-20 overflow-hidden rounded-3xl border border-border-soft bg-[linear-gradient(180deg,#fbf7f2_0%,#f6f0fa_100%)] p-3 shadow-[var(--shadow-card)]">
      <KitArt art={KIT.painted.leafSprigSage} sizes="6rem" className="pointer-events-none absolute -right-3 -top-4 -z-10 h-24 w-auto rotate-12 opacity-50" />
      <div className="flex items-baseline justify-between gap-3 pr-10">
        <h2 id="community-title" className="font-display text-[19px] leading-tight text-ink">
          From Pulse
        </h2>
        <Link href="/pulse" className="relative inline-flex items-center gap-0.5 text-[12.5px] font-medium text-accent-ink before:absolute before:-inset-3 before:content-[''] hover:underline">
          Explore <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      {/* This week, in words — no numbers. */}
      {g.week ? (
        <p className="mt-1 pr-6 font-display text-[14px] italic leading-snug text-ink-muted">
          <span className="sr-only">This week in Pulse: </span>
          {g.week}
        </p>
      ) : null}

      <div className="mt-2.5 space-y-3">
        {g.catchUp ? (
          <Link href={g.catchUp.conversations === 1 ? `/pulse/conversations/${g.catchUp.firstId}` : "/pulse?filter=conversations"} className="flex min-h-12 items-center gap-3 rounded-2xl bg-white/75 px-3 py-2 hover:bg-white">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
              <MessagesSquare className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-medium text-ink">{g.catchUp.conversations === 1 ? "A conversation you joined has moved on" : `${g.catchUp.conversations} conversations you joined have moved on`}</span>
              <span className="block truncate text-[12.5px] text-ink-muted">
                {g.catchUp.conversations === 1 ? `“${g.catchUp.title}”` : `Latest: “${g.catchUp.title}”`} · {g.catchUp.newReplies} new {g.catchUp.newReplies === 1 ? "reply" : "replies"}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-ink-subtle" aria-hidden />
          </Link>
        ) : null}
        {g.live ? (
          <Link href={`/huddles/${g.live.huddleId}`} className="relative isolate flex items-center gap-3 overflow-hidden rounded-2xl bg-white/75 p-3 hover:bg-white/90">
            <KitArt art={KIT.wash.washLavender} sizes="20rem" className="absolute inset-y-0 right-0 -z-10 h-full w-2/3 object-cover opacity-60" />
            <span className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-success-ink">
                <span className="size-2 rounded-full bg-success" aria-hidden /> Live now
              </span>
              <span className="block truncate font-display text-[16px] leading-snug text-ink">{g.live.topic ?? `${g.live.participantNames[0] ?? "A creator"}'s Huddle`}</span>
              <span className="mt-1 flex items-center gap-2 text-[12px] text-ink-muted">
                <AvatarStack people={g.live.participantNames.map((n) => ({ name: n }))} size={22} max={4} />
                {g.live.participantCount} {g.live.participantCount === 1 ? "creator" : "creators"} talking
              </span>
            </span>
            <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-accent px-3 text-[12.5px] font-medium text-white">
              <Radio className="size-3.5" aria-hidden /> Join
            </span>
          </Link>
        ) : null}

        {g.creations.length ? (
          <div>
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">New work</h3>
            <ul aria-label="New work from Pulse" className="-mx-3 mt-1.5 flex snap-x gap-2.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
              {g.creations.map((c, i) => {
                const cover = g.covers[c.id];
                return (
                  <li key={c.id} className="w-[8.75rem] shrink-0 snap-start">
                    <Link href={`/creations/${c.id}`} className="group block">
                      <span className="relative block aspect-[4/5] overflow-hidden rounded-xl bg-surface-muted shadow-[0_8px_20px_-14px_rgb(60_40_80/0.6)]">
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cover} alt="" loading="lazy" className="size-full object-cover" />
                        ) : (
                          <>
                            <KitArt art={WASHES[i % WASHES.length]!} sizes="9rem" className="absolute inset-0 size-full object-cover" />
                            <span className="absolute inset-0 flex items-end p-2.5 pt-7 font-display text-[13.5px] italic leading-snug text-ink">
                              <span className="line-clamp-5 whitespace-pre-line">{c.excerpt ?? c.title}</span>
                            </span>
                          </>
                        )}
                        <span className="absolute left-1.5 top-1.5 rounded-full bg-white/85 px-2 py-0.5 text-[10.5px] font-medium text-ink">{artifactType(c.artifactType).label}</span>
                      </span>
                      <span className="mt-1.5 block truncate text-[13px] font-medium text-ink group-hover:underline">{c.title}</span>
                      <span className="flex items-center gap-1 text-[11.5px] text-ink-subtle">
                        <Avatar name={c.author.name} src={avatars[c.author.id]} size={16} />
                        <span className="truncate">{c.author.name}</span>
                      </span>
                      {c.reason ? <span className="block truncate text-[11px] text-accent-ink">{c.reason}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {g.thought || g.ask ? (
          <div className={cn("grid gap-2.5", g.thought && g.ask && "sm:grid-cols-2")}>
            {g.thought ? (
              <Link href={`/scrapbook/${g.thought.id}`} className="relative isolate block overflow-hidden rounded-2xl bg-[#f8f3ea] p-3 hover:bg-[#f5eee2]">
                <KitArt art={KIT.painted.leafSprigSage} sizes="4rem" className="pointer-events-none absolute -bottom-2 -right-1 -z-10 h-16 w-auto opacity-60" />
                <span className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">A thought</span>
                {g.thought.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.thought.imageUrl} alt="" loading="lazy" className="mt-1.5 aspect-[16/9] w-full rounded-xl object-cover" />
                ) : null}
                {g.thought.body ? <span className="mt-1 line-clamp-4 block whitespace-pre-line pr-8 font-display text-[16px] italic leading-snug text-ink">{g.thought.body}</span> : null}
                <span className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-muted">
                  <Avatar name={g.thought.author.name} src={avatars[g.thought.author.id]} size={20} />
                  {g.thought.author.name} · <RelativeTime iso={g.thought.createdAt} />
                </span>
                {g.thought.reason ? <span className="block text-[11.5px] text-accent-ink">{g.thought.reason}</span> : null}
              </Link>
            ) : null}
            {g.ask ? (
              <Link href={`/pulse/conversations/${g.ask.conversation.id}`} className="block rounded-2xl border border-border-soft bg-white/80 p-3 hover:bg-white">
                <span className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                  <Avatar name={g.ask.author.name} src={avatars[g.ask.author.id]} size={20} />
                  <span className="truncate">{helpHeadline(g.ask.conversation.intent, g.ask.author.name)}</span>
                </span>
                <span className="mt-1 line-clamp-2 block font-display text-[16px] leading-snug text-ink">{g.ask.conversation.title}</span>
                {g.ask.conversation.body ? <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-ink-muted">{g.ask.conversation.body}</span> : null}
                {g.ask.reason ? <span className="mt-1 block text-[11.5px] text-accent-ink">{g.ask.reason}</span> : null}
                <span className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-accent-ink">
                  <HandHelping className="size-3.5" aria-hidden /> Offer a thought <ArrowRight className="size-3.5" aria-hidden />
                </span>
              </Link>
            ) : null}
          </div>
        ) : null}

        {g.person ? (
          <Link href={g.person.person.handle ? `/creators/${g.person.person.handle}` : "/people"} className="flex min-h-14 items-center gap-3 rounded-2xl bg-white/70 px-3 py-2 hover:bg-white">
            <Avatar name={g.person.person.name} src={avatars[g.person.person.id]} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">Someone to meet</span>
              <span className="block truncate font-display text-[15px] text-ink">{g.person.person.name}</span>
              <span className="block truncate text-[12px] text-ink-muted">{g.person.reason ?? (g.person.openTo.length ? `Open to ${g.person.openTo.slice(0, 2).map((o) => OPEN_TO_LABEL[o].toLowerCase()).join(" · ")}` : (g.person.bio ?? "Creates on Wonder Creator"))}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-ink-subtle" aria-hidden />
          </Link>
        ) : null}
      </div>
    </section>
  );
}

type RoomItem = { projectId: string; projectTitle: string; itemId: string; title: string; kind: string; by: { id: string; name: string }; at: string };

/** New in your Creative Rooms: what room-mates shared lately — the rooms you're actually in, newest first. */
export function RoomsGlance({ items, avatars }: { items: RoomItem[]; avatars: Record<string, string> }) {
  return (
    <section id="rooms" aria-labelledby="rooms-title" className="relative isolate scroll-mt-20 overflow-hidden rounded-3xl border border-border-soft bg-surface/90 p-3 shadow-[var(--shadow-card)]">
      <KitArt art={KIT.wash.washPeach} sizes="12rem" className="pointer-events-none absolute -right-10 -top-12 -z-10 h-32 w-auto opacity-50" />
      <h2 id="rooms-title" className="flex items-center gap-2 font-display text-[17px] leading-tight text-ink">
        <DoorOpen className="size-4 text-accent-ink" aria-hidden /> New in your Creative Rooms
      </h2>
      <ul className="mt-1.5 divide-y divide-border-soft">
        {items.map((i) => (
          <li key={`${i.projectId}:${i.itemId}`}>
            <Link href={`/rooms/${i.projectId}/shared/${i.itemId}`} className="flex min-h-12 items-center gap-3 py-2 hover:underline">
              <span className="relative shrink-0">
                <Avatar name={i.by.name} src={avatars[i.by.id]} size={32} />
                <span className="absolute -bottom-1 -right-1 inline-flex size-4 items-center justify-center rounded-full bg-surface text-ink-muted ring-1 ring-border-soft">
                  {i.kind === "material" ? <ImageIcon className="size-2.5" aria-hidden /> : <FileText className="size-2.5" aria-hidden />}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] text-ink">
                  <span className="font-medium">{i.by.name.split(" ")[0]}</span> shared <span className="font-display italic">“{i.title}”</span>
                </span>
                <span className="block truncate text-[12px] text-ink-subtle">
                  {i.projectTitle} · <RelativeTime iso={i.at} />
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-ink-subtle" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
