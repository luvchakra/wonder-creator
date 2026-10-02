import type { TemplateSettings } from "@wonder/creator-studio/creator-page";
import { clock, type PageSection } from "@wonder/creator-studio/publish";
import { Avatar, KIT, KitArt, cn } from "@wonder/ui";
import { AudioLines, ExternalLink, Film, GalleryHorizontalEnd, Link2, MapPin, MessagesSquare, Play, Quote, StickyNote } from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Waveform } from "@/components/profile/shared";
import type { PublicCard, PublicCreatorPage } from "@/lib/public-pages";
import { momentFaceOf, workForm, type PageModel } from "./model";

export { pageModel, templateSettings, type PageModel } from "./model";

/**
 * Shared content for every Creator Page template (spec §11): one model computed from the page's public data, and
 * type-aware primitives the templates style but never re-implement. Templates own presentation only — no fetching,
 * permissions or mutations happen below this line.
 */

export type Tone = "light" | "paper" | "dark" | "glass";

export interface CreatorPageTemplateProps {
  data: PublicCreatorPage;
  mode: "public" | "preview";
  /** Settings for the template being shown (validated, defaults filled). */
  settings: TemplateSettings;
}

const TONE = {
  light: { card: "bg-white/85 border border-black/5", ink: "text-ink", muted: "text-ink-muted", subtle: "text-ink-subtle", paper: "bg-[#f8f3ea] text-ink", chip: "bg-accent-soft text-accent-ink" },
  paper: { card: "bg-[#fbf7f0] border border-[#e6dccb]", ink: "text-[#2b241c]", muted: "text-[#5c5043]", subtle: "text-[#7a6d5e]", paper: "bg-[#f3ebdd] text-[#2b241c]", chip: "bg-[#ece3d3] text-[#4a3f31]" },
  dark: { card: "bg-[#1a1613] border border-white/5", ink: "text-[#f3ebe0]", muted: "text-[#cbbfae]", subtle: "text-[#a89b89]", paper: "bg-[#231d18] text-[#f3ebe0]", chip: "bg-white/8 text-[#f0e4d2] ring-1 ring-white/15" },
  glass: { card: "bg-white/70 backdrop-blur-sm border border-white/60", ink: "text-ink", muted: "text-ink-muted", subtle: "text-ink-subtle", paper: "bg-white/60 text-ink", chip: "bg-white/70 text-accent-ink" },
} as const;
export const tone = (t: Tone) => TONE[t];

export const workHref = (handle: string, w: PublicCard) => w.href || `/p/${handle}/${w.slug}`;

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** The cue for a work's own form: play for film and sound, slide count for a carousel. */
function mediaCue(w: PublicCard) {
  if (w.experience === "watch" || w.experience === "listen") return w.durationSeconds ? clock(w.durationSeconds) : null;
  if (w.experience === "swipe" && w.itemCount) return `${w.itemCount} slides`;
  return null;
}

/**
 * A work's visual, in its own form (spec §12): text as typography on paper, sound as a waveform over its artwork,
 * film as a poster with a play cue, a carousel as its first slide with a slide count. Never a stand-in photograph.
 */
