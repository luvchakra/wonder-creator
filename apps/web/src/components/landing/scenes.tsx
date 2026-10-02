import { BACKGROUNDS, KIT, KitArt, cn } from "@wonder/ui";
import { AudioLines, BookOpen, CalendarDays, ChevronRight, FileText, Images, Link2, Mail, Mic, NotebookPen, PenLine, Play, Radio, Sparkles, StickyNote, Users } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

/**
 * Product scenes for the landing page (docs/landing.md). Each one is drawn from the real product — its terms, its
 * layouts, its art — and is decorative: the words beside it carry the meaning, so the scenes are hidden from assistive
 * tech. Sample names and lines are illustrative content, never presented as real people's work or as testimonials.
 */

const card = "rounded-2xl border border-white/80 bg-white/90 shadow-[0_18px_40px_-22px_rgb(76_60_120/0.45)] backdrop-blur-sm";

function Drift({ children, tilt = 0, delay = 0, className, style }: { children: ReactNode; tilt?: number; delay?: number; className?: string; style?: CSSProperties }) {
  return (
    <div className={cn("absolute motion-safe:animate-[drift_9s_ease-in-out_infinite]", className)} style={{ ["--tilt" as string]: `${tilt}deg`, transform: `rotate(${tilt}deg)`, animationDelay: `${delay}s`, ...style }}>
      {children}
    </div>
  );
}

function Wave({ bars = 18, className }: { bars?: number; className?: string }) {
  return (
    <span className={cn("flex h-5 items-center gap-[2px]", className)}>
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} className="w-[3px] rounded-full bg-current" style={{ height: `${30 + Math.round(Math.abs(Math.sin(i * 1.7)) * 70)}%` }} />
      ))}
    </span>
  );
}

/* --------------------------------------------------------------------------------------------- Hero composition */

/** A note, a photograph, a voice memo and a memory drifting toward one finished Creation. */
export function HeroScene() {
  return (
    <div aria-hidden className="relative mx-auto aspect-[10/11] w-full max-w-[34rem] select-none sm:aspect-[1/1]">
      <KitArt art={KIT.wash.washLavender} priority className="absolute -left-[8%] top-[4%] w-[70%] opacity-70" />
      <KitArt art={KIT.wash.washPeach} priority className="absolute -right-[6%] bottom-[2%] w-[72%] opacity-75" />
      <KitArt art={KIT.painted.flowerBranch} sizes="12rem" className="absolute -right-[2%] -top-[2%] w-[30%] opacity-90" />

      {/* Threads from each piece toward the Creation. */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full text-accent/35">
        <path d="M22 30 C 40 42, 46 52, 58 62" fill="none" stroke="currentColor" strokeWidth="0.35" strokeDasharray="1.2 1.4" />
        <path d="M78 22 C 72 40, 70 50, 66 58" fill="none" stroke="currentColor" strokeWidth="0.35" strokeDasharray="1.2 1.4" />
        <path d="M14 70 C 30 70, 42 70, 52 72" fill="none" stroke="currentColor" strokeWidth="0.35" strokeDasharray="1.2 1.4" />
      </svg>

      <Drift tilt={-5} className="left-[2%] top-[6%] w-[42%]">
        <figure className={cn(card, "p-1.5")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BACKGROUNDS.coastalVillage} alt="" width={640} height={480} fetchPriority="high" className="aspect-[4/3] w-full rounded-xl object-cover" />
          <figcaption className="flex items-center gap-1 px-1 pb-0.5 pt-1.5 text-[10.5px] text-ink-muted">
            <Images className="size-3" /> Photo · Saturday evening
          </figcaption>
        </figure>
      </Drift>

      <Drift tilt={4} delay={-2} className="right-[3%] top-[8%] w-[40%]">
        <div className={cn(card, "bg-[#fffaf2]/95 p-3")}>
          <p className="flex items-center gap-1 text-[10.5px] font-medium text-ink-subtle">
            <StickyNote className="size-3" /> Note
          </p>
          <p className="mt-1 font-display text-[clamp(12px,3.3vw,15px)] italic leading-snug text-ink">The harbour sounded like a held breath.</p>
        </div>
      </Drift>

      <Drift tilt={-2} delay={-4} className="left-[0%] top-[60%] w-[46%]">
        <div className={cn(card, "flex items-center gap-2 px-2.5 py-2")}>
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink">
            <Mic className="size-3.5" />
          </span>
          <Wave bars={14} className="flex-1 text-accent/70" />
          <span className="text-[10.5px] tabular-nums text-ink-subtle">0:42</span>
        </div>
      </Drift>

      <Drift tilt={2} delay={-6} className="right-[-2%] top-[40%] w-[38%]">
        <div className={cn(card, "px-2.5 py-2")}>
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#b4533f]">
            <Sparkles className="size-3" /> DejaVu
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-ink">Harbours · a thread through 6 Moments</p>
        </div>
      </Drift>

      {/* The Creation: a carousel slide made from the pieces. */}
      <Drift tilt={1.5} delay={-1} className="left-[30%] top-[52%] w-[56%]">
        <div className={cn(card, "overflow-hidden p-0 shadow-[0_30px_60px_-28px_rgb(76_60_120/0.6)]")}>
          <div className="relative aspect-[4/5]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BACKGROUNDS.sunsetCoast} alt="" width={640} height={800} className="absolute inset-0 size-full object-cover" />
            <span className="absolute inset-0 bg-gradient-to-t from-[#1e1b4b]/70 via-transparent to-transparent" />
            <p className="absolute inset-x-3 bottom-8 font-display text-[clamp(15px,4.4vw,22px)] leading-tight text-white">The town that waits for the tide</p>
            <span className="absolute bottom-3 left-3 flex gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className={cn("h-1 rounded-full", i === 0 ? "w-4 bg-white" : "w-1 bg-white/60")} />
              ))}
            </span>
          </div>
          <p className="flex items-center justify-between px-2.5 py-1.5 text-[10.5px] text-ink-muted">
            <span className="font-medium text-ink">Creation · Carousel</span>
            <span>5 slides</span>
          </p>
        </div>
      </Drift>
    </div>
  );
}

