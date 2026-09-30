"use client";
import { Pause, Play, Share2 } from "lucide-react";
import { useRef, useState } from "react";

/** Share a Profile: the system share sheet where there is one, else copy the address. */
export function ShareProfile({ name, path, className }: { name: string; path: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = new URL(path, window.location.origin).toString();
    if (navigator.share) {
      try {
        await navigator.share({ title: name, url });
        return;
      } catch {
        /* cancelled: fall back to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* nothing else to do */
    }
  }
  return (
    <button type="button" onClick={() => void share()} className={className}>
      <Share2 className="size-3.5" aria-hidden /> {copied ? "Link copied" : "Share profile"}
      <span role="status" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
    </button>
  );
}

/**
 * An audio Moment's own player. It is ordinary page audio: starting it pauses CreativeRadio through the shell's
 * audio-focus rule, and nothing loads until the creator presses play.
 */
export function MomentAudio({ src, label }: { src: string; label: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={playing ? `Pause ${label}` : `Play ${label}`}
        onClick={() => {
          const el = ref.current;
          if (!el) return;
          if (el.paused) void el.play().catch(() => setPlaying(false));
          else el.pause();
        }}
        className="relative z-10 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-white before:absolute before:-inset-1 before:content-['']"
      >
        {playing ? <Pause className="size-4" aria-hidden /> : <Play className="ml-0.5 size-4" aria-hidden />}
      </button>
      <audio ref={ref} src={src} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
    </>
  );
}
