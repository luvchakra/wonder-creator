"use client";
import type { CarouselView } from "@wonder/creator-brain";
import { CAROUSEL_MAX_SLIDES } from "@wonder/creator-studio/carousel";
import { Button, Menu, MenuContent, MenuItem, MenuTrigger, cn } from "@wonder/ui";
import { ChevronDown, ChevronLeft, ChevronRight, GripVertical, PenLine, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStripSignal } from "@/components/creative-palette";
import { SlideFrame } from "@/components/carousel/slide-render";
import { api, errorMessage } from "@/lib/client";
import { AddOneSheet, Arrange, CarouselComposer } from "../carousel/composer";
import { DirectText } from "./direct-text";

/**
 * The Carousel on the Studio canvas (owner board, 28 Sep 2026): one slide fills the canvas with its words on it, "1 / N",
 * previous/next, and a "Refine text" chip on the slide. Under it, every slide as a numbered thumbnail with a grip —
 * drag one to reorder (Shift + arrow keys do the same without a drag; Arrange under More is the list way) — and a dashed
 * "Add slide". Tapping the slide opens the focused Slide Editor. Before there are slides, the Composer's own steps show
 * here unchanged.
 */
/** A result from outside the canvas ("Use this"): jump to that slide, refresh, and — for words — offer them to keep. */
export interface CanvasNews {
  key: number;
  slideId: string;
  proposal?: { text: string; live: boolean } | null;
}

export interface SlidesState {
  current: string | null;
  ids: string[];
  /** 0-based position of the slide on screen. */
  index: number;
  /** Its words (what's shown, else its source passage). */
  text: string;
}

