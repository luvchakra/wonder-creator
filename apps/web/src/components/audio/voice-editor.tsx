"use client";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, cn } from "@wonder/ui";
import { Download, MoreHorizontal, Pause, Play, Scissors, Share2, Trash2, Undo2, Crop } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cut, encodeWav, isEdited, keptLength, nextPlayable, parseEdit, renderKept, trim, whole, type Range } from "@/lib/audio-edit";
import { clock } from "./use-recorder";

/** Decoded once at a voice-friendly rate, mono: small enough for a phone, clear enough to export. */
const RATE = 24_000;
const BARS = 120;

type Decoded = { samples: Float32Array; duration: number; peaks: Float32Array };

async function decode(src: string): Promise<Decoded> {
  const bytes = await (await fetch(src)).arrayBuffer();
  const ctx = new OfflineAudioContext(1, 1, RATE);
  const buf = await new Promise<AudioBuffer>((resolve, reject) => ctx.decodeAudioData(bytes, resolve, reject));
  const samples = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < ch.length; i++) samples[i]! += ch[i]! / buf.numberOfChannels;
  }
  const peaks = new Float32Array(BARS);
  const step = Math.max(1, Math.floor(samples.length / BARS));
  for (let b = 0; b < BARS; b++) {
    let max = 0;
    for (let i = b * step; i < Math.min(samples.length, (b + 1) * step); i++) max = Math.max(max, Math.abs(samples[i]!));
    peaks[b] = max;
  }
  const top = Math.max(...peaks, 0.01);
  for (let b = 0; b < BARS; b++) peaks[b] = peaks[b]! / top;
  return { samples, duration: buf.duration, peaks };
}

/** Time in the edited note for original time `t` (what the counter shows). */
function editedAt(keep: Range[], t: number) {
  let s = 0;
  for (const [a, b] of keep) {
    if (t >= b) s += b - a;
    else if (t > a) return s + (t - a);
    else break;
  }
  return s;
}

const extOf = (type: string) => (type.includes("mp4") || type.includes("aac") ? "m4a" : type.includes("ogg") ? "ogg" : type.includes("wav") ? "wav" : "webm");

/**
 * A voice note's editor (owner, 21 Oct 2026): play and pause; trim to a selection or cut it out, as many times as you
 * like (Undo steps back); export as WAV (with the edits) or the original recording; share to other apps through the
 * phone's own share sheet; delete. Edits never change the recording: they are the parts kept (`lib/audio-edit.ts`),
 * reported through `onChange` for the page to autosave. Select by dragging across the waveform, or with the two sliders.
 */
