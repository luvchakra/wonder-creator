import { BACKGROUNDS, KIT, KitArt, buttonClasses, cn } from "@wonder/ui";
import { ArrowDown, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  CommunityScene,
  CreatorPageScene,
  DejaVuScene,
  FormatsScene,
  HeroScene,
  HuddleScene,
  IdeasScene,
  MaterialsScene,
  MomentsScene,
  PulseScene,
  SourcesScene,
  STEP_ICON,
  StudioScene,
} from "@/components/landing/scenes";
import { SiteFooter, SiteHeader } from "@/components/public/site-chrome";

export const metadata: Metadata = {
  title: { absolute: "Wonder Creator — Everything begins with a little wonder" },
  description: "A personal creative universe. Bring your thoughts, photographs, voice notes and memories together, and turn them into Creations worth sharing.",
};

/**
 * Public landing page (owner brief, 2 Oct 2026; docs/landing.md) — what signed-out visitors see at `/`. An expressive
 * surface: one dominant action (Start Creating), editorial type, product scenes drawn from the real app, quiet motion
 * that stops for reduced motion. Privacy, security and terms live in the footer, linking to the real pages.
 */

const WORLD = [
  { key: "ideas", title: "Ideas", line: "The half-formed ones too. Keep them before they drift away.", Scene: IdeasScene, span: "lg:col-span-1" },
  { key: "materials", title: "Materials", line: "Photos, voice memos, documents and links — private until you share.", Scene: MaterialsScene, span: "lg:col-span-2" },
  { key: "moments", title: "Moments", line: "Everyday fragments in your Scrapbook, in the order they happened.", Scene: MomentsScene, span: "lg:col-span-1" },
  { key: "dejavu", title: "DejaVu", line: "Threads you name — a place, a person, a feeling — across time.", Scene: DejaVuScene, span: "lg:col-span-1" },
  { key: "sources", title: "Your sources", line: "Notes, photos, calendar and mail. Sync discovers; you decide what comes in.", Scene: SourcesScene, span: "lg:col-span-1" },
] as const;

const JOURNEY = [
  { key: "capture", name: "Capture", line: "A note, a voice memo, a photo or a link — in a moment." },
  { key: "discover", name: "Discover", line: "CreativeMind notices how your pieces connect. Suggestions only." },
  { key: "explore", name: "Explore", line: "Look at a few directions before you choose one." },
  { key: "create", name: "Create", line: "Bring sources into CreativeStudio and shape them on the canvas." },
  { key: "refine", name: "Refine", line: "Every version kept. Compare, restore, keep going." },
  { key: "share", name: "Share", line: "Publish to your Creator Page, or ask Pulse what they think." },
] as const;

const FORMATS = ["Writing", "Carousel", "Images", "Video", "Audio", "Presentation"] as const;

const eyebrow = "text-[12px] font-semibold uppercase tracking-[0.18em] text-accent-ink";
const h2 = "font-display text-[34px] leading-[1.05] tracking-[-0.01em] text-ink [text-wrap:balance] sm:text-[48px] lg:text-[56px]";
const lede = "mt-3 max-w-[34rem] text-[16px] leading-relaxed text-ink-muted sm:text-[18px]";