export function CarouselCanvas({
  artifactId,
  initial,
  arrangeRequest,
  onSlides,
  news,
}: {
  artifactId: string;
  initial: CarouselView;
  arrangeRequest: number;
  /** The slide on screen (and its words) and the order, so "Use this" knows where to put things and Ask Community what to share. */
  onSlides?: (s: SlidesState) => void;
  news?: CanvasNews | null;
}) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [current, setCurrent] = useState(0);
  const [adding, setAdding] = useState(false);
  const [arranging, setArranging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const strip = useStripSignal();

  // "Arrange slides" in the Studio's More sheet bumps the counter; a new value opens Arrange (adjusted while rendering).
  const [seenArrange, setSeenArrange] = useState(arrangeRequest);
  if (arrangeRequest !== seenArrange) {
    setSeenArrange(arrangeRequest);
    if (view.slides.length > 1) setArranging(true);
  }

  const [incoming, setIncoming] = useState<{ slideId: string; proposal: { text: string; live: boolean } } | null>(null);
  const [seenNews, setSeenNews] = useState<number | null>(news?.key ?? null);

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

  // News from "Use this" (adjusted while rendering; the fetch runs in the effect below).
  const [jumpTo, setJumpTo] = useState<string | null>(null);
  if (news && news.key !== seenNews) {
    setSeenNews(news.key);
    const i = view.slides.findIndex((s) => s.id === news.slideId);
    if (i >= 0) setCurrent(i);
    // A slide that doesn't exist yet (just added): jump when the refresh brings it.
    else setJumpTo(news.slideId);
    setIncoming(news.proposal ? { slideId: news.slideId, proposal: news.proposal } : null);
  }
  const newsKey = news?.key ?? null;
  useEffect(() => {
    if (newsKey === null) return;
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, [newsKey, refresh]);

  if (jumpTo) {
    const i = view.slides.findIndex((s) => s.id === jumpTo);
    if (i >= 0) {
      setJumpTo(null);
      setCurrent(i);
    }
  }
  const slideIds = view.slides.map((s) => s.id).join(",");
  const currentIndex = Math.min(current, Math.max(0, view.slides.length - 1));
  const currentSlide = view.slides[currentIndex];
  const currentId = currentSlide?.id ?? null;
  const currentText = (currentSlide?.displayText || currentSlide?.sourceText || "").trim();
  useEffect(() => {
    onSlides?.({ current: currentId, ids: slideIds ? slideIds.split(",") : [], index: currentIndex, text: currentText });
  }, [currentId, slideIds, currentIndex, currentText, onSlides]);

  // The navbar says what's happening while arranging (Phase 04 §12): "Arrange 5 slides".
  const count = view.slides.length;
  useEffect(() => {
    if (!arranging) return;
    strip("arrange", { text: `Arrange ${count} slides`, tone: "active", priority: 5.5 });
    return () => strip("arrange", null);
  }, [arranging, count, strip]);

  useEffect(() => {
    if (view.adding) strip("carousel", { text: "Creating one more slide…", tone: "active" });
    else strip("carousel", null);
    return () => strip("carousel", null);
  }, [view.adding, strip]);

  // Reorder (§9): a drag in the strip, or Shift + arrows. Never regenerates anything.
  const move = useCallback(
    async (from: number, to: number) => {
      const n = view.slides.length;
      if (from === to || to < 0 || to >= n) return;
      const order = [...view.slides];
      const [s] = order.splice(from, 1);
      order.splice(to, 0, s!);
      setView((v) => ({ ...v, slides: order }));
      setCurrent(to);
      setNotice(`Slide moved to position ${to + 1} of ${n}`);
      try {
        await api(`/api/v1/carousels/${artifactId}/order`, { method: "POST", json: { slideIds: order.map((x) => x.id) } });
      } catch (e) {
        setError(errorMessage(e));
        await refresh();
      }
    },
    [artifactId, refresh, view.slides],
  );

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
  // A new image waiting for the creator's choice (a regenerated one, or their own photo from "Use this") shows in the
  // frame so they can judge it; the bar under the frame decides.
  const image = slide.pending?.url ?? slide.image?.url ?? null;
  const words = slide.displayText || slide.sourceText;
  const go = (to: number) => setCurrent(((to % n) + n) % n);
  // On phones the slide shrinks so the strip below it stays above the bottom bar on the first screen: its width follows
  // the height left after the app's chrome (header, top bar, format chip, strip, bottom bar; more with a caption),
  // never below 9rem, and never wider than the canvas. Larger screens have room and use the full width.
  const [aw, ah] = view.settings.aspectRatio.split(":").map(Number) as [number, number];
  const caption = !slide.overlay.enabled && !!words.trim();
  const direct = view.canEdit && slide.overlay.enabled && !!words.trim();
  const phoneWidth = `max(9rem, calc((100dvh - ${caption ? "26.5rem" : "22rem"} - var(--canvas-extra, 0rem)) * ${(aw && ah ? aw / ah : 0.8).toFixed(3)}))`;

  return (
    <div
      className="space-y-2"
      onKeyDown={(e) => {
        if (e.shiftKey || (e.target as HTMLElement).closest("[data-slide-thumb], [data-overlay-text]")) return;
        if (e.key === "ArrowLeft") go(idx - 1);
        if (e.key === "ArrowRight") go(idx + 1);
      }}
    >
      {/* The slide, big, as it will be seen. Tapping it opens the Slide Editor. */}
      <div
        style={{ ["--slide-w" as string]: phoneWidth }}
        className="mx-auto w-full max-w-[var(--slide-w)] overflow-hidden rounded-3xl border border-border-soft bg-surface shadow-[var(--shadow-card)] sm:max-w-none"
      >
        <div className="relative">
          <Link
            href={`/artifacts/${artifactId}/slides/${slide.id}`}
            className="block focus-visible:outline-2 focus-visible:outline-accent"
            aria-label={`Edit slide ${idx + 1} of ${n}: ${words.slice(0, 60)}`}
          >
            {/* Editable words are drawn by DirectText (below) so they can be moved and pinched right here. */}
            <SlideFrame image={image} overlay={slide.overlay} text={words} transform={slide.transform} aspect={view.settings.aspectRatio} className="w-full">
              {direct ? <></> : undefined}
            </SlideFrame>
          </Link>
          {direct ? <DirectText slideId={slide.id} overlay={slide.overlay} text={words} onOpen={() => router.push(`/artifacts/${artifactId}/slides/${slide.id}`)} onSaved={refresh} onError={setError} /> : null}
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
                className="absolute left-2 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur hover:bg-black/50"
              >
                <ChevronLeft className="size-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => go(idx + 1)}
                aria-label="Next slide"
                className="absolute right-2 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur hover:bg-black/50"
              >
                <ChevronRight className="size-5" aria-hidden />
              </button>
            </>
          ) : null}
          {view.canEdit ? (
            <RefineText
              key={`${slide.id}:${incoming?.slideId === slide.id ? seenNews : ""}`}
              artifactId={artifactId}
              slideId={slide.id}
              words={words}
              onChanged={refresh}
              initial={incoming?.slideId === slide.id ? incoming.proposal : null}
            />
          ) : null}
        </div>
        {slide.pending && view.canEdit ? <PendingChoice key={slide.id} slideId={slide.id} onDone={refresh} /> : null}
        {/* Words that aren't on the image: two lines on a phone (the slide editor has them all), under the frame. */}
        {caption ? <p className="line-clamp-2 whitespace-pre-line px-4 py-3 font-display text-[15px] leading-snug text-ink sm:line-clamp-none">{words}</p> : null}
      </div>

      {/* Every slide at a glance: numbered, with a grip to drag; "+" makes exactly one more (§7). */}
      <ol className="flex items-center gap-1.5 overflow-x-auto px-0.5 pb-1 pt-1 [scrollbar-width:none]" aria-label="Slides">
        {view.slides.map((s, i) => (
          <Thumb
            key={s.id}
            index={i}
            total={n}
            current={i === idx}
            thumbnail={s.image?.thumbnailUrl ?? s.pending?.thumbnailUrl ?? null}
            onSelect={() => setCurrent(i)}
            onMove={(to) => void move(i, to)}
            canMove={view.canEdit && n > 1}
          />
        ))}
        {view.adding > 0 ? <li className="h-[3.75rem] w-[4.5rem] shrink-0 rounded-xl bg-surface-muted motion-safe:animate-pulse" role="status" aria-label="Creating one more slide" /> : null}
        {view.isOwner && n < CAROUSEL_MAX_SLIDES ? (
          <li className="shrink-0">
            <button
              type="button"
              onClick={() => setAdding(true)}
              disabled={view.adding > 0}
              aria-label="Add slide"
              className="flex h-[3.75rem] w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-accent/50 bg-surface text-[11px] font-medium text-accent-ink hover:bg-accent-softer disabled:opacity-50"
            >
              <Plus className="size-4" aria-hidden />
              Add slide
            </button>
          </li>
        ) : null}
      </ol>
      <p className="sr-only" aria-live="polite">
        {notice}
      </p>
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

/** One numbered thumbnail. Drag it (past a few pixels) to reorder; a tap selects; Shift + arrows move it without a drag. */
function Thumb({
  index,
  total,
  current,
  thumbnail,
  onSelect,
  onMove,
  canMove,
}: {
  index: number;
  total: number;
  current: boolean;
  thumbnail: string | null;
  onSelect: () => void;
  onMove: (to: number) => void;
  canMove: boolean;
}) {
  const drag = useRef<{ x: number; y: number; started: boolean; to: number } | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const targetOf = (el: HTMLElement, clientX: number) => {
    const thumbs = Array.from(el.closest("ol")?.querySelectorAll<HTMLElement>("[data-slide-thumb]") ?? []);
    let to = index;
    thumbs.forEach((t, i) => {
      const r = t.getBoundingClientRect();
      if (i < index && clientX < r.left + r.width / 2 && to === index) to = i;
      if (i > index && clientX > r.left + r.width / 2) to = i;
    });
    return to;
  };
  return (
    <li className="shrink-0">
      <button
        type="button"
        data-slide-thumb=""
        onClick={(e) => {
          if (drag.current?.started) {
            e.preventDefault();
            return;
          }
          onSelect();
        }}
        onPointerDown={(e) => {
          if (!canMove || (e.pointerType === "mouse" && e.button !== 0)) return;
          drag.current = { x: e.clientX, y: e.clientY, started: false, to: index };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          if (!d.started) {
            if (Math.abs(dx) < 6 && Math.abs(e.clientY - d.y) < 6) return;
            d.started = true;
            setDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          setOffset(dx);
          d.to = targetOf(e.currentTarget, e.clientX);
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          if (d?.started) {
            e.currentTarget.releasePointerCapture(e.pointerId);
            setDragging(false);
            setOffset(0);
            if (d.to !== index) onMove(d.to);
            // The click that follows a drag isn't a tap; clear after it.
            setTimeout(() => {
              drag.current = null;
            }, 0);
            return;
          }
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
          setOffset(0);
        }}
        onKeyDown={(e) => {
          if (!canMove || !e.shiftKey) return;
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            onMove(index - 1);
          }
          if (e.key === "ArrowRight") {
            e.preventDefault();
            onMove(index + 1);
          }
        }}
        aria-label={`Slide ${index + 1} of ${total}`}
        aria-describedby={canMove ? "slide-thumb-hint" : undefined}
        aria-current={current ? "true" : undefined}
        style={offset ? { transform: `translateX(${offset}px)` } : undefined}
        className={cn(
          "relative block h-[3.75rem] w-[4.5rem] touch-pan-y select-none overflow-hidden rounded-xl border-2 bg-surface-muted focus-visible:outline-2 focus-visible:outline-accent",
          current ? "border-accent" : "border-transparent",
          dragging && "z-10 shadow-[var(--shadow-lift)]",
          canMove && "cursor-grab active:cursor-grabbing",
        )}
      >
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnail} alt="" draggable={false} className="size-full object-cover" />
        ) : (
          <span className="block size-full bg-cream-deep" />
        )}
        <span aria-hidden className="absolute bottom-1 left-1 inline-flex size-5 items-center justify-center rounded-md bg-accent text-[11px] font-semibold text-white">
          {index + 1}
        </span>
        {canMove ? <GripVertical aria-hidden className="absolute left-1 top-1 size-3.5 text-white/85 drop-shadow" /> : null}
      </button>
      {index === 0 && canMove ? (
        <span id="slide-thumb-hint" hidden>
          Drag to reorder, or hold Shift and press the left or right arrow.
        </span>
      ) : null}
    </li>
  );
}