export function WorkVisual({ w, t, className, sizes = "(min-width: 768px) 30vw, 45vw", large }: { w: PublicCard; t: Tone; className?: string; sizes?: string; large?: boolean }) {
  const cue = mediaCue(w);
  const T = TONE[t];
  const form = workForm(w);
  if (form === "text") {
    return (
      <span className={cn("relative flex overflow-hidden rounded-xl p-3", T.paper, className)}>
        <span className={cn("relative line-clamp-6 whitespace-pre-line", w.poem ? "font-display text-[14px] italic leading-snug" : "text-[13px] leading-snug", large && "text-[16px]")}>{w.excerpt || w.title}</span>
        {w.poem ? <KitArt art={KIT.painted.leafSprigSage} sizes="4rem" className="pointer-events-none absolute -bottom-2 -right-1 h-16 w-auto opacity-70" /> : null}
      </span>
    );
  }
  if (form === "audio") {
    return (
      <span className={cn("relative flex items-end overflow-hidden rounded-xl", t === "dark" ? "bg-[#231d18]" : "bg-[#f1eeff]", className)}>
        {w.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={w.coverUrl} alt="" loading="lazy" sizes={sizes} className="absolute inset-0 size-full object-cover opacity-60" />
        ) : null}
        <span className="relative flex w-full items-center gap-2 p-2.5">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-white">
            <Play className="ml-0.5 size-3.5" aria-hidden />
          </span>
          <Waveform />
          {cue ? <span className={cn("text-[11.5px] tabular-nums", T.muted)}>{cue}</span> : null}
        </span>
      </span>
    );
  }
  if (form === "placeholder") {
    const I = w.experience === "watch" ? Film : w.experience === "swipe" ? GalleryHorizontalEnd : AudioLines;
    return (
      <span className={cn("relative flex items-center justify-center overflow-hidden rounded-xl", w.experience === "watch" ? "bg-[#1b1714] text-white/80" : T.paper, className)}>
        <I className="size-6 opacity-70" aria-hidden />
        <span className="sr-only">{w.typeLabel}</span>
      </span>
    );
  }
  return (
    <span className={cn("relative block overflow-hidden rounded-xl bg-black/5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={w.coverUrl ?? undefined} alt="" loading={large ? "eager" : "lazy"} sizes={sizes} className="size-full object-cover" />
      {w.experience === "watch" ? (
        <span className="absolute bottom-2 right-2 inline-flex size-9 items-center justify-center rounded-full border border-white/80 bg-black/30 text-white">
          <Play className="ml-0.5 size-4" aria-hidden />
        </span>
      ) : null}
      {cue ? <span className="absolute left-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white tabular-nums">{cue}</span> : null}
    </span>
  );
}

/** A work as a card: its visual, then title and what kind of thing it is. */
export function WorkTile({ w, handle, t, aspect = "aspect-[4/3]", className }: { w: PublicCard; handle: string; t: Tone; aspect?: string; className?: string }) {
  const T = TONE[t];
  return (
    <Link href={workHref(handle, w)} className={cn("group block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent", className)}>
      <WorkVisual w={w} t={t} className={cn("w-full", aspect)} />
      <span className={cn("mt-1.5 block truncate text-[13.5px] font-medium group-hover:underline", T.ink)}>{w.title}</span>
      <span className={cn("block truncate text-[12px]", T.subtle)}>{w.descriptor}</span>
    </Link>
  );
}

/** The featured work, large, with its title over or beneath it. */
export function FeaturedWork({ w, handle, t, className, overlay = true }: { w: PublicCard; handle: string; t: Tone; className?: string; overlay?: boolean }) {
  const T = TONE[t];
  const textOnImage = overlay && !!w.coverUrl && w.experience !== "read" && w.experience !== "listen";
  return (
    <Link href={workHref(handle, w)} className={cn("group relative block overflow-hidden rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent", className)}>
      <WorkVisual w={w} t={t} large className={cn("w-full", workForm(w) === "text" ? "min-h-28 p-4" : "aspect-[16/9] @3xl:aspect-[21/9]")} sizes="(min-width: 768px) 60vw, 92vw" />
      {textOnImage ? (
        <span className="absolute inset-x-0 bottom-0 rounded-b-2xl bg-gradient-to-t from-black/65 via-black/25 to-transparent px-3 pb-2.5 pt-8 text-white">
          <span className="block font-display text-[17px] leading-tight">{w.title}</span>
          <span className="block text-[12px] text-white/85">{w.descriptor}</span>
        </span>
      ) : (
        <span className="block px-0.5 pt-2">
          <span className={cn("block font-display text-[17px] leading-tight group-hover:underline", T.ink)}>{w.title}</span>
          <span className={cn("block text-[12px]", T.subtle)}>{w.descriptor}</span>
        </span>
      )}
    </Link>
  );
}

const WASHES = [KIT.wash.washLavender, KIT.wash.washPeach, KIT.wash.washLilacSky, KIT.wash.washRose];

/** A DejaVu: a recurring thread — its picture (or a painted wash), name and how many public pieces it holds. */
export function DejaVuTile({ d, i, handle, t, className }: { d: PublicCreatorPage["dejavus"][number]; i: number; handle: string; t: Tone; className?: string }) {
  const T = TONE[t];
  return (
    <Link href={`/p/${handle}/dejavu/${d.id}`} className={cn("group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent", className)}>
      <span className="relative block aspect-square overflow-hidden rounded-xl">
        {d.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.coverUrl} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <KitArt art={WASHES[i % WASHES.length]!} sizes="10rem" className="size-full object-cover" />
        )}
      </span>
      <span className={cn("mt-1.5 block truncate font-display text-[14px] group-hover:underline", T.ink)}>{d.name}</span>
      <span className={cn("block text-[11.5px]", T.subtle)}>
        {d.count} {d.count === 1 ? "piece" : "pieces"}
      </span>
    </Link>
  );
}

