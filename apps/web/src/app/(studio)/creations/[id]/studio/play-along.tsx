"use client";
import type { PlayAlong, PlayAlongTrack } from "@wonder/creator-projects/parts-options";
import { clockOf } from "@wonder/creator-studio/audio";
import { cn } from "@wonder/ui";
import { Pause, Play } from "lucide-react";
import { useRef, useState } from "react";

/**
 * Play-along (creative-room-parts.md, step 3): the other parts of a Room's work, heard and read from this part's page.
 * The lyricist plays the tune while writing; the singer reads the words and plays the tune while recording. One track
 * plays at a time; playing one pauses CreativeRadio, as any sound on the page does. Nothing here changes anyone's part.
 */
export function PlayAlongBar({ tracks, className }: { tracks: PlayAlongTrack[]; className?: string }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const els = useRef(new Map<string, HTMLAudioElement>());
  if (!tracks.length) return null;
  return (
    <ul aria-label="Play along" className={cn("flex flex-wrap gap-1.5", className)}>
      {tracks.map((t) => {
        const on = playing === t.partId;
        return (
          <li key={t.partId}>
            <audio
              ref={(el) => {
                if (el) els.current.set(t.partId, el);
                else els.current.delete(t.partId);
              }}
              src={t.url}
              preload="none"
              onPlay={() => setPlaying(t.partId)}
              onPause={() => setPlaying((p) => (p === t.partId ? null : p))}
              onEnded={() => setPlaying((p) => (p === t.partId ? null : p))}
            />
            <button
              type="button"
              aria-pressed={on}
              aria-label={on ? `Pause ${t.title}` : `Play ${t.title} v${t.versionNumber}`}
              onClick={() => {
                const el = els.current.get(t.partId);
                if (!el) return;
                if (!el.paused) return el.pause();
                for (const [id, other] of els.current) if (id !== t.partId) other.pause();
                void el.play();
              }}
              className="inline-flex min-h-11 items-center"
            >
              <span className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium", on ? "border-accent bg-accent text-white" : "border-border-soft bg-surface/90 text-ink hover:bg-surface")}>
                {on ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
                {t.title} · v{t.versionNumber}
                {t.seconds ? <span className={cn("tabular-nums", on ? "text-white/80" : "text-ink-muted")}>{clockOf(t.seconds)}</span> : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** A writing part's words, readable from the Audio page; "Use these words" copies them into this take's words. */
export function PlayAlongWords({ words, onUse, compact = false }: { words: NonNullable<PlayAlong["words"]>; onUse?: (text: string) => void; compact?: boolean }) {
  return (
    <section aria-label={`${words.title} v${words.versionNumber}`} className="rounded-2xl bg-surface/80 px-3.5 py-2.5 ring-1 ring-border-soft">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
          {words.title} · v{words.versionNumber}
        </h3>
        {onUse ? (
          <button type="button" onClick={() => onUse(words.text)} className="inline-flex min-h-11 items-center text-[12.5px] font-medium text-accent-ink hover:underline">
            Use these words
          </button>
        ) : null}
      </div>
      <p className={cn("overflow-auto whitespace-pre-wrap font-display text-[15px] leading-relaxed text-ink", compact ? "max-h-40" : "max-h-56")}>{words.text}</p>
    </section>
  );
}
