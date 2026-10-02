import { PROFILE_SHELVES, type ProfileShelf } from "@wonder/creator-studio/types";
import { KIT, KitArt, chipBase, cn } from "@wonder/ui";
import { AudioLines, Feather, Film, GalleryHorizontalEnd, ImageIcon, Layers, Lock, PenLine } from "lucide-react";
import Link from "next/link";
import { Waveform, surface } from "./shared";

export interface ProfileCreation {
  id: string;
  title: string;
  type: string;
  typeLabel: string;
  shelf: ProfileShelf;
  coverUrl: string | null;
  /** The opening words of writing (poems keep their line breaks). */
  excerpt: string | null;
  description: string | null;
  /** "8 pieces" · "1 min read". */
  meta: string | null;
  isPrivate: boolean;
  featured: boolean;
}

export function creationIcon(c: Pick<ProfileCreation, "type" | "shelf">, className = "size-3.5") {
  if (c.type === "poem" || c.type === "lyrics" || c.type === "spoken_word") return <Feather className={className} aria-hidden />;
  if (c.type === "carousel") return <GalleryHorizontalEnd className={className} aria-hidden />;
  const I = { series: Layers, visual: ImageIcon, audio: AudioLines, video: Film, writing: PenLine }[c.shelf];
  return <I className={className} aria-hidden />;
}

/** The Creations tab: filters that scroll sideways, then a calm two-column flow of pieces — each in its own form. */
export function CreationsTab({ base, shelf, items, isMe }: { base: string; shelf: ProfileShelf | "all"; items: ProfileCreation[]; isMe: boolean }) {
  const shown = shelf === "all" ? items : items.filter((c) => c.shelf === shelf);
  const present = new Set(items.map((c) => c.shelf));
  return (
    <div className="space-y-3">
      <nav aria-label="Kinds of work" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {PROFILE_SHELVES.filter((s) => s.value === "all" || present.has(s.value) || s.value === shelf).map((s) => (
          <Link
            key={s.value}
            href={s.value === "all" ? `${base}?tab=creations` : `${base}?tab=creations&shelf=${s.value}`}
            aria-current={s.value === shelf ? "true" : undefined}
            scroll={false}
            className={cn(chipBase, "h-7 px-3 text-[12.5px]", s.value === shelf ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-muted hover:bg-surface")}
          >
            {s.label}
          </Link>
        ))}
      </nav>
      {shown.length ? (
        <ul aria-label="Creations" className="columns-2 gap-2.5 sm:columns-3 [&>li]:mb-2.5">
          {shown.map((c) => (
            <li key={c.id} className="break-inside-avoid">
              <CreationCard c={c} isMe={isMe} />
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn(surface, "px-4 py-6 text-center text-[13.5px] text-ink-muted")}>
          {items.length ? "Nothing of this kind yet." : isMe ? "Your Creations will gather here." : "No public work yet."}{" "}
          {isMe && !items.length ? (
            <Link href="/create" className="font-medium text-accent-ink hover:underline">
              Start a Creation
            </Link>
          ) : null}
        </p>
      )}
    </div>
  );
}

function CreationCard({ c, isMe }: { c: ProfileCreation; isMe: boolean }) {
  const verse = c.type === "poem" || c.type === "lyrics" || c.type === "spoken_word";
  return (
    <article className={cn(surface, "overflow-hidden")}>
      <Link href={`/creations/${c.id}`} className="block p-2 focus-visible:outline-2 focus-visible:outline-accent">
        <p className="flex items-center gap-1.5 px-0.5 pb-1.5 text-[12px] font-medium text-ink-muted">
          <span className="text-accent-ink">{creationIcon(c)}</span>
          <span className="flex-1 truncate">{c.typeLabel}</span>
          {isMe && c.isPrivate ? (
            <span className="inline-flex items-center gap-0.5 text-ink-subtle" title="Only you can see this">
              <Lock className="size-3" aria-hidden />
              <span className="sr-only">Private</span>
            </span>
          ) : null}
        </p>
        {c.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.coverUrl} alt="" loading="lazy" className={cn("w-full rounded-xl object-cover", c.shelf === "series" || c.shelf === "visual" ? "aspect-[4/3]" : "aspect-[16/10]")} />
        ) : c.shelf === "audio" ? (
          <span className="flex items-center gap-2 rounded-xl bg-[#f1eeff] px-2.5 py-3">
            <AudioLines className="size-5 shrink-0 text-accent-ink" aria-hidden />
            <Waveform />
          </span>
        ) : c.shelf === "video" ? (
          <span className="flex aspect-[16/10] items-center justify-center rounded-xl bg-navy/90 text-white">
            <Film className="size-6" aria-hidden />
          </span>
        ) : c.excerpt ? (
          <span className={cn("relative block overflow-hidden rounded-xl bg-[#f8f3ea] px-3 py-2.5 text-ink", verse ? "whitespace-pre-line pr-10 font-display text-[14px] italic leading-snug" : "text-[13px] leading-snug")}>
            {verse ? <KitArt art={KIT.painted.leafSprigSage} sizes="3rem" className="pointer-events-none absolute -bottom-1 -right-1 h-16 w-auto opacity-75" /> : null}
            <span className="relative line-clamp-5">{c.excerpt}</span>
          </span>
        ) : null}
        <h3 className="mt-2 px-0.5 font-display text-[15px] leading-tight text-ink">{c.title}</h3>
        {c.description || c.meta ? (
          <p className="mt-0.5 px-0.5 text-[12px] leading-snug text-ink-muted">
            {c.description ? <span className="line-clamp-2">{c.description}</span> : null}
            {c.meta ? <span className="block text-ink-subtle">{c.meta}</span> : null}
          </p>
        ) : null}
      </Link>
    </article>
  );
}
