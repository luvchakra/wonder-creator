"use client";
import { cn } from "@wonder/ui";
import { Mic, Pause, Play, Video } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { RelativeTime } from "@/components/client-time";
import { api } from "@/lib/client";
import { SectionTitle } from "./section-title";

/**
 * "My captures ›" on Home (owner, 7 Oct 2026: "an option to look back on quick notes, voice notes etc from home page
 * itself"): the last things caught with Quick Capture — notes as a few lines, voice notes to play right here, pictures and
 * videos as small frames — in one quiet row under the four ways in. The title opens all of them (`/captures`); each
 * tile opens its Material. A new capture appears at once. Nothing shows until there's something to look back on.
 */
export type CaptureItem = { id: string; kind: "note" | "voice" | "photo" | "video"; text: string | null; title: string; seconds: number | null; mediaUrl: string | null; createdAt: string };
export const CAPTURED_EVENT = "wc:captured";

export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export function MyCaptures({ initial }: { initial: CaptureItem[] }) {
  const [items, setItems] = useState(initial);
  useEffect(() => {
    const refresh = () => void api<{ items: CaptureItem[] }>("/api/v1/captures?limit=10").then((r) => setItems(r.items)).catch(() => undefined);
    window.addEventListener(CAPTURED_EVENT, refresh);
    return () => window.removeEventListener(CAPTURED_EVENT, refresh);
  }, []);
  const player = useVoice();
  if (!items.length) return null;
  return (
    <section aria-labelledby="my-captures-title">
      <SectionTitle id="my-captures-title" href="/captures">
        My captures
      </SectionTitle>
      <ul aria-label="Recent captures" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {items.map((c) => (
          <li key={c.id} className="shrink-0">
            <CaptureTile c={c} player={player} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CaptureTile({ c, player }: { c: CaptureItem; player: ReturnType<typeof useVoice> }) {
  const tile = "relative flex h-[84px] overflow-hidden rounded-2xl border border-border-soft bg-surface/90 shadow-[var(--shadow-card)]";
  const when = <RelativeTime iso={c.createdAt} />;
  if (c.kind === "photo" && c.mediaUrl) {
    return (
      <Link href={`/materials/${c.id}`} aria-label={`Picture, ${c.title}`} className={cn(tile, "w-[84px]")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c.mediaUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      </Link>
    );
  }
  if (c.kind === "video") {
    return (
      <Link href={`/materials/${c.id}`} aria-label={`Video, ${c.title}`} className={cn(tile, "w-[84px] items-center justify-center bg-ink text-white")}>
        <Video className="size-5 opacity-90" aria-hidden />
        <span className="absolute bottom-1.5 left-2 text-[10.5px] tabular-nums opacity-80">{c.seconds ? clock(c.seconds) : when}</span>
      </Link>
    );
  }
  if (c.kind === "voice") {
    const on = player.playing === c.id;
    return (
      <div className={cn(tile, "w-44 items-center gap-2 bg-[linear-gradient(135deg,#f3eefb,#fbf6ef)] pl-2 pr-2.5")}>
        <button
          type="button"
          disabled={!c.mediaUrl}
          onClick={() => player.toggle(c.id, c.mediaUrl!)}
          aria-label={on ? "Pause the voice note" : `Play the voice note${c.seconds ? `, ${clock(c.seconds)}` : ""}`}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-white disabled:opacity-50"
        >
          {on ? <Pause className="size-4" aria-hidden /> : <Play className="ml-0.5 size-4" aria-hidden />}
        </button>
        <Link href={`/materials/${c.id}`} className="min-w-0 flex-1 py-2">
          <span className="flex items-center gap-1 text-[11.5px] text-ink-muted">
            <Mic className="size-3 text-accent" aria-hidden /> {c.seconds ? clock(c.seconds) : "Voice"} · {when}
          </span>
          <span className="mt-0.5 line-clamp-2 font-display text-[13px] italic leading-snug text-ink">{c.text ?? "Listen back"}</span>
        </Link>
      </div>
    );
  }
  return (
    <Link href={`/materials/${c.id}`} className={cn(tile, "w-44 flex-col justify-between bg-[#fffdf8] px-3 py-2")}>
      <span className="line-clamp-2 font-display text-[13.5px] leading-snug text-ink">{c.text ?? c.title}</span>
      <span className="text-[11px] text-ink-subtle">{when}</span>
    </Link>
  );
}

/** One voice note at a time, played right on Home; the background music steps aside on its own (media focus). */
export function useVoice() {
  const el = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => () => el.current?.pause(), []);
  return {
    playing,
    toggle(id: string, url: string) {
      if (playing === id) {
        el.current?.pause();
        setPlaying(null);
        return;
      }
      el.current?.pause();
      const a = new Audio(url);
      a.onended = () => setPlaying(null);
      el.current = a;
      void a.play().then(() => setPlaying(id)).catch(() => setPlaying(null));
    },
  };
}
