import { writingStyleOf } from "@wonder/creator-studio/pages";
import { EXPERIENCE_LABEL, clock } from "@wonder/creator-studio/publish";
import { KIT, Ornament, cn } from "@wonder/ui";
import { ArrowLeft, Lock, MessagesSquare, Sparkles } from "lucide-react";
import Link from "next/link";
import type { PublicCard, PublicWorkView } from "@/lib/public-pages";
import { ShareButton, ViewBeacon } from "./beacons";
import { ListenRenderer, ViewRenderer, VoiceChip, WatchRenderer } from "./media";
import { SwipeRenderer } from "./swipe";
import { WrittenPiece } from "../writing/written-piece";

/**
 * One published work (docs/creator-publish.md §3): a shared outer shell — header, the work, optional context, rights
 * and credits, an optional conversation, more from the creator — around a renderer chosen by the manifest. The work
 * dominates; the shell recedes as the work becomes more immersive (§31).
 */
const THEME: Record<string, string> = {
  paper: "bg-[#f7f2ea] text-ink",
  light: "bg-white text-ink",
  dark: "bg-[#131016] text-white",
  cinematic: "bg-[#0f0c12] text-white",
};

export function PublishedWorkPage({ work, url }: { work: PublicWorkView; url: string }) {
  const { manifest: m, snapshot: s } = work;
  const dark = m.theme === "dark" || m.theme === "cinematic";
  const media = (id: string | null | undefined) => (id ? (work.media[id] ?? null) : null);
  const byline = `${m.poem ? "A poem" : `A ${s.typeLabel.toLowerCase()}`} by ${work.creator.name}`;
  const immersive = m.experience === "watch" || m.experience === "swipe" || m.experience === "view" || m.experience === "listen";
  // Written work keeps the look it had on its page (creation-pages.md): over the cover, the cover blurred behind, or paper.
  const reading = m.experience === "read";
  const cover = media(s.coverObjectId);
  const blurred = reading && s.look === "blur" && !!cover;
  const paper = reading && (s.look === "paper" || blurred);
  const showCover = !!cover && m.treatment !== "minimal" && (s.look ? s.look === "cover" : !m.poem);

  return (
    <div
      className={cn("relative isolate min-h-dvh", THEME[m.theme] ?? THEME.light)}
      style={paper && !blurred ? { backgroundImage: `url(${KIT.texture.texturePaper.svg})`, backgroundSize: "512px" } : undefined}
    >
      {blurred ? (
        <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover!} alt="" className="size-full scale-110 object-cover blur-2xl" />
          <span className="absolute inset-0 bg-[#f7f2ea]/20" />
        </div>
      ) : null}
      <ViewBeacon workId={work.workId} preview={work.preview} />
      <header className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-2 transition-opacity motion-reduce:transition-none [[data-immersed]_&]:opacity-0">
        {work.creator.pagePublished ? (
          <Link href={`/p/${work.creator.handle}`} className="inline-flex min-h-11 items-center gap-1.5 text-[13.5px] font-medium opacity-80 hover:opacity-100">
            <ArrowLeft className="size-4" aria-hidden /> {work.creator.name}
          </Link>
        ) : (
          <span className="text-[13.5px] font-medium opacity-80">{work.creator.name}</span>
        )}
        <span className="flex-1" />
        {work.rights.allowSharing && work.visibility !== "private" ? <ShareButton workId={work.workId} title={s.title} url={url} tone={dark ? "dark" : "light"} /> : null}
      </header>
      {work.preview ? (
        <p role="status" className="mx-auto mb-2 flex max-w-3xl items-center gap-2 rounded-full bg-accent-softer px-4 py-1.5 text-[13px] text-accent-ink">
          <Lock className="size-4" aria-hidden /> {work.visibility === "private" ? "Private — only you can see this." : "Not published right now — only you can see this."}
        </p>
      ) : null}

      <main id="main" className="px-4 pb-16">
        {m.experience === "swipe" && s.slides?.length ? (
          <>
            <Title title={s.title} byline={byline} small />
            <SwipeRenderer workId={work.workId} slides={s.slides} aspect={m.aspectRatio ?? "4:5"} media={work.media} fullscreen={m.treatment === "fullscreen"} title={s.title} />
          </>
        ) : m.experience === "view" && s.images?.length ? (
          <>
            <ViewRenderer src={media(s.images[0]!.objectId) ?? ""} alt={s.images[0]!.alt || s.title} surround={m.treatment === "museum" || dark ? "dark" : "light"} />
            <div className="mt-6 text-center">
              <h1 className="font-display text-[26px] leading-tight">{s.title}</h1>
              <p className="mt-1 text-[14px] opacity-75">{byline}</p>
              {s.location ? <p className="mt-1 text-[13px] opacity-60">{s.location}</p> : null}
            </div>
            {s.images.length > 1 ? (
              <ul className="mx-auto mt-8 grid max-w-5xl gap-4 sm:grid-cols-2" aria-label="More from this series">
                {s.images.slice(1).map((im) => (
                  <li key={im.objectId}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={media(im.objectId) ?? ""} alt={im.alt} loading="lazy" className="w-full rounded-xl object-cover" />
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : m.experience === "watch" && s.media?.kind === "video" ? (
          <>
            <WatchRenderer workId={work.workId} src={media(s.media.objectId) ?? ""} poster={media(s.media.posterObjectId)} title={s.title} vertical={s.media.vertical} />
            <div className="mx-auto mt-5 max-w-3xl">
              <h1 className="font-display text-[28px] leading-tight">{s.title}</h1>
              <p className="mt-1 text-[14px] opacity-75">
                {byline}
                {s.media.durationSeconds ? ` · ${clock(s.media.durationSeconds)}` : ""}
              </p>
            </div>
          </>
        ) : m.experience === "listen" && s.media?.kind === "audio" ? (
          <ListenRenderer workId={work.workId} src={media(s.media.objectId) ?? ""} artwork={media(s.coverObjectId)} title={s.title} byline={byline} durationSeconds={s.media.durationSeconds} />
        ) : m.experience === "journey" && s.blocks?.length ? (
          <article className="mx-auto max-w-5xl">
            <Title title={s.title} byline={byline} />
            <div className="space-y-8">
              {s.blocks.map((b, k) =>
                b.kind === "text" ? (
                  <p key={k} className="mx-auto max-w-[36rem] whitespace-pre-line font-display text-[18px] leading-[1.75]">
                    {b.text}
                  </p>
                ) : b.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={k} src={media(b.objectId) ?? ""} alt={b.alt} loading={k > 1 ? "lazy" : undefined} className={cn("mx-auto w-full rounded-xl object-cover", m.treatment === "cinematic" ? "max-w-5xl" : "max-w-3xl")} />
                ) : b.kind === "audio" ? (
                  <figure key={k} className="mx-auto max-w-[36rem]">
                    <audio controls preload="none" src={media(b.objectId) ?? undefined} className="w-full" aria-label={b.title} />
                    <figcaption className="mt-1 text-[13px] opacity-70">
                      {b.title}
                      {b.durationSeconds ? ` · ${clock(b.durationSeconds)}` : ""}
                    </figcaption>
                  </figure>
                ) : (
                  <video key={k} controls playsInline preload="metadata" src={media(b.objectId) ?? undefined} aria-label={b.title} className="mx-auto w-full max-w-4xl rounded-xl bg-black" />
                ),
              )}
            </div>
          </article>
        ) : (
          <article
            className={cn(
              "mx-auto",
              m.poem && m.treatment === "centered" ? "max-w-[34rem] text-center" : "max-w-[36rem]",
              blurred && "mt-6 max-w-[40rem] rounded-[28px] bg-[#f7f2ea]/85 px-5 py-9 shadow-[0_24px_60px_-28px_rgba(40,30,20,0.55)] backdrop-blur-md sm:px-12 sm:py-12",
            )}
          >
            {m.poem ? <Title title={s.title} byline={byline} align={m.treatment === "centered" ? "center" : "left"} /> : null}
            {m.poem && s.voice && media(s.voice.objectId) ? (
              <div className={cn("-mt-2 mb-4", m.treatment === "centered" && "flex justify-center")}>
                <VoiceChip src={media(s.voice.objectId)!} durationSeconds={s.voice.durationSeconds} />
              </div>
            ) : null}
            {showCover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover!} alt="" className="mb-8 max-h-[60dvh] w-full rounded-xl object-cover" />
            ) : null}
            {m.poem ? (
              // Line breaks, stanza spacing and indentation exactly as written (§7).
              <div className="whitespace-pre-wrap font-display text-[17px] leading-[1.9] sm:text-[19px]">{s.content}</div>
            ) : (
              // Set the way its kind is best read: an essay's drop cap, a feature's standfirst, news, fiction… (creation-pages.md).
              <WrittenPiece style={writingStyleOf(s.artifactType)} kicker={s.typeLabel} title={s.title} text={s.content} byline={work.creator.name} date={work.revision.publishedAt} ornament={s.ornament} as="h1" />
            )}
            {/* A poem closes with its ornament; prose pieces close their own (WrittenPiece). */}
            {m.poem && s.ornament ? (
              <Ornament kind={s.ornament} className="mt-10" />
            ) : !s.ornament ? (
              <p aria-hidden className="mt-10 text-center text-[18px] opacity-40">
                ◇
              </p>
            ) : null}
          </article>
        )}

        {/* Words that belong to the work, when it's primarily heard or watched. */}
        {(m.experience === "listen" || m.experience === "watch") && s.transcript?.trim() ? (
          <details className="mx-auto mt-8 max-w-[36rem]">
            <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-current/20 px-4 text-[13.5px] font-medium">{s.artifactType === "song_concept" ? "Lyrics" : "Read transcript"}</summary>
            <p className="mt-3 whitespace-pre-line font-display text-[17px] leading-[1.8] opacity-90">{s.transcript}</p>
          </details>
        ) : null}

        <Context work={work} dark={dark} immersive={immersive} />
      </main>
    </div>
  );
}

function Title({ title, byline, small, align = "left" }: { title: string; byline: string; small?: boolean; align?: "left" | "center" }) {
  return (
    <div className={cn(small ? "mx-auto mb-4 max-w-[30rem]" : "mb-8", align === "center" && "text-center")}>
      <h1 className={cn("font-display leading-tight", small ? "text-[22px]" : "text-[30px] sm:text-[34px]")}>{title}</h1>
      <p className="mt-1 text-[14px] opacity-70">{byline}</p>
    </div>
  );
}

/** Optional context, rights and credits (deterministic, as published), the conversation, more from the creator. */
function Context({ work, dark, immersive }: { work: PublicWorkView; dark: boolean; immersive: boolean }) {
  const { snapshot: s, rights: r, provenance: p } = work;
  const muted = dark ? "text-white/70" : "text-ink-muted";
  const line = dark ? "border-white/15" : "border-border-soft";
  return (
    <div className={cn("mx-auto mt-14 max-w-[36rem] space-y-8 text-[14px]", immersive && "mt-10")}>
      {s.description?.trim() ? (
        <section aria-label="About this">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] opacity-60">About this</h2>
          <p className={cn("mt-1 whitespace-pre-line leading-relaxed", muted)}>{s.description}</p>
        </section>
      ) : null}

      <section aria-label="Rights and credits" className={cn("border-t pt-4", line)}>
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] opacity-60">Rights &amp; credits</h2>
        <ul className={cn("mt-1 space-y-0.5", muted)}>
          {r.holder ? <li>© {r.holder}</li> : null}
          {r.credits.map((c) => (
            <li key={c}>{c}</li>
          ))}
          <li>
            {r.requireAttribution ? "Credit the creator when you share it." : "Share freely."}
            {r.allowRemix ? " Remixing is welcome, with credit." : " Please don't remix or reuse it without asking."}
          </li>
          {r.aiAssisted ? (
            <li className="inline-flex items-center gap-1">
              <Sparkles className="size-3.5" aria-hidden /> Made with AI assistance.
            </li>
          ) : null}
          <li className="text-[12.5px] opacity-80">
            {EXPERIENCE_LABEL[work.manifest.experience]} · published version {p.revisionNumber}
            {p.versionNumber ? ` (from v${p.versionNumber})` : ""}
          </li>
        </ul>
      </section>

      {work.conversation ? (
        <section aria-label="Conversation" className={cn("rounded-2xl border px-4 py-3", line)}>
          <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] opacity-60">
            <MessagesSquare className="size-4" aria-hidden /> Conversation
          </p>
          <p className="mt-1 font-display text-[17px]">{work.conversation.title}</p>
          <p className={cn("text-[13px]", muted)}>
            {work.conversation.replyCount} {work.conversation.replyCount === 1 ? "response" : "responses"}
          </p>
          <Link href={`/pulse/conversations/${work.conversation.id}`} className="mt-1 inline-flex min-h-11 items-center font-medium underline-offset-2 hover:underline">
            Join the conversation
          </Link>
        </section>
      ) : null}

      {work.more.length ? (
        <section aria-label={`More from ${work.creator.name}`}>
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] opacity-60">More from {work.creator.name}</h2>
          <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {work.more.map((c) => (
              <li key={c.slug}>
                <WorkCard card={c} dark={dark} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** The public card contract (§17): cover, title, what kind of experience it is. */
export function WorkCard({ card, dark, large }: { card: PublicCard; dark?: boolean; large?: boolean }) {
  return (
    <Link href={card.href} className="group block">
      <span className={cn("relative block overflow-hidden rounded-xl", large ? "aspect-[4/5]" : "aspect-square", dark ? "bg-white/10" : "bg-[#efe6da]")}>
        {card.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.coverUrl} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none" />
        ) : (
          <span className="flex size-full items-end p-3 font-display text-[17px] leading-snug">{card.title}</span>
        )}
      </span>
      <span className="mt-1.5 block truncate text-[14px] font-medium">{card.title}</span>
      <span className="block truncate text-[12.5px] opacity-65">{card.descriptor}</span>
    </Link>
  );
}
