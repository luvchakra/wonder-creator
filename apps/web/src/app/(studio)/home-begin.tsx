"use client";
import { KIT, KitArt, KitCameraIcon, KitMicIcon, KitPlusIcon, KitSparklesIcon, buttonClasses } from "@wonder/ui";
import Link from "next/link";
import { useMeTalk } from "@/components/creative-palette";

/** Home Canvas with nothing in progress yet (UI redesign §8 empty state): an editorial card and four ways to begin. */
export function HomeBegin({ hasMaterials }: { hasMaterials: boolean }) {
  const openMeTalk = useMeTalk();
  return (
    <section aria-labelledby="begin" className="overflow-hidden rounded-3xl border border-border-soft bg-[image:var(--gradient-card)] shadow-[var(--shadow-card)]">
      {/* Vector Kit: a painted coastal vignette on a soft wash — calm, not a photo wall. */}
      <div aria-hidden className="relative flex h-40 items-end justify-center overflow-hidden bg-[linear-gradient(180deg,#fdf2e6_0%,#fbf5ee_100%)] sm:h-52">
        <KitArt art={KIT.wash.washLilacSky} className="pointer-events-none absolute -left-16 -top-24 h-56 w-auto opacity-25" />
        <KitArt art={KIT.painted.coastalVignette} sizes="(min-width: 640px) 36rem, 90vw" priority className="relative h-auto w-[92%] max-w-xl" />
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        <h2 id="begin" className="font-display text-2xl text-ink">
          What would you like to begin with?
        </h2>
        <p className="text-[15px] text-ink-muted">
          {hasMaterials ? "Your Materials are here — turn one into something, or start fresh." : "A photograph, a note, a voice memo or a single line is enough to start."} Everything is also in the Palette, in the corner.
        </p>
        <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 [&>*]:whitespace-nowrap">
          <Link href="/create" className={buttonClasses({ variant: "primary" })}>
            <KitSparklesIcon size={18} /> New Creation
          </Link>
          <Link href="/send" className={buttonClasses({ variant: "secondary" })}>
            <KitPlusIcon size={18} /> Bring Material
          </Link>
          <Link href="/send" className={buttonClasses({ variant: "secondary" })}>
            <KitCameraIcon size={18} /> Capture
          </Link>
          <button type="button" onClick={openMeTalk} className={buttonClasses({ variant: "secondary" })}>
            <KitMicIcon size={18} /> meTalk
          </button>
        </div>
      </div>
    </section>
  );
}