const MOMENT_ICON = { photo: StickyNote, quote: Quote, link: Link2, note: StickyNote } as const;

/** A Moment as a compact row: its picture or its kind, the first line of its words, and when (spec §13). */
export function MomentRow({ m, t }: { m: PublicCreatorPage["moments"][number]; t: Tone }) {
  const T = TONE[t];
  const face = momentFaceOf(m);
  const Icon = MOMENT_ICON[face];
  return (
    <div className="flex min-h-14 items-center gap-3 py-2">
      {m.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.imageUrl} alt="" loading="lazy" className="size-11 shrink-0 rounded-lg object-cover" />
      ) : (
        <span className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-lg", T.paper)}>
          <Icon className="size-4 opacity-70" aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[14px]", face === "quote" && "font-display italic", T.ink)}>{m.body.split("\n")[0] || "A moment"}</span>
        <span className={cn("block text-[12px]", T.subtle)}>{fmtDate(m.createdAt)}</span>
      </span>
    </div>
  );
}

/** A Moment as a paper slip (collage): words stay words, a picture stays a picture. */
export function MomentSlip({ m, t, className }: { m: PublicCreatorPage["moments"][number]; t: Tone; className?: string }) {
  const T = TONE[t];
  const face = momentFaceOf(m);
  return (
    <figure className={cn("rounded-lg p-2 shadow-[0_6px_16px_-8px_rgb(90_70_48/0.35)]", T.card, className)}>
      {m.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.imageUrl} alt="" loading="lazy" className="aspect-[4/3] w-full rounded object-cover" />
      ) : null}
      <figcaption className={cn("line-clamp-4 whitespace-pre-line px-0.5 pt-1.5", face === "quote" || face === "note" ? "font-display text-[14px] italic leading-snug" : "text-[12.5px]", T.ink)}>{m.body || "A moment"}</figcaption>
      <p className={cn("px-0.5 pt-1 text-[11px]", T.subtle)}>{fmtDate(m.createdAt)}</p>
    </figure>
  );
}

export function SectionTitle({ children, t, serif, href, className }: { children: ReactNode; t: Tone; serif?: boolean; href?: string; className?: string }) {
  const T = TONE[t];
  return (
    <div className={cn("mb-2 flex items-baseline justify-between gap-3", className)}>
      <h2 className={cn(serif ? "font-display text-[19px]" : "text-[15px] font-semibold", T.ink)}>{children}</h2>
      {href ? (
        <Link href={href} className={cn("text-[12.5px] hover:underline", T.muted)}>
          See all →
        </Link>
      ) : null}
    </div>
  );
}

export function OpenToChips({ items, t }: { items: string[]; t: Tone }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((o) => (
        <li key={o} className={cn("rounded-full px-3 py-1 text-[12.5px]", TONE[t].chip)}>
          {o}
        </li>
      ))}
    </ul>
  );
}

