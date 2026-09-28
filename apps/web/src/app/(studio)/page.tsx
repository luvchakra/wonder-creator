import { greetingFor } from "@wonder/core";
import { artifactType } from "@wonder/creator-studio/types";
import { Avatar, BACKGROUNDS, KIT, KitArt, Watercolor, buttonClasses, cn } from "@wonder/ui";
import { ArrowRight, AudioLines, ChevronRight, FileCheck, Heart, Images, MessageCircle, Play, Share2, Sparkles, SunMedium, UserPlus, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { after } from "next/server";
import { RelativeTime } from "@/components/client-time";
import { PaletteScope } from "@/components/creative-palette";
import { preloadWatercolor } from "@/lib/brand-preload";
import { loadHome } from "@/lib/home";
import { agoPhrase } from "@/lib/home-sections";
import { sweepStalePresence } from "@/lib/presence";
import { requireSession } from "@/lib/session";
import { HomeBegin } from "./home-begin";

export const metadata = { title: "Home" };

const CORNER_SIZES = "(min-width: 640px) 11rem, 8.5rem";

/**
 * Home (owner's board, 28 Sep 2026: "A calmer home for bolder ideas"): a warm welcome with what changed since you were
 * last here, the Creation you're in the middle of as the one clear focus, then compact bubbles — what happened while
 * you were away, a little spark from your own past Materials, something worth hearing from people you follow, and who
 * could use your help. Every section is real data or isn't shown; nothing is ranked by popularity.
 */
export default async function HomePage() {
  const { db, creator } = await requireSession();
  preloadWatercolor("cornerTopRight", CORNER_SIZES);
  after(sweepStalePresence);

  const { lastVisit, creation, version, cover, away, asks, spark, sparkUrl, post, huddle, avatars, hasMaterials } = await loadHome(db, creator.id);
  const first = (creator.display_name || "Creator").split(" ")[0];
  const type = creation ? artifactType(creation.artifact_type) : null;
  const playable = type?.category === "audio" || type?.category === "video";
  const postImage = post?.attachments.find((a) => a.fileUrl && a.mimeType?.startsWith("image/"))?.fileUrl ?? null;

  return (
    <>
      <PaletteScope
        context={{
          page: "home",
          strip: {
            continueTitle: creation && (creation.status === "draft" || creation.status === "in_review") ? creation.title : null,
          },
        }}
      />
      <div className="mx-auto max-w-3xl space-y-4">
        {/* A. Warm welcome: who you are to it, and what changed. */}
        <header className="relative isolate">
          {/* The supplied floral corner behind the welcome — decoration only, outside the layout. */}
          <div aria-hidden className="pointer-events-none absolute -right-4 -top-3 -z-10 w-[8.5rem] sm:-right-2 sm:w-[11rem]">
            <Watercolor name="cornerTopRight" sizes={CORNER_SIZES} priority className="h-auto w-full opacity-80" />
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-ink">
                <span className="block font-display text-lg text-ink-muted sm:text-xl">{greetingFor(new Date())},</span>
                <span className="mt-0.5 flex items-center gap-2 font-display text-[30px] leading-none sm:text-[40px]">
                  <span className="break-words">{first}</span>
                  <KitArt art={KIT.mark.sun} sizes="2.5rem" priority className="size-8 shrink-0 sm:size-10" />
                </span>
              </h1>
              {lastVisit ? (
                <p className="mt-1.5 text-[13px] text-ink-muted">
                  You were last here <RelativeTime iso={lastVisit} />.
                </p>
              ) : null}
            </div>
            {away.length ? (
              <Link
                href="#while-away"
                className="flex size-[4.75rem] shrink-0 flex-col items-center justify-center rounded-full bg-surface/85 text-center shadow-[var(--shadow-card)] ring-1 ring-border-soft backdrop-blur hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span className="font-display text-[22px] leading-none text-ink">{away.length}</span>
                <span className="mt-0.5 text-[10.5px] leading-tight text-ink-muted">
                  {away.length === 1 ? "thing" : "things"}
                  <br />
                  changed
                </span>
                <ChevronRight className="size-3.5 text-accent" aria-hidden />
              </Link>
            ) : null}
          </div>
        </header>

        {/* The one clear focus: the Creation you're in the middle of. */}
        {creation ? (
          <section aria-labelledby="current-creation" className="rounded-2xl border border-border-soft bg-surface/90 p-2 shadow-[var(--shadow-card)]">
            <Link href={`/artifacts/${creation.id}`} tabIndex={-1} aria-hidden className="relative block overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover ?? BACKGROUNDS.sunsetCoast} alt="" className="h-40 w-full object-cover sm:h-56" />
              {playable ? (
                <span className="absolute left-1/2 top-1/2 inline-flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-ink shadow-[var(--shadow-card)]">
                  <Play className="size-5 translate-x-px fill-current" />
                </span>
              ) : null}
            </Link>
            <div className="px-2 pb-1.5 pt-2.5">
              <h2 id="current-creation" className="font-display text-xl leading-tight text-ink">
                <Link href={`/artifacts/${creation.id}`} className="hover:underline">
                  {creation.title}
                </Link>
              </h2>
              <p className="mt-0.5 text-[12.5px] text-ink-muted">
                {version ? `v${version} · ` : ""}
                {type!.label} · Edited <RelativeTime iso={creation.updated_at} />
              </p>
              <Link href={`/artifacts/${creation.id}/studio`} data-primary-action className={buttonClasses({ className: "mt-2.5 w-full" })}>
                Continue Creating <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </section>
        ) : (
          <HomeBegin hasMaterials={hasMaterials} />
        )}

        {/* B. Compact bubbles — each only when there's something real to show. */}
        {away.length ? (
          <section id="while-away" aria-labelledby="while-away-title" className="scroll-mt-20">
            <SectionTitle id="while-away-title" icon={<SunMedium className="size-[18px] text-orange" aria-hidden />} title="While you were away">
              <span className="rounded-full bg-accent-softer px-2 py-0.5 text-[11.5px] font-medium text-accent-ink">
                {away.length} {away.length === 1 ? "update" : "updates"}
              </span>
            </SectionTitle>
            <ul className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
              {away.slice(0, 8).map((i) => (
                <li key={i.id} className="w-[10.5rem] shrink-0 snap-start">
                  <Link
                    href={i.href}
                    className="flex h-full min-h-[5.5rem] flex-col justify-between gap-1.5 rounded-2xl border border-border-soft bg-surface/90 p-2.5 shadow-[var(--shadow-card)] hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <span className="flex items-start gap-2">
                      <KindIcon kind={i.kind} />
                      <span className="line-clamp-3 text-[12.5px] leading-snug text-ink">{i.title}</span>
                    </span>
                    <span className="flex items-center justify-between gap-1 text-[11.5px] text-ink-subtle">
                      <RelativeTime iso={i.at} />
                      {i.actor ? <Avatar name={i.actor.name} src={i.actor.id ? avatars[i.actor.id] : null} size={20} /> : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {spark ? (
          <section aria-labelledby="spark-title">
            <SectionTitle id="spark-title" icon={<Sparkles className="size-[18px] text-orange" aria-hidden />} title="A little spark" />
            <Bubble href={`/space/materials/${spark.id}`}>
              {sparkUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sparkUrl} alt="" className="h-[4.75rem] w-28 shrink-0 rounded-xl object-cover" />
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="line-clamp-3 font-display text-[14.5px] italic leading-snug text-ink">
                  “{agoPhrase(spark.created_at)} you saved {spark.title || "this"}.”
                </span>
                <span className="mt-1 block text-[12px] text-ink-muted">Bring it into something new.</span>
              </span>
            </Bubble>
          </section>
        ) : null}

        {huddle || post ? (
          <section aria-labelledby="hearing-title">
            <SectionTitle id="hearing-title" icon={<AudioLines className="size-[18px] text-accent" aria-hidden />} title="Worth hearing" />
            {huddle ? (
              <Bubble href={`/huddles/${huddle.huddleId}`}>
                <span className="flex h-[4.75rem] w-24 shrink-0 items-center justify-center rounded-xl bg-accent-softer">
                  <Avatar name={huddle.participantNames[0] ?? "Creator"} src={huddle.participantIds[0] ? avatars[huddle.participantIds[0]] : null} size={40} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11.5px] font-medium text-live">Live Huddle</span>
                  <span className="line-clamp-2 text-[14px] leading-snug text-ink">{huddle.topic ?? `${huddle.participantNames[0] ?? "A creator"}'s Huddle`}</span>
                  <span className="mt-0.5 block text-[12px] text-ink-subtle">
                    {huddle.participantCount} here · started <RelativeTime iso={huddle.startedAt} />
                  </span>
                </span>
              </Bubble>
            ) : post ? (
              <Bubble href={`/scrapbook/${post.id}`}>
                {postImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={postImage} alt="" className="h-[4.75rem] w-24 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="flex h-[4.75rem] w-24 shrink-0 items-center justify-center rounded-xl bg-accent-softer">
                    <Avatar name={post.author.name} src={avatars[post.author.id]} size={40} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-[11.5px] font-medium text-accent-ink">From the Scrapbook</span>
                  <span className="line-clamp-2 text-[14px] leading-snug text-ink">{post.body || post.attachments[0]?.title || "A new fragment"}</span>
                  <span className="mt-0.5 block text-[12px] text-ink-subtle">
                    {post.author.name} · <RelativeTime iso={post.createdAt} />
                  </span>
                </span>
              </Bubble>
            ) : null}
          </section>
        ) : null}

        {asks.length ? (
          <section aria-labelledby="help-title">
            <SectionTitle id="help-title" icon={<Heart className="size-[18px] fill-pink text-pink" aria-hidden />} title="You could help" />
            <ul className="grid grid-cols-2 gap-2">
              {asks.slice(0, 4).map((i) => (
                <li key={i.id}>
                  <Link
                    href={i.href}
                    className="flex h-full min-h-[4.25rem] items-center gap-2 rounded-2xl border border-border-soft bg-surface/90 p-2 shadow-[var(--shadow-card)] hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {i.actor ? (
                      <Avatar name={i.actor.name} src={i.actor.id ? avatars[i.actor.id] : null} size={34} />
                    ) : (
                      <span className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-full bg-accent-softer text-accent">
                        <Sparkles className="size-4" aria-hidden />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-3 text-[12.5px] leading-snug text-ink">{i.title}</span>
                      <span className="block text-[11.5px] text-ink-subtle">
                        <RelativeTime iso={i.at} />
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-accent" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}

function SectionTitle({ id, icon, title, children }: { id: string; icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex min-h-8 items-center gap-2">
      {icon}
      <h2 id={id} className="font-display text-[17px] text-ink">
        {title}
      </h2>
      {children ? <span className="ml-auto">{children}</span> : null}
    </div>
  );
}

function Bubble({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-border-soft bg-surface/90 p-2 pr-3 shadow-[var(--shadow-card)] hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
      <ChevronRight className="size-4 shrink-0 text-accent" aria-hidden />
    </Link>
  );
}

const KIND_ICON: Record<string, { icon: typeof Share2; tone: string }> = {
  shared_with_you: { icon: Share2, tone: "bg-accent-softer text-accent" },
  message: { icon: MessageCircle, tone: "bg-accent-softer text-accent" },
  proposal_decided: {
    icon: CheckCircle2,
    tone: "bg-success-soft text-success-ink",
  },
  collaborator_added: { icon: UserPlus, tone: "bg-accent-softer text-accent" },
  license_response: {
    icon: FileCheck,
    tone: "bg-success-soft text-success-ink",
  },
  visuals_ready: { icon: Images, tone: "bg-success-soft text-success-ink" },
};

function KindIcon({ kind }: { kind: string }) {
  const k = KIND_ICON[kind] ?? KIND_ICON.message!;
  return (
    <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full", k.tone)}>
      <k.icon className="size-4" aria-hidden />
    </span>
  );
}