const REFINES: Array<{ key: string; label: string; instruction: string }> = [
  { key: "rewrite", label: "Rewrite", instruction: "Rewrite these words with the same meaning, fresher." },
  { key: "shorten", label: "Shorten", instruction: "Make these words shorter and sharper, keeping the meaning." },
  { key: "expand", label: "Expand", instruction: "Say a little more, in the same voice." },
  { key: "tone", label: "Change tone", instruction: "Change the tone: warmer and more intimate, same meaning." },
];

/** "Refine text" on the slide: one menu, one suggestion at a time, the creator's choice to use it (carousel-composer.md §11). */
function RefineText({
  artifactId,
  slideId,
  words,
  onChanged,
  initial = null,
}: {
  artifactId: string;
  slideId: string;
  words: string;
  onChanged: () => Promise<void>;
  initial?: { text: string; live: boolean } | null;
}) {
  const router = useRouter();
  const [working, setWorking] = useState<string | null>(null);
  const [proposal, setProposal] = useState<{ text: string; live: boolean } | null>(initial);
  const [error, setError] = useState<string | null>(null);
  async function ask(r: (typeof REFINES)[number]) {
    setWorking(r.key);
    setError(null);
    try {
      setProposal(await api<{ live: boolean; text: string }>(`/api/v1/carousel-slides/${slideId}/refine-text`, { method: "POST", json: { instruction: r.instruction } }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(null);
    }
  }
  async function useNew() {
    if (!proposal) return;
    setWorking("use");
    try {
      await api(`/api/v1/carousel-slides/${slideId}`, { method: "PATCH", json: { displayText: proposal.text } });
      setProposal(null);
      await onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setWorking(null);
    }
  }
  return (
    <>
      <div className="absolute bottom-3 right-3">
        <Menu>
          <MenuTrigger asChild>
            <button
              type="button"
              disabled={!!working}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/90 px-3 text-[13px] font-medium text-accent-ink shadow-[var(--shadow-card)] backdrop-blur hover:bg-white disabled:opacity-70"
            >
              <Sparkles className="size-4 text-accent" aria-hidden />
              {working && working !== "use" ? "Working…" : "Refine text"}
              <ChevronDown className="size-3.5" aria-hidden />
            </button>
          </MenuTrigger>
          <MenuContent>
            {REFINES.map((r) => (
              <MenuItem key={r.key} onSelect={() => void ask(r)}>
                <Sparkles className="size-4 text-accent" aria-hidden /> {r.label}
              </MenuItem>
            ))}
            <MenuItem onSelect={() => router.push(`/artifacts/${artifactId}/slides/${slideId}`)}>
              <PenLine className="size-4" aria-hidden /> Edit the words…
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
      {proposal || error ? (
        <div className="border-t border-border-soft px-4 py-3" role="region" aria-label="New words for this slide">
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          {proposal ? (
            <>
              <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-ink-subtle">New words {proposal.live ? "" : "· offline placeholder, not real writing"}</p>
              <p className="mt-1 whitespace-pre-line text-[14px] leading-snug text-ink">{proposal.text}</p>
              <p className="mt-1 line-clamp-2 text-[12.5px] text-ink-subtle">Current: {words}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" loading={working === "use"} onClick={useNew}>
                  Use new
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setProposal(null)}>
                  Keep current
                </Button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/** "Use new / Keep current" for an image waiting on this slide (carousel-composer.md §27). Nothing replaces until chosen. */
function PendingChoice({ slideId, onDone }: { slideId: string; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState<"use" | "keep" | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function choose(choice: "use" | "keep") {
    setBusy(choice);
    setError(null);
    try {
      await api(`/api/v1/carousel-slides/${slideId}/choose`, { method: "POST", json: { choice } });
      await onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  return (
    <div role="region" aria-label="New image for this slide" className="flex flex-wrap items-center gap-2 border-t border-border-soft px-4 py-2.5">
      <span className="flex-1 text-[13px] text-ink">New image on this slide</span>
      {error ? (
        <span role="alert" className="w-full text-[12.5px] text-danger">
          {error}
        </span>
      ) : null}
      <Button size="sm" variant="ghost" loading={busy === "keep"} disabled={!!busy} onClick={() => choose("keep")}>
        Keep current
      </Button>
      <Button size="sm" loading={busy === "use"} disabled={!!busy} onClick={() => choose("use")}>
        Use new
      </Button>
    </div>
  );
}