export default function WelcomePage() {
  return (
    <div className="relative min-h-dvh overflow-x-clip bg-cream text-ink">
      <KitArt art={KIT.texture.texturePaper} priority className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[140vh] w-full object-cover opacity-[0.35]" />

      <SiteHeader />

      <main id="main" className="relative z-10">
        {/* 1 · Hero */}
        <section aria-labelledby="hero-title" className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-16 pt-8 sm:px-6 sm:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:pb-24">
          <div className="max-w-xl motion-safe:animate-[rise_600ms_ease-out_both]">
            <p className={eyebrow}>A personal creative universe</p>
            <h1 id="hero-title" className="mt-4 font-display text-[46px] leading-[0.98] tracking-[-0.02em] text-ink [text-wrap:balance] sm:text-[64px] lg:text-[76px]">
              Everything begins with a little <em className="text-brand-gradient pr-1 italic">wonder</em>.
            </h1>
            <p className="mt-5 max-w-[30rem] text-[17px] leading-relaxed text-ink-muted sm:text-[19px]">
              A thought. A photograph. A forgotten memory. Bring the pieces of your world together and turn them into something extraordinary.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link href="/sign-up" data-primary-action className={cn(buttonClasses({ size: "lg" }), "px-7 shadow-[0_14px_30px_-12px_rgb(110_86_207/0.6)]")}>
                Start Creating <ArrowRight className="size-4" aria-hidden />
              </Link>
              <a href="#world" className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium text-ink-muted hover:text-ink">
                Explore Wonder Creator <ArrowDown className="size-4" aria-hidden />
              </a>
            </div>
          </div>
          <HeroScene />
        </section>

        {/* 2 · Your world */}
        <section id="world" aria-labelledby="world-title" className="relative scroll-mt-6">
          <KitArt art={KIT.botanical.botanicalSprig3} sizes="14rem" className="pointer-events-none absolute -left-10 top-10 hidden w-48 opacity-60 lg:block" />
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="max-w-2xl">
              <p className={eyebrow}>Your world</p>
              <h2 id="world-title" className={cn(h2, "mt-3")}>
                Your world is full of <em className="italic">inspiration</em>.
              </h2>
              <p className={lede}>Ordinary days hold more than they seem. Wonder Creator keeps the pieces, and helps you see them together.</p>
            </div>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {WORLD.map(({ key, title, line, Scene, span }) => (
                <li key={key} className={cn("flex flex-col gap-3 rounded-[1.8rem] border border-white/80 bg-white/55 p-3 shadow-[0_24px_50px_-36px_rgb(76_60_120/0.45)] backdrop-blur-sm", span)}>
                  <div className="h-48 sm:h-52">
                    <Scene />
                  </div>
                  <div className="px-1.5 pb-1.5">
                    <h3 className="font-display text-[22px] leading-tight text-ink">{title}</h3>
                    <p className="mt-1 text-[14.5px] leading-snug text-ink-muted">{line}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 3 · From inspiration to Creation */}
        <section aria-labelledby="journey-title" className="relative isolate overflow-hidden bg-[linear-gradient(180deg,transparent_0%,#f6f0fb_18%,#fbf1ea_100%)]">
          <KitArt art={KIT.wash.washLilacSky} className="pointer-events-none absolute -right-40 top-20 -z-10 w-[42rem] opacity-50" />
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="max-w-2xl">
              <p className={eyebrow}>The journey</p>
              <h2 id="journey-title" className={cn(h2, "mt-3")}>
                From inspiration to <em className="italic">Creation</em>.
              </h2>
            </div>
            <ol className="relative mt-10 grid gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-6">
              <span aria-hidden className="absolute left-[5%] right-[5%] top-[1.375rem] hidden h-px bg-gradient-to-r from-accent/10 via-accent/40 to-[#e8a58b]/40 lg:block" />
              {JOURNEY.map((s, i) => {
                const Icon = STEP_ICON[s.key];
                return (
                  <li key={s.key} className="relative flex gap-3 lg:flex-col lg:gap-3">
                    <span className="relative grid size-11 shrink-0 place-items-center rounded-full border border-white bg-white text-accent-ink shadow-[0_10px_24px_-14px_rgb(76_60_120/0.6)]">
                      <Icon className="size-[18px]" aria-hidden />
                    </span>
                    <div>
                      <p className="text-[12px] tabular-nums text-ink-subtle">0{i + 1}</p>
                      <h3 className="font-display text-[21px] leading-tight text-ink">{s.name}</h3>
                      <p className="mt-1 text-[14px] leading-snug text-ink-muted">{s.line}</p>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="mt-14 grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
              <div className="max-w-md">
                <h3 className="font-display text-[28px] leading-tight text-ink sm:text-[36px]">
                  CreativeStudio, with <em className="italic">CreativeMind</em> beside you.
                </h3>
                <p className="mt-3 text-[16px] leading-relaxed text-ink-muted">
                  The canvas leads. Your sources stay one tap away. CreativeMind offers one useful connection at a time — and only works on what you choose to bring in.
                </p>
                <ul aria-label="Creation formats" className="mt-5 flex flex-wrap gap-2">
                  {FORMATS.map((f) => (
                    <li key={f} className="rounded-full border border-white bg-white/80 px-3.5 py-1.5 text-[13px] font-medium text-ink shadow-sm">
                      {f}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[13px] text-ink-subtle">Change the format as you go — your sources come with you.</p>
              </div>
              <StudioScene />
            </div>
          </div>
        </section>

        {/* 4 · Together */}
        <section aria-labelledby="together-title" className="relative">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="max-w-2xl">
              <p className={eyebrow}>Together</p>
              <h2 id="together-title" className={cn(h2, "mt-3")}>
                Creativity is better when <em className="italic">shared</em>.
              </h2>
              <p className={lede}>Ask for feedback, find people who love what you love, and talk it through live. No likes, no trending, no ranking — just people making things.</p>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                { title: "Pulse", kicker: "The open square", line: "Open Conversations across Wonder Creator: ask, offer a thought, discover someone's work.", Scene: PulseScene },
                { title: "Communities", kicker: "Places you belong", line: "Lasting, interest-based communities anyone can join, with a Forum of topics and posts.", Scene: CommunityScene },
                { title: "Huddles", kicker: "Talk it through, live", line: "Small live sessions that start from a topic and end when everyone leaves.", Scene: HuddleScene },
              ].map(({ title, kicker, line, Scene }) => (
                <article key={title} className="flex flex-col gap-4 rounded-[1.8rem] bg-[linear-gradient(170deg,#ffffff_0%,#faf5ef_100%)] p-4 shadow-[0_24px_50px_-36px_rgb(76_60_120/0.45)] sm:p-5">
                  <div>
                    <p className="text-[12px] font-medium text-ink-subtle">{kicker}</p>
                    <h3 className="font-display text-[26px] leading-tight text-ink">{title}</h3>
                    <p className="mt-1.5 text-[14.5px] leading-snug text-ink-muted">{line}</p>
                  </div>
                  <div className="mt-auto">
                    <Scene />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 5 · Publish */}
        <section aria-labelledby="publish-title" className="relative isolate overflow-hidden">
          <KitArt art={KIT.wash.washPeach} className="pointer-events-none absolute -left-40 top-24 -z-10 w-[40rem] opacity-60" />
          <KitArt art={KIT.painted.blossomSprig} sizes="10rem" className="pointer-events-none absolute right-6 top-10 -z-10 hidden w-32 opacity-80 lg:block" />
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="max-w-2xl">
              <p className={eyebrow}>CreatorPublish</p>
              <h2 id="publish-title" className={cn(h2, "mt-3")}>
                Give your Creations a <em className="italic">beautiful home</em>.
              </h2>
              <p className={lede}>A public Creator Page in a template that suits your work, and each published Creation shown in its own form.</p>
            </div>
            <div className="mt-10 grid items-start gap-6 lg:grid-cols-[1.1fr_1fr]">
              <CreatorPageScene />
              <FormatsScene />
            </div>
          </div>
        </section>

        {/* 6 · Final call */}
        <section aria-labelledby="final-title" className="relative isolate overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BACKGROUNDS.pastelClouds} alt="" loading="lazy" width={1920} height={1080} className="absolute inset-0 -z-10 size-full object-cover" />
          <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-cream via-cream/40 to-cream/70" />
          <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:py-32">
            <KitArt art={KIT.mark.sparklePurple} sizes="3rem" className="mx-auto h-10 w-auto" />
            <h2 id="final-title" className="mt-4 font-display text-[40px] leading-[1.02] tracking-[-0.02em] text-ink [text-wrap:balance] sm:text-[64px]">
              Your next Creation is <em className="text-brand-gradient pr-1 italic">waiting</em>.
            </h2>
            <Link href="/sign-up" className={cn(buttonClasses({ size: "lg" }), "mt-8 px-8 shadow-[0_14px_30px_-12px_rgb(110_86_207/0.6)]")}>
              Start Creating <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
