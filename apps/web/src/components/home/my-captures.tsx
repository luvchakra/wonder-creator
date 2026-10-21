"use client";
import { nextPlayable, type Range } from "@/lib/audio-edit";
import { useEffect, useRef, useState } from "react";

/**
 * What My captures (`/captures`) and Quick Capture share. Home shows a door to My captures rather than a strip of tiles
 * (owner, 21 Oct 2026).
 */
export type CaptureItem = { id: string; kind: "note" | "voice" | "photo" | "video"; text: string | null; title: string; seconds: number | null; keep?: Range[] | null; mediaUrl: string | null; createdAt: string };
export const CAPTURED_EVENT = "wc:captured";

export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** One voice note at a time, played right on Home; the background music steps aside on its own (media focus). */
export function useVoice() {
  const el = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => () => el.current?.pause(), []);
  return {
    playing,
    toggle(id: string, url: string, keep?: Range[] | null) {
      if (playing === id) {
        el.current?.pause();
        setPlaying(null);
        return;
      }
      el.current?.pause();
      const a = new Audio(url);
      a.onended = () => setPlaying(null);
      // Trims and cuts made in the editor: start at the first kept part, skip what was cut, stop after the last.
      if (keep?.length) {
        a.currentTime = keep[0]![0];
        a.ontimeupdate = () => {
          const next = nextPlayable(keep, a.currentTime);
          if (next === null) {
            a.pause();
            setPlaying(null);
          } else if (next > a.currentTime + 0.05) a.currentTime = next;
        };
      }
      el.current = a;
      void a.play().then(() => setPlaying(id)).catch(() => setPlaying(null));
    },
  };
}
