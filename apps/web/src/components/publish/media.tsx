"use client";
import { clock } from "@wonder/creator-studio/publish";
import { Maximize2, Pause, Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { recordPublicEvent } from "./beacons";

/**
 * Watch (§11): cinematic. The film keeps its own shape — a vertical film sits on a restrained stage, never stretched
 * or cropped into landscape — and the page's chrome recedes once it plays.
 */
export function WatchRenderer({ workId, src, poster, title, vertical }: { workId: string; src: string; poster: string | null; title: string; vertical?: boolean }) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    document.documentElement.toggleAttribute("data-immersed", playing);
    return () => document.documentElement.removeAttribute("data-immersed");
  }, [playing]);
  return (
    <div className={vertical ? "mx-auto w-full max-w-[min(100%,calc(80dvh*0.5625))]" : "mx-auto w-full max-w-5xl"}>
      <video
        src={src}
        poster={poster ?? undefined}
        controls
        playsInline
        preload="metadata"
        aria-label={title}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          recordPublicEvent(workId, "complete");
        }}
        className={vertical ? "aspect-[9/16] w-full rounded-2xl bg-black object-contain" : "aspect-video w-full rounded-2xl bg-black object-contain"}
      />
    </div>
  );
}

/** Listen (§12): a listening experience — artwork, title, one clear play, progress, and the words when there are any. */
export function ListenRenderer({ workId, src, artwork, title, byline, durationSeconds }: { workId: string; src: string; artwork: string | null; title: string; byline: string; durationSeconds?: number | null }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [d, setD] = useState(durationSeconds ?? 0);
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
      {artwork ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={artwork} alt="" className="aspect-square w-full max-w-xs rounded-3xl object-cover shadow-2xl" />
      ) : null}
      <h1 className="mt-6 font-display text-[28px] leading-tight">{title}</h1>
      <p className="mt-1 text-[14px] opacity-75">{byline}</p>
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setD(e.currentTarget.duration || d)}
        onEnded={() => {
          setPlaying(false);
          recordPublicEvent(workId, "complete");
        }}
      />
      <button
        type="button"
        onClick={() => (audio.current?.paused ? void audio.current.play() : audio.current?.pause())}
        aria-label={playing ? `Pause ${title}` : `Play ${title}`}
        className="mt-6 inline-flex size-16 items-center justify-center rounded-full bg-white text-[#2b1f3a] shadow-lg"
      >
        {playing ? <Pause className="size-7" aria-hidden /> : <Play className="ml-1 size-7" aria-hidden />}
      </button>
      <label className="mt-5 w-full">
        <span className="sr-only">Position</span>
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.round(d))}
          value={Math.round(t)}
          onChange={(e) => {
            if (audio.current) audio.current.currentTime = Number(e.target.value);
          }}
          className="w-full accent-white"
          aria-valuetext={`${clock(t)} of ${clock(d)}`}
        />
      </label>
      <p className="mt-1 flex w-full justify-between text-[12px] tabular-nums opacity-70" aria-hidden>
        <span>{clock(t)}</span>
        <span>{d ? `-${clock(Math.max(0, d - t))}` : ""}</span>
      </p>
    </div>
  );
}

/** A poem's reading, offered beside the words — "▶ Listen · 1:42" — never taking over the page (§7). */
export function VoiceChip({ src, durationSeconds }: { src: string; durationSeconds?: number | null }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  return (
    <>
      <audio ref={audio} src={src} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
      <button type="button" onClick={() => (audio.current?.paused ? void audio.current.play() : audio.current?.pause())} className="inline-flex min-h-11 items-center">
        <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent-softer px-3 text-[13px] font-medium text-accent-ink">
          {playing ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
          {playing ? "Pause" : "Listen"}
          {durationSeconds ? ` · ${clock(durationSeconds)}` : ""}
        </span>
      </button>
    </>
  );
}

/** View (§9): the artwork dominates; full-screen on request, with pinch or wheel zoom there. */
export function ViewRenderer({ src, alt, surround }: { src: string; alt: string; surround: "light" | "dark" }) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  return (
    <>
      <figure className="relative mx-auto w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="mx-auto max-h-[82dvh] w-auto max-w-full object-contain" />
        <button type="button" onClick={() => setOpen(true)} aria-label="View full screen" className="absolute right-2 top-2 inline-flex size-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur">
          <Maximize2 className="size-4" aria-hidden />
        </button>
      </figure>
      {open ? (
        <div role="dialog" aria-modal="true" aria-label={alt || "Full screen"} className={surround === "dark" ? "fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-black" : "fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-[#f6f1ea]"}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            onWheel={(e) => setZoom((z) => Math.min(4, Math.max(1, z - e.deltaY * 0.002)))}
            onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2))}
            style={{ transform: `scale(${zoom})` }}
            className="max-h-full max-w-full object-contain transition-transform motion-reduce:transition-none"
          />
          <button type="button" onClick={() => setOpen(false)} aria-label="Close full screen" className="fixed right-3 top-3 inline-flex size-11 items-center justify-center rounded-full bg-black/50 text-white">
            <X className="size-5" aria-hidden />
          </button>
        </div>
      ) : null}
    </>
  );
}
