"use client";
import { BACKGROUNDS, buttonClasses } from "@wonder/ui";
import { Camera, ImagePlus, Mic, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMeTalk } from "@/components/creative-palette";

/** Home Canvas with nothing in progress yet (UI redesign §8 empty state): an editorial card and four ways to begin. */
export function HomeBegin({ hasMaterials }: { hasMaterials: boolean }) {
  const openMeTalk = useMeTalk();
  return (
    <section aria-labelledby="begin" className="overflow-hidden rounded-3xl border border-border-soft bg-surface shadow-[var(--shadow-card)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BACKGROUNDS.botanicalLeaves} alt="" className="h-40 w-full object-cover sm:h-52" />
      <div className="space-y-4 p-5 sm:p-6">
        <h2 id="begin" className="font-display text-2xl text-ink">
          What would you like to begin with?
        </h2>
        <p className="text-[15px] text-ink-muted">
          {hasMaterials ? "Your Materials are here — turn one into something, or start fresh." : "A photograph, a note, a voice memo or a single line is enough to start."} Everything is also in the Palette, in the corner.
        </p>
        <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 [&>*]:whitespace-nowrap">
          <Link href="/create" className={buttonClasses({ variant: "primary" })}>
            <Sparkles className="size-4" aria-hidden /> New Creation
          </Link>
          <Link href="/send" className={buttonClasses({ variant: "secondary" })}>
            <ImagePlus className="size-4" aria-hidden /> Bring Material
          </Link>
          <Link href="/send" className={buttonClasses({ variant: "secondary" })}>
            <Camera className="size-4" aria-hidden /> Capture
          </Link>
          <button type="button" onClick={openMeTalk} className={buttonClasses({ variant: "secondary" })}>
            <Mic className="size-4" aria-hidden /> meTalk
          </button>
        </div>
      </div>
    </section>
  );
}
