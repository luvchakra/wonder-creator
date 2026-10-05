import type { DeckSlide, DeckTheme } from "@wonder/creator-studio/deck";
import { KIT, KitArt, cn } from "@wonder/ui";

/**
 * A Presentation's slide (creation-pages.md, step 4), on the Presentation page, in its strip, full screen, printed, and
 * on the published page alike. The type scales with the slide (container units). The first slide is the title; a
 * picture sits beside the words, or fills the slide behind the title when there are none.
 */
/** The named palettes (CLAUDE.md, Colour), defined once for the deck: background, ink, quieter ink, and art. */
export const THEMES: Record<DeckTheme, { surface: string; ink: string; muted: string; rule: string; art: "paper" | "dark" | "wash" }> = {
  paper: { surface: "bg-[#f6efe3]", ink: "text-[#2b241c]", muted: "text-[#7a6d5e]", rule: "bg-[#e2d6c3]", art: "paper" },
  cinematic: { surface: "bg-[radial-gradient(120%_90%_at_20%_10%,#2a2119_0%,#0d0b09_60%)]", ink: "text-[#f3ebe0]", muted: "text-[#cbbfae]", rule: "bg-[#e9ae6b]", art: "dark" },
  gradient: { surface: "bg-[linear-gradient(135deg,#ece8fb_0%,#f6f1f8_50%,#fbf3ee_100%)]", ink: "text-[#2a2440]", muted: "text-[#6b6380]", rule: "bg-[#c6bdf8]", art: "wash" },
};

/** One slide in its theme, at any size. With a picture: beside the words, or filling the slide when there are none. */
export function SlideView({ slide, index, theme, deckTitle, imageUrl = null, small = false, className }: { slide: Pick<DeckSlide, "title" | "body">; index: number; theme: DeckTheme; deckTitle: string; imageUrl?: string | null; small?: boolean; className?: string }) {
  const t = THEMES[theme];
  const lines = slide.body.split("\n").filter((l) => l.trim());
  const points = lines.length > 0 && lines.every((l) => /^\s*[-•*]\s+/.test(l));
  const opening = index === 0;
  // A picture with no words fills the slide, the title over it; with words, it takes the right side.
  const full = !!imageUrl && (opening || !lines.length);
  const side = !!imageUrl && !full;
  const ink = full ? "text-white" : t.ink;
  // Readable on a phone: the type scales with the slide but never below a reading size (thumbnails excepted).
  const size = small
    ? { opening: "text-[7cqw]", title: "text-[5cqw]", body: "text-[3cqw]", points: "text-[2.9cqw]", sub: "text-[2.8cqw]" }
    : { opening: "text-[max(7cqw,1.5rem)]", title: "text-[max(5cqw,1.15rem)]", body: "text-[max(3cqw,0.8rem)]", points: "text-[max(2.9cqw,0.8rem)]", sub: "text-[max(2.8cqw,0.8rem)]" };
  const muted = full ? "text-white/85" : t.muted;
  return (
    <div className={cn("@container relative isolate aspect-video w-full overflow-hidden", t.surface, className)} aria-hidden={small || undefined}>
      {full ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl!} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
          <span aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(15,12,10,0.15)_0%,rgba(15,12,10,0.65)_100%)]" />
        </>
      ) : t.art === "paper" ? (
        <>
          <KitArt art={KIT.texture.texturePaper} sizes="40rem" className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-50" />
          {side ? null : <KitArt art={KIT.painted.leafSprigSage} sizes="12rem" className="pointer-events-none absolute -bottom-[6%] -right-[3%] -z-10 h-auto w-[22%] opacity-70" />}
        </>
      ) : t.art === "wash" ? (
        <KitArt art={KIT.wash.washLavender} sizes="30rem" className="pointer-events-none absolute -right-[12%] -top-[20%] -z-10 h-auto w-[60%] opacity-70" />
      ) : null}
      {side ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl!} alt="" className="absolute inset-y-[6cqw] right-[5cqw] -z-10 h-[calc(100%-12cqw)] w-[40%] rounded-[1.5cqw] object-cover shadow-[0_2cqw_5cqw_-2cqw_rgba(0,0,0,0.45)]" />
      ) : null}
      <div className={cn("flex h-full flex-col px-[7cqw] py-[6cqw]", opening ? "items-center justify-center text-center" : full ? "justify-end" : "justify-start", side && "w-[58%] pr-[3cqw]")}>
        <p className={cn("font-display leading-[1.12] drop-shadow-sm", ink, opening ? size.opening : size.title)}>{slide.title || (opening ? deckTitle : "")}</p>
        {!opening ? <span className={cn("mt-[2cqw] block h-[0.35cqw] w-[8cqw] rounded-full", full ? "bg-white/80" : t.rule)} /> : null}
        {lines.length ? (
          points ? (
            <ul className={cn("mt-[3cqw] space-y-[1.4cqw] leading-snug", size.points, ink)}>
              {lines.map((l, i) => (
                <li key={i} className="flex gap-[1.4cqw]">
                  <span className={cn("mt-[1.1cqw] size-[0.9cqw] shrink-0 rounded-full", full ? "bg-white/80" : t.rule)} />
                  <span>{l.replace(/^\s*[-•*]\s+/, "")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={cn("mt-[3cqw] whitespace-pre-line leading-snug", opening ? cn(size.sub, muted) : cn(size.body, ink))}>{slide.body}</p>
          )
        ) : null}
      </div>
    </div>
  );
}
