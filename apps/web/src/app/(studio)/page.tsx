import { greetingFor } from "@wonder/core";
import { Avatar, BACKGROUNDS, Watercolor, buttonClasses, cn } from "@wonder/ui";
import { ArrowRight, Check, ChevronRight, Heart, Link2, MessageCircle, Sparkles, Sun } from "lucide-react";
import Link from "next/link";
import { after } from "next/server";
import { RelativeTime } from "@/components/client-time";
import { PaletteScope } from "@/components/creative-palette";
import { CommunityGlance, RoomsGlance } from "@/components/home/community-glance";
import { HomeCommunities } from "@/components/home/home-communities";
import { HomeTestimonials } from "@/components/home/home-testimonials";
import { ConnectionActions, FoundConnection } from "@/components/home/connection-actions";
import { QuickCapture } from "@/components/home/quick-capture";
import { ScrapbookStrip } from "@/components/home/scrapbook-strip";
import { FromYourWorld } from "@/components/sources/from-your-world";
import { SectionTitle } from "@/components/home/section-title";
import { TrackedLink } from "@/components/home/tracked-link";
import { preloadWatercolor } from "@/lib/brand-preload";
import { scheduleDiscovery } from "@/lib/home/discover";
import { buildHomePayload, type HomeInProgressItem, type HomePayload } from "@/lib/home/payload";
import { sweepStalePresence } from "@/lib/presence";
import { requireSession } from "@/lib/session";
import { flagOn } from "@/lib/features";
import { homeWorld, sourcesHomeOn } from "@/lib/sources";
import { track } from "@/lib/telemetry";
import { HomeBegin } from "./home-begin";

export const metadata = { title: "Home" };

const CORNER_SIZES = "(min-width: 640px) 11rem, 8.5rem";

/**
 * Home — the orchestration layer of the creator's life (docs/phases/02-home-quick-capture.md). It answers: what
 * matters now, what to continue, what changed, what might inspire, how the creator's world is connecting, and where
 * they could help. Active, Return or Quiet; one dominant action (Continue); Quick Capture always in reach; a handful of
 * modules chosen on the server, each shown only when it has something real. Never a feed, a dashboard or a chat.
 */
