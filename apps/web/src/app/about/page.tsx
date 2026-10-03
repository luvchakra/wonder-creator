import { BACKGROUNDS, KIT, KitArt, buttonClasses, cn } from "@wonder/ui";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/public/site-chrome";

export const metadata: Metadata = {
  title: "About",
  description: "Wonder Creator is a personal creative universe: a calm place to keep the pieces of your world and turn them into Creations worth sharing.",
};

/**
 * About (owner, 3 Oct 2026). What Wonder Creator is and what it holds to — every line describes how the product works
 * today (CLAUDE.md, docs/). No founding story, team bios, numbers or quotes: nothing here is invented.
 */
const BELIEFS = [
  {
    title: "Your work stays yours",
    body: "Materials and Creations are private until you choose to share them. We don't sell personal data, show third-party ads, or use your material to train AI models.",
    art: KIT.painted.lavenderSprig,
  },
  {
    title: "CreativeMind works beside you",
    body: "It only sees what you bring in, and it suggests rather than decides. Anything touching rights, money or deletion always waits for you.",
    art: KIT.painted.blossomSprig,
  },
  {
    title: "Feedback, not applause",
    body: "No likes, no trending, no ranking. People ask for feedback, offer a thought, and make things together in Communities and Huddles.",
    art: KIT.painted.leafSprigSage,
  },
  {
    title: "Ordinary days count",
    body: "A note on the train, a photo from the harbour, a voice memo at midnight. The small pieces of life are where Creations begin.",
    art: KIT.painted.coralLeaves,
  },
] as const;

export default function AboutPage() {
  return (
    <div className="relative min-h-dvh overflow-x-clip bg-cream text-ink">
      <KitArt art={KIT.texture.texturePaper} priority className="pointer-events-none absolute inset-x-0 top-0 h-[120vh] w-full object-cover opacity-[0.35]" />
      <SiteHeader />
      <main id="main" className="relative z-10">
        <section aria-labelledby="about-title" className="relative mx-auto max-w-6xl px-4 pb-14 pt-10 sm:px-6 sm:pt-16">
          <KitArt art={KIT.wash.washLavender} priority className="pointer-events-none absolute -right-24 -top-10 w-[30rem] max-w-none opacity-60" />
          <KitArt art={KIT.painted.flowerBranch} sizes="12rem" className="pointer-events-none absolute right-2 top-6 hidden w-40 opacity-90 sm:block" />
          <p className="relative text-[12px] font-semibold uppercase tracking-[0.18em] text-accent-ink">About Wonder Creator</p>
          <h1 id="about-title" className="relative mt-4 max-w-3xl font-display text-[42px] leading-[1.02] tracking-[-0.02em] [text-wrap:balance] sm:text-[64px]">
            A quiet place where the pieces of your world become <em className="text-brand-gradient pr-1 italic">something</em>.
          </h1>
          <p className="relative mt-5 max-w-[36rem] text-[17px] leading-relaxed text-ink-muted sm:text-[19px]">
            Wonder Creator is a personal creative universe. You keep your thoughts, photographs, voice notes and memories in one place, see how they connect, and shape them into Creations — writing, carousels, images, video, audio and presentations — to keep or to share.
          </p>
        </section>

        <section aria-labelledby="beliefs-title" className="relative">
          <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
            <h2 id="beliefs-title" className="font-display text-[30px] leading-tight sm:text-[40px]">
              What we hold to
            </h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {BELIEFS.map((b) => (
                <li key={b.title} className="relative isolate overflow-hidden rounded-[1.6rem] border border-white/80 bg-white/70 p-5 shadow-[0_24px_50px_-36px_rgb(76_60_120/0.45)] backdrop-blur-sm sm:p-6">
                  <KitArt art={b.art} sizes="8rem" className="pointer-events-none absolute -bottom-4 -right-3 -z-10 h-28 w-auto opacity-70" />
                  <h3 className="font-display text-[22px] leading-snug">{b.title}</h3>
                  <p className="mt-2 max-w-[30rem] pr-10 text-[15px] leading-relaxed text-ink-muted">{b.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="about-next" className="relative isolate overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BACKGROUNDS.pastelClouds} alt="" loading="lazy" width={1920} height={1080} className="absolute inset-0 -z-10 size-full object-cover" />
          <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-cream via-cream/40 to-cream/70" />
          <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:py-28">
            <h2 id="about-next" className="font-display text-[34px] leading-tight [text-wrap:balance] sm:text-[48px]">
              Start with a single line, a photo or a <em className="italic">voice note</em>.
            </h2>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
              <Link href="/sign-up" className={cn(buttonClasses({ size: "lg" }), "px-7")}>
                Start Creating <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href="/contact" className="inline-flex min-h-11 items-center text-[15px] font-medium text-ink-muted hover:text-ink hover:underline">
                Get in touch
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
