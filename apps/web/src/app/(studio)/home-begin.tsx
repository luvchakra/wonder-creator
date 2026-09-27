"use client";
import { KIT, KitArt, KitPlusIcon, KitSparklesIcon, buttonClasses } from "@wonder/ui";
import Link from "next/link";

/**
 * Home Canvas with nothing in progress yet (UI redesign §8 empty state): a compact editorial card with one primary way
 * to begin and one secondary (interaction-minimalism §24: Create first; Capture and meTalk live in the Palette → Create).
 */
export function HomeBegin({ hasMaterials }: { hasMaterials: boolean }) {
  return (
    <section aria-labelledby="begin" className="overflow-hidden rounded-2xl border border-border-soft bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
      {/* Vector Kit: a painted coastal vignette on a soft wash — calm, not a photo wall. */}
      <div aria-hidden className="relative flex h-32 items-end justify-center overflow-hidden bg-[linear-gradient(180deg,#fdf2e6_0%,#fbf5ee_100%)] sm:h-40">
        <KitArt art={KIT.wash.washLilacSky} className="pointer-events-none absolute -left-16 -top-24 h-56 w-auto opacity-25" />
        <KitArt art={KIT.painted.coastalVignette} sizes="(min-width: 640px) 30rem, 80vw" priority className="relative h-auto w-[80%] max-w-md" />
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        <h2 id="begin" className="font-display text-xl text-ink">
          What would you like to begin with?
        </h2>
        <p className="text-sm text-ink-muted">{hasMaterials ? "Your Materials are here — turn one into something, or start fresh." : "A photograph, a note, a voice memo or a single line is enough to start."}</p>
        <div className="flex flex-wrap gap-2 [&>*]:whitespace-nowrap">
          <Link href="/create" className={buttonClasses({ variant: "primary", size: "sm" })}>
            <KitSparklesIcon size={16} /> New Creation
          </Link>
          <Link href="/send" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            <KitPlusIcon size={16} /> Bring Material
          </Link>
        </div>
      </div>
    </section>
  );
}