export function AboutBlock({ data, t }: { data: PublicCreatorPage; t: Tone }) {
  const T = TONE[t];
  return (
    <div className="space-y-1.5">
      {data.creator.bio ? <p className={cn("whitespace-pre-line text-[14px] leading-relaxed", T.ink)}>{data.creator.bio}</p> : null}
      {data.testimonials?.length ? (
        // Testimonials the creator chose for the page (docs/testimonials.md): in their words, newest first, no counts.
        <ul aria-label="Testimonials" className="space-y-2 pt-1">
          {data.testimonials.slice(0, 3).map((q) => (
            <li key={q.id}>
              <blockquote className={cn("font-display text-[15.5px] italic leading-snug", T.ink)}>“{q.body}”</blockquote>
              <p className={cn("mt-0.5 text-[12px]", T.muted)}>— {q.fromName}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {data.creator.location || data.links.length ? (
        <p className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]", T.muted)}>
          {data.creator.location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden /> {data.creator.location}
            </span>
          ) : null}
          {data.links.map((l) => (
            <a key={l.url} href={l.url} rel="noopener noreferrer me" target="_blank" className="inline-flex min-h-8 items-center gap-1 underline-offset-2 hover:underline">
              <ExternalLink className="size-3.5" aria-hidden /> {l.label}
            </a>
          ))}
        </p>
      ) : null}
    </div>
  );
}

export function ConversationRows({ data, t }: { data: PublicCreatorPage; t: Tone }) {
  const T = TONE[t];
  return (
    <ul className="space-y-1.5">
      {data.conversations.slice(0, 4).map((c) => (
        <li key={c.id}>
          <Link href={`/community/conversations/${c.id}`} className={cn("flex min-h-12 items-center gap-2.5 rounded-xl px-3 py-2 hover:underline", T.card)}>
            <MessagesSquare className={cn("size-4 shrink-0", T.muted)} aria-hidden />
            <span className={cn("min-w-0 flex-1 truncate text-[14px]", T.ink)}>{c.title}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Name, crafts and place — the identity every template starts from (identity is never optional). */
export function Identity({ data, t, avatar = 56, nameClass, className, statement }: { data: PublicCreatorPage; t: Tone; avatar?: number | null; nameClass?: string; className?: string; statement?: string | null }) {
  const T = TONE[t];
  return (
    <div className={className}>
      {avatar ? <Avatar name={data.creator.name} src={data.creator.avatarUrl ?? undefined} size={avatar} className="border-2 border-white/80" /> : null}
      <h1 className={cn("font-display leading-tight", T.ink, nameClass ?? "mt-2 text-[26px]")}>{data.creator.name}</h1>
      {data.creator.roles.length ? <p className={cn("mt-0.5 text-[13px]", T.muted)}>{data.creator.roles.join(" · ")}</p> : null}
      {statement ? <p className={cn("mt-2 max-w-prose whitespace-pre-line text-[14.5px] leading-relaxed", T.ink)}>{statement}</p> : null}
    </div>
  );
}

export function Counts({ counts, t, className }: { counts: PageModel["counts"]; t: Tone; className?: string }) {
  if (!counts.length) return null;
  const T = TONE[t];
  return (
    <dl className={cn("flex divide-x", t === "dark" ? "divide-white/10" : "divide-black/10", className)}>
      {counts.map((c) => (
        <div key={c.label} className="flex flex-1 flex-col-reverse px-2 text-center">
          <dt className={cn("text-[11.5px]", T.muted)}>{c.label}</dt>
          <dd className={cn("text-[17px] font-semibold tabular-nums", T.ink)}>{c.n}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The page's sections in the creator's order, each drawn by the template's own block (missing blocks are skipped). */
export function Sections({ model, blocks }: { model: PageModel; blocks: Partial<Record<PageSection, () => ReactNode>> }) {
  return <>{model.sections.map((s) => (blocks[s] ? <Fragment key={s}>{blocks[s]!()}</Fragment> : null))}</>;
}
