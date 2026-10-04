"use client";
import { craftOf } from "@wonder/creator-studio/craft";
import type { WritingStyle } from "@wonder/creator-studio/pages";
import { Button, Dialog, DialogContent, KIT } from "@wonder/ui";
import { Pause, Play, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/**
 * The Writing page's own tools, from the Palette (owner, 4 Oct 2026: "less about AI, more about supporting the writing
 * type"): the counts a writer of this kind looks at, and hearing it read by the device. Nothing is sent anywhere.
 */
export function CraftSheet({ open, onOpenChange, style, title, text }: { open: boolean; onOpenChange: (o: boolean) => void; style: WritingStyle; title: string; text: string }) {
  const view = useMemo(() => (open ? craftOf(style, title, text) : null), [open, style, title, text]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={view?.title ?? "Craft"} description="Counted here on your device — a guide, never a score." art={KIT.iconChip.type}>
        {view ? (
          <div className="space-y-3">
            <dl className="divide-y divide-border-soft rounded-2xl border border-border-soft">
              {view.facts.map((f) => (
                <div key={f.label} className="flex min-h-11 flex-wrap items-baseline justify-between gap-x-3 px-3 py-2">
                  <dt className="text-[13px] text-ink-muted">{f.label}</dt>
                  <dd className="text-[14px] font-medium tabular-nums text-ink">{f.value}</dd>
                  {f.note ? <dd className="w-full text-[12px] text-ink-subtle">{f.note}</dd> : null}
                </div>
              ))}
            </dl>
            {view.lines?.length ? (
              <ol aria-label="Lines" className="max-h-[40vh] overflow-y-auto rounded-2xl bg-surface-muted px-3 py-2 [scrollbar-width:thin]">
                {view.lines.map((l, i) => (
                  <li key={i} className="flex items-baseline gap-3 py-0.5">
                    <span className="min-w-0 flex-1 truncate font-display text-[14.5px] text-ink">{l.text}</span>
                    <span className="shrink-0 text-[12px] tabular-nums text-ink-subtle" aria-label={`${l.count} ${l.unit}`}>
                      {l.count}
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}
            {view.lines?.length ? <p className="text-[12px] text-ink-subtle">The number beside each line is its {view.lines[0].unit === "syllables" ? "syllables (an estimate)" : "words"}.</p> : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Read aloud with the device's own voice, in the language the words are in when it has one. */
export function AloudSheet({ open, onOpenChange, title, text, verse }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; text: string; verse: boolean }) {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [state, setState] = useState<"idle" | "speaking" | "paused">("idle");
  const [rate, setRate] = useState(verse ? 0.85 : 1);

  useEffect(() => {
    if (!open && supported) {
      window.speechSynthesis.cancel();
    }
  }, [open, supported]);
  useEffect(() => () => (supported ? window.speechSynthesis.cancel() : undefined), [supported]);

  function speak() {
    const synth = window.speechSynthesis;
    synth.cancel();
    const lang = /[ऀ-ॿ]/.test(text) ? "hi-IN" : document.documentElement.lang || navigator.language || "en";
    // A poem's line breaks become pauses; a stanza break a longer one.
    const body = verse ? text.replace(/\n\s*\n/g, ".\n\n").replace(/([^.!?,;:।])\n/g, "$1,\n") : text;
    const u = new SpeechSynthesisUtterance(`${title ? `${title}.\n\n` : ""}${body}`);
    u.lang = lang;
    u.rate = rate;
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
    if (voice) u.voice = voice;
    u.onend = () => setState("idle");
    u.onerror = () => setState("idle");
    synth.speak(u);
    setState("speaking");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Hear it read" description={verse ? "Listen for the rhythm and where the lines break." : "Hearing it catches what the eye skips."} art={KIT.iconChip.waveform}>
        {!supported ? (
          <p role="status" className="text-[14px] text-ink">
            This browser can&apos;t read aloud. Try another browser, or read it on its own page.
          </p>
        ) : !text.trim() ? (
          <p role="status" className="text-[14px] text-ink">
            Nothing to read yet.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {state === "speaking" ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    window.speechSynthesis.pause();
                    setState("paused");
                  }}
                >
                  <Pause className="size-4" aria-hidden /> Pause
                </Button>
              ) : (
                <Button
                  className="flex-1"
                  onClick={() => {
                    if (state === "paused") {
                      window.speechSynthesis.resume();
                      setState("speaking");
                    } else speak();
                  }}
                >
                  <Play className="size-4" aria-hidden /> {state === "paused" ? "Resume" : "Read it aloud"}
                </Button>
              )}
              {state !== "idle" ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    window.speechSynthesis.cancel();
                    setState("idle");
                  }}
                >
                  <Square className="size-4 fill-current" aria-hidden /> Stop
                </Button>
              ) : null}
            </div>
            <label className="flex min-h-11 items-center gap-3 text-[13px] text-ink-muted">
              Pace
              <input type="range" min={0.6} max={1.3} step={0.05} value={rate} onChange={(e) => setRate(Number(e.target.value))} disabled={state !== "idle"} className="h-11 flex-1 accent-[var(--color-accent,#6d5dfc)]" />
            </label>
            <p className="sr-only" role="status">
              {state === "speaking" ? "Reading aloud" : state === "paused" ? "Paused" : ""}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