/* --------------------------------------------------------------------------------------------- Your world */

export function IdeasScene() {
  return (
    <div aria-hidden className="relative h-full overflow-hidden rounded-[1.4rem] bg-[#fffaf2] p-4">
      <KitArt art={KIT.texture.texturePaper} className="absolute inset-0 size-full object-cover opacity-40" />
      <ul className="relative space-y-2.5">
        {["A film about tides, told in five photographs", "What my grandmother's kitchen sounded like", "Poems that only work read aloud"].map((t, i) => (
          <li key={t} className="flex gap-2">
            <span className="mt-[0.45em] size-1.5 shrink-0 rounded-full" style={{ background: ["#9b7bd8", "#e8a58b", "#7fb3a1"][i] }} />
            <span className="font-display text-[15px] italic leading-snug text-ink">{t}</span>
          </li>
        ))}
      </ul>
      <KitArt art={KIT.painted.lavenderSprig} sizes="6rem" className="absolute -bottom-3 -right-2 w-20 opacity-90" />
    </div>
  );
}

export function MaterialsScene() {
  const tile = "relative overflow-hidden rounded-xl";
  return (
    <div aria-hidden className="grid h-full grid-cols-3 grid-rows-2 gap-1.5">
      <div className={cn(tile, "col-span-2 row-span-1")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BACKGROUNDS.mistyMountains} alt="" loading="lazy" width={480} height={240} className="size-full object-cover" />
      </div>
      <div className={cn(tile, "flex flex-col items-center justify-center gap-1 bg-accent-soft/70 text-accent-ink")}>
        <AudioLines className="size-5" />
        <span className="text-[10px]">Voice memo</span>
      </div>
      <div className={cn(tile, "flex flex-col justify-between bg-white p-2")}>
        <FileText className="size-4 text-ink-subtle" />
        <span className="text-[10px] leading-tight text-ink-muted">Script draft.pdf</span>
      </div>
      <div className={tile}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BACKGROUNDS.leafShadow} alt="" loading="lazy" width={240} height={240} className="size-full object-cover" />
      </div>
      <div className={cn(tile, "flex flex-col justify-between bg-[#eef6f2] p-2")}>
        <Link2 className="size-4 text-[#2f7a62]" />
        <span className="text-[10px] leading-tight text-ink-muted">A talk you saved</span>
      </div>
    </div>
  );
}

