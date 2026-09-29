"use client";
import type { PublishedSnapshot } from "@wonder/creator-studio/publish";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SlideFrame } from "@/components/carousel/slide-render";
import { recordPublicEvent } from "./beacons";

/**
 * Swipe (§8): a native visual story. A finger swipes it (scroll-snap); keys and ‹ › move it; the count is announced.
 * Overlays, crops, order, typography and aspect ratio are the composed ones — words stay real text. On a wide screen
 * the slides sit on a centred stage instead of stretching. No editor controls, no permanent thumbnail rail.
 */
export function SwipeRenderer({ workId, slides, aspect, media, fullscreen, title }: { workId: string; slides: NonNullable<PublishedSnapshot["slides"]>; aspect: string; media: Record<string, string>; fullscreen: boolean; title: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const done = useRef(false);
  const n = slides.length;
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => {
      const k = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      setI(Math.max(0, Math.min(n - 1, k)));
      if (k >= n - 1 && !done.current) {
        done.current = true;
        recordPublicEvent(workId, "complete");
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [n, workId]);
  const go = (k: number) => {
    const el = track.current;
    if (!el) return;
    const to = Math.max(0, Math.min(n - 1, k));
    el.scrollTo({ left: to * el.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  return (
    <section
      aria-roledescription="carousel"
      aria-label={title}
      className="relative mx-auto w-full"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          go(i + 1);
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          go(i - 1);
        }
      }}
    >
      <div className={fullscreen ? "mx-auto w-full max-w-[min(100%,calc(86dvh*0.8))]" : "mx-auto w-full max-w-[min(100%,calc(72dvh*0.8),30rem)]"}>
        <div
          ref={track}
          tabIndex={0}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-2xl [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-accent"
          aria-label={`Slide ${i + 1} of ${n}. Use the arrow keys to move.`}
        >
          {slides.map((s, k) => (
            <div key={k} role="group" aria-roledescription="slide" aria-label={`${k + 1} of ${n}`} className="w-full shrink-0 snap-center">
              <SlideFrame image={s.objectId ? (media[s.objectId] ?? null) : null} overlay={s.overlay} text={s.text} transform={s.transform} aspect={aspect} className="w-full" />
              {/* The words stay real, readable text even when drawn on the image. */}
              {!s.overlay.enabled && s.text.trim() ? <p className="whitespace-pre-line px-1 pt-3 font-display text-[16px] leading-snug">{s.text}</p> : <p className="sr-only">{s.text}</p>}
            </div>
          ))}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        Slide {i + 1} of {n}
      </p>
      {n > 1 ? (
        <>
          <button type="button" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous slide" className="absolute left-0 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/5 disabled:opacity-30 md:inline-flex lg:-left-4">
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button type="button" onClick={() => go(i + 1)} disabled={i === n - 1} aria-label="Next slide" className="absolute right-0 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/5 disabled:opacity-30 md:inline-flex lg:-right-4">
            <ChevronRight className="size-5" aria-hidden />
          </button>
          <div className="mt-3 flex items-center justify-center gap-3 text-[12.5px] tabular-nums opacity-70">
            <span aria-hidden className="flex gap-1.5">
              {slides.map((_, k) => (
                <span key={k} className={k === i ? "size-2 rounded-full bg-current" : "size-2 rounded-full bg-current opacity-25"} />
              ))}
            </span>
            <span aria-hidden>
              {i + 1} / {n}
            </span>
          </div>
        </>
      ) : null}
    </section>
  );
}
