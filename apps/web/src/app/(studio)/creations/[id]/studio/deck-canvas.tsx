"use client";
import { blankSlide, DECK_THEMES, DECK_THEME_LABEL, MAX_SLIDES, type Deck, type DeckSlide, type DeckTheme } from "@wonder/creator-studio/deck";
import { Dialog, DialogContent, KIT, KitArt, cn } from "@wonder/ui";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, NotebookText, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
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

/** The named palettes (CLAUDE.md, Colour), defined once for the deck: background, ink, quieter ink, and art. */
const THEMES: Record<DeckTheme, { surface: string; ink: string; muted: string; rule: string; art: "paper" | "dark" | "wash" }> = {
  paper: { surface: "bg-[#f6efe3]", ink: "text-[#2b241c]", muted: "text-[#7a6d5e]", rule: "bg-[#e2d6c3]", art: "paper" },
  cinematic: { surface: "bg-[radial-gradient(120%_90%_at_20%_10%,#2a2119_0%,#0d0b09_60%)]", ink: "text-[#f3ebe0]", muted: "text-[#cbbfae]", rule: "bg-[#e9ae6b]", art: "dark" },
  gradient: { surface: "bg-[linear-gradient(135deg,#ece8fb_0%,#f6f1f8_50%,#fbf3ee_100%)]", ink: "text-[#2a2440]", muted: "text-[#6b6380]", rule: "bg-[#c6bdf8]", art: "wash" },
};

export function DeckCanvas({ artifactId, title, initial, baseVersionId, controls, onKept }: { artifactId: string; title: string; initial: Deck; baseVersionId: string | null; controls: Ref<DeckControls>; onKept: (v: { id: string; version_number: number; content: string }) => void }) {
  const [deck, setDeck] = useState<Deck>(initial);
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
          <SlideView slide={slide} index={Math.min(at, deck.slides.length - 1)} theme={deck.theme} deckTitle={title} className="rounded-2xl shadow-[var(--shadow-card)]" />
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
                <SlideView slide={s} index={i} theme={deck.theme} deckTitle={title} small />
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
                  <SlideView slide={slide ?? blankSlide(title)} index={0} theme={t} deckTitle={title} small />
                  <span className="mt-1 block px-1 text-[13px] font-medium text-ink">{DECK_THEME_LABEL[t]}</span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      {presenting ? <Presenter deck={deck} start={Math.min(at, deck.slides.length - 1)} deckTitle={title} onClose={(i) => (setPresenting(false), setAt(i))} /> : null}

      {/* Print or save as PDF: every slide on its own landscape page (globals.css, .printing-deck). */}
      <div className="deck-print hidden" aria-hidden>
        {deck.slides.map((s, i) => (
          <SlideView key={s.id} slide={s} index={i} theme={deck.theme} deckTitle={title} />
        ))}
      </div>
    </div>
  );
}

/** One slide in its theme, at any size: the type scales with the slide (container units). The first slide is the title. */
export function SlideView({ slide, index, theme, deckTitle, small = false, className }: { slide: DeckSlide; index: number; theme: DeckTheme; deckTitle: string; small?: boolean; className?: string }) {
  const t = THEMES[theme];
  const lines = slide.body.split("\n").filter((l) => l.trim());
  const points = lines.length > 0 && lines.every((l) => /^\s*[-•*]\s+/.test(l));
  const opening = index === 0;
  return (
    <div className={cn("@container relative isolate aspect-video w-full overflow-hidden", t.surface, className)} aria-hidden={small || undefined}>
      {t.art === "paper" ? (
        <>
          <KitArt art={KIT.texture.texturePaper} sizes="40rem" className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-50" />
          <KitArt art={KIT.painted.leafSprigSage} sizes="12rem" className="pointer-events-none absolute -bottom-[6%] -right-[3%] -z-10 h-auto w-[22%] opacity-70" />
        </>
      ) : t.art === "wash" ? (
        <KitArt art={KIT.wash.washLavender} sizes="30rem" className="pointer-events-none absolute -right-[12%] -top-[20%] -z-10 h-auto w-[60%] opacity-70" />
      ) : null}
      <div className={cn("flex h-full flex-col px-[7cqw] py-[6cqw]", opening ? "items-center justify-center text-center" : "justify-start")}>
        <p className={cn("font-display leading-[1.12]", t.ink, opening ? "text-[7cqw]" : "text-[5cqw]")}>{slide.title || (opening ? deckTitle : "")}</p>
        {!opening ? <span className={cn("mt-[2cqw] block h-[0.35cqw] w-[8cqw] rounded-full", t.rule)} /> : null}
        {lines.length ? (
          points ? (
            <ul className={cn("mt-[3cqw] space-y-[1.4cqw] text-[2.9cqw] leading-snug", t.ink)}>
              {lines.map((l, i) => (
                <li key={i} className="flex gap-[1.4cqw]">
                  <span className={cn("mt-[1.1cqw] size-[0.9cqw] shrink-0 rounded-full", t.rule)} />
                  <span>{l.replace(/^\s*[-•*]\s+/, "")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={cn("mt-[3cqw] whitespace-pre-line leading-snug", opening ? cn("text-[2.8cqw]", t.muted) : cn("text-[3cqw]", t.ink))}>{slide.body}</p>
          )
        ) : null}
      </div>
    </div>
  );
}

/** Present: the slides fill the screen, one at a time; the notes on request. */
function Presenter({ deck, start, deckTitle, onClose }: { deck: Deck; start: number; deckTitle: string; onClose: (at: number) => void }) {
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
          <SlideView slide={slide} index={i} theme={deck.theme} deckTitle={deckTitle} />
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
