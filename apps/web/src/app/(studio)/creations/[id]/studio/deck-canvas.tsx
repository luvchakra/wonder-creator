"use client";
import { blankSlide, DECK_THEMES, DECK_THEME_LABEL, MAX_SLIDES, type Deck, type DeckSlide } from "@wonder/creator-studio/deck";
import { Dialog, DialogContent, cn } from "@wonder/ui";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, ImagePlus, NotebookText, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { SlideView } from "@/components/deck/slide-view";
import { YourPictures } from "@/components/images/your-pictures";
import { api, errorMessage } from "@/lib/client";

/**
 * The Presentation page's canvas (creation-pages.md, step 4): the current slide large, the strip of slides beneath.
 * Edit slide (the page's primary action) opens the slide's title, words and speaker notes beneath it; Add slide and
 * Present are the two secondaries; Theme and Print live under More. Every change autosaves as a version a moment after
 * the last edit. Present fills the screen: arrows, space or a tap move on; N shows the notes; Escape ends it.
 */
/** What the page's header, bottom bar and More sheet ask of the canvas — called from their own click handlers. */
export interface DeckControls {
  edit: () => void;
  add: () => void;
  present: () => void;
  theme: () => void;
  print: () => void;
}

export function DeckCanvas({ artifactId, title, initial, pictures: initialPictures, baseVersionId, controls, onKept }: { artifactId: string; title: string; initial: Deck; pictures: Record<string, string | null>; baseVersionId: string | null; controls: Ref<DeckControls>; onKept: (v: { id: string; version_number: number; content: string }) => void }) {
  const [deck, setDeck] = useState<Deck>(initial);
  // Each slide picture's address; ones chosen here join as they're picked.
  const [pictures, setPictures] = useState(initialPictures);
  const [choosing, setChoosing] = useState(false);
  const urlOf = (s: DeckSlide) => (s.image ? (pictures[s.image] ?? null) : null);
  const [at, setAt] = useState(0);
  const [editing, setEditing] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [theming, setTheming] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const base = useRef(baseVersionId);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(deck);
  const titleField = useRef<HTMLInputElement>(null);
  const slide = deck.slides[Math.min(at, deck.slides.length - 1)] ?? null;

  const save = useCallback(async () => {
    pending.current = null;
    setSaving("saving");
    try {
      const r = await api<{ version: { id: string; version_number: number; content: string } }>(`/api/v1/artifacts/${artifactId}/deck`, { method: "POST", json: { deck: latest.current, baseVersionId: base.current } });
      base.current = r.version.id;
      onKept(r.version);
      setSaving("saved");
      setError(null);
    } catch (e) {
      setSaving("idle");
      setError(errorMessage(e));
    }
  }, [artifactId, onKept]);

  // Autosave: the deck as it is, a moment after the last change.
  const change = useCallback(
    (next: Deck) => {
      latest.current = next;
      setDeck(next);
      setSaving("saving");
      if (pending.current) clearTimeout(pending.current);
      pending.current = setTimeout(() => void save(), 1000);
    },
    [save],
  );
  useEffect(() => () => void (pending.current && clearTimeout(pending.current)), []);

  const edit = (patch: Partial<DeckSlide>) => slide && change({ ...deck, slides: deck.slides.map((s) => (s.id === slide.id ? { ...s, ...patch } : s)) });
  const add = useCallback(() => {
    if (deck.slides.length >= MAX_SLIDES) return setError(`A deck holds up to ${MAX_SLIDES} slides.`);
    const i = deck.slides.length ? Math.min(at, deck.slides.length - 1) + 1 : 0;
    change({ ...deck, slides: [...deck.slides.slice(0, i), blankSlide(), ...deck.slides.slice(i)] });
    setAt(i);
    setEditing(true);
    requestAnimationFrame(() => titleField.current?.focus());
  }, [at, change, deck]);
  const move = (by: -1 | 1) => {
    const i = Math.min(at, deck.slides.length - 1);
    const j = i + by;
    if (j < 0 || j >= deck.slides.length) return;
    const slides = [...deck.slides];
    [slides[i], slides[j]] = [slides[j]!, slides[i]!];
    change({ ...deck, slides });
    setAt(j);
  };
  const remove = () => {
    if (!slide) return;
    change({ ...deck, slides: deck.slides.filter((s) => s.id !== slide.id) });
    setAt((x) => Math.max(0, Math.min(x, deck.slides.length - 2)));
  };
  const print = useCallback(() => {
    document.body.classList.add("printing-deck");
    const done = () => {
      document.body.classList.remove("printing-deck");
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
  }, []);

  // The page's header and bottom bar ask; the canvas answers. The handle is made once (the page keeps it in state) and
  // always calls the latest actions.
  const actions = useRef<DeckControls | null>(null);
  useEffect(() => {
    actions.current = {
      edit: () => (deck.slides.length ? setEditing((e) => !e) : add()),
      add,
      present: () => {
        if (deck.slides.length) setPresenting(true);
      },
      theme: () => setTheming(true),
      print,
    };
  });
  useImperativeHandle(
    controls,
    () => ({
      edit: () => actions.current?.edit(),
      add: () => actions.current?.add(),
      present: () => actions.current?.present(),
      theme: () => actions.current?.theme(),
      print: () => actions.current?.print(),
    }),
    [],
  );

  return (
    <div className="p-3 sm:p-4">
      {slide ? (
        <>
          <SlideView slide={slide} index={Math.min(at, deck.slides.length - 1)} theme={deck.theme} deckTitle={title} imageUrl={urlOf(slide)} className="rounded-2xl shadow-[var(--shadow-card)]" />
          <p className="mt-1.5 flex items-center justify-between text-[12px] text-ink-subtle" aria-live="polite">
            <span>
              Slide {Math.min(at, deck.slides.length - 1) + 1} of {deck.slides.length} · {DECK_THEME_LABEL[deck.theme]}
            </span>
            <span>{saving === "saving" ? "Saving…" : saving === "saved" ? "Saved" : ""}</span>
          </p>
        </>
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center rounded-2xl bg-[#f6efe3] text-center">
          <p className="font-display text-[22px] italic text-[#2b241c]">No slides yet.</p>
          <p className="mt-1 text-[13.5px] text-[#7a6d5e]">Add the first one — a title is enough to begin.</p>
        </div>
      )}

      {editing && slide ? (
        <div className="mt-3 space-y-2 rounded-2xl bg-surface-muted/60 p-3">
          <input ref={titleField} aria-label="Slide title" value={slide.title} maxLength={200} placeholder="A title" onChange={(e) => edit({ title: e.target.value })} className="block w-full rounded-xl border border-border-soft bg-surface px-3 py-2 font-display text-[18px] text-ink outline-none focus:border-accent" />
          <textarea aria-label="Words on the slide" value={slide.body} maxLength={2000} rows={4} placeholder={"What the slide says.\n- A line starting with a dash is a point"} onChange={(e) => edit({ body: e.target.value })} className="block w-full resize-y rounded-xl border border-border-soft bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-accent" />
          <textarea aria-label="Speaker notes" value={slide.notes} maxLength={4000} rows={2} placeholder="Speaker notes — only you see these while presenting" onChange={(e) => edit({ notes: e.target.value })} className="block w-full resize-y rounded-xl border border-border-soft bg-surface px-3 py-2 text-[13.5px] text-ink-muted outline-none focus:border-accent" />
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" onClick={() => setChoosing(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-accent-ink hover:underline">
              <ImagePlus className="size-4" aria-hidden /> {slide.image ? "Change the picture" : "Add a picture"}
            </button>
            {slide.image ? (
              <button type="button" onClick={() => edit({ image: null })} className="inline-flex min-h-11 items-center rounded-full px-2 text-[13px] text-ink-muted hover:text-ink">
                Remove the picture
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" onClick={() => move(-1)} disabled={at === 0} className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-[13px] text-ink-muted hover:text-ink disabled:opacity-40">
              <ArrowLeft className="size-4" aria-hidden /> Move earlier
            </button>
            <button type="button" onClick={() => move(1)} disabled={at >= deck.slides.length - 1} className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-[13px] text-ink-muted hover:text-ink disabled:opacity-40">
              Move later <ArrowRight className="size-4" aria-hidden />
            </button>
            <span className="flex-1" />
            <button type="button" onClick={remove} className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-[13px] text-danger hover:underline">
              <Trash2 className="size-4" aria-hidden /> Delete slide
            </button>
          </div>
        </div>
      ) : null}

      {deck.slides.length > 1 || editing ? (
        <ol aria-label="Slides" className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1">
          {deck.slides.map((s, i) => (
            <li key={s.id} className="w-28 shrink-0 snap-start">
              <button type="button" onClick={() => setAt(i)} aria-label={`Slide ${i + 1}: ${s.title || "untitled"}`} aria-current={i === Math.min(at, deck.slides.length - 1) ? "true" : undefined} className={cn("block w-full overflow-hidden rounded-lg ring-2 ring-offset-2 ring-offset-surface", i === Math.min(at, deck.slides.length - 1) ? "ring-accent" : "ring-transparent hover:ring-border")}>
                <SlideView slide={s} index={i} theme={deck.theme} deckTitle={title} imageUrl={urlOf(s)} small />
              </button>
            </li>
          ))}
        </ol>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 rounded-2xl bg-[#fdecec] px-3.5 py-2 text-[14px] text-danger">
          {error}
        </p>
      ) : null}

      {/* Theme: the three named palettes. */}
      <Dialog open={theming} onOpenChange={setTheming}>
        <DialogContent title="Theme" description="How every slide is set.">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {DECK_THEMES.map((t) => (
              <li key={t}>
                <button type="button" aria-pressed={deck.theme === t} onClick={() => (change({ ...deck, theme: t }), setTheming(false))} className={cn("block w-full rounded-xl p-1 text-left ring-2", deck.theme === t ? "ring-accent" : "ring-transparent hover:ring-border")}>
                  <SlideView slide={slide ?? blankSlide(title)} index={0} theme={t} deckTitle={title} imageUrl={slide ? urlOf(slide) : null} small />
                  <span className="mt-1 block px-1 text-[13px] font-medium text-ink">{DECK_THEME_LABEL[t]}</span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      {presenting ? <Presenter deck={deck} pictures={pictures} start={Math.min(at, deck.slides.length - 1)} deckTitle={title} onClose={(i) => (setPresenting(false), setAt(i))} /> : null}

      <Dialog open={choosing} onOpenChange={setChoosing}>
        <DialogContent title="A picture for this slide" description="One of your pictures — beside the words, or filling the slide when there are none.">
          <YourPictures
            busy={false}
            verb="Use"
            onPick={(id, url) => {
              setPictures((p) => ({ ...p, [id]: url }));
              edit({ image: id });
              setChoosing(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Print or save as PDF: every slide on its own landscape page (globals.css, .printing-deck). */}
      <div className="deck-print hidden" aria-hidden>
        {deck.slides.map((s, i) => (
          <SlideView key={s.id} slide={s} index={i} theme={deck.theme} deckTitle={title} imageUrl={urlOf(s)} />
        ))}
      </div>
    </div>
  );
}

/** Present: the slides fill the screen, one at a time; the notes on request. */
function Presenter({ deck, pictures, start, deckTitle, onClose }: { deck: Deck; pictures: Record<string, string | null>; start: number; deckTitle: string; onClose: (at: number) => void }) {
  const [i, setI] = useState(start);
  const [notes, setNotes] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const last = deck.slides.length - 1;
  const close = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    onClose(i);
  }, [i, onClose]);
  useEffect(() => {
    root.current?.focus();
    root.current?.requestFullscreen?.().catch(() => {});
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) setI((x) => Math.min(last, x + 1));
      else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) setI((x) => Math.max(0, x - 1));
      else if (e.key === "Escape") close();
      else if (e.key.toLowerCase() === "n") setNotes((n) => !n);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, last]);
  const slide = deck.slides[i]!;
  return (
    <div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Presenting" className="fixed inset-0 z-[70] flex flex-col bg-black outline-none">
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <div className="w-full max-w-[calc((100dvh-4rem)*16/9)]">
          <SlideView slide={slide} index={i} theme={deck.theme} deckTitle={deckTitle} imageUrl={slide.image ? (pictures[slide.image] ?? null) : null} />
        </div>
        {/* Tap zones for touch; the buttons below are the accessible controls. */}
        <div aria-hidden onClick={() => setI((x) => Math.max(0, x - 1))} className="absolute inset-y-0 left-0 w-1/4 cursor-w-resize" />
        <div aria-hidden onClick={() => setI((x) => Math.min(last, x + 1))} className="absolute inset-y-0 right-0 w-1/4 cursor-e-resize" />
      </div>
      {notes ? <p className="max-h-[30dvh] overflow-auto bg-[#15110e] px-5 py-3 text-[15px] leading-relaxed text-[#cbbfae]">{slide.notes || "No notes for this slide."}</p> : null}
      <div className="flex h-16 items-center justify-center gap-2 text-[13px] text-white/70">
        <button type="button" aria-label="Previous slide" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <span className="tabular-nums" aria-live="polite">
          {i + 1} / {deck.slides.length}
        </span>
        <button type="button" aria-label="Next slide" onClick={() => setI((x) => Math.min(last, x + 1))} disabled={i === last} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30">
          <ChevronRight className="size-5" aria-hidden />
        </button>
        <button type="button" aria-pressed={notes} onClick={() => setNotes((n) => !n)} className="ml-3 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 hover:bg-white/10">
          <NotebookText className="size-4" aria-hidden /> Notes
        </button>
        <button type="button" aria-label="End the presentation" onClick={close} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-white/10">
          <X className="size-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
