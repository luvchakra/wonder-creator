import { greetingFor } from "@wonder/core";
import { Avatar, BACKGROUNDS, Watercolor, buttonClasses, cn } from "@wonder/ui";
import { ArrowRight, Check, ChevronRight, Heart, Link2, MessageCircle, Play, Sparkles, Sun } from "lucide-react";
import Link from "next/link";
import { after } from "next/server";
import { RelativeTime } from "@/components/client-time";
import { PaletteScope } from "@/components/creative-palette";
import { CommunityGlance, RoomsGlance } from "@/components/home/community-glance";
import { ConnectionActions, FoundConnection } from "@/components/home/connection-actions";
import { QuickCapture } from "@/components/home/quick-capture";
import { TrackedLink } from "@/components/home/tracked-link";
import { preloadWatercolor } from "@/lib/brand-preload";
import { scheduleDiscovery } from "@/lib/home/discover";
import { buildHomePayload, type HomeContinueItem, type HomePayload } from "@/lib/home/payload";
import { sweepStalePresence } from "@/lib/presence";
import { requireSession } from "@/lib/session";
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

  const home = await buildHomePayload(db, creator.id);
  scheduleDiscovery(db, creator.id);
  const modules = [home.whileAway, home.worldConnecting, home.dejavu, home.spark, home.worthHearing, home.couldHelp, home.community, home.rooms].filter(Boolean).length;
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

        {/* The one dominant action: continue (or something worth starting, or a calm beginning). */}
        {home.continue ? (
          <ContinueCard c={home.continue} quiet={quiet} />
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

        {home.quickCapture.textEnabled || home.quickCapture.voiceEnabled ? <QuickCapture /> : null}

        {/* The rest, as compact rows (owner board, 29 Sep 2026): what it is, one line of why, nothing more. */}
        {home.whileAway || home.yourQuestion || home.worldConnecting || home.dejavu || home.spark || home.worthHearing || home.couldHelp ? (
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
                <Link href={`/community/conversations/${home.yourQuestion.conversationId}`} className="block px-3 py-2 hover:bg-surface-muted">
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
                <TrackedLink event="home_spark_opened" href={`/space/materials/${home.spark.materialId}`} className="block px-3 py-2 hover:bg-surface-muted">
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

            {home.worthHearing ? <WorthHearing w={home.worthHearing} avatars={home.avatars} /> : null}

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

        {home.rooms ? <RoomsGlance items={home.rooms} avatars={home.avatars} /> : null}

        {home.community ? <CommunityGlance g={home.community} avatars={home.avatars} /> : null}

        {home.recent?.length ? (
          <Module id="recent" label="Recent Creations">
            <ul className="-my-1">
              {home.recent.map((r) => (
                <li key={r.id}>
                  <Link href={`/artifacts/${r.id}`} className="flex min-h-11 items-center gap-2 text-[14px] text-ink hover:underline">
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

function ContinueCard({ c, quiet }: { c: HomeContinueItem; quiet: boolean }) {
  return (
    <section aria-labelledby="current-creation" className="relative isolate overflow-hidden rounded-2xl shadow-[var(--shadow-card)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={c.coverUrl ?? BACKGROUNDS.sunsetCoast} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
      <span aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(20,18,40,0.35)_0%,rgba(20,18,40,0.15)_40%,rgba(20,18,40,0.8)_100%)]" />
      <div className="flex min-h-[10.5rem] flex-col justify-between p-3 text-white">
        <p className="flex items-center justify-between text-[11.5px] font-semibold uppercase tracking-[0.12em] text-white/85">
          Continue
          {c.playable ? (
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-white/85 text-ink">
              <Play className="size-3.5 translate-x-px fill-current" aria-hidden />
            </span>
          ) : null}
        </p>
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="current-creation" className="font-display text-[21px] leading-tight">
              <Link href={`/artifacts/${c.id}`} className="break-words hover:underline">
                {c.title}
              </Link>
            </h2>
            <p className="text-[12.5px] text-white/85">
              {c.version ? `v${c.version} · ` : ""}
              {c.typeLabel} · Edited <RelativeTime iso={c.updatedAt} />
            </p>
            <p className="mt-0.5 text-[13px] text-white">
              {quiet ? "Where you left it." : (c.hint.text ?? "Pick up where you left off.")}
              {c.sources ? (
                <span className="text-white/80">
                  {" "}
                  · {c.sources.total} {c.sources.total === 1 ? "source" : "sources"}
                  {c.sources.unused ? ` · ${c.sources.unused} unused` : ""}
                </span>
              ) : null}
            </p>
          </div>
          {/* The one dominant action. */}
          <TrackedLink
            event="home_continue_clicked"
            href={`/artifacts/${c.id}/studio`}
            data-primary-action
            aria-label="Continue Creating"
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/15 text-white backdrop-blur hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <ArrowRight className="size-5" aria-hidden />
          </TrackedLink>
        </div>
      </div>
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

function WorthHearing({ w, avatars }: { w: NonNullable<HomePayload["worthHearing"]>; avatars: Record<string, string> }) {
  if (w.kind === "conversation")
    return (
      <section id="hearing" aria-label="Worth hearing">
        <Link href={`/community/conversations/${w.conversationId}`} className="block px-3 py-2 hover:bg-surface-muted">
          <RowBody
            icon={<MessageCircle className="size-5 text-accent" aria-hidden />}
            title="Worth hearing"
            summary={`${w.title} · ${w.replyCount} ${w.replyCount === 1 ? "reply" : "replies"} · ${w.reason}`}
            chevron
          />
        </Link>
      </section>
    );
  const person = w.kind === "huddle" ? { name: w.participantName, id: w.participantId } : { name: w.authorName, id: w.authorId };
  return (
    <section id="hearing" aria-label="Worth hearing">
      <Link href={w.kind === "huddle" ? `/huddles/${w.huddleId}` : `/scrapbook/${w.postId}`} className="block px-3 py-2 hover:bg-surface-muted">
        <RowBody
          icon={
            w.kind === "post" && w.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={w.imageUrl} alt="" className="size-10 rounded-full object-cover" />
            ) : (
              <Avatar name={person.name} src={person.id ? avatars[person.id] : null} size={40} />
            )
          }
          title="Worth hearing"
          summary={w.kind === "huddle" ? `Live Huddle · ${w.topic} · ${w.participantCount} here` : `${w.authorName}: ${w.body}`}
          chevron
        />
      </Link>
    </section>
  );
}