export function MomentsScene() {
  return (
    <div aria-hidden className="h-full divide-y divide-border-soft overflow-hidden rounded-[1.4rem] border border-border-soft bg-white/90">
      <p className="flex items-center gap-2 px-3 py-2.5 text-[12.5px] text-ink-subtle">
        <NotebookPen className="size-4 text-accent" /> Share a thought…
      </p>
      {[
        ["Morning fog, the fishing boats as commas.", "You"],
        ["Trying a quieter palette — ochre, slate, one red.", "Maya"],
        ["Does anyone else hear line breaks when they walk?", "Dev"],
      ].map(([t, who]) => (
        <p key={t} className="flex items-center gap-2 px-3 py-2">
          <span className="min-w-0 flex-1 truncate font-display text-[13.5px] italic text-ink">{t}</span>
          <span className="shrink-0 text-[10.5px] text-ink-subtle">{who}</span>
        </p>
      ))}
    </div>
  );
}

export function DejaVuScene() {
  return (
    <div aria-hidden className="relative h-full overflow-hidden rounded-[1.4rem] bg-[linear-gradient(160deg,#fdf1ec_0%,#f4eefc_100%)] p-4">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#b4533f]">DejaVu</p>
      <p className="mt-1 font-display text-[17px] leading-snug text-ink">Light through water</p>
      <div className="mt-3 flex -space-x-3">
        {[BACKGROUNDS.archesSea, BACKGROUNDS.botanicalLeaves, BACKGROUNDS.waves].map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt="" loading="lazy" width={120} height={120} className="size-14 rounded-xl border-2 border-white object-cover shadow-sm" style={{ transform: `rotate(${(i - 1) * 5}deg)` }} />
        ))}
      </div>
      <p className="mt-3 text-[11.5px] leading-snug text-ink-muted">A photo, a note and a voice memo kept months apart, joined by one thread you named.</p>
    </div>
  );
}