export default async function HomePage() {
  const { db, creator } = await requireSession();
  preloadWatercolor("cornerTopRight", CORNER_SIZES);
  after(sweepStalePresence);

  const [home, world] = await Promise.all([buildHomePayload(db, creator.id), flagOn("personal_sources_enabled") && sourcesHomeOn() ? homeWorld(db) : null]);
  scheduleDiscovery(db, creator.id);
  const modules = [home.whileAway, home.worldConnecting, home.dejavu, home.spark, home.worthHearing, home.couldHelp, home.community, home.rooms, home.communities].filter(Boolean).length;
  after(() => {
    track(db, "home_opened", creator.id);
    track(db, "home_mode_rendered", creator.id, { mode: home.mode, slots: modules });
  });
  const first = (creator.display_name || "Creator").split(" ")[0];
  const quiet = home.mode === "quiet";

  return (
    <>
      <PaletteScope
        context={{
          page: "home",
          strip: { continueTitle: home.continue ? home.continue.title : null, homeLine: home.contextLine },
        }}
      />
      <div id="home" className="mx-auto max-w-3xl space-y-3" data-home-mode={home.mode}>
        <header className="relative isolate">
          {/* The supplied floral corner behind the welcome — decoration only, outside the layout. */}
          <div aria-hidden className="pointer-events-none absolute -right-4 -top-3 -z-10 w-[8.5rem] sm:-right-2 sm:w-[11rem]">
            <Watercolor name="cornerTopRight" sizes={CORNER_SIZES} priority className="h-auto w-full opacity-80" />
          </div>
          <h1 className="pr-24 font-display text-[26px] leading-tight text-ink sm:text-[30px]">
            {greetingFor(new Date())}, <span className="break-words">{first}</span>
          </h1>
          {/* One short truth, as in the navbar: "3 things changed", "Nothing needs your attention." */}
          <p className="mt-0.5 text-[13px] text-ink-muted">{quiet ? "Nothing needs your attention." : home.contextLine}</p>
        </header>

        {/* Capture first (owner, 4 Oct 2026: "move the quick note, voice note above scrapbook"): note, voice, picture, video. */}
        <QuickCapture />

        {/* Fixed sections (owner, 3 Oct 2026): My Scrapbook, Continue, My Communities, My Testimonials — always here, never repeated below. */}
        <ScrapbookStrip db={db} viewer={{ id: creator.id, name: creator.display_name || "Creator" }} />

        {/* The one dominant action: continue (thin rows of the work in progress), else something worth starting, else a calm beginning. */}
        {home.inProgress ? (
          <ContinueRows items={home.inProgress} />
        ) : home.start ? (
          <section aria-labelledby="start-title" className="rounded-2xl border border-border-soft bg-surface/90 p-3 shadow-[var(--shadow-card)]">
            <p id="start-title" className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
              Something worth starting
            </p>
            <p className="mt-1 font-display text-[17px] leading-snug text-ink">{home.start.text}</p>
            <Link href={home.start.href} data-primary-action className={buttonClasses({ className: "mt-2.5 w-full" })}>
              Explore this idea <ArrowRight className="size-4" aria-hidden />
            </Link>
          </section>
        ) : (
          <HomeBegin hasMaterials={home.beginning?.hasMaterials ?? false} />
        )}


        {/* Personal Sources (owner spec, 2 Oct 2026): one thing worth exploring from the creator's world, with a quiet Sync. */}
        {/* Only when something real arrived from the creator's sources; connecting them lives in Me (fewer buttons on Home). */}
        {world?.candidate ? <FromYourWorld {...world} /> : null}

        {/* The rest, as compact rows (owner board, 29 Sep 2026): what it is, one line of why, nothing more. */}
        {home.whileAway || home.yourQuestion || home.worldConnecting || home.dejavu || home.spark || home.couldHelp ? (
          <div className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-surface/90 shadow-[var(--shadow-card)]">
            {home.whileAway ? (
              <Expandable id="while-away" label="While you were away" summary={home.whileAway.lines.map((l) => l.text).join(" · ")} count={home.whileAway.total} icon={<Sun className="size-5 text-orange" aria-hidden />}>
                {home.whileAway.lines.map((l) => (
                  <li key={l.text}>
                    <Link href={l.href} className="flex min-h-11 items-center gap-2 text-[13.5px] leading-snug text-ink hover:underline">
                      <span className="min-w-0 flex-1">{l.text}</span>
                      <ChevronRight className="size-4 shrink-0 text-accent" aria-hidden />
                    </Link>
                  </li>
                ))}
              </Expandable>
            ) : null}

            {home.yourQuestion ? (
              <section id="question" aria-label="Your question">
                <Link href={`/pulse/conversations/${home.yourQuestion.conversationId}`} className="block px-3 py-2 hover:bg-surface-muted">
                  <RowBody
                    icon={<MessageCircle className="size-5 text-accent" aria-hidden />}
                    title="Your question"
                    summary={`“${home.yourQuestion.title}” · ${home.yourQuestion.newReplies} new ${home.yourQuestion.newReplies === 1 ? "reply" : "replies"} · Catch up`}
                    chevron
                  />
                </Link>
              </section>
            ) : null}

            {home.worldConnecting ? (
              <section id="connecting" aria-label="Your world is connecting">
                {home.worldConnecting.connectionId ? (
                  <FoundConnection id={home.worldConnecting.connectionId} text={home.worldConnecting.text} href={home.worldConnecting.href} why={home.worldConnecting.why ?? []} />
                ) : home.worldConnecting.suggestion ? (
                  <div className="px-3 py-2">
                    <RowBody icon={<Link2 className="size-5 text-accent" aria-hidden />} title="Your world is connecting" summary={home.worldConnecting.text} />
                    <div className="pl-12">
                      <ConnectionActions {...home.worldConnecting.suggestion} />
                    </div>
                  </div>
                ) : (
                  <TrackedLink event="home_connection_opened" href={home.worldConnecting.href} className="block px-3 py-2 hover:bg-surface-muted">
                    <RowBody icon={<Link2 className="size-5 text-accent" aria-hidden />} title="Your world is connecting" summary={home.worldConnecting.text} chevron />
                  </TrackedLink>
                )}
              </section>
            ) : null}

            {home.dejavu ? (
              <section id="dejavu" aria-label="A DejaVu surfaced">
                <TrackedLink event="home_dejavu_opened" href={`/dejavu/${home.dejavu.id}`} className="block px-3 py-2 hover:bg-surface-muted">
                  <RowBody
                    icon={<Check className="size-5 text-success" aria-hidden />}
                    title="A DejaVu surfaced"
                    summary={`${home.dejavu.name} · ${home.dejavu.newCount} new, ${home.dejavu.newCount + home.dejavu.olderCount} Moments`}
                    chevron
                  />
                </TrackedLink>
              </section>
            ) : null}

            {home.spark ? (
              <section id="spark" aria-label="A little spark">
                {/* For its own sake: the row opens the Material; nothing asks for anything. */}
                <TrackedLink event="home_spark_opened" href={`/materials/${home.spark.materialId}`} className="block px-3 py-2 hover:bg-surface-muted">
                  <RowBody
                    icon={
                      home.spark.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={home.spark.imageUrl} alt="" className="size-10 rounded-lg object-cover" />
                      ) : (
                        <Sparkles className="size-5 text-orange" aria-hidden />
                      )
                    }
                    title="A little spark"
                    summary={home.spark.text}
                    italic
                  />
                </TrackedLink>
              </section>
            ) : null}

            {home.couldHelp ? (
              <Expandable
                id="help"
                label="You could help"
                summary={home.couldHelp.items[0]!.title}
                count={home.couldHelp.items.length}
                icon={
                  home.couldHelp.items[0]!.actor ? (
                    <Avatar name={home.couldHelp.items[0]!.actor.name} src={home.couldHelp.items[0]!.actor.id ? home.avatars[home.couldHelp.items[0]!.actor.id] : null} size={36} />
                  ) : (
                    <Heart className="size-5 fill-pink text-pink" aria-hidden />
                  )
                }
              >
                {home.couldHelp.items.map((i) => (
                  <li key={i.id}>
                    <Link href={i.href} className="flex min-h-11 items-center gap-2 text-[13.5px] leading-snug text-ink hover:underline">
                      <span className="min-w-0 flex-1">
                        {i.title}
                        {i.reason ? <span className="block text-[12px] text-accent-ink">{i.reason}</span> : null}
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-accent" aria-hidden />
                    </Link>
                  </li>
                ))}
              </Expandable>
            ) : null}
          </div>
        ) : null}

        {/* Communities (owner, 3 Oct 2026): what's new in one, your communities, and Discover — easy to find from Home. */}
        {home.communities || home.worthHearing ? (
          <HomeCommunities mine={home.communities?.mine ?? null} hearing={home.worthHearing ? <WorthHearing w={home.worthHearing} avatars={home.avatars} /> : null} />
        ) : null}

        {flagOn("testimonials_enabled") ? <HomeTestimonials db={db} creator={{ id: creator.id, handle: creator.handle ?? null }} /> : null}

        {home.rooms ? <RoomsGlance items={home.rooms} avatars={home.avatars} /> : null}

        {home.community ? <CommunityGlance g={home.community} avatars={home.avatars} /> : null}

        {home.recent?.length ? (
          <Module id="recent" label="Recent Creations">
            <ul className="-my-1">
              {home.recent.map((r) => (
                <li key={r.id}>
                  <Link href={`/creations/${r.id}`} className="flex min-h-11 items-center gap-2 text-[14px] text-ink hover:underline">
                    <span className="min-w-0 flex-1 truncate">{r.title}</span>
                    <span className="text-[12.5px] text-ink-subtle">{r.typeLabel}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Module>
        ) : null}
      </div>
    </>
  );
}

/**
 * Continue (owner, 3 Oct 2026: "instead of a large continue image, show 4 thin rows"): the last three edited Creations
 * in progress, each opening where it's worked on; the title opens them all. The newest is the page's primary action.
 */
function ContinueRows({ items }: { items: HomeInProgressItem[] }) {
  return (
    <section aria-labelledby="continue-title">
      <SectionTitle id="continue-title" href="/creations">
        Continue
      </SectionTitle>
      <ul aria-label="Creations in progress" className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-surface/90 shadow-[var(--shadow-card)]">
        {items.map((c, i) => (
          <li key={c.id}>
            <TrackedLink
              event="home_continue_clicked"
              href={c.href ?? `/creations/${c.id}/studio`}
              {...(i === 0 ? { "data-primary-action": true } : {})}
              className="flex min-h-12 items-center gap-2.5 px-3 py-1.5 hover:bg-surface-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.coverUrl ?? BACKGROUNDS.sunsetCoast} alt="" className="size-8 shrink-0 rounded-lg object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-[15.5px] leading-snug text-ink">{c.title}</span>
                <span className={cn("block truncate text-[11.5px]", c.hint ? "text-accent-ink" : "text-ink-subtle")}>
                  {c.typeLabel} · {c.hint ?? <>Edited <RelativeTime iso={c.updatedAt} /></>}
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-accent" aria-hidden />
            </TrackedLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A compact row: a small picture or icon, what it is, one line of why. */
function RowBody({ icon, title, summary, chevron, italic }: { icon: React.ReactNode; title: string; summary: string; chevron?: boolean; italic?: boolean }) {
  return (
    <span className="flex min-h-12 items-center gap-3">
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-muted">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-ink">{title}</span>
        <span className={cn("line-clamp-2 text-[12.5px] leading-snug text-ink-muted", italic && "font-display text-[13.5px] italic")}>{summary}</span>
      </span>
      {chevron ? <ChevronRight className="size-4 shrink-0 text-ink-subtle" aria-hidden /> : null}
    </span>
  );
}

/** A row that opens in place (no extra page): a summary first, the items when asked for. */
function Expandable({ id, label, summary, count, icon, children }: { id: string; label: string; summary: string; count: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-label={label} className="scroll-mt-20">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center px-3 py-2 hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
          <span className="flex min-h-12 min-w-0 flex-1 items-center gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-muted">{icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium text-ink">{label}</span>
              <span className="line-clamp-1 text-[12.5px] text-ink-muted">{summary}</span>
            </span>
          </span>
          <span className="ml-2 inline-flex items-center gap-0.5 text-[12.5px] text-ink-subtle">
            {count}
            <ChevronRight className="size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden />
          </span>
        </summary>
        <ul className="px-3 pb-2 pl-16">{children}</ul>
      </details>
    </section>
  );
}

function Module({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 rounded-2xl border border-border-soft bg-surface/90 px-3 py-2.5 shadow-[var(--shadow-card)]">
      <h2 id={`${id}-title`} className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
        {label}
      </h2>
      <div className="mt-1">{children}</div>
    </section>
  );
}

/** What's new in a community (or, failing that, a conversation, live Huddle or thought worth hearing): one row. */
function WorthHearing({ w, avatars }: { w: NonNullable<HomePayload["worthHearing"]>; avatars: Record<string, string> }) {
  if (w.kind === "conversation")
    return (
      <Link href={`/pulse/conversations/${w.conversationId}`} className="block px-3 pb-1.5 hover:bg-surface-muted">
        <RowBody icon={<MessageCircle className="size-5 text-accent" aria-hidden />} title={w.title} summary={`${w.reason} · ${w.replyCount} ${w.replyCount === 1 ? "reply" : "replies"}`} chevron />
      </Link>
    );
  const person = w.kind === "huddle" ? { name: w.participantName, id: w.participantId } : { name: w.authorName, id: w.authorId };
  return (
    <Link href={w.kind === "huddle" ? `/huddles/${w.huddleId}` : `/scrapbook/${w.postId}`} className="block px-3 pb-1.5 hover:bg-surface-muted">
      <RowBody
        icon={
          w.kind === "post" && w.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={w.imageUrl} alt="" className="size-10 rounded-full object-cover" />
          ) : (
            <Avatar name={person.name} src={person.id ? avatars[person.id] : null} size={40} />
          )
        }
        title={w.kind === "huddle" ? `Live Huddle · ${w.topic}` : w.authorName}
        summary={w.kind === "huddle" ? `${w.participantCount} here` : w.body}
        chevron
      />
    </Link>
  );
}