export function VoiceEditor({
  src,
  type,
  initialEdit,
  onChange,
  onDelete,
  status,
  name = "voice-note",
}: {
  src: string;
  /** The recording's media type (for "Original" export). */
  type: string;
  initialEdit?: unknown;
  onChange: (keep: Range[] | null) => void;
  onDelete?: () => void;
  /** The quiet save line from the page. */
  status?: string;
  name?: string;
}) {
  const [data, setData] = useState<Decoded | null>(null);
  const [failed, setFailed] = useState(false);
  const [keep, setKeep] = useState<Range[]>([]);
  const [history, setHistory] = useState<Range[][]>([]);
  const [sel, setSel] = useState<Range>([0, 0]);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const keepRef = useRef(keep);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    keepRef.current = keep;
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    let live = true;
    decode(src)
      .then((d) => {
        if (!live) return;
        const k = parseEdit(initialEdit, d.duration) ?? whole(d.duration);
        setData(d);
        setKeep(k);
        setSel([k[0]![0], k[k.length - 1]![1]]);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
    // The edit read at first load only; later changes come from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const duration = data?.duration ?? 0;
  const apply = useCallback(
    (next: Range[]) => {
      if (!next.length) {
        setNotice("That would cut everything. Delete the voice note instead if you don't want it.");
        return;
      }
      setNotice(null);
      setHistory((h) => [...h.slice(-49), keepRef.current]);
      setKeep(next);
      onChangeRef.current(isEdited(next, duration) ? next : null);
    },
    [duration],
  );
  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setKeep(prev);
    onChangeRef.current(isEdited(prev, duration) ? prev : null);
  };

  // Playback skips what was cut; a frame loop keeps the jump within a few milliseconds.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const a = audio.current;
      if (!a) return;
      const now = a.currentTime;
      const next = nextPlayable(keepRef.current, now);
      if (next === null) {
        a.pause();
        a.currentTime = keepRef.current[0]?.[0] ?? 0;
        setT(a.currentTime);
        return;
      }
      if (next > now + 0.02) a.currentTime = next;
      setT(a.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (!a.paused) return a.pause();
    const at = nextPlayable(keep, a.currentTime) ?? keep[0]?.[0] ?? 0;
    a.currentTime = at;
    void a.play();
  };

  // The waveform: kept parts in the accent, cuts faded, the selection tinted, the playhead a line.
  useEffect(() => {
    const c = canvas.current;
    if (!c || !data) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    c.width = w * dpr;
    c.height = h * dpr;
    const g = c.getContext("2d");
    if (!g) return;
    g.scale(dpr, dpr);
    const css = getComputedStyle(c);
    const accent = css.getPropertyValue("--color-accent").trim() || "#6b5ce7";
    const muted = css.getPropertyValue("--color-ink-subtle").trim() || "#9a96ad";
    g.clearRect(0, 0, w, h);
    const x = (s: number) => (s / duration) * w;
    g.fillStyle = accent;
    g.globalAlpha = 0.1;
    g.fillRect(x(sel[0]), 0, x(sel[1]) - x(sel[0]), h);
    const bw = w / BARS;
    for (let b = 0; b < BARS; b++) {
      const mid = ((b + 0.5) / BARS) * duration;
      const kept = keep.some(([a, e]) => mid >= a && mid < e);
      const bh = Math.max(2, data.peaks[b]! * (h - 8));
      g.globalAlpha = kept ? 1 : 0.25;
      g.fillStyle = kept ? accent : muted;
      g.fillRect(b * bw + bw * 0.2, (h - bh) / 2, bw * 0.6, bh);
    }
    g.globalAlpha = 1;
    g.fillStyle = css.getPropertyValue("--color-ink").trim() || "#1f1b3a";
    g.fillRect(x(t) - 1, 0, 2, h);
  }, [data, keep, sel, t, duration]);

  // Drag across the waveform to select; a tap moves the playhead.
  const drag = useRef<number | null>(null);
  const timeAt = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(duration, ((e.clientX - r.left) / r.width) * duration));
  };

  async function exportAs(kind: "wav" | "original", share = false) {
    if (!data) return;
    setNotice(null);
    let file: File;
    if (kind === "wav") {
      const wav = encodeWav(renderKept(data.samples, RATE, keep), RATE);
      file = new File([wav], `${name}.wav`, { type: "audio/wav" });
    } else {
      const blob = await (await fetch(src)).blob();
      file = new File([blob], `${name}.${extOf(type || blob.type)}`, { type: type || blob.type });
    }
    if (share) {
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: "Voice note" });
        } catch {
          /* the person closed the share sheet */
        }
        return;
      }
      setNotice("This browser can't share files to other apps, so it was downloaded instead.");
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  if (failed)
    return (
      <div className="space-y-2">
        <audio controls src={src} className="w-full" />
        <p className="text-[13px] text-ink-muted">Editing isn&apos;t available for this recording in this browser. It&apos;s saved as recorded.</p>
      </div>
    );

  const tool = "inline-flex size-11 items-center justify-center rounded-full text-ink hover:bg-black/5 disabled:opacity-40";
  const edited = data ? isEdited(keep, duration) : false;
  return (
    <div className="space-y-3">
      <audio ref={audio} src={src} preload="auto" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} className="hidden" />
      <p className="text-center font-display text-[32px] tabular-nums leading-none text-ink" aria-live="off">
        {clock(editedAt(keep, t))} <span className="text-[18px] text-ink-subtle">/ {clock(keptLength(keep))}</span>
      </p>
      <canvas
        ref={canvas}
        aria-hidden
        className={cn("h-24 w-full touch-none rounded-2xl bg-surface-muted/60", !data && "animate-pulse motion-reduce:animate-none")}
        onPointerDown={(e) => {
          if (!data) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = timeAt(e);
        }}
        onPointerMove={(e) => {
          if (drag.current === null) return;
          const now = timeAt(e);
          setSel([Math.min(drag.current, now), Math.max(drag.current, now)]);
        }}
        onPointerUp={(e) => {
          const start = drag.current;
          drag.current = null;
          if (start === null) return;
          const now = timeAt(e);
          if (Math.abs(now - start) < duration / 100) {
            if (audio.current) audio.current.currentTime = now;
            setT(now);
          }
        }}
      />
      {data ? (
        <div className="grid grid-cols-2 gap-3 text-[12.5px] text-ink-muted">
          <label className="space-y-0.5">
            <span>Selection start · {clock(sel[0])}</span>
            <input type="range" min={0} max={duration} step={0.1} value={sel[0]} onChange={(e) => setSel([Math.min(Number(e.target.value), sel[1]), sel[1]])} className="block h-11 w-full accent-[var(--color-accent)]" />
          </label>
          <label className="space-y-0.5">
            <span>Selection end · {clock(sel[1])}</span>
            <input type="range" min={0} max={duration} step={0.1} value={sel[1]} onChange={(e) => setSel([sel[0], Math.max(Number(e.target.value), sel[0])])} className="block h-11 w-full accent-[var(--color-accent)]" />
          </label>
        </div>
      ) : null}

      <div role="toolbar" aria-label="Edit the voice note" className="flex items-center justify-center gap-1">
        <button type="button" className={tool} disabled={!data} onClick={() => apply(trim(keep, sel[0], sel[1], duration))} aria-label="Trim to selection">
          <Crop className="size-5" aria-hidden />
        </button>
        <button type="button" className={tool} disabled={!data} onClick={() => apply(cut(keep, sel[0], sel[1], duration))} aria-label="Cut selection">
          <Scissors className="size-5" aria-hidden />
        </button>
        <button type="button" onClick={toggle} disabled={!data} aria-label={playing ? "Pause" : "Play"} className="mx-2 inline-flex size-14 items-center justify-center rounded-full bg-accent text-white shadow-[var(--shadow-card)] disabled:opacity-50">
          {playing ? <Pause className="size-6 fill-current" aria-hidden /> : <Play className="size-6 fill-current" aria-hidden />}
        </button>
        <button type="button" className={tool} disabled={!history.length} onClick={undo} aria-label="Undo">
          <Undo2 className="size-5" aria-hidden />
        </button>
        <Menu>
          <MenuTrigger asChild>
            <button type="button" className={tool} disabled={!data} aria-label="Export, share or delete">
              <MoreHorizontal className="size-5" aria-hidden />
            </button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem onSelect={() => void exportAs("wav", true)}>
              <Share2 className="size-4" aria-hidden /> Share to another app…
            </MenuItem>
            <MenuItem onSelect={() => void exportAs("wav")}>
              <Download className="size-4" aria-hidden /> Export as WAV{edited ? " (edited)" : ""}
            </MenuItem>
            <MenuItem onSelect={() => void exportAs("original")}>
              <Download className="size-4" aria-hidden /> Export the original ({extOf(type).toUpperCase()})
            </MenuItem>
            {onDelete ? (
              <>
                <MenuSeparator />
                <MenuItem destructive onSelect={onDelete}>
                  <Trash2 className="size-4" aria-hidden /> Delete
                </MenuItem>
              </>
            ) : null}
          </MenuContent>
        </Menu>
      </div>
      <p role="status" aria-live="polite" className="min-h-4 text-center text-[12.5px] text-ink-subtle">
        {notice ?? status ?? (edited ? "Edits don't change the recording; export and share use them." : "")}
      </p>
    </div>
  );
}
