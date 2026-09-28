"use client";
import type { CarouselView } from "@wonder/creator-brain";
import { CAROUSEL_MAX_SLIDES } from "@wonder/creator-studio/carousel";
import { cn } from "@wonder/ui";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useStripSignal } from "@/components/creative-palette";
import { SlideFrame } from "@/components/carousel/slide-render";
import { api, errorMessage } from "@/lib/client";
import { AddOneSheet, Arrange, CarouselComposer } from "../carousel/composer";

/**
 * The Carousel on the Studio canvas (owner board 8 "Canvas — creating with multiple sources"): one slide fills the
 * canvas with its words on it, "1 / N" in the corner, previous/next, and a strip of every slide with "+" to make one
 * more. Tapping the slide opens the focused Slide Editor; Arrange comes from the Studio's More sheet. Before there are
 * slides (setup, generating, a failed start) the Composer's own steps show here unchanged.
 */
export function CarouselCanvas({ artifactId, initial, arrangeRequest }: { artifactId: string; initial: CarouselView; arrangeRequest: number }) {
  const [view, setView] = useState(initial);
  const [current, setCurrent] = useState(0);
  const [adding, setAdding] = useState(false);
  const [arranging, setArranging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const strip = useStripSignal();

  // "Arrange slides" in the Studio's More sheet bumps the counter; a new value opens Arrange (adjusted while rendering).
  const [seenArrange, setSeenArrange] = useState(arrangeRequest);
  if (arrangeRequest !== seenArrange) {
    setSeenArrange(arrangeRequest);
    if (view.slides.length > 1) setArranging(true);
  }

  const refresh = useCallback(async () => {
    try {
      setView(await api<CarouselView>(`/api/v1/carousels/${artifactId}`));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [artifactId]);

  // Follow anything in flight; the page never waits on it.
  const busy = !!view.generating || view.adding > 0 || view.slides.some((s) => s.change && s.change.status !== "failed");
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [busy, refresh]);

  useEffect(() => {
    if (view.adding) strip("carousel", { text: "Creating one more slide…", tone: "active" });
    else strip("carousel", null);
    return () => strip("carousel", null);
  }, [view.adding, strip]);

  // Before there are slides, the Composer's steps (how many, generating, failed) are the canvas.
  if (!view.settings || !view.slides.length || view.generating || view.failed) {
    return <CarouselComposer artifactId={artifactId} title="" meta="" source={null} initial={view} hideHeader onView={setView} />;
  }

  if (arranging) {
    return (
      <Arrange
        artifactId={artifactId}
        slides={view.slides}
        aspect={view.settings.aspectRatio}
        onDone={async () => {
          setArranging(false);
          // A new order starts from its first slide.
          setCurrent(0);
          await refresh();
        }}
      />
    );
  }

  const n = view.slides.length;
  const idx = Math.min(current, n - 1);
  const slide = view.slides[idx]!;
  const image = slide.image?.url ?? slide.pending?.url ?? null;
  const words = slide.displayText || slide.sourceText;
  const go = (to: number) => setCurrent(((to % n) + n) % n);

  return (
    <div
      className="space-y-2"
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(idx - 1);
        if (e.key === "ArrowRight") go(idx + 1);
      }}
    >
      {/* The slide, big, as it will be seen. Tapping it opens the Slide Editor. */}
      <div className="relative overflow-hidden rounded-3xl border border-border-soft bg-surface shadow-[var(--shadow-card)]">
        <Link
          href={`/artifacts/${artifactId}/slides/${slide.id}`}
          className="block focus-visible:outline-2 focus-visible:outline-accent"
          aria-label={`Edit slide ${idx + 1} of ${n}: ${words.slice(0, 60)}`}
        >
          <SlideFrame image={image} overlay={slide.overlay} text={words} transform={slide.transform} aspect={view.settings.aspectRatio} className="max-h-[70dvh] w-full" />
        </Link>
        {!slide.overlay.enabled && words.trim() ? <p className="whitespace-pre-line px-4 py-3 font-display text-[15px] leading-snug text-ink">{words}</p> : null}
        <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/45 px-2 py-0.5 text-[11.5px] font-medium text-white backdrop-blur" aria-hidden>
          {idx + 1} / {n}
        </span>
        <p className="sr-only" aria-live="polite">
          Slide {idx + 1} of {n}
        </p>
        {n > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(idx - 1)}
              aria-label="Previous slide"
              className="absolute left-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-white/90 drop-shadow hover:bg-black/20"
            >
              <ChevronLeft className="size-6" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => go(idx + 1)}
              aria-label="Next slide"
              className="absolute right-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-white/90 drop-shadow hover:bg-black/20"
            >
              <ChevronRight className="size-6" aria-hidden />
            </button>
          </>
        ) : null}
      </div>

      {/* Every slide at a glance; "+" makes exactly one more (§7). */}
      <ol className="flex items-center gap-1.5 overflow-x-auto px-0.5 pb-1 [scrollbar-width:none]" aria-label="Slides">
        {view.slides.map((s, i) => (
          <li key={s.id} className="shrink-0">
            <button
              type="button"
              onClick={() => setCurrent(i)}
              aria-label={`Slide ${i + 1} of ${n}`}
              aria-current={i === idx ? "true" : undefined}
              className={cn(
                "block h-12 w-14 overflow-hidden rounded-lg border-2 bg-surface-muted focus-visible:outline-2 focus-visible:outline-accent",
                i === idx ? "border-accent" : "border-transparent",
              )}
            >
              {s.image?.thumbnailUrl || s.pending?.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={(s.image?.thumbnailUrl ?? s.pending?.thumbnailUrl)!} alt="" className="size-full object-cover" />
              ) : (
                <span className="block size-full bg-cream-deep" />
              )}
            </button>
          </li>
        ))}
        {view.adding > 0 ? <li className="h-12 w-14 shrink-0 rounded-lg bg-surface-muted motion-safe:animate-pulse" role="status" aria-label="Creating one more slide" /> : null}
        {view.isOwner && n < CAROUSEL_MAX_SLIDES ? (
          <li className="shrink-0">
            <button
              type="button"
              onClick={() => setAdding(true)}
              disabled={view.adding > 0}
              aria-label="Generate one more"
              className="inline-flex h-12 w-14 items-center justify-center rounded-lg border border-border-soft bg-surface text-ink hover:bg-accent-softer disabled:opacity-50"
            >
              <Plus className="size-5" aria-hidden />
            </button>
          </li>
        ) : null}
      </ol>
      {view.addFailed && !view.adding ? <p className="text-[13px] text-ink-muted">Couldn&apos;t create one more slide. Try again.</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {adding ? <AddOneSheet artifactId={artifactId} onClose={() => setAdding(false)} onQueued={refresh} /> : null}
    </div>
  );
}