export function SourcesScene() {
  const rows: Array<[typeof Mail, string, string]> = [
    [NotebookPen, "Notes", "3 worth a look"],
    [Images, "Photos", "A day you kept in photos"],
    [CalendarDays, "Calendar", "Trip to Goa"],
    [Mail, "Gmail", "Connect"],
  ];
  return (
    <ul aria-hidden className="h-full divide-y divide-border-soft overflow-hidden rounded-[1.4rem] border border-border-soft bg-white/90">
      {rows.map(([Icon, name, note]) => (
        <li key={name} className="flex items-center gap-2.5 px-3 py-2.5">
          <span className="grid size-7 place-items-center rounded-lg bg-surface-muted text-ink-muted">
            <Icon className="size-3.5" />
          </span>
          <span className="flex-1 text-[13px] font-medium text-ink">{name}</span>
          <span className={cn("text-[11px]", note === "Connect" ? "font-medium text-accent-ink" : "text-ink-subtle")}>{note}</span>
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------------------------------------------------------------------- Studio */

/** CreativeStudio: the canvas leads, Sources stay one tap away, CreativeMind offers one connection. */
export function StudioScene() {
  return (
    <div aria-hidden className="relative overflow-hidden rounded-[1.8rem] border border-white/80 bg-[#fbf8f4] p-3 shadow-[0_40px_80px_-40px_rgb(76_60_120/0.55)] sm:p-4">
      <div className="flex items-center justify-between px-1 pb-2.5">
        <p className="font-display text-[15px] text-ink sm:text-[17px]">The town that waits for the tide</p>
        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-ink shadow-sm">
          <BookOpen className="size-3 text-accent" /> Sources 4
        </span>
      </div>
      <div className="grid grid-cols-[1.2fr_1fr] gap-2.5">
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BACKGROUNDS.coastalVillage} alt="" loading="lazy" width={480} height={600} className="size-full object-cover" />
          <span className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <p className="absolute inset-x-2.5 bottom-2.5 font-display text-[13px] leading-tight text-white sm:text-[16px]">Every evening the boats come back like commas.</p>
        </div>
        <div className="flex flex-col gap-2">
          {[BACKGROUNDS.sunsetCoast, BACKGROUNDS.archesSea].map((src) => (
            <div key={src} className="relative flex-1 overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" width={320} height={240} className="size-full object-cover" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2.5 flex items-start gap-2.5 rounded-xl border border-accent/15 bg-white/95 p-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink">
          <Sparkles className="size-3.5" />
        </span>
        <p className="flex-1 text-[12px] leading-snug text-ink">
          <span className="font-medium">CreativeMind</span> · These two photos share the same evening light.
        </p>
        <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-white">Use together</span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------------------------- Together */

export function PulseScene() {
  return (
    <div aria-hidden className="space-y-2">
      <div className="rounded-2xl border border-border-soft bg-white/95 p-3">
        <p className="text-[11px] font-medium text-accent-ink">Maya would like feedback</p>
        <p className="mt-0.5 font-display text-[15px] leading-snug text-ink">Does my opening shot hold for three seconds?</p>
        <p className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-accent-ink">
          Offer a thought <ChevronRight className="size-3" />
        </p>
      </div>
      <div className="rounded-2xl border border-border-soft bg-white/80 p-3">
        <p className="text-[11px] text-ink-subtle">Discuss · Dev</p>
        <p className="mt-0.5 font-display text-[14px] leading-snug text-ink">Reading aloud changes the line breaks</p>
      </div>
    </div>
  );
}

export function CommunityScene() {
  return (
    <div aria-hidden className="overflow-hidden rounded-2xl border border-border-soft bg-white/95">
      <div className="relative h-24">
        <KitArt art={KIT.wash.washLavender} className="absolute inset-0 size-full object-cover" />
        <KitArt art={KIT.painted.lavenderSprig} sizes="8rem" className="absolute -bottom-4 right-1 h-[110%] w-auto" />
        <span className="absolute inset-0 bg-gradient-to-t from-[#1e1b4b]/55 to-transparent" />
        <p className="absolute bottom-2 left-3 font-display text-[17px] text-white">Poetry &amp; Spoken Word</p>
      </div>
      <ul className="divide-y divide-border-soft">
        {["Poets who record: which mic?", "Does this ending land?"].map((t) => (
          <li key={t} className="flex items-center justify-between px-3 py-2">
            <span className="font-display text-[13.5px] text-ink">{t}</span>
            <ChevronRight className="size-3.5 text-ink-subtle" />
          </li>
        ))}
      </ul>
      <p className="flex items-center justify-between px-3 py-2 text-[11.5px]">
        <span className="text-ink-subtle">Open community</span>
        <span className="rounded-full bg-accent px-2.5 py-0.5 font-medium text-white">Join</span>
      </p>
    </div>
  );
}

export function HuddleScene() {
  return (
    <div aria-hidden className="relative overflow-hidden rounded-2xl bg-[#1f1b2e] p-3 text-white">
      <KitArt art={KIT.overlay.overlayBlushOrb} className="absolute -right-10 -top-10 w-40 opacity-50" />
      <p className="relative inline-flex items-center gap-1.5 rounded-full bg-[#c42f3a] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide">
        <Radio className="size-3" /> Live
      </p>
      <p className="relative mt-2 font-display text-[16px] leading-snug">Light and shadow, read aloud</p>
      <div className="relative mt-3 flex items-center gap-2">
        <span className="flex -space-x-2">
          {["#c9b6f2", "#f4c3b0", "#a9d6c4", "#f2dca0"].map((c) => (
            <span key={c} className="size-7 rounded-full border-2 border-[#1f1b2e]" style={{ background: c }} />
          ))}
        </span>
        <Wave bars={12} className="text-white/60" />
      </div>
      <p className="relative mt-2.5 text-[11px] text-white/70">When it ends, only what you choose to keep stays.</p>
    </div>
  );
}

/* --------------------------------------------------------------------------------------------- Publish */

/** A public Creator Page, framed like a browser window. */
export function CreatorPageScene() {
  return (
    <div aria-hidden className="overflow-hidden rounded-[1.6rem] border border-white/80 bg-white shadow-[0_40px_80px_-40px_rgb(76_60_120/0.55)]">
      <div className="flex items-center gap-1.5 border-b border-border-soft bg-[#f7f3ee] px-3 py-2">
        {["#f0b8a8", "#f2d79b", "#b9dcc8"].map((c) => (
          <span key={c} className="size-2 rounded-full" style={{ background: c }} />
        ))}
        <span className="ml-2 truncate rounded-full bg-white px-3 py-0.5 text-[10.5px] text-ink-subtle">wondercreator · /p/maya</span>
      </div>
      <div className="relative h-28 sm:h-36">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BACKGROUNDS.terraceLaptop} alt="" loading="lazy" width={800} height={300} className="size-full object-cover" />
        <span className="absolute inset-0 bg-gradient-to-t from-white via-white/10 to-transparent" />
      </div>
      <div className="-mt-6 px-4 pb-4">
        <span className="relative block size-12 rounded-full border-[3px] border-white bg-[linear-gradient(135deg,#c9b6f2,#f4c3b0)] shadow-sm" />
        <p className="mt-1.5 font-display text-[20px] text-ink">Maya Torres</p>
        <p className="text-[11.5px] text-ink-muted">Photographs and short films about the coast</p>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {[BACKGROUNDS.coastalVillage, BACKGROUNDS.mistyMountains, BACKGROUNDS.archesSea].map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" loading="lazy" width={200} height={200} className="aspect-square w-full rounded-lg object-cover" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Published Creations in their own forms — words stay words, sound stays sound. */
export function FormatsScene() {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-2.5">
      <div className="relative col-span-1 row-span-2 overflow-hidden rounded-2xl bg-[#fffaf2] p-4">
        <KitArt art={KIT.texture.texturePaper} className="absolute inset-0 size-full object-cover opacity-40" />
        <p className="relative text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">Writing · Poem</p>
        <p className="relative mt-2 whitespace-pre-line font-display text-[14px] italic leading-relaxed text-ink">{"The train arrives\nbefore the sentence ends.\n\nI stay a little longer,\nlistening for the rest."}</p>
      </div>
      <div className="relative overflow-hidden rounded-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BACKGROUNDS.sunsetCoast} alt="" loading="lazy" width={320} height={320} className="aspect-square w-full object-cover" />
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-10 place-items-center rounded-full bg-white/90 text-ink shadow">
            <Play className="ml-0.5 size-4" />
          </span>
        </span>
        <span className="absolute bottom-1.5 left-2 text-[10px] font-medium text-white drop-shadow">Video · 2:38</span>
      </div>
      <div className="flex flex-col justify-between rounded-2xl bg-[linear-gradient(150deg,#ece6fb,#fde9e0)] p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">Audio</p>
        <Wave bars={16} className="text-accent" />
        <p className="text-[11.5px] text-ink">Harbour at 6am</p>
      </div>
      <div className="relative col-span-2">
        <div className="flex gap-1.5">
          {[BACKGROUNDS.coastalVillage, BACKGROUNDS.botanicalLeaves, BACKGROUNDS.pastelClouds].map((src, i) => (
            <div key={src} className="relative aspect-[4/5] flex-1 overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" width={200} height={250} className="size-full object-cover" />
              {i === 0 ? <span className="absolute inset-x-2 bottom-2 font-display text-[12px] leading-tight text-white drop-shadow">Five ways to see the tide</span> : null}
            </div>
          ))}
        </div>
        <p className="mt-1.5 px-0.5 text-[10.5px] text-ink-subtle">Carousel · 5 slides</p>
      </div>
    </div>
  );
}

export const STEP_ICON = { capture: PenLine, discover: Sparkles, explore: Images, create: BookOpen, refine: FileText, share: Users } as const;
